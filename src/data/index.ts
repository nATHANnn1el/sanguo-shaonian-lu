import generalsJson from './generals.json';
import enemiesJson from './enemies.json';
import synergiesJson from './synergies.json';
import stagesJson from './stages.json';
import type { EnemyDef, GeneralDef, StageDef, SynergyDef } from '../core/types';

export const GENERALS = generalsJson as unknown as GeneralDef[];
export const ENEMIES = enemiesJson as unknown as EnemyDef[];
export const SYNERGIES = synergiesJson as unknown as SynergyDef[];
export const STAGES = stagesJson as unknown as StageDef[];

export const generalById = (id: string): GeneralDef => {
  const g = GENERALS.find((x) => x.id === id);
  if (!g) throw new Error(`未知武将: ${id}`);
  return g;
};
export const enemyById = (id: string): EnemyDef => {
  const e = ENEMIES.find((x) => x.id === id);
  if (!e) throw new Error(`未知敌人: ${id}`);
  return e;
};
export const stageById = (id: string): StageDef => {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`未知关卡: ${id}`);
  return s;
};
export const unitName = (id: string): string => {
  return GENERALS.find((x) => x.id === id)?.name ?? ENEMIES.find((x) => x.id === id)?.name ?? id;
};
