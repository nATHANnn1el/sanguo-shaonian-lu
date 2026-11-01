import { STAGES } from '../src/data';
import { advance, canAdvance, canLevelUp, levelUp } from '../src/core/progression';
import { fightStage } from '../src/core/game';
import { newSave } from '../src/core/save';
import { activeSynergies, generalStats, powerOf, sumBonus } from '../src/core/setup';
import type { SaveData } from '../src/core/types';

/** 自动化玩家：按战力挑选最优阵容（前排放坦克/战士，后排放谋士/辅助），把资源投入战力最低的上阵武将 */
export function autoFormation(save: SaveData): (string | null)[] {
  const owned = Object.keys(save.roster).filter((id) => save.roster[id].owned);
  const score = (id: string) => powerOf(generalStats(save, id));
  const sorted = [...owned].sort((a, b) => score(b) - score(a)).slice(0, 6);
  // 尝试枚举 6 选子集的羁绊价值：简单起见，优先保证羁绊成员入选
  let best = sorted;
  let bestV = -1;
  const pool = [...owned].sort((a, b) => score(b) - score(a));
  const n = Math.min(pool.length, 9);
  const cand = pool.slice(0, n);
  const recurse = (i: number, pick: string[]) => {
    if (pick.length === 6 || i === cand.length) {
      if (pick.length < Math.min(6, cand.length)) return;
      const syn = activeSynergies(pick);
      const b = sumBonus(syn);
      const v = pick.reduce((a, id) => a + powerOf(generalStats(save, id, b)), 0) + (syn.some((s) => s.combo) ? 40 : 0);
      if (v > bestV) {
        bestV = v;
        best = [...pick];
      }
      return;
    }
    recurse(i + 1, [...pick, cand[i]]);
    recurse(i + 1, pick);
  };
  recurse(0, []);
  const front = best.filter((id) => ['guardian', 'warrior'].includes(roleOf(id))).sort((a, b) => hpOf(b) - hpOf(a));
  const back = best.filter((id) => !front.includes(id));
  const slots: (string | null)[] = [null, null, null, null, null, null];
  const f = front.slice(0, 3);
  const bk = [...back, ...front.slice(3)];
  f.forEach((id, i) => (slots[i] = id));
  bk.slice(0, 3).forEach((id, i) => (slots[3 + i] = id));
  // 若前排没满，从后排补
  return slots;
}
import { generalById } from '../src/data';
const roleOf = (id: string) => generalById(id).role;
const hpOf = (id: string) => generalById(id).hp;

export function invest(save: SaveData) {
  let guard = 200;
  while (guard-- > 0) {
    const team = save.formation.filter((x): x is string => !!x);
    let did = false;
    // 先进阶，再升级最低等级者
    for (const id of team) if (canAdvance(save, id).ok) { advance(save, id); did = true; }
    const cand = team.filter((id) => canLevelUp(save, id).ok).sort((a, b) => save.roster[a].level - save.roster[b].level);
    if (cand.length) { levelUp(save, cand[0]); did = true; }
    if (!did) break;
  }
}

export interface SimLog { stage: string; attempts: number; farms: number }

/** 模拟通关：每关最多尝试 maxAttempts 次，输了就去刷已通关的关卡攒资源再回来 */
export function simulate(seed = 1, maxAttempts = 30): { save: SaveData; logs: SimLog[]; cleared: number } {
  const save = newSave();
  const logs: SimLog[] = [];
  let s = seed * 1000;
  let cleared = 0;
  for (let i = 0; i < STAGES.length; i++) {
    const st = STAGES[i];
    let attempts = 0;
    let farms = 0;
    for (; attempts < maxAttempts; attempts++) {
      save.formation = autoFormation(save);
      invest(save);
      const r = fightStage(save, st.id, s++);
      if (r.outcome) break;
      // 失败：刷上一关（若有）
      const farm = STAGES[Math.max(0, i - 1)];
      save.formation = autoFormation(save);
      fightStage(save, farm.id, s++);
      farms++;
    }
    logs.push({ stage: st.id, attempts: attempts + 1, farms });
    if (!save.progress[st.id]) break;
    cleared++;
  }
  return { save, logs, cleared };
}
