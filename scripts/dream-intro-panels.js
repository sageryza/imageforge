// One-off: render review stills for Sophie's "dream app intro" video concept.
// Boy-in-striped-pajamas silvery soul, in the diary-comic style ref, via the
// gpt-image-2 edits endpoint (style-only reference) — same method as movies.js.
// Uses Node 22 built-in fetch / FormData / Blob (no npm deps).
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STYLE_REF = path.join(__dirname, '..', 'refs', 'movie-style.jpg');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/33d10e33-f4e6-52c9-b476-eb825381c56a/scratchpad/dream-intro';
fs.mkdirSync(OUT, { recursive: true });

const STYLE_PREFIX =
  'The attached image is a STYLE reference only — copy its hand-drawn ink and ' +
  'watercolor storybook drawing style, its linework and textured-paper feel exactly, ' +
  'but do NOT copy its content, subjects, characters, text or composition. ';

const CHILD = 'a young boy about 8 years old with tousled brown hair, wearing ' +
  'classic pajamas with light-blue-and-white vertical stripes, barefoot';
const SOUL = 'his soul: the exact same boy in the same striped pajamas, but rendered ' +
  'as a translucent silvery ghostly figure — semi-transparent, softly glowing pale ' +
  'silver-white and see-through like moonlight, ethereal and weightless';
const CORD = 'a delicate glowing silver cord like a fine thread';

const PANELS = [
  {
    name: '1-character',
    prompt: `Full-figure character study, centered, on a soft dark dusky background. ${SOUL}. ` +
      `He floats gently in a calm pose with a curious, sweet expression. A ${CORD} trails ` +
      `softly from the center of his chest and drifts off the bottom of the frame. Lots of ` +
      `quiet negative space around him. Portrait orientation.`,
  },
  {
    name: '2-leaving-body',
    prompt: `A cozy child's bedroom at night, gentle moonlight through the window. ${CHILD} lies ` +
      `fast asleep in bed. Rising slowly up out of his sleeping body is ${SOUL}. A ${CORD} ` +
      `connects from the silvery soul's chest down to the sleeping boy's heart, glowing softly. ` +
      `Dreamy, tender, wondrous. Portrait orientation.`,
  },
  {
    name: '3-flying-stars',
    prompt: `A deep starry night sky full of stars and small distant planets. ${SOUL} floats and ` +
      `flies happily through the cosmos, waving cheerfully at a little smiling star drifting past ` +
      `him. A ${CORD} trails far behind him, thinning into the distance. Whimsical, magical, ` +
      `full of wonder. Portrait orientation.`,
  },
  {
    name: '4-little-planet',
    prompt: `${SOUL} has landed on a tiny silver planet — a small moon-like world barely bigger ` +
      `than he is, floating in a starry cosmos. He explores it with delight, mid-adventure. A ` +
      `${CORD} trails off his chest into deep space behind him. Playful little-quest feeling, ` +
      `stars all around. Portrait orientation.`,
  },
];

async function render(panel, quality = 'medium') {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', STYLE_PREFIX + panel.prompt);
  const bytes = new Uint8Array(fs.readFileSync(STYLE_REF));
  form.append('image[]', new Blob([bytes], { type: 'image/jpeg' }), 'style.jpg');
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
  const file = path.join(OUT, `${panel.name}.png`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('OK', file);
  return file;
}

(async () => {
  for (const p of PANELS) {
    try { await render(p); }
    catch (e) { console.error('FAIL', e.message); }
  }
  fs.writeFileSync(path.join(OUT, 'prompts.json'), JSON.stringify(PANELS, null, 2));
  console.log('DONE', OUT);
})();
