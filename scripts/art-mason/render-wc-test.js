// Art Mason — watercolor style test: datescan0013.png ref, Sophie's plain
// wrapper (NO style description), quality high, 2:3. Mason = poet-philosopher
// with glasses (not a Viking).
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const WRAP = 'Use the attached image only as the style reference — do not copy its content. Draw: ';
const MASON = 'Mason, a gentle poet-philosopher with reddish shoulder-length hair, a full red beard, and round glasses, ';

const PANELS = [
  { id: 'wc-mason-portrait', label: 'Watercolor test — Mason in his studio',
    content: MASON + 'standing in his cluttered artist studio among homemade contraptions of pipes and funnels, arms crossed, pleased with himself.' },
  { id: 'wc-pipeline', label: 'Watercolor test — Mason operating the noise-art pipeline',
    content: MASON + 'operating his noise-art pipeline: he holds a long pipe with a moppy net head full of small colored dots feeding in; the pipe runs through a wider accordion squeegee section and a moppy section, snaking up and around, and finally empties onto a small framed picture hung high on a gallery wall.' },
  { id: 'wc-process-framed', label: 'Watercolor test — the gold frame around Mason’s process',
    content: MASON + 'standing beside his pipe contraption in an art gallery and presenting it with one open hand, while an ornate gold picture frame hangs in mid-air around the entire machine.' },
  { id: 'wc-gallery-hang', label: 'Watercolor test — Mason hanging his art in the gallery',
    content: MASON + 'up on a small stepladder, hanging a small framed abstract picture of colored dots high on a white gallery wall.' },
];

async function edit(prompt, ref, retries = 2) {
  let lastErr;
  for (let a = 0; a <= retries; a++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('size', '1024x1536');
      form.append('quality', 'high');
      form.append('output_format', 'png');
      form.append('image[]', new Blob([ref], { type: 'image/png' }), 'ref1.png');
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
      if (a < retries) await new Promise(r => setTimeout(r, 2000 * (a + 1)));
    }
  }
  throw lastErr;
}

(async () => {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const app = initializeApp({ credential: cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = getStorage(app).bucket();
  const ref = fs.readFileSync(path.join(__dirname, 'datescan0013.png'));
  const manifest = []; const failed = [];
  await Promise.all(PANELS.map(async (p) => {
    const local = path.join(__dirname, `${p.id}.png`);
    try {
      if (!fs.existsSync(local) || process.env.FORCE) {
        console.log(`${p.id}: rendering…`);
        const buf = await edit(WRAP + p.content, ref);
        fs.writeFileSync(local, buf);
        console.log(`${p.id}: done (${buf.length} bytes)`);
      }
      const dest = `story-shorts/art-mason/wc-test/${p.id}.png`;
      await bucket.upload(local, { destination: dest, metadata: { contentType: 'image/png' } });
      await bucket.file(dest).makePublic();
      const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
      console.log(`${p.id}: uploaded → ${url}`);
      manifest.push({ id: p.id, label: p.label, content: p.content, url, madeAt: Date.now() });
    } catch (e) { console.error(`${p.id}: FAILED — ${e.message}`); failed.push(p.id); }
  }));
  manifest.sort((a, b) => PANELS.findIndex(x => x.id === a.id) - PANELS.findIndex(x => x.id === b.id));
  fs.writeFileSync(path.join(__dirname, 'panels-wc.json'), JSON.stringify(manifest, null, 2));
  console.log(`ALL DONE — ${manifest.length}/${PANELS.length}${failed.length ? ', FAILED: ' + failed.join(',') : ''}`);
  process.exit(failed.length ? 2 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
