// Art Mason story — pastel V2 vertical panels (2:3), from Sophie's July 29
// voice-memo run. Same engine as scripts/story-short-pastel/render-panels.js:
// gpt-image-2 EDITS with the witch-school style refs, whitened background.
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const OUT = __dirname;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const STYLE = 'Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, on a plain white background, playful modern editorial illustration. ';
const CHAR = 'Where the noise artist Mason appears, keep him consistent: a man with reddish shoulder-length hair and a full reddish poet-philosopher beard, a little Viking-like, wearing a sage-green sweater and dark trousers. Where the woman appears, keep her consistent: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants. ';
const END = ' Vertical composition. Absolutely no text, no words, no letters, no numbers, no captions.';

// Story order. label = the Assets-tab description Sophie reviews by.
const PANELS = [
  { id: 'mason-portrait', label: 'Mason — the noise artist, in his studio',
    content: 'Mason stands proudly in a cluttered artist studio among strange homemade contraptions of pipes and funnels, arms crossed, chin up, looking pleased with himself.' },
  { id: 'pipeline-apparatus', label: 'The noise-art pipeline — fuchsia pipe to gallery wall',
    content: 'Mason holds a long fuchsia pipe topped with an ambiguous mop-net head full of small colored dots; the dots get suctioned onward into a wider yellow accordion squeegee pipe, then onto a seafoam-green moppy stage where the same dots appear in slightly different colors, and the pipe curves up and around the scene before landing on a small framed picture hanging on a gallery wall.' },
  { id: 'metaphor-machine', label: 'The metaphor machine — things in, essences out',
    content: 'A conveyor belt carries ordinary things — a book, a teacup, a small framed painting, a speech bubble — into a large friendly rounded machine; out the other side float softly glowing simple abstract shapes rising like released essences.' },
  { id: 'bouncer-gates', label: 'The bouncer at the gates of the metaphor machine',
    content: 'A burly bouncer stands with folded arms in front of a velvet rope outside a nightclub whose doorway is shaped like a big machine mouth, inspecting a small card held up by a nervous squiggly abstract shape waiting in line with other odd shapes.' },
  { id: 'gallery-puzzled', label: 'Gallery viewer scratching their head at Mason’s art',
    content: 'A visitor in an art gallery stands before a framed abstract picture of colored dots, scratching their head, leaning in, brow furrowed, completely puzzled.' },
  { id: 'gallery-lightbulb', label: 'Gallery viewer — the lightbulb and the meaning',
    content: 'The same gallery visitor before the framed dot picture now beams with an idea: a bright lightbulb floats above their head beside a large thought bubble holding one clean simple abstract symbol, as if a meaning has just arrived.' },
  { id: 'gallery-viewer-framed', label: 'The frame lands on the viewer — this is where the art lives',
    content: 'An ornate golden picture frame hangs in mid-air around the gallery visitor themselves as they gaze at the small dot picture on the wall, making the viewer the artwork instead of the painting.' },
  { id: 'beef-jerky', label: 'Pulling apart beef jerky — disentangling the idea',
    content: 'A close-up of two hands slowly pulling apart a strip of beef jerky, its stringy fibers stretching and separating down the middle.' },
  { id: 'split-diagram', label: 'Diagram — one rectangle becomes two',
    content: 'A minimal flat diagram: one large white rectangle outlined in black with a vertical dashed line down its middle, and below it the same rectangle separated into two smaller white rectangles, the left one containing a single circle and the right one containing a single square.' },
  { id: 'dumped-work', label: 'The dumped pile of work — a job that isn’t yours',
    content: 'An office coworker cheerfully dumps a towering armload of loose papers and folders into the arms of the woman, who staggers backward under the pile with a stunned expression.' },
  { id: 'dots-meaning', label: 'Finding meaning in random dots',
    content: 'A loose scattering of small colored dots on a plain background, with a few hand-drawn loops circling little clusters of them, as if someone is finding shapes hiding in the randomness.' },
  { id: 'teacup-before', label: 'Teacup dregs — before',
    content: 'A teacup seen from directly above, pale tea at the bottom with small dark tea dregs scattered randomly across it.' },
  { id: 'teacup-after', label: 'Teacup dregs — clumping into shapes',
    content: 'The same teacup seen from directly above, but now the dark tea dregs have drifted together into tiny recognizable silhouettes: a little animal, a small chair, a star.' },
  { id: 'process-framed', label: 'The gold frame stamped on the process — the process is the art',
    content: 'The whole absurd contraption of fuchsia pipe, yellow accordion squeegee and seafoam mop stages stands in the middle of a gallery with an ornate golden picture frame hanging around the entire machine, a small proud red wax seal stamped on the frame’s corner.' },
  { id: 'checkout-sculpture', label: 'The checkout-counter sculpture',
    content: 'A grocery checkout conveyor belt where the groceries — fruit, boxes, bottles, a baguette — are stacked into a deliberate colorful tower, with an ornate golden picture frame hanging in the air around the stack, while a puzzled cashier looks on.' },
  { id: 'recap-net', label: 'The recap — a net over everything we made',
    content: 'A large soft net drapes gently over a loose grid of tiny simplified pictures floating on white: a tiny pipe contraption, a tiny framed dot picture, a tiny teacup, a tiny gallery visitor, a tiny grocery tower, gathering them all together.' },
  { id: 'wider-net', label: 'Casting a wider net — and the you-are-here diagram',
    content: 'Top half: a fishing net cast wide over water, bulging with many colorful fish. Bottom half: a minimal flat diagram of five small white rectangles in a row, the second one highlighted in pastel pink with a small star inside, thin arrows pointing down at each rectangle from above.' },
  { id: 'campfire-flames', label: 'The campfire — noise turning into patterns',
    content: 'The woman sits at a night campfire next to a man with short blonde hair and round glasses; she stares into the flame, and the top of the fire drifts apart into tiny constellation-like patterns of dots and lines rising into the dark.' },
];

