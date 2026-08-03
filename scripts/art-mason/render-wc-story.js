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
    content: 'A giant machine, and there’s almost like a conveyor belt, and into it go raw materials, like things in the real world — like things people say, or like books or art pieces or something, or just moments. The things go in, and they get into the center, and then this little weird device thing sort of spins them around and basically discards the physical aspect of them, and what’s left is the abstraction that was inside — like the essence, and it can exist without the thing. Nobody in the scene.' },
  { id: 'wcs-bouncer-gates', char: false, memo: '2026-07-29_1347', label: 'The bouncer checking for signs of abstraction',
    content: 'A bouncer standing in front of a nightclub, checking ID, like, okay: do you have any of these three to five signs that often refer to abstraction? Nobody else in the scene.' },
  { id: 'wcs-gallery-puzzled', char: false, memo: '2026-07-29_1400', label: 'The person in the gallery, scratching their head',
    content: 'The person looking at the art in the gallery that Mason made: they’re scratching their head, staring at the picture. Nobody else in the scene.' },
  { id: 'wcs-gallery-lightbulb', char: false, memo: '2026-07-29_1400', label: 'The person gets an idea — the lightbulb and the meaning',
    content: 'The person looking at the art in the gallery that Mason made: suddenly they have an idea, so a light bulb — the light bulb is outside of their head — and a thought bubble, and inside the thought bubble is some sort of representation of a meaning, an abstraction. It’s like, oh, it means this. Okay, got it. Nobody else in the scene.' },
  { id: 'wcs-gallery-viewer-framed', char: false, memo: '2026-07-29_1400', label: 'The frame comes around the viewer — this is where the art lives',
    content: 'The person looking at the art in the gallery that Mason made, and the ornate gold frame comes around that person — okay, this is the art. This is where the art lives. Nobody else in the scene.' },
  { id: 'wcs-beef-jerky', char: false, memo: '2026-07-29_1354', label: 'Pulling apart beef jerky — it needs to be disentangled',
    content: 'Someone pulling apart beef jerky to show that it needs to be disentangled.' },
  { id: 'wcs-split-diagram', char: false, memo: '2026-07-29_1354', label: 'Diagram — one rectangle divides into two',
    content: 'An image in the grid style because it’s really simple: basically it’s just a white rectangle and then a dashed line that divides into two new white rectangles, and each of the new ones has a symbol — one has a circle and one has a square. Nobody, no people.' },
  { id: 'wcs-dumped-work', char: false, memo: '2026-07-29_1355', label: 'Dumping a pile of work — a job that isn’t yours',
    content: 'An office coworker who dumped a bunch of work into a woman’s arms and said, my therapist says I’m not supposed to take on any more work — basically giving someone a job that’s not really theirs. Only the two people in the scene.' },
  { id: 'wcs-dots-meaning', char: false, memo: '2026-07-29_1355 + 1405', label: 'Finding meaning in a random pattern of dots',
    content: 'Noise: you take dots, like a random pattern of dots, and you find meaning in it, so you might circle things — the dots being collected by shapes that are all different, sort of oblong, some more like a constellation. Nobody, no people.' },
  { id: 'wcs-teacup-before', char: false, memo: '2026-07-29_1355', label: 'Teacup — the dregs, before',
    content: 'A teacup with tea dregs at the bottom — the before: just the dregs. No people.' },
  { id: 'wcs-teacup-after', char: false, memo: '2026-07-29_1355', label: 'Teacup — the dregs clumping into little shapes',
    content: 'The teacup with tea dregs at the bottom — the after: they’re clumping into like little shapes. No people.' },
  { id: 'wcs-teacup-symbols', char: false, memo: '2026-07-29_1355', label: 'Teacup — the shapes become symbols: an animal, a chair',
    content: 'The teacup — the after after: the shapes become like symbols, things like an animal, a chair, et cetera. No people.' },
  { id: 'wcs-process-framed', char: false, memo: '2026-07-29_1357', label: 'The gold frame stamped around the whole mechanism',
    content: 'A gold sort of ornate frame, and it goes around that whole weird mechanism with the squeegee and the vacuum and everything, and it gets like boomp stamped on, and it’s like, yeah, see, that’s where the art is. Nobody in the scene.' },
  { id: 'wcs-checkout-sculpture', char: false, memo: '2026-07-29_1357', label: 'The checkout-counter sculpture',
    content: 'The checkout counter sculpture: a little time period where the sculpture exists of all the things picked out at a grocery checkout — you don’t know if they were picked out in order to stack them and make pretty colors and shapes, or whether the person actually wants to eat them — and it has the gold frame stamped on it again. Nobody in the scene.' },
  { id: 'wcs-recap-net', char: false, memo: '2026-07-29_1400', label: 'The recap — a big net covers everything we made',
    content: 'A big net image that covers the whole pipeline: each of the images we already made, possibly simplified versions of them — the pipe mechanism, the framed dot picture, the teacup, the gold frame, the checkout sculpture — and the net covers it. Nobody, no people.' },
  { id: 'wcs-wider-net', char: false, memo: '2026-07-29_1403', label: 'Casting a wider net, with more fish in it',
    content: 'Casting a wider net, with like more fish in it.' },
  { id: 'wcs-zoomout-diagram', char: false, memo: '2026-07-29_1403', label: 'Diagram — five rectangles, you are here',
    content: 'A diagram: five like little white rectangles, and the second one is this idea, so it will just say YOU ARE HERE inside it. And then a little arrow pointing at the other four coming down, little arrow from the top, each one, separate arrows. Nobody, no people.' },
  { id: 'wcs-campfire-flames', char: false, memo: '2026-07-29_1405', label: 'Looking at the campfire — the flame starts to turn into something',
    content: 'A woman looking at a flame at a campfire, sitting next to a guy with blonde hair and glasses, and the flame starts to turn into something. Only those two people in the scene.' },
  { id: 'wcs-gallery-hang', char: true, label: 'Mason hanging his art in the gallery',
    content: MASON + 'up on a small stepladder, hanging a small framed abstract picture of colored dots high on a white gallery wall. Nobody else in the scene.' },
  { id: 'wcs-gold-frame', char: false, memo: '2026-07-29_1357', label: 'The reusable ornate gold frame',
    content: 'A reusable image of a gold sort of ornate frame that can be put onto other images. Nobody, no people.' },
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
  // SUFFIX gives a re-roll a NEW id (old tiles stay in Assets as history);
  // EXTRA_IDS get EXTRA_LINE appended to their content (recorded in the
  // manifest, so the filed prompt is still exactly what was sent)
  const SUF = process.env.SUFFIX || '';
  const extraIds = process.env.EXTRA_IDS ? process.env.EXTRA_IDS.split(',').map(s => s.trim()) : [];
  const queue = PANELS.filter(p => !only || only.includes(p.id))
    .map(p => extraIds.includes(p.id) ? { ...p, content: p.content + ' ' + process.env.EXTRA_LINE } : p)
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
