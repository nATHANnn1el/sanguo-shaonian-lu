import type { BattleUnitInit, Skill } from '../src/core/types';

export const hit = (mult = 1, target: 'enemy-front' | 'enemy-back' = 'enemy-front'): Skill => ({
  name: '普攻',
  desc: 't',
  effects: [{ type: 'damage', mult, target }],
});

export function unit(p: Partial<BattleUnitInit> & { uid: string }): BattleUnitInit {
  const side = p.uid.startsWith('a') ? 'ally' : 'enemy';
  return {
    side,
    slot: Number(p.uid.slice(1)),
    unitId: p.uid,
    name: p.uid,
    role: 'warrior',
    hp: 1000,
    atk: 100,
    def: 0,
    spd: 100,
    basic: hit(),
    ultimate: { name: '绝技', desc: 't', effects: [{ type: 'damage', mult: 3, target: 'enemy-front' }] },
    startRage: 1,
    ...p,
  };
}
