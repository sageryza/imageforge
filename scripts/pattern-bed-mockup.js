#!/usr/bin/env node
// pattern-bed-mockup.js — a pattern tile shown as a BEDSPREAD (2026-09-22,
// Sophie: "mock up new fruit w new banana as a bed spread, same w sea
// animals"). No model call: a bed is drawn in HTML/CSS — wall, floor, a
// headboard, two pillows and a duvet — with the tile as the duvet's fabric,
// tilted in perspective so the pattern runs away from the camera the way a
// real bedspread does, photographed in headless Chromium. Free, so a new
// version of a pattern gets a new picture in seconds.
//
//   node scripts/pattern-bed-mockup.js --tile <name> [--tile <name> …] [--repeat 3]
//        [--post] [--chat animal-fruit-patterns] [--v 1] [--supersede <pageId>]
//
// <name> is a pattern the card-pattern script wrote (scripts/patterns/<name>.json
// with its tile png in the scratch out dir). --repeat is how many tiles run
// across the duvet's width (bigger number = smaller print).

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined && !String(args[i + 1]).startsWith('--') ? args[i + 1] : d; };
const flags = (n) => args.map((a, i) => (a === '--' + n ? args[i + 1] : null)).filter(Boolean);
const has = (n) => args.includes('--' + n);
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const CHAT = flag('chat', 'animal-fruit-patterns');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const VERSION = flag('v', '1');
const REPEAT = Number(flag('repeat', 3));
const POST = has('post');
const SUPERSEDE = (flag('supersede', '') || '').split(',').filter(Boolean);
const SCRATCH = process.env.CLAUDE_SCRATCH || path.join(process.env.TMPDIR || '/tmp', 'card-pattern');
const OUT = path.join(SCRATCH, 'mockups');
fs.mkdirSync(OUT, { recursive: true });
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TILES = flags('tile');
if (!TILES.length) { console.error('usage: --tile <pattern name> [--tile …] [--post]'); process.exit(2); }

