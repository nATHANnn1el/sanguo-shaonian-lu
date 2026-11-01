/** 核心类型定义（与 docs/schema/*.json 保持一致） */

export type Faction = 'shu' | 'wei';
export type Role = 'warrior' | 'strategist' | 'guardian' | 'support';
export type BuffStat = 'atk' | 'def' | 'spd';

export type TargetSel =
  | 'enemy-front' // 敌方最靠前（前排优先，编号小者优先）的单体
  | 'enemy-back' // 敌方后排优先的单体（后排死光才打前排）
  | 'enemy-back-2' // 敌方后排优先的两个目标
  | 'enemy-all'
  | 'enemy-lowest-hp' // 当前生命值最低的敌人
  | 'enemy-top-atk' // 攻击最高的敌人
  | 'self'
  | 'ally-all'
  | 'ally-lowest-hp'; // 生命比例最低的友军

export type Effect =
  | { type: 'damage'; mult: number; target: TargetSel; hits?: number; lifesteal?: number }
  | { type: 'heal'; mult: number; target: TargetSel }
  | { type: 'shield'; mult: number; target: TargetSel } // 护盾值 = 施法者最大生命 × mult
  | { type: 'buff'; stat: BuffStat; pct: number; turns: number; target: TargetSel }
  | { type: 'dot'; mult: number; turns: number; target: TargetSel } // 灼烧：每回合 施法者攻击 × mult
  | { type: 'rage'; amount: number; target: TargetSel }
  | { type: 'taunt'; turns: number }
  | { type: 'silence'; turns: number; target: TargetSel };

export interface Skill {
  name: string;
  desc: string;
  effects: Effect[];
}

export interface Look {
  skin: string;
  hair: 'topknot' | 'long' | 'helmet' | 'hat' | 'crown' | 'bandana' | 'hood';
  beard: 'none' | 'short' | 'long';
  armor: string;
  accent: string;
  weapon: 'blade' | 'spear' | 'fan' | 'sword' | 'halberd' | 'bow' | 'staff' | 'axe';
}

export interface UnitBase {
  id: string;
  name: string;
  title: string;
  role: Role;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  basic: Skill;
  ultimate: Skill;
  look: Look;
}

export interface GeneralDef extends UnitBase {
  faction: Faction;
  bio: string;
  /** 'start' 表示初始拥有；否则为通关后解锁的关卡 id */
  unlock: string;
}

export interface EnemyDef extends UnitBase {
  boss?: boolean;
}

export interface SynergyBonus {
  hp?: number;
  atk?: number;
  def?: number;
  spd?: number;
}

export interface ComboDef {
  /** 释放合击的武将（发起者） */
  lead: string;
  skill: Skill;
}

export interface SynergyDef {
  id: string;
  name: string;
  desc: string;
  members: string[];
  bonus: SynergyBonus;
  combo?: ComboDef;
}

export interface StageEnemy {
  unit: string;
  slot: number; // 0-2 前排，3-5 后排
  level: number;
}

export interface StageDef {
  id: string;
  chapter: number;
  index: number;
  name: string;
  intro: string;
  recommended: number; // 建议战力
  enemies: StageEnemy[];
  rewards: { gold: number; stones: number; firstClearGold: number; unlockGeneral?: string };
}

/* ---------- 战斗 ---------- */

export type Side = 'ally' | 'enemy';

export interface BattleUnitInit {
  uid: string; // a0..a5 / e0..e5
  side: Side;
  slot: number;
  unitId: string;
  name: string;
  role: Role;
  faction?: Faction;
  boss?: boolean;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  basic: Skill;
  ultimate: Skill;
  startRage: number;
}

export interface BattleCombo extends ComboDef {
  /** 释放合击时必须同时存活的其他羁绊成员 */
  requires: string[];
}

export interface BattleSetup {
  allies: BattleUnitInit[];
  enemies: BattleUnitInit[];
  /** 友方生效的合击（已确认羁绊成立） */
  combos: BattleCombo[];
  seed: number;
  maxRounds?: number;
}

export interface UnitSnap {
  uid: string;
  hp: number;
  maxHp: number;
  rage: number;
  shield: number;
}

export type BattleEvent =
  | { t: 'start'; units: UnitSnap[] }
  | { t: 'round'; round: number; order: string[] }
  | { t: 'turn'; uid: string }
  | { t: 'cast'; uid: string; kind: 'basic' | 'ultimate' | 'combo'; skill: string; targets: string[] }
  | { t: 'damage'; uid: string; src: string; amount: number; absorbed: number; crit: boolean; hp: number; shield: number; source: 'hit' | 'dot' }
  | { t: 'heal'; uid: string; amount: number; hp: number }
  | { t: 'shield'; uid: string; amount: number; shield: number }
  | { t: 'rage'; uid: string; delta: number; rage: number }
  | { t: 'buff'; uid: string; label: string; good: boolean }
  | { t: 'status'; uid: string; label: string }
  | { t: 'death'; uid: string }
  | { t: 'end'; winner: Side; reason: 'annihilation' | 'timeout'; rounds: number };

export interface BattleResult {
  events: BattleEvent[];
  winner: Side;
  reason: 'annihilation' | 'timeout';
  rounds: number;
  allyAlive: number;
  allyTotal: number;
}

/* ---------- 存档 ---------- */

export interface RosterEntry {
  owned: boolean;
  level: number;
  adv: number;
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  resources: { gold: number; stones: number };
  roster: Record<string, RosterEntry>;
  /** 6 个阵位（0-2 前排，3-5 后排），存武将 id 或 null */
  formation: (string | null)[];
  progress: Record<string, { stars: number; clears: number }>;
  settings: { speed: 1 | 2 | 4 };
  stats: { battles: number; wins: number };
}
