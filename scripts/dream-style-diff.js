// One-big-illustration test, v2 — the same three dreams in BOTH house styles,
// so the two can be diffed side by side.
//
//   sage sandy mirror  refs/sage-sandy-mirror.png — the settled watercolour
//                      recipe: no written style description at all.
//   dream mystery      refs/dream-mystery.jpg — the diary-comic reference, run
//                      with its REAL in-use prefix/suffix (scripts/nde-panel.py,
//                      mirrored in scripts/style-triptych.js). The anti-grid
//                      suffix is load-bearing: dream-mystery.jpg is itself a
//                      multi-panel comic page and the model copies that layout
//                      without it — which would defeat the whole point here.
//
// ONE deviation from the shipped dream-mystery suffix, named in the reply:
// "vertical" is dropped, because the canvas is square so both styles can be
// compared at the same aspect. Everything else is verbatim.
//
// Faces are drawn this time (Sophie: turned-away figures read as weird, and
// this is a style test — what they look like doesn't matter).
//
//   OPENAI_API_KEY=… node scripts/dream-style-diff.js
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const OUT = path.join(REPO, 'dream-feed', 'style-diff');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const STYLES = [
  {
    id: 'sage',
    label: 'sage sandy mirror',
    ref: { file: 'sage-sandy-mirror.png', type: 'image/png' },
    // The settled recipe — NO style description, the reference does the work.
    prefix: 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.',
    suffix: 'No text or lettering anywhere.',
  },
  {
    id: 'dream',
    label: 'dream mystery',
    ref: { file: 'dream-mystery.jpg', type: 'image/jpeg' },
    prefix: 'The FIRST attached image is a STYLE reference — copy its drawing style, linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy its content, subjects, or composition.',
    suffix: 'Render as ONE single full-bleed illustration — a single image, NOT a grid, NOT split panels, no borders, no caption boxes, no text or lettering anywhere.',
  },
];

const DREAMS = [
  { id: 'spaceship', title: "Claude's Tiny Spaceship", panels: 3,
    draw: 'a person sealed inside a tiny egg-shaped one-person spaceship rolling down the middle of a residential street at night, seen from the front; their eyes are covered by a smooth white helmet with a single narrow pill-shaped slit to see through. Behind them a car sits crashed at the kerb, a man with a startled face rolling out of its open door onto the road.' },
  { id: 'halloween', title: 'Last-Minute Halloween Party', panels: 5,
    draw: 'a young woman standing in front of a full-length mirror in a spare bedroom late at night, putting together a costume at the last minute, pulling on a blue jacket with gold trim at the cuffs; her face is visible in the mirror, anxious and hurrying. Through the open door behind her a crowded party of teenagers in costumes fills the next room.' },
  { id: 'kitten', title: 'Choosing a Kitten', panels: 4,
    draw: 'a man and a woman walking down a long narrow corridor lined on both sides with small open compartments, a different odd-looking kitten sitting in each compartment. The two have stopped to look at one of the kittens, their faces visible — he is pleased, she is uncertain.' },
];

const promptFor = (style, dream) => `${style.prefix}\n\nDraw: ${dream.draw} ${style.suffix}`;

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

  const jobs = [];
  for (const s of STYLES) {
    const ref = fs.readFileSync(path.join(REPO, 'refs', s.ref.file));
    for (const d of DREAMS) jobs.push({ style: s, dream: d, ref });
  }

  const results = await Promise.all(jobs.map(async (j) => {
    const file = `${j.dream.id}-${j.style.id}.webp`;
    const prompt = promptFor(j.style, j.dream);
    try {
      const buf = await edit(prompt, j.ref, j.style.ref.file, j.style.ref.type);
      fs.writeFileSync(path.join(OUT, file), buf);
      console.log(`ok  ${file}  ${(buf.length / 1024).toFixed(0)}KB`);
      return { file, styleId: j.style.id, styleLabel: j.style.label, dreamId: j.dream.id,
               title: j.dream.title, panels: j.dream.panels, prompt,
               style: `${j.style.prefix}\n\nDraw: [content] ${j.style.suffix}\n\n(attached style ref: refs/${j.style.ref.file} — gpt-image-2 images/edits, 1024x1024, quality medium, output webp)`,
               content: j.dream.draw, ok: true };
    } catch (err) {
      console.error(`FAIL ${file}: ${err.message}`);
      return { file, styleId: j.style.id, dreamId: j.dream.id, prompt, ok: false, error: err.message };
    }
  }));

  fs.writeFileSync(path.join(OUT, 'prompts.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} rendered`);
})();
