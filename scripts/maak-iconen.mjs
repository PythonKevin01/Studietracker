// Eenmalig: zet public/icons/icoon.svg om naar PNG's voor installeren op telefoons.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync('public/icons/icoon.svg', 'utf8');
const browser = await chromium.launch();
for (const maat of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: maat, height: maat } });
  await page.setContent(`<style>*{margin:0}svg{width:${maat}px;height:${maat}px;display:block}</style>${svg}`);
  await page.screenshot({ path: `public/icons/icoon-${maat}.png` });
}
await browser.close();
