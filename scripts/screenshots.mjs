// 用 Chrome 移动端模拟，对运行中的预览服务截图：node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium, devices } from 'playwright-core';
const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? '/workspace';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-CN' });
const now = Date.now();
const save = {
  version: 1, createdAt: now, updatedAt: now,
  resources: { gold: 900, stones: 6 },
  roster: {
    'liu-bei': { owned: true, level: 6, adv: 0 }, 'guan-yu': { owned: true, level: 6, adv: 0 },
    'zhang-fei': { owned: true, level: 5, adv: 0 }, 'cao-cao': { owned: true, level: 6, adv: 0 },
    'guo-jia': { owned: true, level: 5, adv: 0 }, 'xiahou-dun': { owned: true, level: 5, adv: 0 },
    'xu-chu': { owned: true, level: 5, adv: 0 }, 'zhao-yun': { owned: true, level: 3, adv: 0 },
  },
  formation: ['guan-yu', 'xu-chu', 'xiahou-dun', 'liu-bei', 'cao-cao', 'guo-jia'],
  progress: { 'stage-01': { stars: 3, clears: 2 }, 'stage-02': { stars: 2, clears: 1 }, 'stage-03': { stars: 3, clears: 1 } },
  settings: { speed: 1 }, stats: { battles: 5, wins: 4 },
};
await ctx.addInitScript((s) => {
  if (!localStorage.getItem('sgsnl.save')) localStorage.setItem('sgsnl.save', JSON.stringify(s));
  localStorage.setItem('sgsnl.seen', '1');
}, save);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base);
await page.waitForSelector('.stage');
await page.screenshot({ path: `${out}/screenshot-stages.png` });
await page.click('[data-tab=formation]');
await page.click('.slot[data-i="0"]');
await page.screenshot({ path: `${out}/screenshot-formation.png` });
await page.click('[data-tab=roster]');
await page.click('[data-act=detail][data-id="cao-cao"]');
await page.screenshot({ path: `${out}/screenshot-detail.png` });
await page.click('[data-act=close]');
await page.click('[data-tab=synergy]');
await page.screenshot({ path: `${out}/screenshot-synergy.png` });
await page.click('[data-tab=stages]');
await page.click('[data-act=fight][data-id="stage-04"]');
await page.waitForSelector('.battle');
// 把速度调到 1x 观察：等待合击横幅出现并截图；否则在中段截图
let gotCombo = false;
for (let i = 0; i < 400; i++) {
  if (await page.$('.banner.show.combo')) { await page.waitForTimeout(250); await page.screenshot({ path: `${out}/screenshot-battle-combo.png` }); gotCombo = true; break; }
  if (await page.$('.modal.result')) break;
  await page.waitForTimeout(150);
}
console.log('combo captured:', gotCombo);
// 中段截图：重新开一场，等 3 回合后
if (await page.$('.modal.result')) { await page.click('[data-x=again]'); }
await page.waitForFunction(() => /第 [3-9] 回合/.test(document.querySelector('#round')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/screenshot-battle.png` });
await page.click('#skip');
await page.waitForSelector('.modal.result', { timeout: 30000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/screenshot-result.png` });
console.log('errors:', JSON.stringify(errors));
await browser.close();
