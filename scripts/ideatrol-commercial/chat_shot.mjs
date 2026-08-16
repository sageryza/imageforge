// Screenshot a batch of HTML frames at 1024x1536.
// Usage: node chat_shot.mjs <shots.json>   where shots.json = [{file, html}]
import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';

const shots = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({
  viewport: { width: 512, height: 768 },
  deviceScaleFactor: 2,
});
for (const s of shots) {
  await page.setContent(s.html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: s.file });
  console.log('shot', s.file);
}
await browser.close();
