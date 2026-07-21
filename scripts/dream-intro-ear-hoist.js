// Ear-hoist beat, v3: the soul must read as coming from INSIDE the head.
// Key fix — his lower half visibly disappears INTO the ear opening (genie-from-
// a-lamp / climbing-out-of-a-manhole read), never standing next to the head.
// Same size as the sleeper, out to the waist. Anchor: [style ref, anchor-silver.png].
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
  { name: 'escape-2-ear-hoist-v3a',
    prompt: `Magical, comical bedroom scene at night. The solid boy sleeps on his side, his head on the ` +
      `pillow with his EAR facing UP toward the ceiling. The ear has been pulled open like the hinged lid ` +
      `of a tiny hatch — the ear itself is the open door flap. Out of that open ear rises his silvery ` +
      `translucent SOUL, exactly like a GENIE emerging from a lamp: his upper body is fully out, the SAME ` +
      `SIZE as the sleeping boy (heads equal size), but from the WAIST DOWN his body funnels and ` +
      `disappears straight down INTO the small ear opening — no legs visible, his waist literally inside ` +
      `the ear hole. It is clearly magically impossible: a full-size boy coming out of a tiny opening. ` +
      `He is mid-hoist, palms braced flat on the sleeping boy's head on either side of the ear, elbows ` +
      `locked, pushing himself up and out, glancing sideways with a sneaky, pleased expression. A faint ` +
      `silver cord runs from his chest down into the ear opening. The sleeping boy is completely ` +
      `undisturbed. Storybook, whimsical, funny. Portrait orientation.` },
  { name: 'escape-2-ear-hoist-v3b',
    prompt: `Magical, comical bedroom scene at night. The solid boy sleeps on his side on the pillow, ` +
      `his EAR facing upward. His ear is swung open like a little hinged trap-door lid, and his silvery ` +
      `translucent SOUL is climbing OUT OF THE INSIDE OF HIS HEAD through it, exactly like a person ` +
      `climbing out of a MANHOLE: hands gripping the rim of the ear opening, arms straining, upper body ` +
      `out up to the waist, and everything below the waist still INSIDE the head — hidden down in the ear ` +
      `hole, no legs visible. The soul is the SAME SIZE as the sleeping boy — their heads are the same ` +
      `size — which makes it wonderfully impossible, like a tent that is bigger on the inside. Sneaky, ` +
      `mischievous face, like a kid sneaking out at night. A faint silver cord trails from the soul's ` +
      `chest back down into the opening. The sleeper never stirs. Hand-drawn storybook charm. Portrait ` +
      `orientation.` },
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
  await Promise.all(PANELS.map(p => render(p).catch(e => console.error('FAIL', e.message))));
  console.log('DONE');
})();
