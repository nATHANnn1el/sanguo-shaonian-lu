// 用 playwright-core + 系统 Chrome 把 SVG 渲染为各尺寸 PNG 图标（开发期一次性脚本）
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const maskable = svg.replace('rx="96"', 'rx="0"').replace('r="170"', 'r="120"').replace('font-size="190"', 'font-size="135"').replace('y="318"', 'y="304"');
const browser = await chromium.launch({ channel: 'chrome' });
async function shot(markup, size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  writeFileSync(new URL(`../public/icons/${file}`, import.meta.url), await page.screenshot({ omitBackground: true }));
  await page.close();
}
await shot(svg, 192, 'icon-192.png');
await shot(svg, 512, 'icon-512.png');
await shot(svg, 180, 'icon-180.png');
await shot(maskable, 512, 'icon-maskable-512.png');
await browser.close();
