// File the six Dream Feed illustrations into the chat's Assets tab:
// upload to Storage → label + MODEL · QUALITY caption → the exact prompt split
// style/content. The whole deliver-images ritual for this one batch.
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const REPO = path.dirname(__dirname);
const OUT = path.join(REPO, 'dream-feed', 'out');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'dream-feed-art';
const CAPTION = 'gpt-image-2 · medium';

// The style half, exactly as sent — the preamble is the only non-subject text
// in the prompt, and the ref does the rest of the work.
const STYLE_SENT = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.\n\nDraw: [content]\n\n(attached style ref: refs/sage-sandy-mirror.png — gpt-image-2 images/edits, 1024x1024, quality medium, output webp)';

const LABELS = {
  '01-xylophone-teeth.webp': 'Dream 1 — the xylophone teeth, struck with a mallet',
  '02-whale-again.webp': 'Dream 2 — the whale in the air over a parked car',
  '03-seminar-on-doors.webp': 'Dream 3 — the lecture hall seated with doors',
  '05-peephole-moon.webp': 'Dream 5 — the moon as a peephole, a hand about to knock',
  '06-weather-chess.webp': 'Dream 6 — the old woman winning at weather chess',
  '07-floor-8-is-ocean.webp': 'Dream 7 — the elevator opening onto open ocean',
};

(async () => {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
  const bucket = getStorage().bucket();

  const runs = JSON.parse(fs.readFileSync(path.join(OUT, 'prompts.json'), 'utf8'));

  for (const run of runs) {
    const local = path.join(OUT, run.file);
    const dest = `dream-feed/${run.file}`;
    await bucket.upload(local, { destination: dest, metadata: { contentType: 'image/webp' } });
    await bucket.file(dest).makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;

    const description = LABELS[run.file];

    // Tile + label + MODEL · QUALITY caption.
    const g = await fetch(`${BASE}/api/gallery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, url, description, prompt: CAPTION }),
    }).then(r => r.json());

    // The exact text sent, split style / content.
    const p = await fetch(`${BASE}/api/gallery/assets/prompt`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, url, style: STYLE_SENT, content: run.draw }),
    }).then(r => r.json());

    console.log(`${run.file}\n  ${url}\n  gallery=${JSON.stringify(g)} prompt=${JSON.stringify(p)}`);
  }
})();
