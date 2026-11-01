import { GENERALS, STAGES } from '../data';
import { newEntry } from './progression';
import type { SaveData } from './types';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'sgsnl.save';

export const STARTERS = GENERALS.filter((g) => g.unlock === 'start').map((g) => g.id);

export function newSave(now = Date.now()): SaveData {
  const roster: SaveData['roster'] = {};
  for (const id of STARTERS) roster[id] = newEntry();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    resources: { gold: 300, stones: 0 },
    roster,
    formation: ['guan-yu', 'xu-chu', 'xiahou-dun', 'liu-bei', 'cao-cao', null],
    progress: {},
    settings: { speed: 1 },
    stats: { battles: 0, wins: 0 },
  };
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;
/** 迁移表：键为「源版本」，把存档升到 源版本+1。v1 为当前版本，暂无迁移。 */
export const MIGRATIONS: Record<number, Migration> = {};

/** 对读入的原始对象做版本迁移与校验；无法恢复时返回 null */
export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  let obj = raw as Record<string, unknown>;
  let v = typeof obj.version === 'number' ? obj.version : 0;
  if (v < 1 || v > SAVE_VERSION) return null; // 未知/来自未来的版本：不尝试解释
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) return null;
    obj = m(obj);
    v += 1;
    obj.version = v;
  }
  return sanitize(obj);
}

/** 防御式清洗：剔除未知武将，补全缺失字段，修正非法值 */
export function sanitize(obj: Record<string, unknown>): SaveData | null {
  const base = newSave();
  const num = (x: unknown, d: number, min = 0) => (typeof x === 'number' && isFinite(x) ? Math.max(min, Math.floor(x)) : d);
  const res = (obj.resources ?? {}) as Record<string, unknown>;
  const out: SaveData = {
    version: SAVE_VERSION,
    createdAt: num(obj.createdAt, base.createdAt),
    updatedAt: num(obj.updatedAt, base.updatedAt),
    resources: { gold: num(res.gold, base.resources.gold), stones: num(res.stones, 0) },
    roster: {},
    formation: [null, null, null, null, null, null],
    progress: {},
    settings: { speed: 1 },
    stats: { battles: 0, wins: 0 },
  };
  const ids = new Set(GENERALS.map((g) => g.id));
  const roster = (obj.roster ?? {}) as Record<string, Record<string, unknown>>;
  for (const [id, r] of Object.entries(roster)) {
    if (!ids.has(id) || !r || typeof r !== 'object') continue;
    out.roster[id] = {
      owned: r.owned !== false,
      level: Math.min(25, Math.max(1, num(r.level, 1))),
      adv: Math.min(3, num(r.adv, 0)),
    };
  }
  for (const id of STARTERS) if (!out.roster[id]) out.roster[id] = newEntry();
  const f = Array.isArray(obj.formation) ? obj.formation : [];
  const used = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const id = f[i];
    if (typeof id === 'string' && out.roster[id]?.owned && !used.has(id)) {
      out.formation[i] = id;
      used.add(id);
    }
  }
  const stageIds = new Set(STAGES.map((s) => s.id));
  const prog = (obj.progress ?? {}) as Record<string, Record<string, unknown>>;
  for (const [id, p] of Object.entries(prog)) {
    if (!stageIds.has(id) || !p) continue;
    out.progress[id] = { stars: Math.min(3, num(p.stars, 0)), clears: num(p.clears, 1) };
  }
  const sp = (obj.settings as Record<string, unknown> | undefined)?.speed;
  out.settings.speed = sp === 2 || sp === 4 ? sp : 1;
  const st = (obj.stats ?? {}) as Record<string, unknown>;
  out.stats = { battles: num(st.battles, 0), wins: num(st.wins, 0) };
  if (out.formation.every((x) => x === null)) out.formation = base.formation;
  return out;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function loadSave(storage: StorageLike): { save: SaveData; recovered: boolean } {
  try {
    const txt = storage.getItem(SAVE_KEY);
    if (txt) {
      const s = migrate(JSON.parse(txt));
      if (s) return { save: s, recovered: false };
      // 存档损坏：备份后重新开始
      storage.setItem(SAVE_KEY + '.bak', txt);
      return { save: newSave(), recovered: true };
    }
  } catch {
    /* fallthrough */
  }
  return { save: newSave(), recovered: false };
}

export function writeSave(storage: StorageLike, save: SaveData): void {
  save.updatedAt = Date.now();
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* 存储已满或被禁用：忽略，游戏仍可继续 */
  }
}

export const isUnlocked = (save: SaveData, stageIndex: number): boolean => {
  if (stageIndex === 0) return true;
  const prev = STAGES[stageIndex - 1];
  return !!save.progress[prev.id];
};
