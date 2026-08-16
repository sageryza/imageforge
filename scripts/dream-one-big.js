// One-big-illustration test — Sophie's own dreams, distilled to a SINGLE image
// each instead of the multi-panel dream-zine look (movies.js makeDreamPagesV2).
//
// Three real dreams from forge-dreamapp that currently carry 3, 4 and 5 panels,
// so the comparison is direct. Same settled recipe as everything else in the
// house: gpt-image-2 edits, refs/sage-sandy-mirror.png attached as a pure style
// reference, NO written style description.
//
// Faces are kept non-specific on purpose — these dreams have real people in
// them and nobody's likeness is being invented.
//
//   OPENAI_API_KEY=… node scripts/dream-one-big.js
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const OUT = path.join(REPO, 'dream-feed', 'one-big');
const STYLE_REF = path.join(REPO, 'refs/sage-sandy-mirror.png');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PREAMBLE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';

const DREAMS = [
  { file: 'big-spaceship.webp', title: "Claude's Tiny Spaceship", panels: 3,
    draw: 'a person sealed inside a tiny egg-shaped one-person spaceship rolling down the middle of a residential street at night, seen from the front; their eyes are covered by a smooth white helmet with a single narrow pill-shaped slit to see through. Behind them a car sits crashed at the kerb with a figure rolling out of its open door onto the road. No text or lettering anywhere.' },
  { file: 'big-halloween.webp', title: 'Last-Minute Halloween Party', panels: 5,
    draw: 'a woman standing in front of a full-length mirror in a spare bedroom late at night, putting together a costume at the last minute, pulling on a blue jacket with gold trim at the cuffs; through the open door behind her a crowded party of teenagers in costumes fills the next room. Her back is to us. No text or lettering anywhere.' },
  { file: 'big-kitten.webp', title: 'Choosing a Kitten', panels: 4,
    draw: 'two people seen from behind walking away down a long narrow corridor lined on both sides with small open compartments, a different odd-looking kitten sitting in each compartment, all of the kittens watching as the two pass. No text or lettering anywhere.' },
];

const promptFor = (d) => `${PREAMBLE}\n\nDraw: ${d.draw}`;

async function edit(prompt, ref, attempts = 3) {
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
      form.append('image[]', new Blob([ref], { type: 'image/png' }), 'style-ref.png');
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
  const ref = fs.readFileSync(STYLE_REF);
  const results = await Promise.all(DREAMS.map(async (d) => {
    const prompt = promptFor(d);
    try {
      const buf = await edit(prompt, ref);
      fs.writeFileSync(path.join(OUT, d.file), buf);
      console.log(`ok  ${d.file}  ${(buf.length / 1024).toFixed(0)}KB  (was ${d.panels} panels)`);
      return { ...d, prompt, ok: true };
    } catch (err) {
      console.error(`FAIL ${d.file}: ${err.message}`);
      return { ...d, prompt, ok: false, error: err.message };
    }
  }));
  fs.writeFileSync(path.join(OUT, 'prompts.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} rendered`);
})();
