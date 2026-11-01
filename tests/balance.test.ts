import { describe, expect, it } from 'vitest';
import { fightStage } from '../src/core/game';
import { newSave } from '../src/core/save';
import { STAGES } from '../src/data';
import { simulate } from './sim';

describe('平衡性（自动玩家模拟）', () => {
  it('新手第一关胜率 ≥ 90%（20 个种子）', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (fightStage(newSave(), 'stage-01', s).outcome) wins++;
    expect(wins).toBeGreaterThanOrEqual(18);
  });

  it('自动玩家能在合理的失败/刷关次数内通关全部 10 关（5 个种子）', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const r = simulate(seed);
      expect(r.cleared).toBe(STAGES.length);
      const totalFarms = r.logs.reduce((a, l) => a + l.farms, 0);
      // 平均每关需要的刷关次数不应过多（避免过度肝）
      expect(totalFarms).toBeLessThanOrEqual(40);
    }
  });

  it('不升级的新手在第 5 关（Boss）应当被挡住 —— 关卡有门槛', () => {
    const s = newSave();
    let wins = 0;
    for (let k = 1; k <= 10; k++) if (fightStage(structuredClone(s), 'stage-05', k).outcome) wins++;
    expect(wins).toBeLessThanOrEqual(3);
  });
});
