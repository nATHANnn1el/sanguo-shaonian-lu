import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENEMIES, GENERALS, STAGES, SYNERGIES } from '../src/data';
import { newSave } from '../src/core/save';

const sch = (n: string) => JSON.parse(readFileSync(resolve(__dirname, '../docs/schema', n), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(sch('common.schema.json'));
const cache = new Map<string, ReturnType<typeof ajv.compile>>();
const v = (n: string, data: unknown) => {
  if (!cache.has(n)) cache.set(n, ajv.compile(sch(n)));
  const fn = cache.get(n)!;
  const ok = fn(data);
  return { ok, errors: fn.errors };
};

describe('数据通过 JSON Schema 校验', () => {
  it.each([
    ['general.schema.json', GENERALS],
    ['enemy.schema.json', ENEMIES],
    ['synergy.schema.json', SYNERGIES],
    ['stage.schema.json', STAGES],
  ])('%s', (name, data) => {
    const r = v(name, data);
    expect(r.errors).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('初始存档通过 save.schema.json', () => {
    const r = v('save.schema.json', newSave());
    expect(r.errors).toBeNull();
  });

  it('Schema 能拒绝非法数据（负向）', () => {
    const bad = JSON.parse(JSON.stringify(GENERALS));
    bad[0].faction = 'wu';
    expect(v('general.schema.json', bad).ok).toBe(false);
    const bad2 = JSON.parse(JSON.stringify(STAGES));
    bad2[0].enemies[0].slot = 9;
    expect(v('stage.schema.json', bad2).ok).toBe(false);
  });
});

describe('数据引用完整性与规模', () => {
  it('12 名武将，蜀魏各 6，id 唯一', () => {
    expect(GENERALS).toHaveLength(12);
    expect(GENERALS.filter((g) => g.faction === 'shu')).toHaveLength(6);
    expect(GENERALS.filter((g) => g.faction === 'wei')).toHaveLength(6);
    expect(new Set(GENERALS.map((g) => g.id)).size).toBe(12);
  });
  it('4 个羁绊，成员存在，且至少 1 个含合击，合击发起者属于成员', () => {
    expect(SYNERGIES).toHaveLength(4);
    const ids = new Set(GENERALS.map((g) => g.id));
    for (const s of SYNERGIES) {
      s.members.forEach((m) => expect(ids.has(m)).toBe(true));
      if (s.combo) expect(s.members).toContain(s.combo.lead);
    }
    expect(SYNERGIES.filter((s) => s.combo).length).toBeGreaterThanOrEqual(1);
  });
  it('10 个关卡，敌人引用有效、阵位不重复，解锁武将引用有效', () => {
    expect(STAGES).toHaveLength(10);
    const eids = new Set(ENEMIES.map((e) => e.id));
    const gids = new Set(GENERALS.map((g) => g.id));
    for (const s of STAGES) {
      expect(new Set(s.enemies.map((e) => e.slot)).size).toBe(s.enemies.length);
      s.enemies.forEach((e) => expect(eids.has(e.unit)).toBe(true));
      if (s.rewards.unlockGeneral) expect(gids.has(s.rewards.unlockGeneral)).toBe(true);
    }
  });
  it('每个非初始武将恰好由一个关卡解锁，且与其 unlock 字段一致', () => {
    for (const g of GENERALS) {
      if (g.unlock === 'start') continue;
      const st = STAGES.filter((s) => s.rewards.unlockGeneral === g.id);
      expect(st).toHaveLength(1);
      expect(st[0].id).toBe(g.unlock);
    }
  });
  it('技能文本与数值一致：描述里的百分比出现在效果中（抽查伤害倍率）', () => {
    for (const g of GENERALS) {
      const d = g.basic.effects[0];
      if (d.type === 'damage') expect(g.basic.desc).toContain(`${Math.round(d.mult * 100)}%`);
    }
  });
});