async function whiten(buf) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const idx = (x, y) => (y * W + x) * C;
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of corners) { const i = idx(x, y); br += data[i]; bg += data[i + 1]; bb += data[i + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const tol2 = 46 * 46;
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb; return dr * dr + dg * dg + db * db <= tol2; };
  const visited = new Uint8Array(W * H), stack = [];
  const pushIf = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (visited[p] || !close(idx(x, y))) return; visited[p] = 1; stack.push(p); };
  for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); }
  for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); }
  while (stack.length) { const p = stack.pop(), x = p % W, y = (p - x) / W; pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1); }
  const out = Buffer.from(data);
  for (let p = 0; p < W * H; p++) if (visited[p]) { const i = p * C; out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; if (C === 4) out[i + 3] = 255; }
  return await sharp(out, { raw: { width: W, height: H, channels: C } }).webp({ lossless: true }).toBuffer();
}

async function editWithRefs(prompt, refs, retries = 2) {
  let lastErr;
  for (let a = 0; a <= retries; a++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('size', '1024x1536');
      form.append('quality', 'medium');
      form.append('output_format', 'webp');
      refs.forEach((b, i) => form.append('image[]', new Blob([b], { type: 'image/png' }), `ref${i + 1}.png`));
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'edit error');
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('no image returned');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      console.warn(`  attempt ${a + 1} failed: ${err.message}`);
      if (a < retries) await new Promise(r => setTimeout(r, 2000 * (a + 1)));
    }
  }
  throw lastErr;
}

(async () => {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const app = initializeApp({ credential: cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = getStorage(app).bucket();

  console.log('downloading style refs…');
  const refs = [];
  for (const p of ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png']) {
    const [buf] = await bucket.file(p).download();
    refs.push(buf);
  }
  console.log('refs ok:', refs.map(r => r.length));

  const manifest = [];
  const failed = [];
  // 4 at a time — the concurrency movies.js validated against OpenAI limits.
  const queue = [...PANELS];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const local = path.join(OUT, `${p.id}.webp`);
      try {
        if (!fs.existsSync(local) || process.env.FORCE) {
          console.log(`${p.id}: rendering…`);
          const t0 = Date.now();
          let buf = await editWithRefs(STYLE + CHAR + p.content + END, refs);
          try { buf = await whiten(buf); } catch (e) { console.warn('whiten failed:', e.message); }
          fs.writeFileSync(local, buf);
          console.log(`${p.id}: done in ${((Date.now() - t0) / 1000).toFixed(0)}s (${buf.length} bytes)`);
        } else {
          console.log(`${p.id}: exists, skip render`);
        }
        const dest = `story-shorts/art-mason/${p.id}.webp`;
        await bucket.upload(local, { destination: dest, metadata: { contentType: 'image/webp' } });
        await bucket.file(dest).makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
        console.log(`${p.id}: uploaded → ${url}`);
        manifest.push({ id: p.id, label: p.label, content: p.content, url, madeAt: Date.now() });
      } catch (err) {
        console.error(`${p.id}: FAILED — ${err.message}`);
        failed.push(p.id);
      }
    }
  });
  await Promise.all(workers);

  manifest.sort((a, b) => PANELS.findIndex(p => p.id === a.id) - PANELS.findIndex(p => p.id === b.id));
  fs.writeFileSync(path.join(OUT, 'panels.json'), JSON.stringify(manifest, null, 2));
  console.log(`ALL DONE — ${manifest.length}/${PANELS.length} panels${failed.length ? ', FAILED: ' + failed.join(', ') : ''}`);
  process.exit(failed.length ? 2 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
