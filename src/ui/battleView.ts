import { enemyById, generalById } from '../data';
import type { BattleCombo, BattleEvent, BattleResult, BattleSetup, BattleUnitInit, SaveData, StageDef } from '../core/types';
import type { ClearOutcome } from '../core/game';
import { RULES } from '../core/battle';
import { portrait } from './svg';

export type BattleExit = 'back' | 'again' | 'next';

interface ViewOpts {
  root: HTMLElement;
  save: SaveData;
  stage: StageDef;
  setup: BattleSetup;
  result: BattleResult;
  outcome: ClearOutcome | null;
  hasNext: boolean;
  onSpeed: (s: 1 | 2 | 4) => void;
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

function unitCard(u: BattleUnitInit): string {
  const isEnemy = u.side === 'enemy';
  const look = isEnemy ? enemyById(u.unitId).look : generalById(u.unitId).look;
  const faction = isEnemy ? 'enemy' : generalById(u.unitId).faction;
  const pips = Array.from({ length: RULES.RAGE_MAX }, (_, i) => `<i class="${i === RULES.RAGE_CAST - 1 ? 'mark' : ''}"></i>`).join('');
  return `<div class="bunit ${u.side} ${u.boss ? 'boss' : ''}" data-uid="${u.uid}" data-unit="${u.unitId}">
    <div class="bportrait">${portrait(look, faction)}<div class="turn-arrow">▼</div><div class="shield-badge" hidden></div></div>
    <div class="bname">${esc(u.name)}</div>
    <div class="hpbar"><div class="hpfill"></div><div class="shfill"></div></div>
    <div class="rage" data-rage="0">${pips}</div>
    <div class="tags"></div>
  </div>`;
}

export function playBattle(o: ViewOpts): Promise<BattleExit> {
  const { root, setup, result, stage } = o;
  return new Promise((resolve) => {
    let speed = o.save.settings.speed;
    let skipping = false;
    const allUnits = [...setup.allies, ...setup.enemies];
    const byUid = new Map(allUnits.map((u) => [u.uid, u]));
    const row = (side: 'ally' | 'enemy', back: boolean) => {
      const slots = back ? [3, 4, 5] : [0, 1, 2];
      return `<div class="brow ${back ? 'back' : 'front'}">${slots
        .map((s) => {
          const u = (side === 'ally' ? setup.allies : setup.enemies).find((x) => x.slot === s);
          return `<div class="bcell">${u ? unitCard(u) : '<div class="empty"></div>'}</div>`;
        })
        .join('')}</div>`;
    };
    root.innerHTML = `<div class="battle">
      <div class="btop">
        <div class="btitle">第${stage.chapter}章 · ${stage.index}　${esc(stage.name)}</div>
        <div class="bround" id="round">第 1 回合</div>
        <button class="chip" id="speed">${speed}x</button>
        <button class="chip" id="skip">跳过</button>
      </div>
      <div class="orderbar" id="order"></div>
      <div class="field">
        ${row('enemy', true)}${row('enemy', false)}
        <div class="vsline"><span>敌</span><span class="vs">VS</span><span>我</span></div>
        ${row('ally', false)}${row('ally', true)}
        <div class="banner" id="banner"></div>
      </div>
      <div class="blog" id="blog">战斗开始</div>
      <div class="legend">怒气 ●●●●○○○○（满 4 点释放绝技；合击需搭档在场）</div>
    </div>`;
    const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
    const cardOf = (uid: string) => root.querySelector(`.bunit[data-uid="${uid}"]`) as HTMLElement | null;
    const banner = $('#banner');
    const blog = $('#blog');
    const orderEl = $('#order');
    const sleep = (ms: number) => (skipping ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms / speed)));

    $('#speed').addEventListener('click', () => {
      speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
      $('#speed').textContent = `${speed}x`;
      o.onSpeed(speed);
    });
    $('#skip').addEventListener('click', () => {
      skipping = true;
    });

    const float = (uid: string, text: string, cls: string) => {
      if (skipping) return;
      const c = cardOf(uid);
      if (!c) return;
      const f = document.createElement('div');
      f.className = `float ${cls}`;
      f.textContent = text;
      c.appendChild(f);
      setTimeout(() => f.remove(), 1000 / Math.min(speed, 2));
    };
    const setHp = (uid: string, hp: number, shield: number) => {
      const c = cardOf(uid);
      if (!c) return;
      const u = byUid.get(uid)!;
      const max = Math.round(u.hp);
      (c.querySelector('.hpfill') as HTMLElement).style.width = `${(hp / max) * 100}%`;
      const sh = c.querySelector('.shfill') as HTMLElement;
      sh.style.width = `${Math.min(100, (shield / max) * 100)}%`;
      const badge = c.querySelector('.shield-badge') as HTMLElement;
      badge.hidden = shield <= 0;
      badge.textContent = shield > 0 ? String(shield) : '';
      c.dataset.hp = String(hp);
    };
    const setRage = (uid: string, rage: number) => {
      const c = cardOf(uid);
      if (!c) return;
      c.querySelectorAll('.rage i').forEach((el, i) => el.classList.toggle('on', i < rage));
      c.classList.toggle('ready', rage >= RULES.RAGE_CAST);
      (c.querySelector('.rage') as HTMLElement).dataset.rage = String(rage);
    };
    const addTag = (uid: string, label: string) => {
      const t = cardOf(uid)?.querySelector('.tags');
      if (!t) return;
      if (t.children.length >= 3) t.firstElementChild?.remove();
      const s = document.createElement('span');
      s.textContent = label;
      t.appendChild(s);
      setTimeout(() => s.remove(), 4000);
    };
    const renderOrder = (order: string[], doneIdx: number) => {
      orderEl.innerHTML = order
        .map((uid, i) => {
          const u = byUid.get(uid)!;
          const dead = cardOf(uid)?.classList.contains('dead');
          return `<div class="oitem ${u.side} ${i < doneIdx ? 'done' : ''} ${i === doneIdx ? 'cur' : ''} ${dead ? 'dead' : ''}" data-uid="${uid}">${esc(u.name.slice(0, 2))}</div>`;
        })
        .join('');
    };

    const comboFor = (uid: string): BattleCombo | undefined => setup.combos.find((c) => c.lead === byUid.get(uid)?.unitId);

    async function play() {
      let order: string[] = [];
      let idx = -1;
      for (const e of result.events as BattleEvent[]) {
        switch (e.t) {
          case 'start':
            e.units.forEach((s) => {
              setHp(s.uid, s.hp, s.shield);
              setRage(s.uid, s.rage);
            });
            await sleep(500);
            break;
          case 'round':
            $('#round').textContent = `第 ${e.round} 回合`;
            order = e.order;
            idx = -1;
            renderOrder(order, idx);
            blog.textContent = `—— 第 ${e.round} 回合 ——`;
            await sleep(350);
            break;
          case 'turn': {
            idx = order.indexOf(e.uid);
            renderOrder(order, idx);
            root.querySelectorAll('.bunit.acting').forEach((n) => n.classList.remove('acting'));
            cardOf(e.uid)?.classList.add('acting');
            await sleep(200);
            break;
          }
          case 'cast': {
            const u = byUid.get(e.uid)!;
            const label = e.kind === 'combo' ? '合击' : e.kind === 'ultimate' ? '绝技' : '';
            blog.innerHTML = `<b>${esc(u.name)}</b> ${label ? `<em class="${e.kind}">${label}</em>` : '使出'} 「${esc(e.skill)}」`;
            if (e.kind !== 'basic') {
              banner.className = `banner show ${e.kind} ${u.side}`;
              banner.innerHTML = `${label ? `<small>${label}</small>` : ''}<span>${esc(e.skill)}</span>`;
              if (e.kind === 'combo') {
                const c = comboFor(e.uid);
                for (const r of c?.requires ?? []) {
                  const partner = allUnits.find((x) => x.side === u.side && x.unitId === r);
                  if (partner) cardOf(partner.uid)?.classList.add('comboflash');
                }
              }
            }
            e.targets.forEach((t) => cardOf(t)?.classList.add('targeted'));
            await sleep(e.kind === 'basic' ? 380 : 950);
            banner.className = 'banner';
            root.querySelectorAll('.targeted,.comboflash').forEach((n) => n.classList.remove('targeted', 'comboflash'));
            break;
          }
          case 'damage': {
            setHp(e.uid, e.hp, e.shield);
            const c = cardOf(e.uid);
            if (c && !skipping) {
              c.classList.remove('hit');
              void c.offsetWidth;
              c.classList.add('hit');
            }
            float(e.uid, `${e.absorbed && !e.amount ? '盾' : '-' + e.amount}${e.crit ? '!' : ''}`, `dmg ${e.crit ? 'crit' : ''} ${e.source === 'dot' ? 'dot' : ''}`);
            await sleep(e.source === 'dot' ? 300 : 260);
            break;
          }
          case 'heal':
            setHp(e.uid, e.hp, Number((cardOf(e.uid)?.querySelector('.shield-badge') as HTMLElement)?.textContent || 0));
            float(e.uid, `+${e.amount}`, 'heal');
            await sleep(240);
            break;
          case 'shield':
            setHp(e.uid, Number(cardOf(e.uid)?.dataset.hp ?? 0), e.shield);
            float(e.uid, `盾+${e.amount}`, 'shield');
            await sleep(220);
            break;
          case 'rage':
            setRage(e.uid, e.rage);
            if (e.delta < 0 && e.delta !== -RULES.RAGE_CAST) float(e.uid, `怒${e.delta}`, 'ragefx');
            break;
          case 'buff':
            float(e.uid, e.label, e.good ? 'buff' : 'debuff');
            addTag(e.uid, e.label);
            await sleep(180);
            break;
          case 'status':
            float(e.uid, e.label, 'debuff');
            addTag(e.uid, e.label);
            await sleep(180);
            break;
          case 'death': {
            const c = cardOf(e.uid);
            c?.classList.add('dead');
            c?.classList.remove('acting', 'ready');
            renderOrder(order, idx);
            await sleep(420);
            break;
          }
          case 'end':
            break;
        }
      }
      root.querySelectorAll('.acting').forEach((n) => n.classList.remove('acting'));
      showResult();
    }

    function showResult() {
      const win = result.winner === 'ally';
      const oc = o.outcome;
      const stars = oc ? '★'.repeat(oc.stars) + '☆'.repeat(3 - oc.stars) : '';
      const unlocked = oc?.unlocked ? generalById(oc.unlocked) : null;
      const m = document.createElement('div');
      m.className = 'modal result';
      m.innerHTML = `<div class="sheet ${win ? 'win' : 'lose'}">
        <h2>${win ? '大获全胜' : result.reason === 'timeout' ? '久战不胜' : '败北'}</h2>
        ${win ? `<div class="stars">${stars}</div>` : '<p class="muted">提升武将等级、调整阵容或激活羁绊后再来挑战。</p>'}
        <p class="muted">共 ${result.rounds} 回合 · 我方存活 ${result.allyAlive}/${result.allyTotal}</p>
        ${oc ? `<div class="rewards"><span>银两 +${oc.gold}</span>${oc.stones ? `<span>将魂石 +${oc.stones}</span>` : ''}${oc.first ? '<span class="first">首通</span>' : ''}</div>` : ''}
        ${unlocked ? `<div class="unlocked">新武将加入：<b>${esc(unlocked.name)}</b></div>` : ''}
        <div class="btns">
          <button class="btn ghost" data-x="back">返回</button>
          <button class="btn" data-x="again">再战</button>
          ${win && o.hasNext ? '<button class="btn primary" data-x="next">下一关</button>' : ''}
        </div>
      </div>`;
      m.addEventListener('click', (ev) => {
        const x = (ev.target as HTMLElement).closest('[data-x]')?.getAttribute('data-x') as BattleExit | null;
        if (x) resolve(x);
      });
      root.querySelector('.battle')!.appendChild(m);
    }

    play();
  });
}
