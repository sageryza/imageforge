#!/usr/bin/env node
/**
 * char-sheet.js — character reference sheets for Sophie's storybooks.
 *
 * The Marla sheet was built inside her book's own script; these three books
 * need the same thing, so the recipe lives here once instead of being copied
 * three more times.
 *
 * THE RECIPE (docs/evan-film-style.md, and settled with her on the Marla book):
 *   - gpt-image-2, the image EDITS endpoint
 *   - refs/sage-sandy-mirror.png attached as a pure STYLE reference
 *   - quality medium, size 1024x1536
 *   - NO written style description. That is the headline rule of that doc and
 *     the easiest thing to "improve" back into a regression.
 *
 * THREE VIEWS ON ONE PAGE, always. The first Marla card was a head-on portrait
 * and the model then framed nearly every page head-on — a character card
 * teaches POSE as much as face. Front, three-quarter and profile fixed that.
 *
 * EVERY OPTION IS THE SAME PROMPT unless the book's data says otherwise, so a
 * set is comparable. Baby is the exception: her hair colour is undecided, so
 * her options vary it deliberately and each one records what it asked for.
 *
 * USAGE
 *   node scripts/char-sheet.js --book baby            # its configured options
 *   node scripts/char-sheet.js --book jonas --n 3     # three runs of one brief
 *   node scripts/char-sheet.js --book juan --n 3 --dry-run
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const FormData = require('form-data');

const ROOT = path.join(__dirname, '..');
const CHARS = path.join(ROOT, 'docs/storybooks/characters.json');
const STATE = path.join(ROOT, 'docs/storybooks/char-state.json');
const STYLE_REF = path.join(ROOT, 'refs/sage-sandy-mirror.png');

const QUALITY = 'medium', MODEL = 'gpt-image-2', SIZE = '1024x1536';
const STYLE_LINE = 'Use the attached image as a style reference. Only use its style, '
  + 'not its content — do not copy anything depicted in it. You do not have to copy its colors.';
const NO_TEXT = 'Do not put any text, words, letters, numbers, captions or watermarks anywhere in the image.';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(`--${n}`);

const cfg = JSON.parse(fs.readFileSync(CHARS, 'utf8'));
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const saveState = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');

function buildPrompt(book, option) {
  const hair = option && option.hair
    ? ` Her hair is ${option.hair}.`
    : '';
  const scene = `${cfg.sheetShape} ${book.brief}${hair} In all three views ${book.who} wears the same clothes: ${book.outfit}`;
  return { prompt: [STYLE_LINE, '', `Draw: ${scene}`, '', NO_TEXT].join('\n'), scene };
}

async function draw(prompt) {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'png');
  form.append('image[]', fs.readFileSync(STYLE_REF), { filename: 'style.png', contentType: 'image/png' });
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form.getBuffer(),
  });
  const data = await r.json();
  if (data.error) {
    const e = new Error(data.error.message || 'gpt-image-2 edit error');
    // A safety refusal is deterministic — retrying only burns time.
    e.refusal = /safety|moderation|content policy|rejected as a result of/i.test(e.message);
    throw e;
  }
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-2 returned no image');
  return Buffer.from(b64, 'base64');
}

async function drawWithRetry(prompt, label) {
  let last;
  for (let a = 1; a <= 3; a++) {
    try { return await draw(prompt); }
    catch (e) { last = e; if (e.refusal) throw e; console.log(`   ${label}: ${e.message} — retry ${a}/3`); await new Promise((r) => setTimeout(r, 4000 * a)); }
  }
  throw last;
}

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  const pid = JSON.parse(raw).project_id;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), storageBucket: `${pid}.firebasestorage.app` });
}
async function upload(buf, dest) {
  const bucket = admin.storage().bucket();
  const tmp = path.join(os.tmpdir(), path.basename(dest));
  fs.writeFileSync(tmp, buf);
  await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'image/png' } });
  await bucket.file(dest).makePublic();
  fs.unlinkSync(tmp);
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

(async () => {
  const key = arg('book');
  const book = cfg.books[key];
  if (!book) throw new Error(`--book must be one of: ${Object.keys(cfg.books).join(', ')}`);

  // A book with configured options uses them (Baby, whose hair varies); any
  // other book is the same brief run --n times.
  const opts = book.options
    ? book.options
    : Array.from({ length: Number(arg('n', '3')) }, (_, i) => ({ tag: String.fromCharCode(97 + i) }));

  console.log(`${book.title} — ${book.who}, age ${book.age} — ${opts.length} sheet(s)`);
  console.log(`about $${(opts.length * 0.06).toFixed(2)} · ${MODEL} · ${QUALITY} · ${SIZE}`);
  if (has('dry-run')) { console.log('\n' + buildPrompt(book, opts[0]).prompt); return; }
  if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY.');
  initAdmin();

  if (!state[key]) state[key] = {};
  for (const o of opts) {
    if (state[key][o.tag]?.url && !has('force')) { console.log(`  ${o.tag}: already drawn`); continue; }
    const { prompt, scene } = buildPrompt(book, o);
    process.stdout.write(`  ${o.tag}${o.hair ? ' (' + o.hair + ')' : ''} … `);
    try {
      const buf = await drawWithRetry(prompt, o.tag);
      const url = await upload(buf, `storybooks/${key}/refs/${key}-${o.tag}.png`);
      state[key][o.tag] = { url, prompt, scene, hair: o.hair || null, at: Date.now() };
      saveState();
      console.log('✓');
    } catch (e) { console.log('FAILED —', e.message); }
  }
  console.log(`\n${Object.keys(state[key]).length} sheet(s) on file for ${key}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
