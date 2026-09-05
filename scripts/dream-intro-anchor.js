// Re-render the dream-intro scenes with a CHARACTER ANCHOR so the boy stays
// the same person across shots. Attach order: [style ref, anchor image].
// Style ref = movie-style.jpg (style only); anchor = the locked character study.
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STYLE_REF = path.join(__dirname, '..', 'refs', 'movie-style.jpg');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/33d10e33-f4e6-52c9-b476-eb825381c56a/scratchpad/dream-intro';
const ANCHOR = path.join(OUT, '1-character.png');
fs.mkdirSync(OUT, { recursive: true });

const STYLE_NOTE =
  'The #1 attached image is a STYLE reference only — copy its hand-drawn ink and ' +
  'watercolor storybook style, linework and textured-paper feel exactly, but do NOT ' +
  'copy its content, subjects or composition. ';
const ANCHOR_NOTE =
  'The #2 attached image shows the MAIN CHARACTER — a boy\'s silvery soul. Draw him as ' +
  'the EXACT same character: same face, same tousled brown hair, same light-blue-and-white ' +
  'striped pajamas, same translucent silvery ghostly see-through look. Do not redesign him. ';

const CORD = 'a delicate glowing silver cord like a fine thread';

const PANELS = [
  {
    name: '2-leaving-body',
    prompt: `Scene: a cozy child's bedroom at night, gentle moonlight through the window. The same ` +
      `boy (solid, real, sleeping) lies fast asleep in bed wearing the striped pajamas. Rising slowly ` +
      `up out of his sleeping body is his silvery translucent soul (the anchored character). A ${CORD} ` +
      `connects from the soul's chest down to the sleeping boy's heart, glowing softly. Dreamy, tender. ` +
      `Portrait orientation.`,
  },
  {
    name: '3-flying-stars',
    prompt: `Scene: a deep starry night sky full of stars and small distant planets. The silvery soul ` +
      `boy floats and flies happily through the cosmos, waving cheerfully at a little smiling star ` +
      `drifting past him. A ${CORD} trails far behind him, thinning into the distance. Whimsical, ` +
      `magical, full of wonder. Portrait orientation.`,
  },
  {
    name: '4-little-planet',
    prompt: `Scene: the silvery soul boy has landed on a tiny silver planet — a small moon-like world ` +
      `barely bigger than he is, floating in a starry cosmos. He explores it with delight, mid-adventure, ` +
      `a tiny flag planted beside him. A ${CORD} trails off his chest into deep space behind him. Playful ` +
      `little-quest feeling, stars all around. Portrait orientation.`,
  },
];

async function render(panel, quality = 'medium') {
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
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  const data = await res.json();
  if (data.error) throw new Error(`${panel.name}: ${data.error.message}`);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${panel.name}: no image returned`);
  const file = path.join(OUT, `${panel.name}-anchored.png`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('OK', file);
}

(async () => {
  for (const p of PANELS) {
    try { await render(p); } catch (e) { console.error('FAIL', e.message); }
  }
  console.log('DONE', OUT);
})();
