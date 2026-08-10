// Memory Passport — the FREE pre-generated stamp library.
//
//   node scripts/selfcare-stamps.js              # everything missing
//   node scripts/selfcare-stamps.js --only cat,treat
//   node scripts/selfcare-stamps.js --force --dry-run
//
// Generating your own stamp costs money on every tap, so the passport ships
// with a library of generic moments anyone can stick in for free — "someone
// gave me a compliment", "I got a treat" — and making your own is the upgrade.
//
// House line style (the Witch School refs, same as the stickers), but each
// stamp sits on its OWN flat pastel background colour, so a passport page
// reads as a set of different stamps rather than one repeated card. The white
// scalloped stamp edge is NOT drawn here — the page adds it as an SVG path, so
// every stamp's frame is identical.
//
// Env: OPENAI_API_KEY + FIREBASE_SERVICE_ACCOUNT (JSON) or FIREBASE_KEY_FILE.
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const fs = require('fs');
const path = require('path');

const BUCKET = 'deckfactory-43176.firebasestorage.app';
const REFS = ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'];
const OUT = path.join(__dirname, '..', 'public', 'selfcare-stamps.json');

// The palette is stated twice and the refs' own colours explicitly disowned —
// the attached refs are warm gold/salmon and the model drifts back to them if
// it's only said once.
const STYLE = 'Use the attached images ONLY as a STYLE reference for the DRAWING STYLE — match their bold confident black ink outlines, flat playful modern editorial illustration, flat colors with NO gradients and minimal shading. IGNORE the reference colours completely. ';
const endFor = (bg) => ` The whole square background is one flat solid ${bg} colour, edge to edge. The subject is drawn large and centred on it in soft pastel colours with black ink outlines. No border, no frame, no postage stamp edge, no scalloped edge, no white margin. Absolutely no text, no words, no letters, no numbers.`;

// Generic moments — the things that actually happen on an ordinary day. Each
// gets its own background colour so the set doesn't read as one card repeated.
const LIBRARY = [
  { id: 'compliment', label: 'Someone gave me a compliment', bg: 'pale blush pink',   subject: 'a speech bubble with a small heart inside it' },
  { id: 'treat',      label: 'I got myself a treat',         bg: 'soft mint green',   subject: 'a hand holding up a takeaway coffee cup with a lid (no logo, no branding)' },
  { id: 'dog',        label: 'I saw a good dog',             bg: 'butter yellow',     subject: 'a happy dog sitting with its tongue out' },
  { id: 'cat',        label: 'A cat let me say hello',       bg: 'lilac',             subject: 'a cat sitting neatly with its tail curled round its feet' },
  { id: 'cake',       label: 'I ate something delicious',    bg: 'powder blue',       subject: 'a single slice of layer cake on a small plate' },
  { id: 'sun',        label: 'The weather was good',         bg: 'pale peach',        subject: 'a sun with a small cloud drifting across it' },
  { id: 'flowers',    label: 'I bought myself flowers',      bg: 'pale sage green',   subject: 'a small bunch of flowers wrapped in paper' },
  { id: 'message',    label: 'A friend messaged me',         bg: 'baby pink',         subject: 'a phone lying flat with a small heart on its screen' },
  { id: 'bath',       label: 'I had a long bath',            bg: 'pale aqua',         subject: 'a claw-foot bathtub with a few round bubbles above it' },
  { id: 'finished',   label: 'I finished something',         bg: 'soft periwinkle',   subject: 'a checklist page with one big tick on it' },
  { id: 'bird',       label: 'A bird came to the window',    bg: 'pale lemon',        subject: 'a small round bird perched on a thin branch' },
  { id: 'rain',       label: 'It rained while I was warm inside', bg: 'dusty lavender', subject: 'a window pane with raindrops running down it' },
  { id: 'sunset',     label: 'I watched the sky change',     bg: 'pale coral',        subject: 'a low sun sitting on a simple horizon line' },
  { id: 'hug',        label: 'Someone hugged me',            bg: 'rose pink',         subject: 'two simple people hugging' },
  { id: 'song',       label: 'A song got me',                bg: 'pistachio green',   subject: 'a record player with its arm down and two music notes above' },
  { id: 'walk',       label: 'I went somewhere new',         bg: 'pale sky blue',     subject: 'a winding path leading to a small hill' },
  { id: 'cooked',     label: 'I made myself a proper meal',  bg: 'apricot',           subject: 'a plate of food with a fork and knife either side' },
  { id: 'laughed',    label: 'Something made me laugh',      bg: 'pale mauve',        subject: 'two overlapping speech bubbles with squiggles inside' },
  { id: 'nap',        label: 'I rested',                     bg: 'soft mint',         subject: 'a plump pillow with a crescent moon above it' },
  { id: 'luck',       label: 'A small piece of luck',        bg: 'pale seafoam',      subject: 'a four-leaf clover' },
];

