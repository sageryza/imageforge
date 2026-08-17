// Build the handoff package for a new design chat continuing the dreams work.
//
// Scope, per Sophie: DREAM MYSTERY style only (no watercolour), and SINGLE
// PANEL images only — so the 16-panel diary comic is deliberately left out of
// this pack even though it is the most interesting thing rendered so far.
//
// Contents: the style reference itself, every dream-mystery single-panel
// image, the verbatim dream text behind each one, the exact prompt each was
// made with, and a manifest tying the three together.
//
// Only SOPHIE'S dreams go in. forge-dreamapp also holds dreams belonging to
// other people in the shared feed; those are nobody's to package up.
//
//   FIREBASE_SERVICE_ACCOUNT=… node scripts/dream-handoff-pack.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const REPO = path.dirname(__dirname);
const BUILD = path.join(REPO, 'dream-feed', 'handoff');
const PACK = path.join(BUILD, 'dream-mystery-handoff');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// image file -> the dream it came from, and how the prompt was built.
const IMAGES = [
  { src: ['style-diff', 'kitten-dream.webp'], out: '01-choosing-a-kitten.webp',
    title: 'Choosing a Kitten', source: 'scene brief written by the chat' },
  { src: ['style-diff', 'spaceship-dream.webp'], out: "02-claudes-tiny-spaceship.webp",
    title: "Claude's Tiny Spaceship", source: 'scene brief written by the chat' },
  { src: ['style-diff', 'halloween-dream.webp'], out: '03-halloween-from-brief.webp',
    title: 'Last-Minute Halloween Party', source: 'scene brief written by the chat' },
  { src: ['raw-text', 'mountain-raw-dream.webp'], out: '04-mountain-from-raw-text.webp',
    title: 'Bathroom at the Mountain Summit', source: 'the raw dream text, verbatim' },
  { src: ['raw-text', 'halloween-raw-dream.webp'], out: '05-halloween-from-raw-text.webp',
    title: 'Last-Minute Halloween Party', source: 'the raw dream text, verbatim' },
];

(async () => {
  fs.rmSync(BUILD, { recursive: true, force: true });
  for (const d of ['style-ref', 'images', 'dreams']) {
    fs.mkdirSync(path.join(PACK, d), { recursive: true });
  }

  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });

  // ── her dreams ────────────────────────────────────────────────────────────
  const snap = await getFirestore().collection('forge-dreamapp').get();
  const hers = [];
  snap.forEach(d => {
    const v = d.data();
    // "Sage" under her live auth uid, plus the seeded sample-sage rows — both
    // are her own dictated dreams. Everyone else's stay out.
    const mine = String(v.uid) === 'ryUwOuU8viYu7ERBU0IQcYPdBcR2' || String(v.uid) === 'sample-sage';
    if (mine) hers.push(v);
  });
  hers.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const byTitle = {};
  for (const v of hers) {
    const name = `${slug(v.title)}.txt`;
    byTitle[v.title] = { file: name, chars: v.text.length, panels: (v.panels || []).length };
    fs.writeFileSync(path.join(PACK, 'dreams', name),
      `${v.title}\n${'='.repeat(v.title.length)}\n\n${v.text}\n`);
  }

  // ── the style reference ───────────────────────────────────────────────────
  fs.copyFileSync(path.join(REPO, 'refs/dream-mystery.jpg'),
    path.join(PACK, 'style-ref', 'dream-mystery.jpg'));

  // ── the images + their exact prompts ──────────────────────────────────────
  const filed = {};
  for (const dir of ['style-diff', 'raw-text']) {
    const p = path.join(REPO, 'dream-feed', dir, 'filed.json');
    if (fs.existsSync(p)) for (const r of JSON.parse(fs.readFileSync(p, 'utf8'))) filed[`${dir}/${r.file}`] = r;
  }

  const manifest = IMAGES.map((im) => {
    const key = `${im.src[0]}/${im.src[1]}`;
    const rec = filed[key];
    fs.copyFileSync(path.join(REPO, 'dream-feed', ...im.src), path.join(PACK, 'images', im.out));
    return {
      image: `images/${im.out}`,
      dream: im.title,
      dreamText: `dreams/${byTitle[im.title].file}`,
      promptBuiltFrom: im.source,
      model: 'gpt-image-2', size: '1024x1024', quality: 'medium',
      styleRef: 'style-ref/dream-mystery.jpg',
      promptStyleHalf: rec ? rec.style : null,
      promptContentHalf: rec ? rec.content : null,
      liveUrl: rec ? rec.url : null,
    };
  });

  fs.writeFileSync(path.join(PACK, 'manifest.json'), JSON.stringify({
    style: 'dream mystery (refs/dream-mystery.jpg)',
    scope: 'single-panel images only — the 16-panel diary comic is excluded on purpose',
    images: manifest,
    otherDreamsAvailable: Object.entries(byTitle)
      .filter(([t]) => !IMAGES.some(i => i.title === t))
      .map(([t, v]) => ({ dream: t, file: `dreams/${v.file}`, chars: v.chars })),
  }, null, 2));

  fs.copyFileSync(path.join(REPO, 'dream-feed', 'handoff-README.md'), path.join(PACK, 'README.md'));

  // ── zip ───────────────────────────────────────────────────────────────────
  const zipPath = path.join(BUILD, 'dream-mystery-handoff.zip');
  execFileSync('zip', ['-rq', zipPath, 'dream-mystery-handoff'], { cwd: BUILD });

  const bucket = getStorage().bucket();
  const dest = 'dream-feed/handoff/dream-mystery-handoff.zip';
  await bucket.upload(zipPath, { destination: dest, metadata: { contentType: 'application/zip' } });
  await bucket.file(dest).makePublic();

  console.log('zip:', zipPath, (fs.statSync(zipPath).size / 1048576).toFixed(2) + 'MB');
  console.log('url: https://storage.googleapis.com/' + bucket.name + '/' + dest);
  console.log('dreams packed:', Object.keys(byTitle).length, '| images:', manifest.length);
})();
