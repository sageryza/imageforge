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
const WRAP_CHAR = 'Use the first attached image only as the style reference — do not copy its content. The second attached image is the character reference for Mason. Draw: ';
const MASON = 'Mason (the person from the character reference) ';

// Content prompts are written FROM SOPHIE'S OWN VOICE MEMO TRANSCRIPTS (the
// 2026-07-28 "Metaphor Machine" memo + the 2026-07-29 1:47–2:05pm run, in the
// membry memo archive) — her wording kept wherever it can be, never another
// chat's rewrite. Panels marked `memo:` cite their source recording.
// mason-portrait and gallery-hang are NOT in the memos (earlier-session
// panels, kept). The "Nobody else in the scene" guard lines are Claude's.
const PANELS = [
  { id: 'wcs-mason-portrait', char: true, label: 'Mason in his studio',
    content: MASON + 'standing in his cluttered artist studio among homemade contraptions of pipes and funnels, arms crossed, pleased with himself. Nobody else in the scene.' },
  { id: 'wcs-pipeline', char: true, memo: '2026-07-29_1351', label: 'Mason operating the noise-art pipeline',
    content: MASON + 'making his noise art, showing the pipeline: he holds a long fuchsia pipe, and attached to it is an ambiguous mop-net handle thing that has all these colored dots in it; from there the dots get suctioned into a yellow pipe — a squeegee, accordion-type pipe thing, a little wider; after that step the same dots, slightly different colors, are on an aquamarine seafoam-green moppy type thing, a little bit different; the pipe snakes down low — not all the way to the floor — then back up and around so it fits in the image, maybe one more pipe iteration, and then it lands onto a framed picture on the wall of the gallery. Nobody else in the scene.' },
  { id: 'wcs-metaphor-machine', char: false, memo: '2026-07-28_2146', label: 'The metaphor machine',
    content: 'A giant machine with a conveyor belt going into it; on the belt, raw materials — things from the real world: things people say, books, art pieces, moments; in the center a little weird device spins them around and discards the physical aspect of them; what is left — the abstraction that was inside, the essence — floats out the other side. Nobody in the scene.' },
  { id: 'wcs-bouncer-gates', char: false, memo: '2026-07-29_1347', label: 'The bouncer checking for signs of abstraction',
    content: 'A bouncer standing in front of a nightclub, checking ID at the door — checking for the three to five signs that often refer to abstraction; a few small signs hinting at hidden meaning float near the ID. Nobody else in the scene.' },
  { id: 'wcs-gallery-puzzled', char: false, memo: '2026-07-29_1400', label: 'The person in the gallery, scratching their head',
    content: 'A person in an art gallery looking at the framed picture Mason made — colored dots on the wall — scratching their head, staring at the picture. Nobody else in the scene.' },
  { id: 'wcs-gallery-lightbulb', char: false, memo: '2026-07-29_1400', label: 'The person gets an idea — the lightbulb and the meaning',
    content: 'The same person in the art gallery staring at the framed dot picture, suddenly having an idea: a light bulb outside their head, and a thought bubble with some representation of a meaning — an abstraction — inside it. Oh, it means this. Nobody else in the scene.' },
  { id: 'wcs-gallery-viewer-framed', char: false, memo: '2026-07-29_1400', label: 'The frame comes around the viewer — this is where the art lives',
    content: 'The same person in the art gallery looking at the framed dot picture, while an ornate gold frame comes around the PERSON — this is the art, this is where the art lives. Nobody else in the scene.' },
  { id: 'wcs-beef-jerky', char: false, memo: '2026-07-29_1354', label: 'Pulling apart beef jerky — it needs to be disentangled',
    content: 'Someone pulling apart a piece of beef jerky, the stringy strands separating, to show that it needs to be disentangled. Simple and clear, centered.' },
  { id: 'wcs-split-diagram', char: false, memo: '2026-07-29_1354', label: 'Diagram — one rectangle divides into two',
    content: 'A really simple diagram in the grid style: a white rectangle, then a dashed line that divides into two new white rectangles; each of the new ones has a symbol — one has a circle and one has a square. Nobody, no people — just the diagram.' },
  { id: 'wcs-dumped-work', char: false, memo: '2026-07-29_1355', label: 'Dumping a pile of work — a job that isn’t yours',
    content: 'An office coworker dumping a pile of work into a woman’s arms — giving someone a job that’s not really theirs. Only the two people in the scene.' },
  { id: 'wcs-dots-meaning', char: false, memo: '2026-07-29_1355', label: 'Finding meaning in a random pattern of dots',
    content: 'A random pattern of finite dots, with meaning being found in it: some dots collected by loops of all different oblong shapes, like a constellation. Nobody, no people — just the dots and loops.' },
  { id: 'wcs-teacup-before', char: false, memo: '2026-07-29_1355', label: 'Teacup — the dregs, before',
    content: 'A teacup with tea dregs at the bottom — just the dregs, nothing recognizable. One clear subject, centered. No people.' },
  { id: 'wcs-teacup-after', char: false, memo: '2026-07-29_1355', label: 'Teacup — the dregs clumping into little shapes',
    content: 'The same teacup with the tea dregs now clumping into little shapes at the bottom. One clear subject, centered. No people.' },
  { id: 'wcs-teacup-symbols', char: false, memo: '2026-07-29_1355', label: 'Teacup — the shapes become symbols: an animal, a chair',
    content: 'The same teacup, the clumped tea dregs now become symbols — one clearly an animal, one clearly a chair. One clear subject, centered. No people.' },
  { id: 'wcs-process-framed', char: false, memo: '2026-07-29_1357', label: 'The gold frame stamped around the whole mechanism',
    content: 'Mason’s whole weird mechanism — the pipes with the squeegee and the vacuum and everything — standing in a gallery, with an ornate gold frame stamped around the entire mechanism: see, that’s where the art is. Nobody in the scene.' },
  { id: 'wcs-checkout-sculpture', char: false, memo: '2026-07-29_1357', label: 'The checkout-counter sculpture',
    content: 'A checkout counter with all the things someone picked out stacked into a little sculpture of pretty colors and shapes — you don’t know whether they were picked out to make a sculpture or to be eaten — with an ornate gold frame stamped around it. Nobody in the scene.' },
  { id: 'wcs-recap-net', char: false, memo: '2026-07-29_1400', label: 'The recap — a big net covers everything we made',
    content: 'A big net covering the whole pipeline of images: simplified versions of the images already made — the pipe mechanism, the framed dot picture, the teacup, the gold frame, the checkout sculpture — gathered under the net. Nobody, no people.' },
  { id: 'wcs-wider-net', char: false, memo: '2026-07-29_1403', label: 'Casting a wider net, with more fish in it',
    content: 'Casting a wider net: a person casting a wide fishing net out, with more fish in it. Only that one person in the scene.' },
  { id: 'wcs-zoomout-diagram', char: false, memo: '2026-07-29_1403', label: 'Diagram — five rectangles, you are here',
    content: 'A simple diagram: five little white rectangles in a row; the second one says YOU ARE HERE inside it; separate little arrows come down from the top, pointing at each of the other four. Nobody, no people.' },
  { id: 'wcs-campfire-flames', char: false, memo: '2026-07-29_1405', label: 'Looking at the campfire — the flame starts to turn into something',
    content: 'A woman looking at a flame at a campfire, sitting next to a guy with blonde hair and glasses; the flame starts to turn into something — a shape beginning to appear in the fire. Only those two people in the scene.' },
  { id: 'wcs-gallery-hang', char: true, label: 'Mason hanging his art in the gallery',
    content: MASON + 'up on a small stepladder, hanging a small framed abstract picture of colored dots high on a white gallery wall. Nobody else in the scene.' },
  { id: 'wcs-gold-frame', char: false, memo: '2026-07-29_1357', label: 'The reusable ornate gold frame',
    content: 'A reusable image of a gold, ornate frame, empty in the middle, meant to be stamped onto other images. Centered. Nobody, no people.' },
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
  // SUFFIX gives a re-roll a NEW id (old tiles stay in Assets as history)
  const SUF = process.env.SUFFIX || '';
  const queue = PANELS.filter(p => !only || only.includes(p.id))
    .map(p => SUF ? { ...p, id: p.id + SUF } : p);
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
        // record the EXACT wrapper this render used — the prompt filed to the
        // Assets tab must be the real text, never reconstructed from today's constants
        manifest.push({ id: p.id, base: p.id.replace(SUF, ''), char: p.char, label: p.label, content: p.content, wrap: (p.char ? WRAP_CHAR : WRAP_STYLE) + '[content]', quality: QUALITY, url, thumb, madeAt: Date.now() });
      } catch (e) { console.error(`${p.id}: FAILED — ${e.message}`); failed.push(p.id); }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  // merge into any existing manifest so partial (ONLY=…) runs never drop panels
  const mPath = path.join(__dirname, 'panels-wc-story.json');
  const prior = fs.existsSync(mPath) ? JSON.parse(fs.readFileSync(mPath, 'utf8')) : [];
  const merged = [...prior.filter(e => !manifest.some(n => n.id === e.id)), ...manifest];
  merged.sort((a, b) => PANELS.findIndex(x => x.id === (a.base || a.id)) - PANELS.findIndex(x => x.id === (b.base || b.id)));
  fs.writeFileSync(mPath, JSON.stringify(merged, null, 2));
  console.log(`ALL DONE — ${manifest.length}/${PANELS.length}${failed.length ? ', FAILED: ' + failed.join(',') : ''}`);
  process.exit(failed.length ? 2 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
