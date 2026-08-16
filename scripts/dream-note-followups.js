// Answering two notes Sophie left on images.
//
// 1. weather chess — "can you try this one again in high-quality?"
//    Identical prompt and style ref to the original, quality HIGH. New file,
//    the medium one stays as history.
//
// 2. the long raw-text Halloween dream — "I don't mind if there's borders or
//    caption boxes or text. Try it again."
//    So the dream-mystery suffix comes OFF entirely: no "ONE single
//    full-bleed illustration", no anti-grid line, no no-text rule. Style
//    prefix + her verbatim dream and nothing else. This lets the model lay it
//    out however it wants — which is the thing the suffix was suppressing.
//
//   OPENAI_API_KEY=… FIREBASE_SERVICE_ACCOUNT=… node scripts/dream-note-followups.js
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const REPO = path.dirname(__dirname);
const OUT = path.join(REPO, 'dream-feed', 'followups');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SAGE_PREFIX = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';
const DREAM_PREFIX = 'The FIRST attached image is a STYLE reference — copy its drawing style, linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy its content, subjects, or composition.';

async function edit(prompt, ref, refName, refType, quality, attempts = 3) {
  let lastErr;
  for (let a = 1; a <= attempts; a++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('size', '1024x1024');
      form.append('quality', quality);
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
  let halloween = '';
  snap.forEach(d => { const v = d.data();
    if (v.title === 'Last-Minute Halloween Party') halloween = v.text; });

  const sageRef = fs.readFileSync(path.join(REPO, 'refs/sage-sandy-mirror.png'));
  const dreamRef = fs.readFileSync(path.join(REPO, 'refs/dream-mystery.jpg'));

  const CHESS_CONTENT = 'an old woman seated at a chessboard whose pieces are made of weather — one bishop is a small drizzling rain cloud, a rook is a column of fog, a pawn is a tiny gust. She is winning. No text or lettering anywhere.';

  const jobs = [
    { file: '06-weather-chess-high.webp', quality: 'high',
      why: 'her note: try this one again in high-quality',
      ref: sageRef, refName: 'sage-sandy-mirror.png', refType: 'image/png',
      prompt: `${SAGE_PREFIX}\n\nDraw: ${CHESS_CONTENT}`,
      style: `${SAGE_PREFIX}\n\nDraw: [content]\n\n(attached style ref: refs/sage-sandy-mirror.png — gpt-image-2 images/edits, 1024x1024, quality high, output webp)`,
      content: CHESS_CONTENT,
      caption: 'gpt-image-2 · high',
      description: 'Dream 6 — the old woman winning at weather chess — HIGH quality re-roll' },

    { file: 'halloween-raw-free.webp', quality: 'medium',
      why: 'her note: borders / caption boxes / text are fine — suffix removed',
      ref: dreamRef, refName: 'dream-mystery.jpg', refType: 'image/jpeg',
      prompt: `${DREAM_PREFIX}\n\nDraw: ${halloween}`,
      style: `${DREAM_PREFIX}\n\nDraw: [content]\n\n(attached style ref: refs/dream-mystery.jpg — gpt-image-2 images/edits, 1024x1024, quality medium, output webp. NO suffix: no full-bleed instruction, no anti-grid line, no no-text rule.)`,
      content: halloween,
      caption: 'gpt-image-2 · medium',
      description: 'RAW TEXT, no layout rules — Last-Minute Halloween Party — dream mystery' },
  ];

  const results = await Promise.all(jobs.map(async (j) => {
    try {
      const buf = await edit(j.prompt, j.ref, j.refName, j.refType, j.quality);
      fs.writeFileSync(path.join(OUT, j.file), buf);
      console.log(`ok  ${j.file}  ${(buf.length / 1024).toFixed(0)}KB  quality=${j.quality}`);
      return { ...j, ref: undefined, ok: true };
    } catch (err) {
      console.error(`FAIL ${j.file}: ${err.message}`);
      return { ...j, ref: undefined, ok: false, error: err.message };
    }
  }));

  fs.writeFileSync(path.join(OUT, 'prompts.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} rendered`);
})();
