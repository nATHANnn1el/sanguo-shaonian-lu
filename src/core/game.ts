import { GENERALS, STAGES, stageById } from '../data';
import { newEntry } from './progression';
import { runBattle } from './battle';
import { buildSetup } from './setup';
import type { BattleResult, SaveData, StageDef } from './types';

export interface ClearOutcome {
  stars: number;
  gold: number;
  stones: number;
  first: boolean;
  unlocked?: string;
}

/** 星级：存活人数 = 上阵人数 → 3 星；损失 1 人 → 2 星；其余胜利 → 1 星 */
export function starsFor(result: BattleResult): number {
  if (result.winner !== 'ally') return 0;
  const lost = result.allyTotal - result.allyAlive;
  return lost === 0 ? 3 : lost === 1 ? 2 : 1;
}

/** 执行一场战斗并结算（会修改 save）；返回战斗结果与奖励 */
export function fightStage(save: SaveData, stageId: string, seed: number): { result: BattleResult; outcome: ClearOutcome | null; stage: StageDef } {
  const stage = stageById(stageId);
  const result = runBattle(buildSetup(save, stage, seed));
  save.stats.battles += 1;
  if (result.winner !== 'ally') return { result, outcome: null, stage };
  save.stats.wins += 1;
  const stars = starsFor(result);
  const prev = save.progress[stage.id];
  const first = !prev;
  const gold = stage.rewards.gold + (first ? stage.rewards.firstClearGold : 0);
  const stones = stage.rewards.stones;
  save.resources.gold += gold;
  save.resources.stones += stones;
  save.progress[stage.id] = { stars: Math.max(prev?.stars ?? 0, stars), clears: (prev?.clears ?? 0) + 1 };
  let unlocked: string | undefined;
  const ug = stage.rewards.unlockGeneral;
  if (ug && !save.roster[ug]?.owned) {
    save.roster[ug] = newEntry();
    unlocked = ug;
  }
  return { result, outcome: { stars, gold, stones, first, unlocked }, stage };
}

export { GENERALS, STAGES };
