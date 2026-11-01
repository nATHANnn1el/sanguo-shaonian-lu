import { describe, expect, it } from 'vitest';
import { RULES, runBattle } from '../src/core/battle';
import type { BattleEvent } from '../src/core/types';
import { hit, unit } from './helpers';

const casts = (ev: BattleEvent[]) => ev.filter((e): e is Extract<BattleEvent, { t: 'cast' }> => e.t === 'cast');
const dmg = (ev: BattleEvent[]) => ev.filter((e): e is Extract<BattleEvent, { t: 'damage' }> => e.t === 'damage');

describe('战斗引擎', () => {
  it('相同种子产生完全相同的事件日志（确定性）', () => {
    const mkSetup = () => ({
      allies: [unit({ uid: 'a0' }), unit({ uid: 'a3', spd: 90 })],
      enemies: [unit({ uid: 'e0', spd: 95 }), unit({ uid: 'e3' })],
      combos: [],
      seed: 42,
    });
    expect(JSON.stringify(runBattle(mkSetup()).events)).toBe(JSON.stringify(runBattle(mkSetup()).events));
  });

  it('按速度从高到低行动，同速友方先手', () => {
    const r = runBattle({
      allies: [unit({ uid: 'a0', spd: 100 }), unit({ uid: 'a1', spd: 120 })],
      enemies: [unit({ uid: 'e0', spd: 100 }), unit({ uid: 'e1', spd: 80 })],
      combos: [],
      seed: 1,
    });
    const round1 = r.events.find((e) => e.t === 'round') as Extract<BattleEvent, { t: 'round' }>;
    expect(round1.order).toEqual(['a1', 'a0', 'e0', 'e1']);
  });

  it('伤害公式：攻击×倍率×100/(100+防御)', () => {
    const r = runBattle({
      allies: [unit({ uid: 'a0', atk: 200, startRage: 0 })],
      enemies: [unit({ uid: 'e0', def: 100, hp: 100000, atk: 1 })],
      combos: [],
      seed: 7,
      maxRounds: 1,
    });
    const d = dmg(r.events).find((e) => e.src === 'a0')!;
    // 200 × 1 × 100/200 = 100；暴击时 150
    expect([100, 150]).toContain(d.amount);
    expect(d.crit).toBe(d.amount === 150);
  });

  it('怒气：普攻后 +2，受击 +1，满 4 点释放绝技并消耗 4 点', () => {
    const r = runBattle({
      allies: [unit({ uid: 'a0', spd: 200, startRage: 1, hp: 100000, atk: 10 })],
      enemies: [unit({ uid: 'e0', spd: 1, hp: 100000, atk: 1 })],
      combos: [],
      seed: 3,
      maxRounds: 3,
    });
    const c = casts(r.events).filter((e) => e.uid === 'a0');
    // 回合1：怒气1→普攻→3；回合2：3(+1 受击)=4 → 绝技
    expect(c.map((x) => x.kind)).toEqual(['basic', 'ultimate', 'basic']);
    const rages = r.events.filter((e) => e.t === 'rage' && e.uid === 'a0') as Extract<BattleEvent, { t: 'rage' }>[];
    expect(rages.some((e) => e.delta === -RULES.RAGE_CAST)).toBe(true);
    expect(Math.max(...rages.map((e) => e.rage))).toBeLessThanOrEqual(RULES.RAGE_MAX);
  });

  it('怒气上限为 8', () => {
    const r = runBattle({
      allies: [unit({ uid: 'a0', startRage: 8, spd: 1 })],
      enemies: [unit({ uid: 'e0', hp: 99999, atk: 1, spd: 200, basic: hit(0.01) })],
      combos: [],
      seed: 1,
      maxRounds: 2,
    });
    const rages = r.events.filter((e) => e.t === 'rage') as Extract<BattleEvent, { t: 'rage' }>[];
    expect(rages.every((e) => e.rage <= RULES.RAGE_MAX)).toBe(true);
  });

  it('前排优先被攻击，前排全灭后攻击后排', () => {
    const r = runBattle({
      allies: [unit({ uid: 'a0', atk: 2000, spd: 150 })],
      enemies: [unit({ uid: 'e0', hp: 100, atk: 1 }), unit({ uid: 'e3', hp: 100, atk: 1 })],
      combos: [],
      seed: 1,
      maxRounds: 3,
    });
    const targets = dmg(r.events).filter((e) => e.src === 'a0').map((e) => e.uid);
    expect(targets[0]).toBe('e0');
    expect(targets[1]).toBe('e3');
    expect(r.winner).toBe('ally');
  });

  it('后排优先技能先打后排', () => {
    const r = runBattle({
      allies: [unit({ uid: 'a0', basic: hit(1, 'enemy-back') })],
      enemies: [unit({ uid: 'e0', hp: 99999, atk: 1 }), unit({ uid: 'e3', hp: 99999, atk: 1 })],
      combos: [],
      seed: 1,
      maxRounds: 1,
    });
    expect(dmg(r.events).find((e) => e.src === 'a0')!.uid).toBe('e3');
  });

  it('嘲讽强制单体技能攻击嘲讽者', () => {
    const taunter = unit({
      uid: 'e3',
      spd: 200,
      hp: 99999,
      atk: 1,
      basic: { name: '挑衅', desc: 't', effects: [{ type: 'taunt', turns: 2 }] },
    });
    const r = runBattle({
      allies: [unit({ uid: 'a0', basic: hit(1, 'enemy-front'), spd: 100 })],
      enemies: [unit({ uid: 'e0', hp: 99999, atk: 1, spd: 50 }), taunter],
      combos: [],
      seed: 1,
      maxRounds: 1,
    });
    expect(dmg(r.events).find((e) => e.src === 'a0')!.uid).toBe('e3');
  });

  it('护盾先于生命吸收伤害', () => {
    const r = runBattle({
      allies: [unit({ uid: 'a0', atk: 100, spd: 100 })],
      enemies: [
        unit({
          uid: 'e0',
          hp: 1000,
          atk: 1,
          spd: 200,
          basic: { name: '盾', desc: 't', effects: [{ type: 'shield', mult: 0.5, target: 'self' }] },
        }),
      ],
      combos: [],
      seed: 5,
      maxRounds: 1,
    });
    const d = dmg(r.events).find((e) => e.src === 'a0')!;
    expect(d.absorbed).toBeGreaterThan(0);
    expect(d.hp).toBe(1000); // 500 盾吸收 100 伤害，生命未减
  });

  it('灼烧在目标回合开始结算并持续指定回合', () => {
    const r = runBattle({
      allies: [
        unit({
          uid: 'a0',
          spd: 200,
          startRage: 4,
          atk: 100,
          ultimate: { name: '火', desc: 't', effects: [{ type: 'dot', mult: 0.5, turns: 2, target: 'enemy-all' }] },
        }),
      ],
      enemies: [unit({ uid: 'e0', hp: 99999, atk: 1, spd: 100, basic: hit(0.001) })],
      combos: [],
      seed: 1,
      maxRounds: 2,
    });
    const dots = dmg(r.events).filter((e) => e.source === 'dot');
    expect(dots).toHaveLength(2);
    expect(dots[0].amount).toBe(50);
  });

  it('封绝使目标在该回合无法释放绝技，改为普攻', () => {
    const r = runBattle({
      allies: [
        unit({
          uid: 'a0',
          spd: 200,
          startRage: 4,
          ultimate: { name: '封', desc: 't', effects: [{ type: 'silence', turns: 1, target: 'enemy-front' }] },
        }),
      ],
      enemies: [unit({ uid: 'e0', hp: 99999, atk: 1, spd: 100, startRage: 8 })],
      combos: [],
      seed: 1,
      maxRounds: 2,
    });
    const ec = casts(r.events).filter((e) => e.uid === 'e0').map((e) => e.kind);
    expect(ec[0]).toBe('basic');
    expect(ec[1]).toBe('ultimate');
  });

  it('增益持续指定回合后消失', () => {
    const r = runBattle({
      allies: [
        unit({
          uid: 'a0',
          spd: 200,
          startRage: 4,
          atk: 100,
          ultimate: { name: '鼓舞', desc: 't', effects: [{ type: 'buff', stat: 'atk', pct: 1, turns: 1, target: 'self' }] },
        }),
      ],
      enemies: [unit({ uid: 'e0', hp: 99999, atk: 1, spd: 100, basic: { name: '待机', desc: 't', effects: [{ type: 'shield', mult: 0.00001, target: 'self' }] } })],
      combos: [],
      seed: 9,
      maxRounds: 3,
    });
    const own = dmg(r.events).filter((e) => e.src === 'a0');
    // 回合1放增益（本回合无伤害），回合2普攻吃满增益 200，回合3恢复 100（暴击时还原）
    const base = own.map((e) => (e.crit ? e.amount / 1.5 : e.amount));
    expect(Math.round(base[0])).toBe(200);
    expect(Math.round(base[1])).toBe(100);
  });

  it('合击：羁绊成员在场时，发起者怒气满改放合击；搭档阵亡后改放普通绝技', () => {
    const combo = {
      lead: 'a3',
      requires: ['a0'],
      skill: { name: '合击', desc: 't', effects: [{ type: 'damage' as const, mult: 5, target: 'enemy-all' as const }] },
    };
    const mk = (partnerHp: number) =>
      runBattle({
        allies: [unit({ uid: 'a0', hp: partnerHp, spd: 1 }), unit({ uid: 'a3', spd: 200, startRage: 8, hp: 99999 })],
        enemies: [unit({ uid: 'e0', hp: 99999, atk: 1000, spd: 100 })],
        combos: [combo],
        seed: 1,
        maxRounds: 2,
      });
    const alive = casts(mk(99999).events).filter((e) => e.uid === 'a3');
    expect(alive[0].kind).toBe('combo');
    expect(alive[1].kind).toBe('combo'); // 搭档仍在，第二回合怒气 4 再次合击
    const dead = mk(1);
    expect(dead.events.some((e) => e.t === 'death' && e.uid === 'a0')).toBe(true);
    const k = casts(dead.events).filter((e) => e.uid === 'a3').map((e) => e.kind);
    expect(k).toEqual(['combo', 'ultimate']);
  });

  it('合击不会被敌方使用', () => {
    const combo = { lead: 'e0', requires: [], skill: hit(9) };
    const r = runBattle({
      allies: [unit({ uid: 'a0', hp: 99999, atk: 1, spd: 1 })],
      enemies: [unit({ uid: 'e0', hp: 99999, atk: 1, spd: 100, startRage: 4 })],
      combos: [combo],
      seed: 1,
      maxRounds: 1,
    });
    expect(casts(r.events).find((e) => e.uid === 'e0')!.kind).toBe('ultimate');
  });

  it('多段攻击会对低血目标重新选择', () => {
    const r = runBattle({
      allies: [
        unit({
          uid: 'a0',
          atk: 1000,
          spd: 200,
          startRage: 4,
          ultimate: { name: '三连', desc: 't', effects: [{ type: 'damage', mult: 1, target: 'enemy-lowest-hp', hits: 3 }] },
        }),
      ],
      enemies: [unit({ uid: 'e0', hp: 500, atk: 1 }), unit({ uid: 'e1', hp: 600, atk: 1 }), unit({ uid: 'e2', hp: 700, atk: 1 })],
      combos: [],
      seed: 1,
      maxRounds: 1,
    });
    const deaths = r.events.filter((e) => e.t === 'death');
    expect(deaths.length).toBe(3);
  });

  it('全灭立即结束；超过回合上限判负', () => {
    const win = runBattle({
      allies: [unit({ uid: 'a0', atk: 9999 })],
      enemies: [unit({ uid: 'e0', hp: 10 })],
      combos: [],
      seed: 1,
    });
    expect(win.winner).toBe('ally');
    expect(win.reason).toBe('annihilation');
    const stall = runBattle({
      allies: [unit({ uid: 'a0', atk: 1, hp: 999999 })],
      enemies: [unit({ uid: 'e0', atk: 1, hp: 999999, def: 9999 })],
      combos: [],
      seed: 1,
    });
    expect(stall.reason).toBe('timeout');
    expect(stall.winner).toBe('enemy');
    expect(stall.rounds).toBe(RULES.MAX_ROUNDS);
  });

  it('吸血不超过最大生命', () => {
    const r = runBattle({
      allies: [
        unit({
          uid: 'a0',
          startRage: 4,
          spd: 200,
          hp: 1000,
          ultimate: { name: '吸', desc: 't', effects: [{ type: 'damage', mult: 5, target: 'enemy-front', lifesteal: 1 }] },
        }),
      ],
      enemies: [unit({ uid: 'e0', hp: 99999, atk: 1 })],
      combos: [],
      seed: 1,
      maxRounds: 1,
    });
    const heals = r.events.filter((e) => e.t === 'heal') as Extract<BattleEvent, { t: 'heal' }>[];
    expect(heals.every((h) => h.hp <= 1000)).toBe(true);
  });
});
