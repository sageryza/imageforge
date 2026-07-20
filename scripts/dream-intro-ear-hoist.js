// Re-roll of the trapdoor beat: the soul hoisting himself up OUT OF THE EAR
// specifically — climbing out through the ear-hatch like a manhole.
// Anchor on the silver soul (anchor-silver.png). Attach: [style ref, silver anchor].
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STYLE_REF = path.join(__dirname, '..', 'refs', 'movie-style.jpg');
const REPO_DIR = path.join(__dirname, '..', 'docs', 'dream-intro');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/33d10e33-f4e6-52c9-b476-eb825381c56a/scratchpad/dream-intro';
const ANCHOR = path.join(REPO_DIR, 'anchor-silver.png');

const STYLE_NOTE =
  'The #1 attached image is a STYLE reference only — copy its hand-drawn ink and ' +
  'watercolor storybook style, linework and textured-paper feel exactly, but do NOT ' +
  'copy its content, subjects or composition. ';
const ANCHOR_NOTE =
  'The #2 attached image is the MAIN CHARACTER: the glowing silvery translucent SOUL of a boy. ' +
  'Draw HIM exactly — same face, same tousled hair, same light-blue-and-white striped pajamas, and ' +
  'the same VERY see-through, translucent, ethereal, softly-glowing pale silver-white look. His ' +
  'expression here is sneaky, mischievous and playful — like a kid quietly sneaking out to run away ' +
  'from home — NOT a big goofy grin. The SLEEPING boy is the same boy but SOLID and fully opaque, ' +
  'eyes peacefully closed, sound asleep and never waking. ';

const PANELS = [
  { name: 'escape-2-ear-hoist',
    prompt: `Whimsical, comical close-up scene at night: the sleeping solid boy lies on his side in bed, ` +
      `his head large in frame on the pillow. Set into his EAR is a tiny open hinged trap door, swung wide ` +
      `like a little secret hatch. The small silvery translucent soul boy is climbing OUT THROUGH THE EAR ` +
      `OPENING itself — both hands gripping the rim of the ear-hatch, arms straining as he hoists himself ` +
      `up and out like someone climbing out of a manhole, one elbow up, halfway out, legs still inside. ` +
      `His expression is sneaky and pleased with himself. The sleeping boy stays completely undisturbed, ` +
      `eyes closed. A faint silver cord trails from the soul's chest back down into the ear. Funny, ` +
      `magical, storybook. Portrait orientation.` },
];

async function render(panel, quality = 'high') {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', STYLE_NOTE + ANCHOR_NOTE + panel.prompt);
  for (const [p, fn] of [[STYLE_REF, 'style.jpg'], [ANCHOR, 'anchor.png']]) {
    const bytes = new Uint8Array(fs.readFileSync(p));
    form.append('image[]', new Blob([bytes], { type: fn.endsWith('png') ? 'image/png' : 'image/jpeg' }), fn);
  }
  form.append('size', '1024x1536');
  form.append('quality', quality);
  form.append('output_format', 'png');
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: form,
  });
  const data = await res.json();
  if (data.error) throw new Error(`${panel.name}: ${data.error.message}`);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${panel.name}: no image`);
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${panel.name}.png`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('OK', file);
}

(async () => {
  for (const p of PANELS) {
    try { await render(p); } catch (e) { console.error('FAIL', e.message); }
  }
  console.log('DONE');
})();
