#!/usr/bin/env node
/**
 * marla-textplace.js — the caption ON the picture instead of in a band under it.
 *
 * Sophie: "you asked for a clearer bottom but then you still put the text
 * underneath it." True — captionPage() in marla-revise.js paints an opaque
 * cream band over the bottom of every page, so the calm bottom third the
 * prompt asks for is covered up and paid for twice.
 *
 * Three treatments, hers, chosen per page by what is actually drawn down there
 * (measured by marla-bottoms.js, never guessed):
 *
 *   clear   the bottom is bare paper — the text goes straight on it
 *   veil    there is a light wash or a stray object — a white veil that fades
 *           in downward gives the text a place without hiding the picture,
 *           optionally over a soft blur of what is underneath
 *   byhand  the bottom is DARK edge to edge — no veil is honest there, so the
 *           text goes on the facing page and the picture is left alone
 *
 * THE VEIL IS THE ONE GRADIENT IN THIS REPO, and it is deliberate: the house
 * rule bans gradients in UI, and Sophie asked for exactly this here — "a white
 * level that fades in with low opacity, so the text still has a place". A hard
 * edge would just be the cream band again.
 *
 *   node scripts/marla-textplace.js --pages 24,1,17 [--post]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CHAT = 'marlas-eyes-fishbowl-storybook';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/state.json'), 'utf8'));
const bottoms = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/bottoms.json'), 'utf8'));
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const POST = process.argv.includes('--post');

const W = 1024, H = 1536;
const FONT = "Georgia, 'Times New Roman', serif";
const INK = '#2c2622', PAPER = '#fffdf6';

// The bucket a page falls in. Calibrated by LOOKING at the bottom bands, not
// by picking numbers: p22 at heavy .038 is a shoe in one corner over bare
// paper (clear); p1 at .53 is a pale wash with nothing drawn in it, which a
// veil sits on happily; p17 at mean 129 is a solid dark wash where a veil
// strong enough to read would visibly bleach the picture.
const bucketOf = (r) => (r.heavy <= 0.05 ? 'clear' : r.mean < 40 ? 'veil' : 'byhand');

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
function wrap(text, max) {
  const lines = []; let cur = '';
  for (const w of String(text).trim().split(/\s+/).filter(Boolean)) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur.trim()); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines;
}
function textSvg(lines, topY, fontSize) {
  const lineH = Math.round(fontSize * 1.34);
  const tspans = lines.map((l, i) => `<tspan x="${W / 2}" y="${topY + fontSize + i * lineH}">${escapeXml(l)}</tspan>`).join('');
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
    + `<text font-family="${FONT}" font-size="${fontSize}" fill="${INK}" text-anchor="middle" font-style="italic">${tspans}</text></svg>`;
}

async function fit(buf) { return sharp(buf).resize(W, H, { fit: 'cover' }).toBuffer(); }

async function clearPage(buf, words) {
  const lines = wrap(words, 40), fontSize = 36, lineH = Math.round(fontSize * 1.34);
  const blockH = lines.length * lineH;
  const topY = H - blockH - 70;
  return sharp(await fit(buf))
    .composite([{ input: Buffer.from(textSvg(lines, topY, fontSize)), top: 0, left: 0 }])
    .webp({ quality: 92 }).toBuffer();
}

async function veilPage(buf, words, { blur = true } = {}) {
  const lines = wrap(words, 40), fontSize = 36, lineH = Math.round(fontSize * 1.34);
  const blockH = lines.length * lineH;
  const topY = H - blockH - 70;
  const veilTop = Math.max(0, topY - 150);          // the fade starts above the words
  const veilH = H - veilTop;
  const base = await fit(buf);

  // Blur only what sits under the words, then feather the veil over it. The
  // blur is what lets the veil stay light — 0.62 reads as haze, not paint.
  let art = base;
  if (blur) {
    const region = await sharp(base).extract({ left: 0, top: veilTop, width: W, height: veilH }).blur(9).toBuffer();
    art = await sharp(base).composite([{ input: region, top: veilTop, left: 0 }]).toBuffer();
  }
  const veil = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
    + `<defs><linearGradient id="v" x1="0" y1="${veilTop}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">`
    + `<stop offset="0" stop-color="${PAPER}" stop-opacity="0"/>`
    + `<stop offset="0.45" stop-color="${PAPER}" stop-opacity="0.62"/>`
    + `<stop offset="1" stop-color="${PAPER}" stop-opacity="0.72"/></linearGradient></defs>`
    + `<rect x="0" y="${veilTop}" width="${W}" height="${veilH}" fill="url(#v)"/></svg>`;
  return sharp(art).composite([
    { input: Buffer.from(veil), top: 0, left: 0 },
    { input: Buffer.from(textSvg(lines, topY, fontSize)), top: 0, left: 0 },
  ]).webp({ quality: 92 }).toBuffer();
}

// The picture untouched, and the words on the page beside it — what a real
// spread does. Rendered as one landscape sheet so the pair can be judged.
async function facingPage(buf, words) {
  const lines = wrap(words, 30), fontSize = 40, lineH = Math.round(fontSize * 1.34);
  const art = await fit(buf);
  const blockH = lines.length * lineH;
  const y0 = Math.round(H / 2 - blockH / 2);
  const tspans = lines.map((l, i) => `<tspan x="${W / 2}" y="${y0 + fontSize + i * lineH}">${escapeXml(l)}</tspan>`).join('');
  const leaf = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
    + `<rect width="${W}" height="${H}" fill="${PAPER}"/>`
    + `<text font-family="${FONT}" font-size="${fontSize}" fill="${INK}" text-anchor="middle" font-style="italic">${tspans}</text></svg>`);
  return sharp({ create: { width: W * 2, height: H, channels: 3, background: PAPER } })
    .composite([{ input: leaf, top: 0, left: 0 }, { input: art, top: 0, left: W }])
    .webp({ quality: 92 }).toBuffer();
}

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  const pid = JSON.parse(raw).project_id;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), storageBucket: `${pid}.firebasestorage.app` });
}
async function upload(buf, dest, type) {
  const bucket = admin.storage().bucket();
  const tmp = path.join(os.tmpdir(), path.basename(dest));
  fs.writeFileSync(tmp, buf);
  await bucket.upload(tmp, { destination: dest, metadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  await bucket.file(dest).makePublic();
  fs.unlink(tmp, () => {});
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

(async () => {
  const want = String(arg('pages', '24,1,17')).split(',').map(Number);
  initAdmin();
  const out = [];
  for (const n of want) {
    const row = bottoms.find((r) => r.n === n);
    const words = (state.pages[String(n)] || {}).words || '';
    if (!row || !words) { console.log(`p${n}: no art or no words`); continue; }
    const buf = Buffer.from(await (await fetch(row.url)).arrayBuffer());
    const b = bucketOf(row);
    const made = {};
    made.clear = await upload(await clearPage(buf, words), `storybook/marla/text/p${n}-clear.webp`, 'image/webp');
    made.veil = await upload(await veilPage(buf, words), `storybook/marla/text/p${n}-veil.webp`, 'image/webp');
    made.facing = await upload(await facingPage(buf, words), `storybook/marla/text/p${n}-facing.webp`, 'image/webp');
    out.push({ n, bucket: b, heavy: row.heavy, mean: row.mean, ...made });
    console.log(`p${n} (${b}) done`);
  }
  fs.writeFileSync(path.join(ROOT, 'docs/marla/textplace.json'), JSON.stringify(out, null, 1) + '\n');
  if (!POST) return;
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
