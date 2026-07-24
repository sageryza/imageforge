// Ear-hoist beat, v5: graft v4b's cute little golden ear-door onto v4a's
// winning composition (soul emerging from INSIDE the opening, waist-deep).
// Attach: [style ref, silver anchor, v4a composition, v4b door reference].
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STYLE_REF = path.join(__dirname, '..', 'refs', 'movie-style.jpg');
const REPO_DIR = path.join(__dirname, '..', 'docs', 'dream-intro');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/33d10e33-f4e6-52c9-b476-eb825381c56a/scratchpad/dream-intro';
const ANCHOR = path.join(REPO_DIR, 'anchor-silver.png');
const V4A = path.join(REPO_DIR, 'escape-2-ear-hoist-v4a.png');
const V4B = path.join(REPO_DIR, 'escape-2-ear-hoist-v4b.png');

const STYLE_NOTE =
  'The #1 attached image is a STYLE reference only — copy its hand-drawn ink and ' +
  'watercolor storybook style, linework and textured-paper feel exactly, but do NOT ' +
  'copy its content, subjects or composition. ';
const ANCHOR_NOTE =
  'The #2 attached image is the MAIN CHARACTER: the glowing silvery translucent SOUL of a boy. ' +
  'Draw HIM exactly — same face, same tousled hair, same light-blue-and-white striped pajamas, and ' +
  'the same VERY see-through, translucent, ethereal, softly-glowing pale silver-white look. His ' +
  'expression is GENTLE and quietly delighted — a soft, sweet, wonder-filled half-smile, kind eyes — ' +
  'NOT smug, NOT smirking. The SLEEPING boy is the same boy but SOLID and fully opaque, eyes ' +
  'peacefully closed, sound asleep and never waking. ';

const PANELS = [
  { name: 'escape-2-ear-hoist-v5',
    prompt: `The #3 attached image is the APPROVED COMPOSITION of this scene — keep everything about ` +
      `it: the bedroom, bed, lighting, the sleeping boy's pose, and especially the soul boy emerging ` +
      `FROM INSIDE the head through the opening, visible only from the waist up with his legs down ` +
      `inside, same size as the sleeper. Make ONE change: replace the opened ear-lid with the little ` +
      `DOOR from the #4 attached image — the small, neat, hinged golden ear-door on the side of the ` +
      `sleeping boy's head (a tiny cute hatch with the ear on its inner face), now swung fully OPEN ` +
      `with the soul boy rising out through that doorway, warm light glowing from it. Keep the door ` +
      `small, simple and charming — never fleshy or grotesque. A faint silver cord runs from the ` +
      `soul's chest back into the opening. Portrait orientation.` },
];

async function render(panel, quality = 'high') {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', STYLE_NOTE + ANCHOR_NOTE + panel.prompt);
  const files = [[STYLE_REF, 'style.jpg'], [ANCHOR, 'anchor.png'], [V4A, 'composition.png'], [V4B, 'door.png']];
  for (const [p, fn] of files) {
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
  await Promise.all(PANELS.map(p => render(p).catch(e => console.error('FAIL', e.message))));
  console.log('DONE');
})();
