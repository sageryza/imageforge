// Clearing Things Up (Sophie's new show, Max voice) — title segment stills.
// Draws in the container, not through /api/promptlab (her feed stays hers).
const fs = require('fs');
const KEY = process.env.OPENAI_API_KEY;
const OUT = process.argv[2] || '.';
const Q = 'medium', SIZE = '1024x1536';

async function gen(name, prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, size: SIZE, quality: Q, output_format: 'webp', moderation: 'low' }),
  });
  const j = await res.json();
  if (!j.data || !j.data[0]) throw new Error(name + ': ' + JSON.stringify(j).slice(0, 400));
  fs.writeFileSync(`${OUT}/${name}.webp`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log(name, 'ok', j.usage ? JSON.stringify(j.usage) : '');
}

async function edit(name, prompt, refPath) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', Q);
  form.append('output_format', 'webp');
  form.append('moderation', 'low');
  form.append('image[]', new Blob([fs.readFileSync(refPath)], { type: 'image/webp' }), 'ref.webp');
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: form,
  });
  const j = await res.json();
  if (!j.data || !j.data[0]) throw new Error(name + ': ' + JSON.stringify(j).slice(0, 400));
  fs.writeFileSync(`${OUT}/${name}.webp`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log(name, 'ok');
}

const PROMPTS = {
  tangle: 'a big tangled pile of colorful cords in one messy knot on a plain wooden floor, photo',
  untangled: 'the same colorful cords fully untangled, laid out neatly side by side in straight separate lines on the same wooden floor, same camera angle, photo',
  star: 'a shimmering rainbow shooting star streaking across a dark starry night sky, glittering trail, photo',
};
module.exports = { PROMPTS };

if (require.main === module) (async () => {
  await Promise.all([gen('tangle', PROMPTS.tangle), gen('star', PROMPTS.star)]);
  await edit('untangled', PROMPTS.untangled, `${OUT}/tangle.webp`);
})().catch(e => { console.error(e); process.exit(1); });
