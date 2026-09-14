// Re-render the silver-soul shots with his eyes softly OPEN (calm, not smiley).
// Anchor on anchor-silver.png. Attach order: [style ref, silver anchor].
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
  'the same VERY see-through, translucent, ethereal, softly-glowing pale silver-white look (you can ' +
  'see through him). One change: his eyes are softly OPEN now, with a calm, gentle, peaceful gaze — ' +
  'awake and serene, NOT a big smile, not grinning, not wide-eyed. Do not redesign him and do not ' +
  'make him solid or opaque. ';
const CORD = 'a delicate glowing silver cord like a fine thread';

const PANELS = [
  { name: 'try-flying-stars-open',
    prompt: `Scene: the silvery translucent soul boy drifts serenely through a deep starry night sky ` +
      `full of stars and small distant planets, floating weightlessly, calmly taking it all in with his ` +
      `eyes open. A ${CORD} trails far behind him, thinning into the distance. Calm, dreamy, quiet wonder. ` +
      `Portrait orientation.` },
  { name: 'try-leaving-body-open',
    prompt: `Scene: a cozy child's bedroom at night, gentle moonlight and a crescent moon through the ` +
      `window, a small rocket and books on a shelf, a star lamp. The real boy lies fast asleep in bed, ` +
      `SOLID and opaque, his own eyes peacefully closed. Rising up out of his body is his silvery ` +
      `translucent soul, whose eyes are softly OPEN with a calm gaze. A ${CORD} connects from the soul's ` +
      `chest down to the sleeping boy's heart, glowing softly. Dreamy and tender. Portrait orientation.` },
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
