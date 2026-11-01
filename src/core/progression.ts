import type { RosterEntry, SaveData } from './types';

/** 成长规则（见 docs/battle-rules.md §成长） */
export const PROG = {
  LEVEL_STEP: 0.1, // 每级 +10% 基础属性
  ADV_STEP: 0.15, // 每阶 +15%
  MAX_ADV: 3,
  BASE_CAP: 10,
  CAP_PER_ADV: 5,
} as const;

export const levelCap = (adv: number) => PROG.BASE_CAP + PROG.CAP_PER_ADV * adv;
export const statMult = (level: number, adv: number) =>
  (1 + PROG.LEVEL_STEP * (level - 1)) * (1 + PROG.ADV_STEP * adv);
export const enemyMult = (level: number) => 1 + PROG.LEVEL_STEP * (level - 1);

export const levelUpCost = (level: number) => 30 + 15 * level;
export const advanceCost = (adv: number) => 2 * (adv + 1);

export type ProgResult = { ok: true } | { ok: false; reason: string };

export function canLevelUp(save: SaveData, id: string): ProgResult {
  const r = save.roster[id];
  if (!r?.owned) return { ok: false, reason: '尚未拥有该武将' };
  if (r.level >= levelCap(r.adv)) return { ok: false, reason: '已达等级上限，请先进阶' };
  if (save.resources.gold < levelUpCost(r.level)) return { ok: false, reason: '银两不足' };
  return { ok: true };
}

export function levelUp(save: SaveData, id: string): ProgResult {
  const c = canLevelUp(save, id);
  if (!c.ok) return c;
  const r = save.roster[id];
  save.resources.gold -= levelUpCost(r.level);
  r.level += 1;
  return { ok: true };
}

export function canAdvance(save: SaveData, id: string): ProgResult {
  const r = save.roster[id];
  if (!r?.owned) return { ok: false, reason: '尚未拥有该武将' };
  if (r.adv >= PROG.MAX_ADV) return { ok: false, reason: '已进阶至最高' };
  if (r.level < levelCap(r.adv)) return { ok: false, reason: `需先升至 ${levelCap(r.adv)} 级` };
  if (save.resources.stones < advanceCost(r.adv)) return { ok: false, reason: '将魂石不足' };
  return { ok: true };
}

export function advance(save: SaveData, id: string): ProgResult {
  const c = canAdvance(save, id);
  if (!c.ok) return c;
  const r = save.roster[id];
  save.resources.stones -= advanceCost(r.adv);
  r.adv += 1;
  return { ok: true };
}

export const newEntry = (): RosterEntry => ({ owned: true, level: 1, adv: 0 });
