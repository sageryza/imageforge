// Chat feed — "the Chat app": every project chat drops a copy of its replies
// here (standing CLAUDE.md rule), and Sophie reads/listens in one place in
// DeckFactory with a picture icon per chat. Content is live (Firestore);
// replies she leaves land as notes chats pick up on their hourly checks.
//
// Routes (x-studio-token gated like the rest):
//   GET  /api/chatfeed           → { chats:{name:{icon}}, messages:[...] } (newest first)
//   POST /api/chatfeed           → { chat, title?, text, audio? (url or data URL), tldr? }
//   POST /api/chatfeed/icon      → { chat, image (data URL) } — set a chat's picture
//   POST /api/chatfeed/reply     → { chat, text } — Sophie's reply (chats check hourly)

const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();
const MSGS = 'forge-chat-feed';
const REG = 'forge-chat-registry';

function gate(req, res, next) {
  const token = process.env.STUDIO_TOKEN || '';
  if (token && req.get('x-studio-token') !== token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
router.use(gate);
router.use(express.json({ limit: '10mb' }));

function db() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.firestore();
}
function fail(res, err) {
  res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
}

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 100);
    const [msnap, rsnap] = await Promise.all([
      db().collection(MSGS).orderBy('created', 'desc').limit(limit).get(),
      db().collection(REG).get(),
    ]);
    const chats = {};
    rsnap.docs.forEach((d) => { chats[d.id] = d.data(); });
    res.json({ chats, messages: msnap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const { chat, title, text, audio, tldr } = req.body || {};
    if (!chat || !text) return res.status(400).json({ error: 'chat and text required' });
    const doc = {
      chat: String(chat).slice(0, 60),
      title: String(title || '').slice(0, 120),
      text: String(text).slice(0, 20000),
      tldr: String(tldr || '').slice(0, 1000),
      from: 'claude',
      created: new Date().toISOString(),
    };
    if (audio && /^https?:\/\//.test(audio)) doc.audioUrl = String(audio);
    else if (audio && /^data:audio\//.test(audio)) {
      const m = audio.match(/^data:(audio\/[\w.+-]+);base64,(.+)$/);
      if (m && admin.apps.length) {
        const ext = m[1].includes('mpeg') ? 'mp3' : m[1].split('/')[1].split(';')[0];
        const bucket = admin.storage().bucket();
        const file = bucket.file(`chat-feed/${Date.now()}.${ext}`);
        await file.save(Buffer.from(m[2], 'base64'), { contentType: m[1], resumable: false });
        await file.makePublic();
        doc.audioUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      }
    }
    const ref = await db().collection(MSGS).add(doc);
    await db().collection(REG).doc(doc.chat).set({ lastSeen: doc.created }, { merge: true });
    res.json({ ok: true, id: ref.id });
  } catch (err) { fail(res, err); }
});

router.post('/icon', async (req, res) => {
  try {
    const { chat, image } = req.body || {};
    const m = String(image || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (!chat || !m) return res.status(400).json({ error: 'chat and image (data URL) required' });
    const ext = m[1].split('/')[1].split(';')[0].replace('jpeg', 'jpg');
    const bucket = admin.storage().bucket();
    const file = bucket.file(`chat-feed/icons/${String(chat).replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`);
    await file.save(Buffer.from(m[2], 'base64'), { contentType: m[1], resumable: false });
    await file.makePublic();
    const icon = `https://storage.googleapis.com/${bucket.name}/${file.name}?v=${Date.now()}`;
    await db().collection(REG).doc(String(chat).slice(0, 60)).set({ icon }, { merge: true });
    res.json({ ok: true, icon });
  } catch (err) { fail(res, err); }
});

router.post('/reply', async (req, res) => {
  try {
    const { chat, text } = req.body || {};
    if (!chat || !text) return res.status(400).json({ error: 'chat and text required' });
    const doc = {
      chat: String(chat).slice(0, 60),
      text: String(text).slice(0, 8000),
      from: 'sophie',
      created: new Date().toISOString(),
    };
    const ref = await db().collection(MSGS).add(doc);
    res.json({ ok: true, id: ref.id });
  } catch (err) { fail(res, err); }
});

module.exports = { router };
