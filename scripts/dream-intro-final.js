// Render the full set anchored on the REAL boy master (real-boy.png).
// Attach order every time: [style ref, real-boy anchor]. The soul is described
// as his silvery translucent copy so face/hair/pajamas stay identical.
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STYLE_REF = path.join(__dirname, '..', 'refs', 'movie-style.jpg');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/33d10e33-f4e6-52c9-b476-eb825381c56a/scratchpad/dream-intro';
const ANCHOR = path.join(OUT, 'real-boy.png');

const STYLE_NOTE =
  'The #1 attached image is a STYLE reference only — copy its hand-drawn ink and ' +
  'watercolor storybook style, linework and textured-paper feel exactly, but do NOT ' +
  'copy its content, subjects or composition. ';
const ANCHOR_NOTE =
  'The #2 attached image is the MAIN CHARACTER: a real boy. Every boy in this picture is ' +
  'HIM — his exact face shape, tousled brown hair, and light-blue-and-white striped pajamas. ' +
  'Do not redesign him. ';
const SOUL = 'his SOUL — the exact same boy, but rendered as a translucent silvery ghostly ' +
  'figure: semi-transparent, softly glowing pale silver-white and see-through like moonlight, ' +
  'ethereal and weightless';
const CORD = 'a delicate glowing silver cord like a fine thread';

const PANELS = [
  { name: '1-character', out: '1-character-final',
    prompt: `Full-figure character study on a soft dark dusky background: ${SOUL}. He floats gently ` +
      `in a calm pose, curious sweet expression. A ${CORD} trails from the center of his chest and ` +
      `drifts off the bottom of the frame. Lots of quiet negative space. Portrait orientation.` },
  { name: '2-leaving-body', out: '2-leaving-body-final',
    prompt: `A cozy child's bedroom at night, gentle moonlight through the window. The real boy lies ` +
      `fast asleep in bed — SOLID and fully opaque. Rising up out of his body is ${SOUL}. A ${CORD} ` +
      `connects from the soul's chest down to the sleeping boy's heart, glowing softly. Both the sleeper ` +
      `and the soul are the SAME boy. Dreamy, tender. Portrait orientation.` },
  { name: '3-flying-stars', out: '3-flying-stars-final',
    prompt: `A deep starry night sky full of stars and small distant planets. ${SOUL} flies happily ` +
      `through the cosmos, waving cheerfully at a little smiling star drifting past him. A ${CORD} trails ` +
      `far behind him, thinning into the distance. Whimsical, magical. Portrait orientation.` },
  { name: '4-little-planet', out: '4-little-planet-final',
    prompt: `${SOUL} has landed on a tiny silver planet — a small moon-like world barely bigger than he ` +
      `is, floating in a starry cosmos, a tiny flag planted beside him. He explores with delight, ` +
      `mid-adventure. A ${CORD} trails off his chest into deep space behind him. Playful little-quest ` +
      `feeling, stars all around. Portrait orientation.` },
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
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: form,
  });
  const data = await res.json();
  if (data.error) throw new Error(`${panel.name}: ${data.error.message}`);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${panel.name}: no image`);
  const file = path.join(OUT, `${panel.out}.png`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('OK', file);
}

(async () => {
  for (const p of PANELS) {
    try { await render(p); } catch (e) { console.error('FAIL', e.message); }
  }
  console.log('DONE');
})();
