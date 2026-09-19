// Try-out: one star scene anchored on Sophie's chosen SILVER SOUL image
// (anchor-silver.png). Keep him very translucent/ethereal and CALM — no big smiles.
// Attach order: [style ref, silver-soul anchor].
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STYLE_REF = path.join(__dirname, '..', 'refs', 'movie-style.jpg');
const REPO_DIR = path.join(__dirname, '..', 'docs', 'dream-intro');
const OUT = process.argv[3] || '/tmp/claude-0/-home-user/33d10e33-f4e6-52c9-b476-eb825381c56a/scratchpad/dream-intro';
const ANCHOR = path.join(REPO_DIR, 'anchor-silver.png');
const name = process.argv[2] || 'try-flying-stars';

const STYLE_NOTE =
  'The #1 attached image is a STYLE reference only — copy its hand-drawn ink and ' +
  'watercolor storybook style, linework and textured-paper feel exactly, but do NOT ' +
  'copy its content, subjects or composition. ';
const ANCHOR_NOTE =
  'The #2 attached image is the MAIN CHARACTER: the glowing silvery translucent SOUL of a boy ' +
  'floating in the bedroom. Draw HIM exactly — the same face, same tousled hair, same ' +
  'light-blue-and-white striped pajamas, and the same VERY see-through, translucent, ethereal, ' +
  'softly-glowing pale silver-white look (you can see through him). Keep his expression calm, ' +
  'peaceful and serene with eyes gently closed or softly half-open — NOT a big smile, not grinning. ' +
  'Do not redesign him and do not make him solid or opaque. ';
const CORD = 'a delicate glowing silver cord like a fine thread';

const PROMPT =
  `Scene: the silvery translucent soul boy drifts serenely through a deep starry night sky full of ` +
  `stars and small distant planets, floating weightlessly with a peaceful expression, quietly taking ` +
  `it all in. A ${CORD} trails far behind him, thinning into the distance. Calm, dreamy, full of quiet ` +
  `wonder. Portrait orientation.`;

async function render(quality = 'high') {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', STYLE_NOTE + ANCHOR_NOTE + PROMPT);
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
  if (data.error) throw new Error(data.error.message);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image');
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('OK', file);
}

render().catch(e => { console.error('FAIL', e.message); process.exit(1); });