const COST_PER = 0.014;   // gpt-image-2, low quality, 1024x1024

const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const has = (n) => args.includes('--' + n);
const ONLY = (flag('only') || '').split(',').map(s => s.trim()).filter(Boolean);
const FORCE = has('force');
const DRY = has('dry-run');

let existing = { stamps: {} };
if (fs.existsSync(OUT)) { try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* rebuild */ } }
existing.stamps = existing.stamps || {};

const todo = LIBRARY.filter(s => {
  if (ONLY.length && !ONLY.includes(s.id)) return false;
  return FORCE || !(existing.stamps[s.id] && existing.stamps[s.id].img);
});

console.log(`${todo.length} stamp(s) to draw${FORCE ? ' (forced)' : ''} · estimated $${(todo.length * COST_PER).toFixed(2)}`);
if (DRY) { console.log(todo.map(s => s.id).join(', ') || '(nothing to do)'); process.exit(0); }
if (!todo.length) process.exit(0);

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY required'); process.exit(1); }
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(process.env.FIREBASE_KEY_FILE, 'utf8');
initializeApp({ credential: cert(JSON.parse(saJson)), storageBucket: BUCKET });

async function refs() {
  const out = [];
  for (const remote of REFS) {
    const local = '/tmp/sc-ref-' + remote.split('/').pop();
    if (!fs.existsSync(local)) await getStorage().bucket().file(remote).download({ destination: local });
    out.push(local);
  }
  return out;
}

async function draw(stamp, refPaths) {
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', STYLE + 'Draw ' + stamp.subject + '.' + endFor(stamp.bg));
  fd.append('size', '1024x1024');
  fd.append('quality', 'low');
  fd.append('n', '1');
  for (const p of refPaths) {
    fd.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/png' }), path.basename(p));
  }
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { authorization: 'Bearer ' + KEY }, body: fd,
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error).slice(0, 220));
  return Buffer.from(d.data[0].b64_json, 'base64');
}

async function upload(buf, id) {
  const p = `selfcare/passport/library/${id}.png`;
  const file = getStorage().bucket().file(p);
  await file.save(buf, { metadata: { contentType: 'image/png' }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${BUCKET}/${p}`;
}

(async () => {
  const refPaths = await refs();
  const failed = [];
  // Keep the library's declared order — it's the order of the picker.
  existing.order = LIBRARY.map(s => s.id);
  for (const stamp of todo) {
    process.stdout.write(stamp.id + ' … ');
    try {
      let buf = null;
      for (let a = 1; a <= 3 && !buf; a++) {
        try { buf = await draw(stamp, refPaths); }
        catch (e) {
          if (a === 3) throw e;
          process.stdout.write(`retry(${a}) `);
          await new Promise(r => setTimeout(r, 3000 * a));
        }
      }
      const img = await upload(buf, stamp.id);
      existing.stamps[stamp.id] = { label: stamp.label, bg: stamp.bg, img };
      fs.writeFileSync(OUT, JSON.stringify(existing, null, 2) + '\n');   // after each, so a crash keeps what landed
      console.log('ok');
    } catch (e) {
      failed.push(stamp.id);
      console.log('FAILED: ' + e.message);
    }
  }
  // Labels for any stamp drawn on an earlier run stay in sync with the list.
  for (const s of LIBRARY) if (existing.stamps[s.id]) { existing.stamps[s.id].label = s.label; existing.stamps[s.id].bg = s.bg; }
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 2) + '\n');
  console.log(`\ndone${failed.length ? ' · failed: ' + failed.join(', ') : ''} → ${path.relative(process.cwd(), OUT)}`);
  if (failed.length) process.exitCode = 1;
})();
