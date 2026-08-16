// EXPERIMENT — hand the image model the FULL RAW DREAM TEXT instead of a
// scene description a chat wrote for it.
//
// The scaffold is deliberately IDENTICAL to scripts/dream-style-diff.js —
// same style prefix, same "Draw:" lead-in, same suffix, same size and quality.
// The ONLY variable is the content half: the dream's verbatim dictated text
// (read live from forge-dreamapp) in place of a distilled one-scene brief.
// Anything else changing would make the comparison worthless.
//
// Two lengths, ~110x apart:
//   Bathroom at the Mountain Summit    49 chars / 11 words
//   Last-Minute Halloween Party      5372 chars / 1080 words
//
// The long one still carries every dictation artifact — "um", "like", false
// starts, the meta-commentary where she narrates her own dreaming. That is
// the point: this asks whether the model can find a through-line in raw
// speech, not whether it can read a tidy brief.
//
//   OPENAI_API_KEY=… FIREBASE_SERVICE_ACCOUNT=… node scripts/dream-raw-text.js
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const REPO = path.dirname(__dirname);
const OUT = path.join(REPO, 'dream-feed', 'raw-text');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Verbatim copies of the two style recipes in dream-style-diff.js.
const STYLES = [
  { id: 'sage', label: 'sage sandy mirror',
    ref: { file: 'sage-sandy-mirror.png', type: 'image/png' },
    prefix: 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.',
    suffix: 'No text or lettering anywhere.' },
  { id: 'dream', label: 'dream mystery',
    ref: { file: 'dream-mystery.jpg', type: 'image/jpeg' },
    prefix: 'The FIRST attached image is a STYLE reference — copy its drawing style, linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy its content, subjects, or composition.',
    suffix: 'Render as ONE single full-bleed illustration — a single image, NOT a grid, NOT split panels, no borders, no caption boxes, no text or lettering anywhere.' },
];

const WANT = [
  { id: 'mountain', title: 'Bathroom at the Mountain Summit', length: 'short' },
  { id: 'halloween', title: 'Last-Minute Halloween Party', length: 'long' },
];

async function edit(prompt, ref, refName, refType, attempts = 3) {
  let lastErr;
  for (let a = 1; a <= attempts; a++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('size', '1024x1024');
      form.append('quality', 'medium');
      form.append('output_format', 'webp');
      form.append('output_compression', '90');
      form.append('image[]', new Blob([ref], { type: refType }), refName);
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'edit error');
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('no image returned');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      console.warn(`  attempt ${a} failed: ${err.message}`);
      if (a < attempts) await new Promise(r => setTimeout(r, 2000 * a));
    }
  }
  throw lastErr;
}

(async () => {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  fs.mkdirSync(OUT, { recursive: true });

  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const snap = await getFirestore().collection('forge-dreamapp').get();
  const texts = {};
  snap.forEach(d => { const v = d.data();
    const w = WANT.find(x => x.title === v.title);
    if (w) texts[w.id] = v.text;
  });

  const jobs = [];
  for (const s of STYLES) {
    const ref = fs.readFileSync(path.join(REPO, 'refs', s.ref.file));
    for (const w of WANT) jobs.push({ style: s, want: w, ref, text: texts[w.id] });
  }

  const results = await Promise.all(jobs.map(async (j) => {
    const file = `${j.want.id}-raw-${j.style.id}.webp`;
    const prompt = `${j.style.prefix}\n\nDraw: ${j.text} ${j.style.suffix}`;
    try {
      const buf = await edit(prompt, j.ref, j.style.ref.file, j.style.ref.type);
      fs.writeFileSync(path.join(OUT, file), buf);
      console.log(`ok  ${file}  ${(buf.length / 1024).toFixed(0)}KB  (prompt ${prompt.length} chars)`);
      return { file, styleId: j.style.id, styleLabel: j.style.label, dreamId: j.want.id,
               title: j.want.title, length: j.want.length, chars: j.text.length, ok: true,
               style: `${j.style.prefix}\n\nDraw: [content] ${j.style.suffix}\n\n(attached style ref: refs/${j.style.ref.file} — gpt-image-2 images/edits, 1024x1024, quality medium, output webp)`,
               content: j.text };
    } catch (err) {
      console.error(`FAIL ${file}: ${err.message}`);
      return { file, styleId: j.style.id, dreamId: j.want.id, ok: false, error: err.message };
    }
  }));

  fs.writeFileSync(path.join(OUT, 'prompts.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} rendered`);
})();
