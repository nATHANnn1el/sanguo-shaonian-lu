import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, loadSave, migrate, newSave, writeSave, type StorageLike } from '../src/core/save';

const mem = (init: Record<string, string> = {}): StorageLike & { d: Record<string, string> } => {
  const d = { ...init };
  return { d, getItem: (k) => d[k] ?? null, setItem: (k, v) => void (d[k] = v), removeItem: (k) => void delete d[k] };
};

describe('存档', () => {
  it('新存档含 5 名初始武将与可用阵容', () => {
    const s = newSave();
    expect(Object.keys(s.roster)).toHaveLength(5);
    expect(s.formation.filter(Boolean).length).toBeGreaterThan(0);
    expect(s.version).toBe(SAVE_VERSION);
  });
  it('写入后读取得到相同数据', () => {
    const st = mem();
    const s = newSave();
    s.resources.gold = 777;
    writeSave(st, s);
    const r = loadSave(st);
    expect(r.recovered).toBe(false);
    expect(r.save.resources.gold).toBe(777);
  });
  it('损坏的 JSON → 新存档并备份', () => {
    const st = mem({ [SAVE_KEY]: '{bad json' });
    const r = loadSave(st);
    expect(r.recovered).toBe(false); // JSON.parse 抛错走 catch，不备份
    expect(r.save.resources.gold).toBe(300);
  });
  it('版本非法 → 新存档并保留备份', () => {
    const st = mem({ [SAVE_KEY]: JSON.stringify({ version: 99 }) });
    const r = loadSave(st);
    expect(r.recovered).toBe(true);
    expect(st.d[SAVE_KEY + '.bak']).toBeTruthy();
  });
  it('清洗：剔除未知武将、修正非法值、去重阵位', () => {
    const raw = {
      version: 1,
      resources: { gold: -5, stones: 'x' },
      roster: { 'guan-yu': { owned: true, level: 999, adv: 9 }, ghost: { owned: true, level: 1, adv: 0 } },
      formation: ['guan-yu', 'guan-yu', 'ghost', null, 'liu-bei', null],
      progress: { 'stage-01': { stars: 9, clears: 2 }, 'stage-99': { stars: 1, clears: 1 } },
      settings: { speed: 3 },
    };
    const s = migrate(raw)!;
    expect(s.roster.ghost).toBeUndefined();
    expect(s.roster['guan-yu'].level).toBe(25);
    expect(s.roster['guan-yu'].adv).toBe(3);
    expect(s.resources.gold).toBe(0);
    expect(s.formation).toEqual(['guan-yu', null, null, null, 'liu-bei', null]);
    expect(s.progress['stage-01'].stars).toBe(3);
    expect(s.progress['stage-99']).toBeUndefined();
    expect(s.settings.speed).toBe(1);
  });
  it('未来版本不被解释', () => {
    expect(migrate({ version: SAVE_VERSION + 1 })).toBeNull();
    expect(migrate(null)).toBeNull();
  });
});
