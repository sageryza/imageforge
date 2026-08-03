// Art Mason — watercolor STORY set: datescan0013.png as the style ref on
// every panel + mason-char-ref.jpeg as Mason's character reference on the
// panels he appears in. Sophie's plain wrapper (NO style description), 2:3.
// Storyboard tier: quality medium by default (WC_QUALITY=high to re-render
// keepers). Content prompts adapted from the proven v2/wc-test sets with the
// pastel style clauses stripped (the wrapper adds no style language).
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp');

const QUALITY = process.env.WC_QUALITY || 'medium';
const WRAP_STYLE = 'Use the attached image only as the style reference — do not copy its content. Draw: ';
const WRAP_CHAR = 'Use the first attached image only as the style reference — do not copy its content. The second attached image is the character reference for Mason — draw the same person (same face, round glasses, same hair, same clothes) in the style of the first image. Draw: ';
const MASON = 'Mason (the person from the character reference) ';

const PANELS = [
  { id: 'wcs-mason-portrait', char: true, label: 'Mason in his studio — watercolor story',
    content: MASON + 'standing in his cluttered artist studio among homemade contraptions of pipes and funnels, arms crossed, pleased with himself. Nobody else in the scene.' },
  { id: 'wcs-pipeline', char: true, label: 'Mason operating the noise-art pipeline — watercolor story',
    content: MASON + 'operating his noise-art pipeline: he holds a long pipe with a moppy net head full of small colored dots feeding in; the pipe runs through a wider accordion squeegee section and a moppy section, snaking up and around, and finally empties onto a small framed picture hung high on a gallery wall. Nobody else in the scene.' },
  { id: 'wcs-metaphor-machine', char: false, label: 'The metaphor machine — things in, essences out — watercolor story',
    content: 'A conveyor belt carries ordinary things — a book, a teacup, a small framed painting, a speech bubble — into a large friendly rounded machine; out the other side float softly glowing simple abstract shapes rising like released essences. Nobody in the scene.' },
  { id: 'wcs-bouncer-gates', char: false, label: 'The bouncer at the gates of the metaphor machine — watercolor story',
    content: 'A nightclub bouncer in a dark suit standing at a velvet-rope doorway, holding a clipboard and checking it as he decides who gets in. A few small simple symbols (a spiral, a pattern of dots, two contrasting shapes) float above the clipboard as the things he is checking for — hints of hidden meaning. Nobody else in the scene.' },
  { id: 'wcs-gallery-puzzled', char: false, label: 'Gallery viewer scratching her head at Mason’s art — watercolor story',
    content: 'A woman standing in an art gallery in front of a framed abstract picture of colored dots on the wall, scratching her head, leaning in, brow furrowed, completely puzzled. Nobody else in the gallery.' },
  { id: 'wcs-gallery-lightbulb', char: false, label: 'Gallery viewer — the lightbulb and the meaning — watercolor story',
    content: 'A woman standing in an art gallery in front of a framed abstract picture on the wall, one hand on her chin, a glowing lightbulb just above her head and a thought bubble beside her holding one small clear abstract symbol — the moment she decides what it means. Nobody else in the scene.' },
  { id: 'wcs-gallery-viewer-framed', char: false, label: 'The frame lands on the viewer — watercolor story',
    content: 'A woman gazing at a small framed abstract dot picture on a gallery wall, while an ornate rectangular gold picture frame with decorative baroque scrollwork corners hangs in mid-air around HER, making the viewer the artwork instead of the painting. Nobody else in the scene.' },
  { id: 'wcs-beef-jerky', char: false, label: 'Pulling apart beef jerky — disentangling — watercolor story',
    content: 'Two hands pulling apart a single piece of beef jerky, stretching it until the stringy strands separate into two — the idea of disentangling two things that were stuck together. Simple and clear, centered. Only the two hands and the jerky, no people.' },
  { id: 'wcs-split-diagram', char: false, label: 'Diagram — one rectangle becomes two — watercolor story',
    content: 'A clean minimal diagram: on the left one rectangle with a bold outline; a short dashed line leads rightward to two separate rectangles; the upper-right rectangle contains a small circle, the lower-right rectangle contains a small square — one thing dividing into two distinct things. Nobody, no people — just the diagram.' },
  { id: 'wcs-dumped-work', char: false, label: 'The dumped pile of work — a job that isn’t yours — watercolor story',
    content: 'An office coworker cheerfully dumps a towering armload of loose papers and folders into the arms of a stunned woman, who staggers backward under the pile. Only the two people in the scene.' },
  { id: 'wcs-dots-meaning', char: false, label: 'Finding meaning in random dots — watercolor story',
    content: 'A loose scattering of small colored dots, with a few hand-drawn loops circling little clusters of them, as if someone is finding shapes hiding in the randomness. Nobody, no people — just the dots and loops.' },
  { id: 'wcs-teacup-before', char: false, label: 'Teacup dregs — before — watercolor story',
    content: 'A single teacup viewed from directly above with loose scattered tea grounds settled randomly at the bottom — nothing recognizable yet. One clear subject, centered. No people.' },
  { id: 'wcs-teacup-after', char: false, label: 'Teacup dregs — clumping into shapes — watercolor story',
    content: 'The same single teacup viewed from directly above, but now the tea grounds have clumped into clear little shapes: one clump clearly forming a small animal, another clearly forming a little chair — reading meaning into random tea leaves. One clear subject, centered. No people.' },
  { id: 'wcs-process-framed', char: true, label: 'The gold frame around Mason’s process — watercolor story',
    content: MASON + 'standing beside his pipe contraption in an art gallery and presenting it with one open hand, while an ornate gold picture frame hangs in mid-air around the entire machine. Nobody else in the scene.' },
  { id: 'wcs-checkout-sculpture', char: false, label: 'The checkout-counter sculpture — art or groceries? — watercolor story',
    content: 'A grocery-store checkout conveyor belt seen from the side with a small tidy arrangement of grocery items on it — a piece of fruit, a can, a box, a bottle, an egg carton — placed so it is genuinely ambiguous whether they were arranged to make a pleasing little sculpture of colors and shapes or simply lined up to be bought and eaten. Simple and clear. Nobody in the scene.' },
  { id: 'wcs-recap-net', char: false, label: 'The recap — a net gathers everything we made — watercolor story',
    content: 'A large soft net drapes gently over a loose vertical arrangement of tiny simplified pictures: a tiny pipe contraption, a tiny framed dot picture, a tiny teacup, a tiny gold frame, a tiny grocery arrangement — gathering them all together. Nobody, no people.' },
  { id: 'wcs-wider-net', char: false, label: 'Casting a wider net — watercolor story',
    content: 'A person standing on a shore casting a wide fishing net out over the water, the net spreading open to catch as much as possible — casting a wider net. Only that one person in the scene.' },
  { id: 'wcs-zoomout-diagram', char: false, label: 'You are here — five rectangles diagram — watercolor story',
    content: 'A clean minimal diagram: a horizontal row of five small rectangles; the second rectangle from the left has a small star drawn inside it and a short arrow pointing down at it from above — a “you are here”, one example among several separate areas. Nobody, no people.' },
  { id: 'wcs-process-alternation', char: false, label: 'Noise → order → noise — the alternating process diagram — watercolor story',
    content: 'A vertical S-shaped process diagram snaking down the tall frame: a chain of four simple rounded-rectangle boxes connected by flowing wavy strands. Loose tangled multicolored strands representing NOISE and chaos flow into the first box; they emerge from it as neat, evenly-combed, ordered parallel lines representing ORDER and control; those ordered lines then scatter back into loose tangled noise as they flow into the next box, which combs them into order again; the pattern alternates back and forth — noise, then order, then noise, then order — down through the boxes to a final box at the bottom. Nobody, no people.' },
  { id: 'wcs-campfire-flames', char: false, label: 'The campfire — noise turning into a pattern — watercolor story',
    content: 'A woman sitting cross-legged at a small campfire beside a young man with blonde hair and horn-rimmed glasses; she gazes into the flames, and the fire is just beginning to curl into the shape of a small recognizable form — the mind turning noise into a pattern. A few small stars above them. Only those two people in the scene.' },
  { id: 'wcs-gallery-hang', char: true, label: 'Mason hanging his art in the gallery — watercolor story',
    content: MASON + 'up on a small stepladder, hanging a small framed abstract picture of colored dots high on a white gallery wall. Nobody else in the scene.' },
  { id: 'wcs-gold-frame', char: false, label: 'The reusable gold frame — “this is art” stamp — watercolor story',
    content: 'A single ornate rectangular gold picture frame with decorative baroque scrollwork corners, with an empty center, centered — a reusable decorative “this is art” frame meant to be stamped onto other images. Nobody, no people.' },
];

