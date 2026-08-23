#!/usr/bin/env node
/**
 * ONE SHEET OF FOUR PANELS, CUT INTO FOUR PICTURES (Aug 2026, Sophie: "maybe I
 * could do the panel trick where you make four panels and then cut them out …
 * and if I used 2K then they would actually be the right resolution").
 *
 * WHY IT IS CHEAPER, measured rather than argued (docs/modules/pictures.md):
 * output tokens scale sub-linearly with pixels, AND a sheet is ONE call, so it
 * pays the style reference's ~1.2c once instead of four times. Per finished
 * picture at medium, all-in with one ref:
 *     four separate 1024x1536 draws   5.39c each
 *     one 2336x3504 sheet, quartered  3.25c each   (1168x1752 — 1.30x a 1K)
 *     one 1568x2352 sheet, quartered  1.96c each   (784x1176  — 0.59x a 1K)
 * So 4K is the tier that makes a quarter BIGGER than an ordinary 1K picture;
 * 2K is cheaper still but the quarters come out smaller than a plain 1K image,
 * which is the thing that is easy to get backwards.
 *
 * THE STYLE'S OWN TAIL FIGHTS THIS. PL_GPT_STYLES.dreamy ends "Render as ONE
 * single illustration — NOT a grid, NOT split panels", which is load-bearing
 * for ordinary runs (the reference IS a multi-panel comic page and the model
 * will happily copy its layout). A sheet has to REPLACE that tail, never
 * append to it — two sentences arguing produce one panel with three ghosts of
 * the others. That is why this script carries its own suffix rather than
 * reusing the style's.
 *
 *   node scripts/panel-sheet.js --spec sheet.json --size 2336x3504
 *     [--quality medium] [--dry-run]
 *
 * The spec is { prefix, panels: [4 strings], suffix } — panels in reading
 * order, top-left, top-right, bottom-left, bottom-right.
 *
 * Cutting is local, free and lossless: exact halves, so a quarter keeps the
 * sheet's aspect ratio exactly.
 *
 * Needs OPENAI_API_KEY and FIREBASE_SERVICE_ACCOUNT (Deck Factory).
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const RATE = { textIn: 5 / 1e6, imageIn: 8 / 1e6, imageOut: 30 / 1e6 };
const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf('--' + n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const dry = args.includes('--dry-run');
const size = flag('size', '2336x3504');
const quality = flag('quality', 'medium');
const specPath = flag('spec');
if (!specPath) { console.error('need --spec <file.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
if (!Array.isArray(spec.panels) || spec.panels.length !== 4) {
  console.error('the spec needs exactly 4 panels'); process.exit(1);
}

const [W, H] = size.split('x').map(Number);
// The same constraints the Playground's tiers obey.
if (W % 16 || H % 16 || W * H > 8294400 || W * H < 655360 || Math.max(W, H) > 3840) {
  console.error('illegal canvas ' + size); process.exit(1);
}
// A quarter has to land on whole pixels or the four cuts do not tile the sheet.
if (W % 2 || H % 2) { console.error('sheet must halve evenly'); process.exit(1); }

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const prompt = [
  spec.prefix,
  '',
  'Draw a 2x2 grid of FOUR separate illustrations on one page, in reading order.',
  ...spec.panels.map((p, i) => `${CORNERS[i]}: ${p}`),
  '',
  spec.suffix,
].join('\n');

(async () => {
  console.log(`sheet   ${size} ${quality}  →  four ${W / 2}x${H / 2} pictures`);
  console.log('\n--- prompt, sent verbatim ---\n' + prompt + '\n---');
  if (dry) return process.exit(0);

  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  admin.initializeApp({ credential: admin.credential.cert(sa),
    storageBucket: `${sa.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();

  const refBuf = fs.readFileSync(path.join(__dirname, '..', 'refs',
    spec.ref || 'dream-mystery.jpg'));
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('output_format', 'webp');       // NO output_compression, ever
  form.append('moderation', 'low');
  form.append('image[]', new Blob([refBuf], { type: 'image/png' }), 'ref1.png');

  console.log('\ndrawing…');
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image came back');
  const sheet = Buffer.from(b64, 'base64');
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${(sheet.length / 1024).toFixed(0)}KB`);

  const u = data.usage || {};
  const inD = u.input_tokens_details || {}, outD = u.output_tokens_details || {};
  const imgOut = outD.image_tokens || u.output_tokens || 0;
  const total = imgOut * RATE.imageOut + (inD.image_tokens || 0) * RATE.imageIn
    + (inD.text_tokens || 0) * RATE.textIn;
  console.log(`cost    ${(total * 100).toFixed(2)}c the sheet = `
    + `${(total * 100 / 4).toFixed(2)}c a picture`);

  const stamp = Date.now();
  const put = async (buf, name) => {
    const f = bucket.file(name);
    await f.save(buf, { metadata: { contentType: 'image/webp' } });
    await f.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${name}`;
  };
  console.log('\nsheet   ' + await put(sheet, `promptlab/${stamp}-sheet-${W}x${H}.webp`));
  // Exact halves — lossless crop, no resample, so a quarter is the sheet's own
  // pixels rather than a re-encode of them.
  const qw = W / 2, qh = H / 2;
  for (let i = 0; i < 4; i++) {
    const left = (i % 2) * qw, top = Math.floor(i / 2) * qh;
    const cut = await sharp(sheet).extract({ left, top, width: qw, height: qh })
      .webp({ lossless: true }).toBuffer();
    console.log(`${CORNERS[i].padEnd(13)} ` + await put(cut, `promptlab/${stamp}-p${i + 1}-${qw}x${qh}.webp`));
  }
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