// The room. Flat colours only. The duvet is a plane rotated back in 3-D with
// the tile as a repeating background; the pillows and the fold at the top are
// plain white cloth so the print reads as fabric on a bed, not a poster.
function page(tileDataUrl, repeat) {
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;width:1600px;height:1200px;overflow:hidden;background:#efe9df;font-family:sans-serif}
  .room{position:relative;width:1600px;height:1200px;background:#efe9df}
  .floor{position:absolute;left:0;right:0;bottom:0;height:300px;background:#cbb69a}
  .base{position:absolute;left:0;right:0;bottom:300px;height:14px;background:#e6dfd3}
  .scene{position:absolute;left:0;top:0;width:1600px;height:1200px;perspective:1900px;perspective-origin:50% 28%}
  .head{position:absolute;left:290px;top:250px;width:1020px;height:330px;background:#8a6a4f;border-radius:18px 18px 0 0}
  .head:after{content:"";position:absolute;inset:22px 22px 0 22px;background:#9c7a5c;border-radius:12px 12px 0 0}
  .bed{position:absolute;left:300px;top:560px;width:1000px;height:640px;transform-style:preserve-3d;transform:rotateX(62deg);transform-origin:50% 0}
  .mattress{position:absolute;left:0;top:0;width:1000px;height:1080px;background:#fff}
  .duvet{position:absolute;left:-30px;top:170px;width:1060px;height:980px;background:#fff url(${tileDataUrl}) repeat;background-size:${Math.round(1060 / repeat)}px ${Math.round(1060 / repeat)}px;box-shadow:0 0 0 1px rgba(0,0,0,.06) inset}
  .fold{position:absolute;left:-30px;top:170px;width:1060px;height:70px;background:#fff;box-shadow:0 8px 12px -6px rgba(0,0,0,.18)}
  .pillow{position:absolute;top:30px;width:400px;height:150px;background:#fff;border-radius:22px;box-shadow:0 10px 18px -8px rgba(0,0,0,.25)}
  .p1{left:70px}.p2{left:530px}
  .side{position:absolute;left:300px;top:560px;width:1000px;height:0}
  .drop{position:absolute;left:270px;top:1145px;width:1060px;height:55px;background:#fff url(${tileDataUrl}) repeat;background-size:${Math.round(1060 / repeat)}px ${Math.round(1060 / repeat)}px;background-position:0 -${Math.round(1060 / repeat) * 0.55}px}
  .shade{position:absolute;left:270px;top:1145px;width:1060px;height:55px;background:rgba(0,0,0,.10)}
</style>
<div class="room">
  <div class="floor"></div><div class="base"></div>
  <div class="head"></div>
  <div class="scene">
    <div class="bed">
      <div class="mattress"></div>
      <div class="duvet"></div>
      <div class="fold"></div>
      <div class="pillow p1"></div><div class="pillow p2"></div>
    </div>
  </div>
  <div class="drop"></div><div class="shade"></div>
</div>`;
}

async function upload(buf, filename, ct) {
  const q = new URLSearchParams({ session: 'pattern-bed-mockup', bundle: `bedspread mockups v${VERSION}`, filename });
  const r = await fetch(`${BASE}/api/drop/upload-file?${q}`, { method: 'POST', headers: { 'Content-Type': ct }, body: buf });
  const j = await r.json();
  if (!j.ok) throw new Error(`upload ${filename}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.item;
}
async function post(url, body) { return (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }

(async () => {
  const { chromium } = require('playwright');
  const sharp = require('sharp');
  const exe = ['/opt/pw-browsers/chromium', process.env.PW_CHROMIUM].filter((p) => p && fs.existsSync(p))[0];
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  const shots = [];
  for (const name of TILES) {
    const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'patterns', `${slug(name)}.json`), 'utf8'));
    const tilePath = path.join(SCRATCH, 'out', `${slug(name)}.png`);
    if (!fs.existsSync(tilePath)) throw new Error(`no tile at ${tilePath} — draw "${name}" with card-pattern.js first`);
    // A 3072px tile as a data url is heavy for the page; the duvet shows it at ~350px a repeat.
    const small = await sharp(tilePath).resize(1024, 1024).png().toBuffer();
    const dataUrl = `data:image/png;base64,${small.toString('base64')}`;
    await pg.setContent(page(dataUrl, REPEAT), { waitUntil: 'load' });
    await pg.waitForTimeout(150);
    const png = await pg.screenshot({ type: 'png' });
    const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
    const file = path.join(OUT, `${slug(name)}-bed.webp`);
    fs.writeFileSync(file, webp);
    shots.push({ name: spec.name || name, key: slug(name), webp, file });
    console.log(`${name} → ${file}`);
  }
  await browser.close();
  if (!POST) return;

  const items = [];
  for (const s of shots) {
    const it = await upload(s.webp, `${s.key}-bedspread.webp`, 'image/webp');
    await post(`${BASE}/api/gallery`, { assetsOnly: true, chat: CHAT, session: SESSION, url: it.url, description: `${s.name} — as a bedspread (mockup, drawn in CSS)`, prompt: `pattern-bed-mockup.js · ${REPEAT} across` });
    items.push({ ...s, url: it.url });
  }
  const title = `Bedspread mockups v${VERSION} — ${items.map((i) => i.name).join(', ')}`;
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>figcaption{font-size:12px;color:var(--ink2);text-align:center;margin-top:4px}figure{margin:0 0 14px}</style>
<div class="wrap">
  <h1>${esc(title)}</h1>
${items.map((it) => `  <figure data-item="bed-${esc(it.key)}"><img src="${esc(it.url)}" alt="${esc(it.name)} as a bedspread" width="1600" height="1200" loading="lazy"><figcaption>${esc(it.name)}</figcaption></figure>`).join('\n')}
</div>
<script src="/compare.js"></script>
<script>(function(){ if (window.__compareNotes) window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: 'bed-mockups-v${VERSION}' }); if (window.__compareHelp) window.__compareHelp({ html: '<b>A drawn bed, not a photo.</b> The pattern is the real tile repeated on the duvet. Tap + to say what to change — the size of the print, the colours, the room.' }); })();</script>
`;
  const posted = await post(`${BASE}/api/chatfeed/page`, { chat: CHAT, session: SESSION, title, html });
  console.log('page', JSON.stringify(posted));
  for (const id of SUPERSEDE) console.log('superseded', id, (await fetch(`${BASE}/api/chatfeed/page/${id}/supersede`, { method: 'POST' })).status);
  console.log(`\npage: ${BASE}/api/chatfeed/page/${posted.id}`);
})().catch((e) => { console.error(e); process.exit(1); });
