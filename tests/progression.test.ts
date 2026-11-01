import { describe, expect, it } from 'vitest';
import { advance, advanceCost, canAdvance, levelCap, levelUp, levelUpCost, statMult } from '../src/core/progression';
import { newSave } from '../src/core/save';
import { activeSynergies, buildSetup, generalStats, sumBonus } from '../src/core/setup';
import { fightStage, starsFor } from '../src/core/game';
import { STAGES } from '../src/data';

describe('成长', () => {
  it('升级消耗银两、不足时失败、到上限需进阶', () => {
    const s = newSave();
    s.resources.gold = 10000;
    expect(levelUp(s, 'guan-yu').ok).toBe(true);
    expect(s.roster['guan-yu'].level).toBe(2);
    expect(s.resources.gold).toBe(10000 - levelUpCost(1));
    s.roster['guan-yu'].level = levelCap(0);
    const r = levelUp(s, 'guan-yu');
    expect(r.ok).toBe(false);
    s.resources.gold = 0;
    s.roster['liu-bei'].level = 1;
    expect(levelUp(s, 'liu-bei').ok).toBe(false);
  });
  it('进阶需满级与将魂石，进阶提高等级上限与属性', () => {
    const s = newSave();
    expect(canAdvance(s, 'guan-yu').ok).toBe(false);
    s.roster['guan-yu'].level = levelCap(0);
    s.resources.stones = 1;
    expect(canAdvance(s, 'guan-yu').ok).toBe(false);
    s.resources.stones = advanceCost(0);
    expect(advance(s, 'guan-yu').ok).toBe(true);
    expect(s.roster['guan-yu'].adv).toBe(1);
    expect(levelCap(1)).toBeGreaterThan(levelCap(0));
    expect(statMult(10, 1)).toBeGreaterThan(statMult(10, 0));
    expect(s.resources.stones).toBe(0);
  });
  it('未拥有的武将不能升级', () => {
    expect(levelUp(newSave(), 'zhuge-liang').ok).toBe(false);
  });
});

describe('羁绊与出战配置', () => {
  it('成员齐全才激活，属性加成正确', () => {
    expect(activeSynergies(['liu-bei', 'guan-yu', null, null, null, null])).toHaveLength(0);
    const syn = activeSynergies(['liu-bei', 'guan-yu', 'zhang-fei', null, null, null]);
    expect(syn.map((s) => s.id)).toEqual(['peach-oath']);
    const s = newSave();
    s.roster['zhang-fei'] = { owned: true, level: 1, adv: 0 };
    const plain = generalStats(s, 'guan-yu');
    const boosted = generalStats(s, 'guan-yu', sumBonus(syn));
    expect(boosted.atk).toBe(Math.round(plain.atk * 1.1 * 1) || boosted.atk);
    expect(boosted.hp).toBeGreaterThan(plain.hp);
  });
  it('曹操+郭嘉激活后战斗配置中带有合击', () => {
    const s = newSave();
    s.roster['guo-jia'] = { owned: true, level: 1, adv: 0 };
    s.formation = ['xu-chu', 'xiahou-dun', null, 'cao-cao', 'guo-jia', null];
    const setup = buildSetup(s, STAGES[0], 1);
    expect(setup.combos).toHaveLength(1);
    expect(setup.combos[0].lead).toBe('cao-cao');
    expect(setup.combos[0].requires).toEqual(['guo-jia']);
  });
});

describe('关卡结算', () => {
  it('第一关新手可胜，首通发放奖励并解锁武将，重复通关无首通奖励', () => {
    const s = newSave();
    const a = fightStage(s, 'stage-01', 1);
    expect(a.result.winner).toBe('ally');
    expect(a.outcome!.first).toBe(true);
    expect(s.progress['stage-01']).toBeTruthy();
    expect(s.roster['guo-jia']?.owned).toBe(true);
    const gold = s.resources.gold;
    const b = fightStage(s, 'stage-01', 2);
    expect(b.outcome!.first).toBe(false);
    expect(s.resources.gold).toBe(gold + STAGES[0].rewards.gold);
    expect(s.stats.battles).toBe(2);
  });
  it('星级规则', () => {
    const base = { events: [], reason: 'annihilation' as const, rounds: 3, allyTotal: 5 };
    expect(starsFor({ ...base, winner: 'ally', allyAlive: 5 })).toBe(3);
    expect(starsFor({ ...base, winner: 'ally', allyAlive: 4 })).toBe(2);
    expect(starsFor({ ...base, winner: 'ally', allyAlive: 2 })).toBe(1);
    expect(starsFor({ ...base, winner: 'enemy', allyAlive: 0 })).toBe(0);
  });
});
