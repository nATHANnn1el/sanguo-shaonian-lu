import { GENERALS, STAGES, SYNERGIES, enemyById, generalById, unitName } from '../data';
import { fightStage } from '../core/game';
import {
  PROG,
  advance,
  advanceCost,
  canAdvance,
  canLevelUp,
  levelCap,
  levelUp,
  levelUpCost,
} from '../core/progression';
import { SAVE_KEY, isUnlocked, loadSave, newSave, writeSave } from '../core/save';
import { activeSynergies, buildSetup, formationPower, generalStats, powerOf, sumBonus } from '../core/setup';
import type { GeneralDef, SaveData, StageDef } from '../core/types';
import { playBattle } from './battleView';
import { FACTION_NAME, ROLE_NAME, portrait } from './svg';

type Tab = 'stages' | 'formation' | 'roster' | 'synergy';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export function startApp(root: HTMLElement, storage: Storage = localStorage) {
  const loaded = loadSave(storage);
  const save: SaveData = loaded.save;
  let tab: Tab = 'stages';
  let selSlot: number | null = null;
  let modal = '';
  let toastTimer = 0;
  let inBattle = false;

  const persist = () => writeSave(storage, save);
  const toast = (msg: string) => {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t!.classList.remove('show'), 1800);
  };

  /* ---------- 小组件 ---------- */
  const heroCard = (g: GeneralDef, extra = '') => {
    const r = save.roster[g.id];
    return `<div class="hcard faction-${g.faction} ${extra}" data-id="${g.id}">
      ${portrait(g.look, g.faction, FACTION_NAME[g.faction])}
      <div class="hname">${esc(g.name)}</div>
      <div class="hmeta">Lv.${r?.level ?? 1}${r && r.adv ? ' ' + '★'.repeat(r.adv) : ''}</div>
    </div>`;
  };
  const statLine = (g: GeneralDef) => {
    const s = generalStats(save, g.id);
    return `<div class="stats"><span>生命 <b>${s.hp}</b></span><span>攻击 <b>${s.atk}</b></span><span>防御 <b>${s.def}</b></span><span>速度 <b>${s.spd}</b></span></div>`;
  };
  const synNames = (id: string) => SYNERGIES.filter((s) => s.members.includes(id)).map((s) => s.name);

  /* ---------- 页面 ---------- */
  function stagesView(): string {
    const power = formationPower(save);
    return `<div class="panel-title">黄巾之乱 <small>第一章 · 10 关</small></div>
    <div class="powerline">我方战力 <b>${power}</b></div>
    ${STAGES.map((s, i) => {
      const unlocked = isUnlocked(save, i);
      const p = save.progress[s.id];
      const ug = s.rewards.unlockGeneral ? generalById(s.rewards.unlockGeneral) : null;
      return `<div class="stage ${unlocked ? '' : 'locked'} ${p ? 'cleared' : ''}">
        <div class="sidx">${s.index}</div>
        <div class="sbody">
          <div class="sname">${esc(s.name)} ${p ? `<span class="sstars">${'★'.repeat(p.stars)}${'☆'.repeat(3 - p.stars)}</span>` : ''}</div>
          <div class="sintro">${esc(s.intro)}</div>
          <div class="senemies">${s.enemies
            .slice()
            .sort((a, b) => a.slot - b.slot)
            .map((e) => `<span class="mini ${enemyById(e.unit).boss ? 'boss' : ''}" title="${esc(enemyById(e.unit).name)}">${esc(enemyById(e.unit).name.slice(0, 2))}<i>${e.level}</i></span>`)
            .join('')}</div>
          <div class="sfoot">建议战力 <b class="${power >= s.recommended ? 'ok' : 'warn'}">${s.recommended}</b>
            · 奖励 银两${s.rewards.gold}${s.rewards.stones ? ' 魂石' + s.rewards.stones : ''}${ug ? ` · <span class="gain">解锁 ${esc(ug.name)}${save.roster[ug.id]?.owned ? '（已获得）' : ''}</span>` : ''}</div>
        </div>
        <button class="btn primary go" data-act="fight" data-id="${s.id}" ${unlocked ? '' : 'disabled'}>${unlocked ? '出战' : '未解锁'}</button>
      </div>`;
    }).join('')}`;
  }

  function formationView(): string {
    const syns = activeSynergies(save.formation);
    const bonus = sumBonus(syns);
    const slot = (i: number) => {
      const id = save.formation[i];
      const g = id ? generalById(id) : null;
      return `<div class="slot ${selSlot === i ? 'sel' : ''} ${g ? 'filled' : ''}" data-act="slot" data-i="${i}">
        ${
          g
            ? `${portrait(g.look, g.faction)}<div class="hname">${esc(g.name)}</div><div class="hmeta">${ROLE_NAME[g.role]} · ${generalStats(save, g.id, bonus).spd}速</div>`
            : '<div class="plus">+</div>'
        }
      </div>`;
    };
    const owned = GENERALS.filter((g) => save.roster[g.id]?.owned);
    return `<div class="panel-title">阵容 <small>战力 ${formationPower(save)}</small></div>
    <div class="form-hint">${selSlot === null ? '点击阵位选中，再点下方武将上阵；点另一阵位可互换位置。' : `已选中${selSlot < 3 ? '前' : '后'}排第 ${(selSlot % 3) + 1} 位，选择下方武将上阵。`}</div>
    <div class="formation">
      <div class="rowlabel">前排（承受攻击）</div>
      <div class="frow">${[0, 1, 2].map(slot).join('')}</div>
      <div class="rowlabel">后排</div>
      <div class="frow">${[3, 4, 5].map(slot).join('')}</div>
    </div>
    <div class="form-actions">
      <button class="btn ghost" data-act="unslot" ${selSlot !== null && save.formation[selSlot] ? '' : 'disabled'}>下阵</button>
      <button class="btn ghost" data-act="autofill">一键布阵</button>
    </div>
    <div class="syn-active">${
      syns.length
        ? syns.map((s) => `<div class="synchip on"><b>${esc(s.name)}</b> ${esc(s.desc)}</div>`).join('')
        : '<div class="muted">尚未激活羁绊。查看「羁绊」页了解组合。</div>'
    }</div>
    <div class="panel-title small">可用武将</div>
    <div class="bench">${owned
      .map((g) => {
        const onIdx = save.formation.indexOf(g.id);
        return `<div class="benchitem ${onIdx >= 0 ? 'placed' : ''}" data-act="assign" data-id="${g.id}">${heroCard(g)}${onIdx >= 0 ? '<span class="tag">已上阵</span>' : ''}</div>`;
      })
      .join('')}</div>`;
  }

  function rosterView(): string {
    return `<div class="panel-title">武将 <small>${GENERALS.filter((g) => save.roster[g.id]?.owned).length}/${GENERALS.length}</small></div>
    <div class="grid">${GENERALS.map((g) => {
      const own = save.roster[g.id]?.owned;
      if (own) return `<div data-act="detail" data-id="${g.id}">${heroCard(g)}</div>`;
      const st = STAGES.find((s) => s.id === g.unlock);
      return `<div class="hcard locked" data-act="locked" data-id="${g.id}"><div class="lockbox">？</div><div class="hname">${esc(g.name)}</div><div class="hmeta">通关第${st?.index ?? '?'}关</div></div>`;
    }).join('')}</div>`;
  }

  function synergyView(): string {
    const active = new Set(activeSynergies(save.formation).map((s) => s.id));
    return `<div class="panel-title">羁绊 <small>${SYNERGIES.length} 组</small></div>
    ${SYNERGIES.map((s) => {
      return `<div class="syn ${active.has(s.id) ? 'on' : ''}">
        <div class="synhead"><b>${esc(s.name)}</b>${active.has(s.id) ? '<span class="tag on">已激活</span>' : ''}${s.combo ? '<span class="tag combo">合击</span>' : ''}</div>
        <div class="synmembers">${s.members
          .map((m) => {
            const g = generalById(m);
            const own = save.roster[m]?.owned;
            return `<div class="sm ${own ? '' : 'dim'}">${portrait(g.look, g.faction)}<span>${esc(g.name)}${own ? '' : '（未获得）'}</span></div>`;
          })
          .join('')}</div>
        <div class="syndesc">${esc(s.desc)}</div>
        ${s.combo ? `<div class="combodesc"><b>合击·${esc(s.combo.skill.name)}</b>（${esc(unitName(s.combo.lead))}发动）${esc(s.combo.skill.desc)}</div>` : ''}
      </div>`;
    }).join('')}`;
  }

  function detailModal(id: string): string {
    const g = generalById(id);
    const r = save.roster[id];
    const lu = canLevelUp(save, id);
    const ad = canAdvance(save, id);
    const cap = levelCap(r.adv);
    const sk = (title: string, s: { name: string; desc: string }) =>
      `<div class="skill"><b>${title}·${esc(s.name)}</b><p>${esc(s.desc)}</p></div>`;
    const syn = synNames(id);
    return `<div class="sheet detail">
      <button class="close" data-act="close">✕</button>
      <div class="dhead">${portrait(g.look, g.faction, FACTION_NAME[g.faction])}
        <div><h2>${esc(g.name)} <small>${esc(g.title)}</small></h2>
          <div class="muted">${FACTION_NAME[g.faction]} · ${ROLE_NAME[g.role]}</div>
          <div class="lv">Lv.${r.level}/${cap}　进阶 ${'★'.repeat(r.adv)}${'☆'.repeat(PROG.MAX_ADV - r.adv)}</div>
        </div></div>
      ${statLine(g)}
      <p class="bio">${esc(g.bio)}</p>
      ${sk('普攻', g.basic)}${sk('绝技', g.ultimate)}
      ${syn.length ? `<div class="muted">羁绊：${syn.map(esc).join('、')}</div>` : ''}
      <div class="btns">
        <button class="btn" data-act="levelup" data-id="${id}" ${lu.ok ? '' : 'disabled'}>升级 <small>银两 ${levelUpCost(r.level)}</small></button>
        <button class="btn primary" data-act="advance" data-id="${id}" ${ad.ok ? '' : 'disabled'}>进阶 <small>魂石 ${r.adv >= PROG.MAX_ADV ? '—' : advanceCost(r.adv)}</small></button>
      </div>
      <div class="muted center">${!lu.ok ? esc(lu.reason) : ''}${!lu.ok && !ad.ok ? '；' : ''}${!ad.ok && r.adv < PROG.MAX_ADV ? esc(ad.reason) : ''}</div>
    </div>`;
  }

  function introModal(): string {
    return `<div class="sheet intro">
      <h2>欢迎来到《三国少年录》</h2>
      <ul>
        <li><b>布阵</b>：6 个阵位，前排吸引攻击，后排输出更安全。</li>
        <li><b>自动战斗</b>：速度高者先行动；普攻 +2 怒气，被击 +1 怒气，满 4 点自动放绝技。</li>
        <li><b>羁绊</b>：特定武将同时上阵获得加成；曹操+郭嘉可触发<b>合击</b>。</li>
        <li><b>成长</b>：用银两升级，满级后用将魂石进阶；通关解锁新武将。</li>
      </ul>
      <p class="muted">本作为原创练习作品，进度保存在本机浏览器。可在浏览器菜单中「添加到主屏幕」。</p>
      <div class="btns"><button class="btn primary" data-act="close">开始</button></div>
    </div>`;
  }

  function settingsModal(): string {
    return `<div class="sheet">
      <button class="close" data-act="close">✕</button>
      <h2>设置</h2>
      <p class="muted">战斗统计：${save.stats.battles} 场，胜 ${save.stats.wins} 场</p>
      <div class="btns"><button class="btn ghost" data-act="help">玩法说明</button><button class="btn danger" data-act="reset">重置存档</button></div>
    </div>`;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    if (inBattle) return;
    const body = { stages: stagesView, formation: formationView, roster: rosterView, synergy: synergyView }[tab]();
    const tabs: [Tab, string][] = [
      ['stages', '出征'],
      ['formation', '阵容'],
      ['roster', '武将'],
      ['synergy', '羁绊'],
    ];
    root.innerHTML = `<div class="shell">
      <header class="topbar"><div class="logo">三国少年录</div>
        <div class="res"><span class="gold">银两 <b>${save.resources.gold}</b></span><span class="stone">魂石 <b>${save.resources.stones}</b></span></div>
        <button class="chip" data-act="settings">设置</button></header>
      <main class="content" id="content">${body}</main>
      <nav class="tabbar">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}</button>`).join('')}</nav>
      ${modal ? `<div class="modal" data-act="modalbg">${modal}</div>` : ''}
    </div>`;
  }

  /* ---------- 战斗流程 ---------- */
  async function runStage(stage: StageDef) {
    if (!save.formation.some(Boolean)) {
      toast('请先上阵至少一名武将');
      tab = 'formation';
      render();
      return;
    }
    inBattle = true;
    modal = '';
    const seed = (Math.random() * 2 ** 31) | 0;
    const setup = buildSetup(save, stage, seed);
    const { result, outcome } = fightStage(save, stage.id, seed);
    persist();
    const idx = STAGES.findIndex((s) => s.id === stage.id);
    const next = STAGES[idx + 1];
    const exit = await playBattle({
      root,
      save,
      stage,
      setup,
      result,
      outcome,
      hasNext: !!next && isUnlocked(save, idx + 1),
      onSpeed: (s) => {
        save.settings.speed = s;
        persist();
      },
    });
    inBattle = false;
    if (exit === 'again') return runStage(stage);
    if (exit === 'next' && next) return runStage(next);
    tab = 'stages';
    render();
  }

  /* ---------- 事件 ---------- */
  root.addEventListener('click', (ev) => {
    const el = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el || inBattle) return;
    const act = el.dataset.act!;
    const id = el.dataset.id;
    if (act === 'modalbg') {
      if (ev.target === el) {
        modal = '';
        render();
      }
      return;
    }
    switch (act) {
      case 'tab':
        tab = el.dataset.tab as Tab;
        selSlot = null;
        render();
        break;
      case 'fight':
        void runStage(STAGES.find((s) => s.id === id)!);
        break;
      case 'slot': {
        const i = Number(el.dataset.i);
        if (selSlot !== null && selSlot !== i) {
          const f = save.formation;
          [f[selSlot], f[i]] = [f[i], f[selSlot]];
          selSlot = null;
          persist();
        } else selSlot = selSlot === i ? null : i;
        render();
        break;
      }
      case 'assign': {
        if (!id) break;
        const f = save.formation;
        const cur = f.indexOf(id);
        let target = selSlot;
        if (target === null) {
          if (cur >= 0) {
            selSlot = cur;
            render();
            return;
          }
          target = f.findIndex((x) => x === null);
          if (target < 0) {
            toast('阵位已满：先选中一个阵位再替换');
            return;
          }
        }
        if (cur >= 0) [f[cur], f[target]] = [f[target], f[cur]];
        else f[target] = id;
        selSlot = null;
        persist();
        render();
        break;
      }
      case 'unslot':
        if (selSlot !== null) {
          save.formation[selSlot] = null;
          selSlot = null;
          persist();
          render();
        }
        break;
      case 'autofill': {
        const owned = GENERALS.filter((g) => save.roster[g.id]?.owned);
        const best = owned
          .map((g) => ({ g, p: powerOf(generalStats(save, g.id)) }))
          .sort((a, b) => b.p - a.p)
          .slice(0, 6)
          .map((x) => x.g);
        const front = best.filter((g) => g.role === 'guardian' || g.role === 'warrior').sort((a, b) => b.hp - a.hp);
        const back = best.filter((g) => !front.includes(g));
        const slots: (string | null)[] = [null, null, null, null, null, null];
        front.slice(0, 3).forEach((g, i) => (slots[i] = g.id));
        [...back, ...front.slice(3)].slice(0, 3).forEach((g, i) => (slots[3 + i] = g.id));
        save.formation = slots;
        selSlot = null;
        persist();
        render();
        toast('已按战力与职业自动布阵');
        break;
      }
      case 'detail':
        modal = detailModal(id!);
        render();
        break;
      case 'locked': {
        const g = generalById(id!);
        const st = STAGES.find((s) => s.id === g.unlock);
        toast(`通关「${st?.name ?? ''}」（第${st?.index}关）可获得${g.name}`);
        break;
      }
      case 'levelup': {
        const r = levelUp(save, id!);
        if (!r.ok) toast(r.reason);
        else persist();
        modal = detailModal(id!);
        render();
        break;
      }
      case 'advance': {
        const r = advance(save, id!);
        if (!r.ok) toast(r.reason);
        else {
          persist();
          toast('进阶成功！');
        }
        modal = detailModal(id!);
        render();
        break;
      }
      case 'settings':
        modal = settingsModal();
        render();
        break;
      case 'help':
        modal = introModal();
        render();
        break;
      case 'reset':
        if (confirm('确定要清除所有进度吗？此操作不可恢复。')) {
          storage.removeItem(SAVE_KEY);
          Object.assign(save, newSave());
          modal = '';
          tab = 'stages';
          persist();
          render();
          toast('存档已重置');
        }
        break;
      case 'close':
        modal = '';
        render();
        break;
    }
  });

  if (loaded.recovered) toast('存档版本不兼容，已为你新建存档（旧档已备份）');
  if (!storage.getItem('sgsnl.seen')) {
    modal = introModal();
    storage.setItem('sgsnl.seen', '1');
  }
  render();
  (window as unknown as { __game?: unknown }).__game = { save, render: () => render() };
  
}
