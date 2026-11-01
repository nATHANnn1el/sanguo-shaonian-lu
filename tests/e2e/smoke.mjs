// 端到端冒烟测试（真实浏览器 + 移动端模拟）：node tests/e2e/smoke.mjs [baseUrl]
import { chromium, devices } from 'playwright-core';
const base = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok, extra }); console.log(ok ? 'PASS' : 'FAIL', name, extra); };

await page.goto(base);
await page.waitForSelector('.modal .intro');
check('E2E-01 首次进入显示新手引导', true);
await page.click('[data-act=close]');
check('E2E-02 关卡列表渲染 10 关', (await page.$$('.stage')).length === 10, String((await page.$$('.stage')).length));
const locked = await page.$$('.stage button[disabled]');
check('E2E-03 仅第 1 关解锁', locked.length === 9, `locked=${locked.length}`);
// 默认阵容出战第一关
await page.click('[data-act=fight][data-id="stage-01"]');
await page.waitForSelector('.battle');
await page.click('#skip');
await page.waitForSelector('.modal.result', { timeout: 30000 });
const title = await page.textContent('.result h2');
check('E2E-04 第 1 关战斗可完成并出结果', !!title, title);
let save = await page.evaluate(() => JSON.parse(localStorage.getItem('sgsnl.save')));
check('E2E-05 战斗结果写入 localStorage', save.version === 1 && Object.keys(save.progress).length >= 1, JSON.stringify(save.progress));
const goldAfter = save.resources.gold;
await page.click('[data-x=back]');
await page.reload();
await page.waitForSelector('.stage');
const save2 = await page.evaluate(() => JSON.parse(localStorage.getItem('sgsnl.save')));
check('E2E-06 刷新后存档保持', save2.resources.gold === goldAfter);
check('E2E-07 刷新后不再弹出引导', !(await page.$('.modal .intro')));
// 升级
await page.click('[data-tab=roster]');
const own = await page.$('[data-act=detail]');
await own.click();
const lvBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('sgsnl.save')).roster);
const id = await page.getAttribute('[data-act=levelup]', 'data-id');
await page.click('[data-act=levelup]');
const lvAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('sgsnl.save')).roster);
check('E2E-08 武将升级生效', lvAfter[id].level === lvBefore[id].level + 1, `${id}: ${lvBefore[id].level}→${lvAfter[id].level}`);
// 一键布阵 & 下阵
await page.click('[data-act=close]');
await page.click('[data-tab=formation]');
await page.click('.slot[data-i="0"]');
await page.click('[data-act=unslot]');
const f1 = await page.evaluate(() => JSON.parse(localStorage.getItem('sgsnl.save')).formation);
check('E2E-09 下阵生效', f1[0] === null || f1[0] === undefined, JSON.stringify(f1));
await page.click('[data-act=autofill]');
const f2 = await page.evaluate(() => JSON.parse(localStorage.getItem('sgsnl.save')).formation);
check('E2E-10 一键布阵填满阵容', f2.filter(Boolean).length >= 3, JSON.stringify(f2));
// 坏档恢复
await page.evaluate(() => localStorage.setItem('sgsnl.save', '{"version":99,"x":1}'));
await page.reload();
await page.waitForSelector('.stage');
const bak = await page.evaluate(() => localStorage.getItem('sgsnl.save.bak'));
check('E2E-11 不兼容版本存档被备份并重建', !!bak);
// 服务工作线程与清单
await page.waitForTimeout(1500);
const sw = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? null);
check('E2E-12 Service Worker 已激活', sw === 'activated', String(sw));
const man = await page.evaluate(async () => (await (await fetch('./manifest.webmanifest')).json()).display);
check('E2E-13 manifest 为 standalone', man === 'standalone');
check('E2E-14 无页面脚本错误', errors.length === 0, JSON.stringify(errors));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
