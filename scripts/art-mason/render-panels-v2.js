// Art Mason storyboard v2 — rebuilt against the exact established prompts
// (Sophie's exactprompts.md: the na-* noise-art set from specA/noiseart/
// teacup/cropart/white-redo/process spec files), adapted square → 2:3.
// Fixes vs v1: character line ONLY on panels that need a person (char:true),
// explicit NO-animals / nobody guards, proven content prompts reused verbatim.
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const OUT = path.join(__dirname, 'v2');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Group 3 style string (identical to server.js house-pastel) — verbatim.
const STYLE = 'Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, on a plain white background, playful modern editorial illustration. ';
// Group 3 character line — inserted ONLY when p.char is true.
const CHAR = 'Where the recurring woman appears keep her consistent: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, striped pants; calm and gentle. ';
const END = ' Vertical composition. Absolutely no text, no words, no letters, no numbers, no captions.';
// Mason inline (the na-pipeline-v2 pattern — no global character line for him).
const MASON = 'A red-bearded Viking-ish man (MASON, a poet-philosopher — reddish shoulder-length hair, a full red beard, NOT the recurring woman)';

const PANELS = [
  { id: 'mason-portrait', char: false, label: 'Mason — the noise artist, in his studio (v2)',
    content: `${MASON} standing proudly in his artist studio among a few simple homemade contraptions of pipes and funnels, arms crossed, pleased with himself. Nobody else in the scene, definitely NO animals or creatures. Bold black outlines, flat pastel colors, no gradients, plain white background.` },
  { id: 'pipeline-apparatus', char: false, label: 'The noise-art pipeline — Mason works the pipes (v2)',
    content: `A red-bearded Viking-ish man (MASON, a poet-philosopher — NOT the recurring woman) operating his noise-art pipeline: he holds a long ORANGE pipe (not pink) with a moppy net handle of colored dots feeding in at the start; the pipe runs through a wider yellow accordion/squeegee section and a teal moppy section, snaking up and around to fit the tall vertical frame, and finally lands on a framed picture HUNG HIGH ON A GALLERY WALL (not near the floor). Keep the tubing simpler and less crazy; small colored polka-dots appear ONLY in the intermediate output, not all along the process. Nobody else in the scene, definitely NO animals or creatures. Bold black outlines, flat colors, plain white background.` },
  { id: 'metaphor-machine', char: false, label: 'The metaphor machine — things in, essences out (v2)',
    content: 'A conveyor belt carries ordinary things — a book, a teacup, a small framed painting, a speech bubble — into a large friendly rounded machine; out the other side float softly glowing simple abstract shapes rising like released essences. Nobody in the scene, definitely NO animals or creatures. Bold black outlines, flat pastel colors, no gradients, plain white background.' },
  { id: 'bouncer-gates', char: false, label: 'The bouncer at the gates of the metaphor machine (v2)',
    content: 'A nightclub bouncer in a dark suit standing at a velvet-rope doorway, holding a clipboard and checking it as he decides who gets in. A few small simple symbols (a spiral, a pattern of dots, two contrasting shapes) float above the clipboard as the things he is checking for — hints of hidden meaning. Definitely NO animals or creatures. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'gallery-puzzled', char: true, label: 'Gallery viewer scratching her head at Mason’s art (v2)',
    content: 'The recurring woman standing in an art gallery in front of a framed abstract picture of colored dots on the wall, scratching her head, leaning in, brow furrowed, completely puzzled. Nobody else in the gallery, definitely NO animals or creatures. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'gallery-lightbulb', char: true, label: 'Gallery viewer — the lightbulb and the meaning (v2)',
    content: 'The recurring woman standing in an art gallery in front of a framed abstract picture on the wall, one hand on her chin, a glowing lightbulb just above her head and a thought bubble beside her holding one small clear abstract symbol — the moment she decides what it means. Nobody else, definitely NO animals or creatures. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'gallery-viewer-framed', char: true, label: 'The frame lands on the viewer — this is where the art lives (v2)',
    content: 'The recurring woman gazing at a small framed abstract dot picture on a gallery wall, while an ornate rectangular gold picture frame with decorative baroque scrollwork corners hangs in mid-air around HER, making the viewer the artwork instead of the painting. Nobody else, definitely NO animals or creatures. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'beef-jerky', char: false, label: 'Pulling apart beef jerky — disentangling (v2)',
    content: 'Two hands pulling apart a single piece of beef jerky, stretching it until the stringy strands separate into two — the idea of disentangling two things that were stuck together. Simple and clear, centered. Only the two hands and the jerky, no people, NO animals. Bold black outlines, flat pastel colors, no gradients, on plain white.' },
  { id: 'split-diagram', char: false, label: 'Diagram — one rectangle becomes two (v2)',
    content: 'A clean minimal diagram: on the left one white rectangle with a bold outline; a short dashed line leads rightward to two separate white rectangles; the upper-right rectangle contains a small circle, the lower-right rectangle contains a small square — one thing dividing into two distinct things. Nobody, no people, definitely NO animals — just the diagram. Bold black outlines, flat, no gradients, plain white background.' },
  { id: 'dumped-work', char: true, label: 'The dumped pile of work — a job that isn’t yours (v2)',
    content: 'An office coworker cheerfully dumps a towering armload of loose papers and folders into the arms of the recurring woman, who staggers backward under the pile with a stunned expression. Only the two people, definitely NO animals or creatures. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'dots-meaning', char: false, label: 'Finding meaning in random dots (v2)',
    content: 'A loose scattering of small colored dots on a plain background, with a few hand-drawn loops circling little clusters of them, as if someone is finding shapes hiding in the randomness. Nobody, no people, definitely NO animals — just the dots and loops. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'teacup-before', char: false, label: 'Teacup dregs — before (v2)',
    content: 'A single teacup viewed from directly above with loose scattered tea grounds settled randomly at the bottom — nothing recognizable yet. One clear subject, centered. No people, NO animals. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'teacup-after', char: false, label: 'Teacup dregs — clumping into shapes (v2)',
    content: 'The same single teacup viewed from directly above, but now the tea grounds have clumped into clear little shapes: one clump clearly forming a small animal, another clearly forming a little chair — reading meaning into random tea leaves. One clear subject, centered. No people. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'process-framed', char: false, label: 'The gold frame stamped on the process — the process is the art (v2)',
    content: 'Mason’s noise-art contraption — an orange pipe, a yellow accordion squeegee section and a teal moppy section — standing in the middle of a gallery, with a single ornate rectangular gold picture frame with decorative baroque scrollwork corners hanging in the air around the ENTIRE machine, declaring the process itself the artwork. Nobody in the scene, definitely NO animals or creatures. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'checkout-sculpture', char: false, label: 'The checkout-counter sculpture — art or groceries? (v2)',
    content: 'A grocery-store checkout conveyor belt seen from the side with a small tidy arrangement of grocery items on it — a piece of fruit, a can, a box, a bottle, an egg carton — placed so it is genuinely ambiguous whether they were arranged to make a pleasing little sculpture of colors and shapes or simply lined up to be bought and eaten. Simple and clear. Nobody in the scene, NO animals. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'recap-net', char: false, label: 'The recap — a net gathers everything we made (v2)',
    content: 'A large soft net drapes gently over a loose vertical arrangement of tiny simplified pictures floating on white: a tiny pipe contraption, a tiny framed dot picture, a tiny teacup, a tiny gold frame, a tiny grocery arrangement — gathering them all together. Nobody, no people, definitely NO animals — just the net and the tiny pictures. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'wider-net', char: false, label: 'Casting a wider net (v2)',
    content: 'A person standing on a shore casting a wide fishing net out over the water, the net spreading open to catch as much as possible — casting a wider net. Only that one person, NO animals except a few small fish in the water. Bold black outlines, flat pastel colors, no gradients, plain white.' },
  { id: 'zoomout-diagram', char: false, label: 'You are here — five rectangles diagram (v2)',
    content: 'A clean minimal diagram: a horizontal row of five small white rectangles each with a bold outline; the second rectangle from the left has a small star drawn inside it and a short arrow pointing down at it from above — a ‘you are here’, one example among several separate areas. Nobody, no people, NO animals. Bold black outlines, flat, minimal, plain white.' },
  { id: 'process-alternation', char: false, label: 'Noise → order → noise — the alternating process diagram (v2)',
    content: 'A vertical S-shaped process diagram snaking down the tall frame: a chain of four simple rounded-rectangle boxes connected by flowing wavy strands, like strands of colored pencil. Loose tangled multicolored strands (yellow, red, blue, beige) representing NOISE and chaos flow into the first box; they emerge from it as neat, evenly-combed, ordered lime-green parallel lines representing ORDER and control; those ordered lines then scatter back into loose tangled colored noise as they flow into the next box, which combs them into order again; the pattern alternates back and forth — noise, then order, then noise, then order — down through the boxes to a final box at the bottom. Clearly show the back-and-forth alternation between the tangled chaotic state and the combed ordered state. Nobody, no people, NO animals. Bold black outlines, flat colors, no gradients, plain white background.' },
  { id: 'campfire-flames', char: true, label: 'The campfire — noise turning into a pattern (v2)',
    content: 'The recurring woman sitting cross-legged at a small campfire beside a young man with blonde hair and horn-rimmed glasses; she gazes into the flames, and the fire is just beginning to curl into the shape of a small recognizable form — the mind turning noise into a pattern. A few small stars above them. Only those two people, definitely NO animals or creatures. Bold black outlines, flat pastel colors, warm flame, no gradients, plain white.' },
  { id: 'gold-frame', char: false, label: 'The reusable gold frame — “this is art” stamp (v2)',
    content: 'A single ornate rectangular gold picture frame with decorative baroque scrollwork corners, empty plain-white center, drawn flat with bold black outlines — a reusable decorative ‘this is art’ frame meant to be stamped onto other images. Gold frame, empty white center, centered on a plain white background. Flat colors, no gradients. Nobody, NO animals.' },
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
  return await sharp(out, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92 }).toBuffer();
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
      form.append('output_compression', '90');
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
  fs.mkdirSync(OUT, { recursive: true });
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const app = initializeApp({ credential: cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = getStorage(app).bucket();

  console.log('downloading style refs…');
  const refs = [];
  for (const p of ['witch-school/refs/style-1.png', 'witch-school/refs/style-2.png']) {
    const [buf] = await bucket.file(p).download();
    refs.push(buf);
  }
  console.log('refs ok:', refs.map(r => r.length));

  const manifest = [];
  const failed = [];
  const queue = [...PANELS];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const local = path.join(OUT, `${p.id}-v2.webp`);
      const promptFull = STYLE + (p.char ? CHAR : '') + p.content + END;
      try {
        if (!fs.existsSync(local) || process.env.FORCE) {
          console.log(`${p.id}: rendering…`);
          const t0 = Date.now();
          let buf = await editWithRefs(promptFull, refs);
          try { buf = await whiten(buf); } catch (e) { console.warn('whiten failed:', e.message); }
          fs.writeFileSync(local, buf);
          console.log(`${p.id}: done in ${((Date.now() - t0) / 1000).toFixed(0)}s (${buf.length} bytes)`);
        } else {
          console.log(`${p.id}: exists, skip render`);
        }
        const dest = `story-shorts/art-mason/v2/${p.id}-v2.webp`;
        await bucket.upload(local, { destination: dest, metadata: { contentType: 'image/webp' } });
        await bucket.file(dest).makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
        console.log(`${p.id}: uploaded → ${url}`);
        manifest.push({ id: p.id, char: p.char, label: p.label, content: p.content, url, madeAt: Date.now() });
      } catch (err) {
        console.error(`${p.id}: FAILED — ${err.message}`);
        failed.push(p.id);
      }
    }
  });
  await Promise.all(workers);

  manifest.sort((a, b) => PANELS.findIndex(p => p.id === a.id) - PANELS.findIndex(p => p.id === b.id));
  fs.writeFileSync(path.join(OUT, 'panels-v2.json'), JSON.stringify(manifest, null, 2));
  console.log(`ALL DONE — ${manifest.length}/${PANELS.length} panels${failed.length ? ', FAILED: ' + failed.join(', ') : ''}`);
  process.exit(failed.length ? 2 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
