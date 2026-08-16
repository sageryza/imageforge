// Dream Feed illustrations — six dreams in the "sage sandy mirror" look.
//
// The settled recipe (docs/evan-film-style.md, docs/nde-watercolor.md,
// scratchpad.js): gpt-image-2 EDITS with refs/sage-sandy-mirror.png attached as
// a pure style reference and NO written style description. Every style block
// that has been tested made the result worse — do not reintroduce one.
//
// Square 1024x1024 because the feed slots are roughly square. Quality medium,
// ~2c an image. Prompts are sent VERBATIM as handed over.
//
//   OPENAI_API_KEY=… node scripts/dream-feed-art.js
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const OUT = path.join(REPO, 'dream-feed', 'out');
const STYLE_REF = path.join(REPO, 'refs/sage-sandy-mirror.png');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PREAMBLE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';

const DREAMS = [
  { file: '01-xylophone-teeth.webp',
    draw: 'an open mouth seen close up, the teeth replaced by the tuned wooden bars of a xylophone; a hand at the edge of the frame strikes them with a small mallet. No text or lettering anywhere.' },
  { file: '02-whale-again.webp',
    draw: 'an enormous whale hanging in the air above a single parked car on a narrow residential street, tilted as if leaning down to inspect it. No text or lettering anywhere.' },
  { file: '03-seminar-on-doors.webp',
    draw: 'an empty lecture hall in which the rows of seats are freestanding doors instead of chairs; one window at the side stands open with a chair tipped over beneath it. Nobody in the room. No text or lettering anywhere.' },
  { file: '05-peephole-moon.webp',
    draw: 'a full moon in a night sky drawn as the peephole of a front door, with a hand raised beside it about to knock on the sky itself. No text or lettering anywhere.' },
  { file: '06-weather-chess.webp',
    draw: 'an old woman seated at a chessboard whose pieces are made of weather — one bishop is a small drizzling rain cloud, a rook is a column of fog, a pawn is a tiny gust. She is winning. No text or lettering anywhere.' },
  { file: '07-floor-8-is-ocean.webp',
    draw: 'an elevator with its doors open onto deep open ocean water instead of a corridor, a few people calmly wading out from the lit elevator car into the water. No text or lettering anywhere.' },
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
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: form,
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
  console.log(`style ref: ${STYLE_REF} (${(ref.length / 1048576).toFixed(1)}MB)`);

  const results = await Promise.all(DREAMS.map(async (d) => {
    const prompt = promptFor(d);
    try {
      const t0 = Date.now();
      const buf = await edit(prompt, ref);
      fs.writeFileSync(path.join(OUT, d.file), buf);
      console.log(`ok  ${d.file}  ${(buf.length / 1024).toFixed(0)}KB  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      return { ...d, prompt, bytes: buf.length, ok: true };
    } catch (err) {
      console.error(`FAIL ${d.file}: ${err.message}`);
      return { ...d, prompt, ok: false, error: err.message };
    }
  }));

  // The exact text sent, for the Assets PROMPT overlay — never a paraphrase.
  fs.writeFileSync(path.join(OUT, 'prompts.json'), JSON.stringify(results, null, 2));
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} rendered`);
  if (bad.length) process.exit(1);
})();
