// Ear-hoist beat, v4 per Sophie's notes on v3:
// - He must be INSIDE the ear opening (waist in), not next to it.
// - Softer face: gentle, quietly delighted — the smirk read as annoying.
// - The ear must NOT be grotesque: small, simply drawn, opened like a neat
//   little door with a soft glow inside — never a big fleshy stretched flap.
// v4a edits off v3b as a composition reference; v4b is a fresh top-down take.
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STYLE_REF = path.join(__dirname, '..', 'refs', 'movie-style.jpg');
const REPO_DIR = path.join(__dirname, '..', 'docs', 'dream-intro');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/33d10e33-f4e6-52c9-b476-eb825381c56a/scratchpad/dream-intro';
const ANCHOR = path.join(REPO_DIR, 'anchor-silver.png');
const V3B = path.join(REPO_DIR, 'escape-2-ear-hoist-v3b.png');

const STYLE_NOTE =
  'The #1 attached image is a STYLE reference only — copy its hand-drawn ink and ' +
  'watercolor storybook style, linework and textured-paper feel exactly, but do NOT ' +
  'copy its content, subjects or composition. ';
const ANCHOR_NOTE =
  'The #2 attached image is the MAIN CHARACTER: the glowing silvery translucent SOUL of a boy. ' +
  'Draw HIM exactly — same face, same tousled hair, same light-blue-and-white striped pajamas, and ' +
  'the same VERY see-through, translucent, ethereal, softly-glowing pale silver-white look. His ' +
  'expression is GENTLE and quietly delighted — a soft, sweet, wonder-filled half-smile, kind eyes — ' +
  'NOT smug, NOT smirking, NOT sneaky-looking. The SLEEPING boy is the same boy but SOLID and fully ' +
  'opaque, eyes peacefully closed, sound asleep and never waking. ';
const EAR_NOTE =
  'THE EAR MUST BE CUTE, small and SIMPLY drawn — a neat little stylized storybook ear opened like a ' +
  'tiny door on a hinge, with a soft warm glow spilling from the opening. Absolutely NOT fleshy, NOT ' +
  'stretched, NOT enlarged, NOT anatomically detailed, never grotesque. ';

const PANELS = [
  { name: 'escape-2-ear-hoist-v4a', extra: V3B,
    prompt: `The #3 attached image is a PREVIOUS DRAFT of this exact scene — keep its overall ` +
      `composition, bedroom, bed, lighting and the sleeping boy, but FIX it as follows: the soul boy ` +
      `must be emerging FROM INSIDE the sleeping boy's head THROUGH the little open ear-door — his body ` +
      `visible only from the waist up, waist and legs INSIDE the opening, like someone halfway up ` +
      `through a manhole, hands braced on the rim pushing himself out. He is the same size as the ` +
      `sleeper (equal head sizes) which is magically impossible and charming. Redraw the ear as a small ` +
      `neat hinged door per the ear instructions, and give the soul the gentle delighted expression per ` +
      `the character instructions. A faint silver cord runs from his chest back into the opening. ` +
      `Portrait orientation.` },
  { name: 'escape-2-ear-hoist-v4b', extra: null,
    prompt: `Whimsical storybook bedroom scene at night, viewed from slightly ABOVE the bed looking ` +
      `down. The solid boy sleeps on his side, head on the pillow, his ear facing up toward us. In the ` +
      `side of his head, his ear stands open like a tiny neat hinged door, warm light glowing from the ` +
      `little doorway. Rising straight up OUT of that glowing opening is his silvery translucent SOUL — ` +
      `visible ONLY from the waist up, his hips and legs down inside the opening, exactly like a person ` +
      `halfway out of a manhole. His head is the SAME SIZE as the sleeping boy's head, making the scene ` +
      `wonderfully impossible. His hands rest on the rim of the doorway mid-climb, and he looks out at ` +
      `the moonlit room with a gentle, quietly delighted expression. A faint silver cord runs from his ` +
      `chest back down into the glow. The sleeper never stirs. Cozy, magical, softly funny. Portrait ` +
      `orientation.` },
];

async function render(panel, quality = 'high') {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', STYLE_NOTE + ANCHOR_NOTE + EAR_NOTE + panel.prompt);
  const files = [[STYLE_REF, 'style.jpg'], [ANCHOR, 'anchor.png']];
  if (panel.extra) files.push([panel.extra, 'draft.png']);
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