async function edit(prompt, refs, retries = 2) {
  let lastErr;
  for (let a = 0; a <= retries; a++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('size', '1024x1536');
      form.append('quality', QUALITY);
      form.append('output_format', 'png');
      refs.forEach((r, i) => form.append('image[]', new Blob([r.buf], { type: r.type }), r.name));
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'edit error');
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('no image returned');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      console.warn(`  attempt ${a + 1} failed: ${err.message}`);
      if (a < retries) await new Promise(r => setTimeout(r, 2500 * (a + 1)));
    }
  }
  throw lastErr;
}

(async () => {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const app = initializeApp({ credential: cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = getStorage(app).bucket();
  const styleRef = { buf: fs.readFileSync(path.join(__dirname, 'datescan0013.png')), type: 'image/png', name: 'style.png' };
  const charRef = { buf: fs.readFileSync(path.join(__dirname, 'mason-char-ref.jpeg')), type: 'image/jpeg', name: 'mason.jpeg' };
  const manifest = []; const failed = [];

  const only = process.env.ONLY ? process.env.ONLY.split(',').map(s => s.trim()) : null;
  const queue = PANELS.filter(p => !only || only.includes(p.id));
  async function worker() {
    for (let p; (p = queue.shift()); ) {
      const local = path.join(__dirname, `${p.id}.png`);
      try {
        if (!fs.existsSync(local) || process.env.FORCE) {
          console.log(`${p.id}: rendering (${QUALITY}${p.char ? ', +char ref' : ''})…`);
          const wrap = p.char ? WRAP_CHAR : WRAP_STYLE;
          const refs = p.char ? [styleRef, charRef] : [styleRef];
          const buf = await edit(wrap + p.content, refs);
          fs.writeFileSync(local, buf);
        }
        const dest = `story-shorts/art-mason/wc-story/${p.id}.png`;
        await bucket.upload(local, { destination: dest, metadata: { contentType: 'image/png' } });
        await bucket.file(dest).makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
        // 720px display copy for the Compare page (originals stay untouched)
        const thumbLocal = path.join(__dirname, `${p.id}-thumb.webp`);
        await sharp(local).resize({ width: 720 }).webp({ quality: 82 }).toFile(thumbLocal);
        const thumbDest = `story-shorts/art-mason/wc-story/thumbs/${p.id}.webp`;
        await bucket.upload(thumbLocal, { destination: thumbDest, metadata: { contentType: 'image/webp' } });
        await bucket.file(thumbDest).makePublic();
        const thumb = `https://storage.googleapis.com/${bucket.name}/${thumbDest}`;
        console.log(`${p.id}: uploaded → ${url}`);
        manifest.push({ id: p.id, char: p.char, label: p.label, content: p.content, quality: QUALITY, url, thumb, madeAt: Date.now() });
      } catch (e) { console.error(`${p.id}: FAILED — ${e.message}`); failed.push(p.id); }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  // merge into any existing manifest so partial (ONLY=…) runs never drop panels
  const mPath = path.join(__dirname, 'panels-wc-story.json');
  const prior = fs.existsSync(mPath) ? JSON.parse(fs.readFileSync(mPath, 'utf8')) : [];
  const merged = [...prior.filter(e => !manifest.some(n => n.id === e.id)), ...manifest];
  merged.sort((a, b) => PANELS.findIndex(x => x.id === a.id) - PANELS.findIndex(x => x.id === b.id));
  fs.writeFileSync(mPath, JSON.stringify(merged, null, 2));
  console.log(`ALL DONE — ${manifest.length}/${PANELS.length}${failed.length ? ', FAILED: ' + failed.join(',') : ''}`);
  process.exit(failed.length ? 2 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
