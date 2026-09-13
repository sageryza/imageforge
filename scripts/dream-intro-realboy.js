// Build the MASTER anchor: a clean, awake character study of the REAL solid boy
// (the child asleep in bed), taken from the leaving-body scene. Everything else
// will anchor on this — the soul is just his silvery translucent copy.
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STYLE_REF = path.join(__dirname, '..', 'refs', 'movie-style.jpg');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/33d10e33-f4e6-52c9-b476-eb825381c56a/scratchpad/dream-intro';
const SRC = path.join(OUT, '2-leaving-body-anchored.png'); // has the clearest real boy
fs.mkdirSync(OUT, { recursive: true });

const STYLE_NOTE =
  'The #1 attached image is a STYLE reference only — copy its hand-drawn ink and ' +
  'watercolor storybook style, linework and textured-paper feel exactly, but do NOT ' +
  'copy its content, subjects or composition. ';
const REALBOY_NOTE =
  'The #2 attached image is a bedroom scene. Look at the REAL solid boy asleep in the bed ' +
  '(NOT the glowing ghost). Draw THAT boy — his exact face shape, his tousled brown hair, ' +
  'his light-blue-and-white striped pajamas. ';

const PROMPT =
  'Full-figure character study of that same real boy, now AWAKE and standing in a calm, ' +
  'friendly pose with his eyes open and a soft happy expression. He is an ordinary SOLID, ' +
  'fully-opaque real child — NOT a ghost, no glow, no transparency, warm skin tones. Centered ' +
  'on a soft plain background with lots of quiet negative space around him. Portrait orientation.';

async function render(quality = 'high') {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', STYLE_NOTE + REALBOY_NOTE + PROMPT);
  for (const [p, fn] of [[STYLE_REF, 'style.jpg'], [SRC, 'scene.png']]) {
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
  if (data.error) throw new Error(data.error.message);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image');
  const file = path.join(OUT, 'real-boy.png');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('OK', file);
}

render().catch(e => { console.error('FAIL', e.message); process.exit(1); });
