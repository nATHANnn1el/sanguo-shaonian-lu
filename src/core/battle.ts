import { makeRng } from './rng';
import type {
  BattleCombo,
  BattleEvent,
  BattleResult,
  BattleSetup,
  BattleUnitInit,
  BuffStat,
  Effect,
  Side,
  Skill,
  TargetSel,
} from './types';

/** 战斗常量（见 docs/battle-rules.md） */
export const RULES = {
  RAGE_CAST: 4, // 释放绝技/合击所需怒气
  RAGE_MAX: 8,
  RAGE_BASIC: 2, // 普通攻击后自身怒气 +2
  RAGE_HIT: 1, // 受到攻击伤害后怒气 +1
  CRIT_RATE: 0.1,
  CRIT_MULT: 1.5,
  DEF_K: 100, // 减伤公式：100 / (100 + 防御)
  MAX_ROUNDS: 20,
} as const;

interface Buff {
  stat: BuffStat;
  pct: number;
  turns: number;
}
interface Dot {
  amount: number;
  turns: number;
}
interface U extends BattleUnitInit {
  maxHp: number;
  curHp: number;
  rage: number;
  shield: number;
  alive: boolean;
  buffs: Buff[];
  dots: Dot[];
  taunt: number;
  silence: number;
}

const SINGLE_SELS: TargetSel[] = ['enemy-front', 'enemy-back', 'enemy-lowest-hp', 'enemy-top-atk'];

