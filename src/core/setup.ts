import { ENEMIES, GENERALS, STAGES, SYNERGIES, enemyById, generalById, stageById } from '../data';
import { enemyMult, statMult } from './progression';
import type {
  BattleCombo,
  BattleSetup,
  BattleUnitInit,
  SaveData,
  StageDef,
  SynergyBonus,
  SynergyDef,
} from './types';

/** 当前阵容中成立的羁绊（所有成员都在阵上） */
export function activeSynergies(ids: (string | null)[]): SynergyDef[] {
  const set = new Set(ids.filter((x): x is string => !!x));
  return SYNERGIES.filter((s) => s.members.every((m) => set.has(m)));
}

export function sumBonus(syns: SynergyDef[]): Required<SynergyBonus> {
  const t = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const s of syns) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += s.bonus[k] ?? 0;
  return t;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export function generalStats(save: SaveData, id: string, withBonus: Required<SynergyBonus> | null = null): Stats {
  const g = generalById(id);
  const r = save.roster[id];
  const m = statMult(r?.level ?? 1, r?.adv ?? 0);
  const b = withBonus ?? { hp: 0, atk: 0, def: 0, spd: 0 };
  return {
    hp: Math.round(g.hp * m * (1 + b.hp)),
    atk: Math.round(g.atk * m * (1 + b.atk)),
    def: Math.round(g.def * m * (1 + b.def)),
    spd: Math.round(g.spd * (1 + b.spd)), // 速度不随等级成长，只受羁绊影响
  };
}

export function powerOf(s: Stats): number {
  return Math.round(s.hp / 10 + s.atk * 1.5 + s.def * 1.2 + s.spd * 0.5);
}

export function formationPower(save: SaveData): number {
  const bonus = sumBonus(activeSynergies(save.formation));
  return save.formation.reduce((acc, id) => (id ? acc + powerOf(generalStats(save, id, bonus)) : acc), 0);
}

export function buildSetup(save: SaveData, stage: StageDef, seed: number): BattleSetup {
  const syns = activeSynergies(save.formation);
  const bonus = sumBonus(syns);
  const allies: BattleUnitInit[] = [];
  save.formation.forEach((id, slot) => {
    if (!id) return;
    const g = generalById(id);
    const st = generalStats(save, id, bonus);
    allies.push({
      uid: `a${slot}`,
      side: 'ally',
      slot,
      unitId: id,
      name: g.name,
      role: g.role,
      faction: g.faction,
      ...st,
      basic: g.basic,
      ultimate: g.ultimate,
      startRage: 1,
    });
  });
  const enemies: BattleUnitInit[] = stage.enemies.map((se) => {
    const e = enemyById(se.unit);
    const m = enemyMult(se.level);
    return {
      uid: `e${se.slot}`,
      side: 'enemy',
      slot: se.slot,
      unitId: e.id,
      name: e.name,
      role: e.role,
      boss: e.boss,
      hp: Math.round(e.hp * m),
      atk: Math.round(e.atk * m),
      def: Math.round(e.def * m),
      spd: e.spd,
      basic: e.basic,
      ultimate: e.ultimate,
      startRage: 1,
    };
  });
  const combos: BattleCombo[] = [];
  for (const s of syns) {
    if (s.combo) combos.push({ ...s.combo, requires: s.members.filter((m) => m !== s.combo!.lead) });
  }
  return { allies, enemies, combos, seed };
}

export { ENEMIES, GENERALS, STAGES, stageById };
