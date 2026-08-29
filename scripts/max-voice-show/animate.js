// Clearing Things Up — upload the stills, fire the two wan-2.2 clips, poll,
// download. Runs in a chat container; input keys mirror movies.js videoInput.
const fs = require('fs');
const admin = require('firebase-admin');
const OUT = process.argv[2] || '.';
const WAN = '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea';
const RT = process.env.REPLICATE_API_TOKEN;

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const bucket = admin.storage().bucket();

async function up(local, remote, type) {
  await bucket.upload(local, { destination: remote, metadata: { contentType: type } });
  await bucket.file(remote).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${remote}`;
}

async function predict(input) {
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: WAN, input }),
  });
  const j = await res.json();
  if (!j.id) throw new Error('create failed: ' + JSON.stringify(j).slice(0, 400));
  return j.id;
}

async function wait(id) {
  for (let i = 0; i < 240; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const j = await (await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${RT}` } })).json();
    if (j.status === 'succeeded') return Array.isArray(j.output) ? j.output[0] : j.output;
    if (j.status === 'failed' || j.status === 'canceled') throw new Error(id + ' ' + j.status + ': ' + (j.error || ''));
  }
  throw new Error(id + ' timed out');
}

(async () => {
  const base = 'max-voice-show/clearing-things-up';
  const [tangle, untangled, star] = await Promise.all([
    up(`${OUT}/tangle.webp`, `${base}/stills/tangle.webp`, 'image/webp'),
    up(`${OUT}/untangled.webp`, `${base}/stills/untangled.webp`, 'image/webp'),
    up(`${OUT}/star.webp`, `${base}/stills/star.webp`, 'image/webp'),
  ]);
  console.log('stills up', tangle, untangled, star);

  const common = { resolution: '720p', num_frames: 81, frames_per_second: 16, interpolate_output: true, go_fast: true };
  const [unfurlId, starId] = await Promise.all([
    predict({ image: tangle, last_image: untangled, prompt: 'the tangled knot of cables loosens and unwinds, the cords pulling apart and straightening into neat separate parallel lines on the floor', ...common }),
    predict({ image: star, prompt: 'the shooting star glides across the sky, its rainbow trail shimmering and sparkling, stars twinkling, camera still', ...common }),
  ]);
  console.log('predictions', unfurlId, starId);

  const [unfurlUrl, starUrl] = await Promise.all([wait(unfurlId), wait(starId)]);
  for (const [name, url] of [['unfurl', unfurlUrl], ['starclip', starUrl]]) {
    const b = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.writeFileSync(`${OUT}/${name}.mp4`, b);
    console.log(name, b.length, 'bytes');
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
