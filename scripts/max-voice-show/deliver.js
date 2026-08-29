// Upload the finished segment + file the stills/prompts/captions/shot map.
const admin = require('firebase-admin');
const SC = process.argv[2];
const SID = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');
const BASE = 'https://imageforge-q125.onrender.com';
const CHAT = 'max-voice-segment';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const bucket = admin.storage().bucket();

async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text();
  console.log(path, r.status, t.slice(0, 200));
}

(async () => {
  const dest = 'max-voice-show/clearing-things-up/clearing-things-up-v1.mp4';
  await bucket.upload(`${SC}/clearing-things-up-v1.mp4`, { destination: dest, metadata: { contentType: 'video/mp4' } });
  await bucket.file(dest).makePublic();
  const film = `https://storage.googleapis.com/${bucket.name}/${dest}`;
  console.log('film', film);

  const S = p => `https://storage.googleapis.com/${bucket.name}/max-voice-show/clearing-things-up/stills/${p}`;
  const PROMPTS = require('./draw-stills').PROMPTS;

  // effective slug check
  const nm = await (await fetch(`${BASE}/api/chatfeed/name?chat=${CHAT}&session=${SID}`)).json();
  console.log('effective chat', JSON.stringify(nm));
  const chat = nm.chat || CHAT;

  // stills -> Assets tab: label + MODEL·QUALITY·SIZE caption, then exact prompts
  const items = [
    { url: S('tangle.webp'), description: 'Clearing Things Up — the tangle (title segment, opening frame)', content: PROMPTS.tangle },
    { url: S('untangled.webp'), description: 'Clearing Things Up — untangled into separate strands (unfurl end frame, edit of the tangle)', content: PROMPTS.untangled },
    { url: S('star.webp'), description: 'Clearing Things Up — rainbow shooting star (title backdrop)', content: PROMPTS.star },
  ];
  for (const it of items) {
    await post('/api/gallery', { assetsOnly: true, chat, session: SID, url: it.url, description: it.description, prompt: 'gpt-image-2 · medium · 1K' });
  }
  await post('/api/gallery/assets/prompt', { chat, items: items.map(it => ({ url: it.url, style: '', content: it.content })) });

  // pin the film (deliverable case 2) — the media pin records itself on the deliverables list
  await post('/api/chatfeed/pin', { chat, session: SID, url: film, title: 'Clearing Things Up — title segment v1 (0:10)', kind: 'film' });

  // shot map (3f)
  await post('/api/filmshots', { chat, session: SID, url: film, seconds: 10.13, shots: [
    { at: 0, url: S('tangle.webp') },
    { at: 5.07, url: S('star.webp') },
  ]});
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