export function runBattle(setup: BattleSetup): BattleResult {
  const rng = makeRng(setup.seed);
  const maxRounds = setup.maxRounds ?? RULES.MAX_ROUNDS;
  const events: BattleEvent[] = [];
  const mk = (i: BattleUnitInit): U => ({
    ...i,
    maxHp: Math.round(i.hp),
    curHp: Math.round(i.hp),
    rage: i.startRage,
    shield: 0,
    alive: true,
    buffs: [],
    dots: [],
    taunt: 0,
    silence: 0,
  });
  const units: U[] = [...setup.allies.map(mk), ...setup.enemies.map(mk)];
  let current: U | null = null;

  const alive = (side: Side) => units.filter((u) => u.side === side && u.alive);
  const foesOf = (u: U) => alive(u.side === 'ally' ? 'enemy' : 'ally');
  const friendsOf = (u: U) => alive(u.side);
  const over = () => alive('ally').length === 0 || alive('enemy').length === 0;
  const eff = (u: U, stat: BuffStat) => {
    const base = u[stat];
    const pct = u.buffs.filter((b) => b.stat === stat).reduce((s, b) => s + b.pct, 0);
    return Math.max(stat === 'def' ? 0 : 1, base * (1 + pct));
  };
  const push = (e: BattleEvent) => events.push(e);
  const timed = (target: U, turns: number) => turns + (target === current ? 1 : 0);

  const frontFirst = (list: U[]) =>
    [...list].sort((a, b) => Number(a.slot >= 3) - Number(b.slot >= 3) || a.slot - b.slot);
  const backFirst = (list: U[]) =>
    [...list].sort((a, b) => Number(a.slot < 3) - Number(b.slot < 3) || a.slot - b.slot);

  function pick(sel: TargetSel, actor: U): U[] {
    const foes = foesOf(actor);
    const friends = friendsOf(actor);
    if (SINGLE_SELS.includes(sel)) {
      const taunter = frontFirst(foes).find((f) => f.taunt > 0);
      if (taunter) return [taunter];
    }
    switch (sel) {
      case 'enemy-front':
        return frontFirst(foes).slice(0, 1);
      case 'enemy-back':
        return backFirst(foes).slice(0, 1);
      case 'enemy-back-2':
        return backFirst(foes).slice(0, 2);
      case 'enemy-all':
        return frontFirst(foes);
      case 'enemy-lowest-hp':
        return [...foes].sort((a, b) => a.curHp - b.curHp || a.slot - b.slot).slice(0, 1);
      case 'enemy-top-atk':
        return [...foes].sort((a, b) => eff(b, 'atk') - eff(a, 'atk') || a.slot - b.slot).slice(0, 1);
      case 'self':
        return [actor];
      case 'ally-all':
        return [...friends].sort((a, b) => a.slot - b.slot);
      case 'ally-lowest-hp':
        return [...friends].sort((a, b) => a.curHp / a.maxHp - b.curHp / b.maxHp || a.slot - b.slot).slice(0, 1);
    }
  }

  const snap = (u: U) => ({ uid: u.uid, hp: u.curHp, maxHp: u.maxHp, rage: u.rage, shield: Math.round(u.shield) });

  function addRage(u: U, delta: number) {
    if (!u.alive) return;
    const next = Math.max(0, Math.min(RULES.RAGE_MAX, u.rage + delta));
    const d = next - u.rage;
    u.rage = next;
    if (d !== 0) push({ t: 'rage', uid: u.uid, delta: d, rage: u.rage });
  }

  function applyDamage(src: U, tgt: U, raw: number, crit: boolean, source: 'hit' | 'dot'): number {
    if (!tgt.alive) return 0;
    let amount = Math.max(1, Math.floor(raw));
    let absorbed = 0;
    if (tgt.shield > 0) {
      absorbed = Math.min(tgt.shield, amount);
      tgt.shield -= absorbed;
      amount -= absorbed;
    }
    tgt.curHp = Math.max(0, tgt.curHp - amount);
    push({ t: 'damage', uid: tgt.uid, src: src.uid, amount, absorbed, crit, hp: tgt.curHp, shield: Math.round(tgt.shield), source });
    if (tgt.curHp <= 0) {
      tgt.alive = false;
      push({ t: 'death', uid: tgt.uid });
    } else if (source === 'hit') {
      addRage(tgt, RULES.RAGE_HIT);
    }
    return amount + absorbed;
  }

  function doDamage(src: U, e: Extract<Effect, { type: 'damage' }>) {
    const hits = e.hits ?? 1;
    let targets = pick(e.target, src);
    for (let h = 0; h < hits && !over(); h++) {
      if (h > 0 && SINGLE_SELS.includes(e.target)) targets = pick(e.target, src);
      for (const t of targets) {
        if (!t.alive) continue;
        const crit = rng() < RULES.CRIT_RATE;
        const raw = eff(src, 'atk') * e.mult * (100 / (RULES.DEF_K + eff(t, 'def'))) * (crit ? RULES.CRIT_MULT : 1);
        const dealt = applyDamage(src, t, raw, crit, 'hit');
        if (e.lifesteal && src.alive) {
          const heal = Math.floor(dealt * e.lifesteal);
          const before = src.curHp;
          src.curHp = Math.min(src.maxHp, src.curHp + heal);
          if (src.curHp > before) push({ t: 'heal', uid: src.uid, amount: src.curHp - before, hp: src.curHp });
        }
      }
    }
  }

  const buffLabel = (stat: BuffStat, pct: number) =>
    `${{ atk: '攻击', def: '防御', spd: '速度' }[stat]}${pct >= 0 ? '+' : ''}${Math.round(pct * 100)}%`;

  function applyEffect(src: U, e: Effect) {
    if (over()) return;
    switch (e.type) {
      case 'damage':
        doDamage(src, e);
        break;
      case 'heal':
        for (const t of pick(e.target, src)) {
          const amt = Math.floor(eff(src, 'atk') * e.mult);
          const before = t.curHp;
          t.curHp = Math.min(t.maxHp, t.curHp + amt);
          push({ t: 'heal', uid: t.uid, amount: t.curHp - before, hp: t.curHp });
        }
        break;
      case 'shield':
        for (const t of pick(e.target, src)) {
          const amt = Math.floor(src.maxHp * e.mult);
          t.shield += amt;
          push({ t: 'shield', uid: t.uid, amount: amt, shield: Math.round(t.shield) });
        }
        break;
      case 'buff':
        for (const t of pick(e.target, src)) {
          t.buffs.push({ stat: e.stat, pct: e.pct, turns: timed(t, e.turns) });
          push({ t: 'buff', uid: t.uid, label: buffLabel(e.stat, e.pct), good: e.pct >= 0 });
        }
        break;
      case 'dot':
        for (const t of pick(e.target, src)) {
          t.dots.push({ amount: Math.max(1, Math.floor(eff(src, 'atk') * e.mult)), turns: e.turns });
          push({ t: 'status', uid: t.uid, label: '灼烧' });
        }
        break;
      case 'rage':
        for (const t of pick(e.target, src)) addRage(t, e.amount);
        break;
      case 'taunt':
        src.taunt = timed(src, e.turns);
        push({ t: 'status', uid: src.uid, label: '嘲讽' });
        break;
      case 'silence':
        for (const t of pick(e.target, src)) {
          t.silence = Math.max(t.silence, timed(t, e.turns));
          push({ t: 'status', uid: t.uid, label: '封绝' });
        }
        break;
    }
  }

  function castSkill(actor: U, skill: Skill, kind: 'basic' | 'ultimate' | 'combo') {
    const first = skill.effects.find((x) => 'target' in x && x.target !== 'self') ?? skill.effects[0];
    const targets = 'target' in first ? pick(first.target, actor) : [actor];
    push({ t: 'cast', uid: actor.uid, kind, skill: skill.name, targets: targets.map((t) => t.uid) });
    for (const e of skill.effects) applyEffect(actor, e);
  }

  function findCombo(actor: U): BattleCombo | undefined {
    if (actor.side !== 'ally') return undefined;
    return setup.combos.find(
      (c) => c.lead === actor.unitId && c.requires.every((r) => friendsOf(actor).some((f) => f.unitId === r)),
    );
  }

  function takeTurn(u: U) {
    current = u;
    push({ t: 'turn', uid: u.uid });
    // 回合开始：结算灼烧
    for (const d of u.dots) {
      if (!u.alive) break;
      applyDamage(u, u, d.amount, false, 'dot');
      d.turns -= 1;
    }
    u.dots = u.dots.filter((d) => d.turns > 0);
    if (u.alive && !over()) {
      const ultReady = u.rage >= RULES.RAGE_CAST && u.silence <= 0;
      if (ultReady) {
        const combo = findCombo(u);
        addRage(u, -RULES.RAGE_CAST);
        if (combo) castSkill(u, combo.skill, 'combo');
        else castSkill(u, u.ultimate, 'ultimate');
      } else {
        castSkill(u, u.basic, 'basic');
        addRage(u, RULES.RAGE_BASIC);
      }
    }
    // 回合结束：状态倒计时
    if (u.alive) {
      u.buffs.forEach((b) => (b.turns -= 1));
      u.buffs = u.buffs.filter((b) => b.turns > 0);
      u.taunt = Math.max(0, u.taunt - 1);
      u.silence = Math.max(0, u.silence - 1);
    }
    current = null;
  }

  push({ t: 'start', units: units.map(snap) });
  let round = 0;
  let reason: 'annihilation' | 'timeout' = 'annihilation';
  while (!over()) {
    if (round >= maxRounds) {
      reason = 'timeout';
      break;
    }
    round += 1;
    const order = alive('ally')
      .concat(alive('enemy'))
      .sort((a, b) => eff(b, 'spd') - eff(a, 'spd') || Number(a.side === 'enemy') - Number(b.side === 'enemy') || a.slot - b.slot);
    push({ t: 'round', round, order: order.map((u) => u.uid) });
    for (const u of order) {
      if (over()) break;
      if (!u.alive) continue;
      takeTurn(u);
    }
  }
  const winner: Side = reason === 'timeout' ? 'enemy' : alive('ally').length > 0 ? 'ally' : 'enemy';
  push({ t: 'end', winner, reason, rounds: round });
  return {
    events,
    winner,
    reason,
    rounds: round,
    allyAlive: alive('ally').length,
    allyTotal: setup.allies.length,
  };
}
