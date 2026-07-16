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
//   POST /api/chatfeed/polish    → { id } — render the message in the polished
//                                  onyx-British neural voice (~1¢), cached forever

const express = require('express');
const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const fetch = require('node-fetch');

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
    const { chat, title, text, audio, tldr, url } = req.body || {};
    if (!chat || !text) return res.status(400).json({ error: 'chat and text required' });
    const doc = {
      chat: String(chat).slice(0, 60),
      title: String(title || '').slice(0, 120),
      text: String(text).slice(0, 20000),
      tldr: String(tldr || '').slice(0, 1000),
      from: 'claude',
      created: new Date().toISOString(),
    };
    // "Open in Claude" deep link for this chat (claude.ai/code/session_…)
    if (url && /^https?:\/\//.test(url)) doc.url = String(url).slice(0, 400);
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
    const reg = { lastSeen: doc.created };
    if (doc.url) reg.url = doc.url; // keep the chat's deep link on its registry tile
    await db().collection(REG).doc(doc.chat).set(reg, { merge: true });
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

// Per-chat image gallery (the "Assets" tab inside a chat). Built from the union
// of: image URLs already present in that chat's message text (so existing chats
// show their art with no back-fill) + forge-chat-assets docs (uploaded-file
// images the gallery hook tags with the chat). De-duped by URL, newest first.
const ASSETS = 'forge-chat-assets';
const IMG_URL_RE = /https:\/\/(?:storage|firebasestorage)\.googleapis\.com\/[^\s)\]"'<>]+?\.(?:png|jpe?g|webp|gif)/gi;
router.get('/assets', async (req, res) => {
  try {
    const chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 300);
    const [msnap, asnap] = await Promise.all([
      db().collection(MSGS).where('chat', '==', chat).get(),
      db().collection(ASSETS).where('chat', '==', chat).get(),
    ]);
    const seen = new Map(); // url -> { url, created, prompt }
    const add = (url, created, prompt) => {
      if (!url || seen.has(url)) return;
      seen.set(url, { url, created: created || '', prompt: prompt || '' });
    };
    msnap.docs.forEach((d) => {
      const m = d.data();
      const found = String(m.text || '').match(IMG_URL_RE) || [];
      found.forEach((u) => add(u, m.created, m.tldr || ''));
    });
    asnap.docs.forEach((d) => { const a = d.data(); add(a.url, a.created, a.prompt); });
    const assets = Array.from(seen.values())
      .sort((a, b) => (a.created < b.created ? 1 : -1))
      .slice(0, limit);
    res.json({ chat, assets });
  } catch (err) { fail(res, err); }
});

// Archive / unarchive a chat — Sophie taps this herself in the app. Archived
// chats move to a collapsed "Archived" section on the home views.
router.post('/archive', async (req, res) => {
  try {
    const { chat, archived } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    await db().collection(REG).doc(String(chat).slice(0, 60))
      .set({ archived: archived !== false }, { merge: true });
    res.json({ ok: true, archived: archived !== false });
  } catch (err) { fail(res, err); }
});

// Set a chat's one-line "what this is" — shown on its tile so the Chats grid
// reads like a project directory. Sophie sets it in the app; a chat can also
// set its own. Stored on the registry doc next to the icon.
router.post('/about', async (req, res) => {
  try {
    const { chat, about } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    await db().collection(REG).doc(String(chat).slice(0, 60))
      .set({ about: String(about || '').slice(0, 140) }, { merge: true });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// Render a message in the polished neural voice (same onyx-British read as
// the Writing Room's Listen button). Result is cached on the message doc as
// audioUrl, so each message costs at most one render (~1¢).
const polishJobs = new Set();
router.post('/polish', async (req, res) => {
  try {
    const id = String((req.body || {}).id || '');
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'openai not configured' });
    const ref = db().collection(MSGS).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown message' });
    const data = doc.data();
    if (data.audioUrl) return res.json({ ok: true, url: data.audioUrl, cached: true });
    if (polishJobs.has(id)) return res.json({ ok: false, rendering: true });
    polishJobs.add(id);
    try {
      // verbatim, lightly adapted for listening: drop URLs and markdown marks
      const text = String(data.text || '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[*#`_]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 16000);
      if (!text) return res.status(400).json({ error: 'nothing to read' });
      const sentences = text.replace(/\n+/g, ' ').match(/[^.!?…]+[.!?…]+["”']?\s*/g) || [text];
      const chunks = []; let cur = '';
      for (const s of sentences) {
        if (cur && (cur + s).length > 3200) { chunks.push(cur.trim()); cur = ''; }
        cur += s;
      }
      if (cur.trim()) chunks.push(cur.trim());
      const bufs = [];
      for (const chunk of chunks) {
        const r = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini-tts', voice: 'onyx', input: chunk,
            instructions: 'Read warmly and naturally in a British accent, conversational and unhurried.',
          }),
        });
        if (!r.ok) throw new Error('tts: ' + r.status + ' ' + (await r.text()).slice(0, 150));
        bufs.push(Buffer.from(await r.arrayBuffer()));
      }
      let out;
      if (bufs.length === 1) out = bufs[0];
      else {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'polish-'));
        const files = bufs.map((b, i) => {
          const f = path.join(tmp, `c${i}.mp3`); fs.writeFileSync(f, b); return f;
        });
        const listFile = path.join(tmp, 'list.txt');
        fs.writeFileSync(listFile, files.map((f) => `file '${f}'`).join('\n'));
        const mp3 = path.join(tmp, 'out.mp3');
        const ffmpeg = require('ffmpeg-static');
        await new Promise((resolve, reject) => {
          const p = spawn(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', mp3]);
          let err = ''; p.stderr.on('data', (c) => err += c);
          p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg: ' + err.slice(-200)))));
        });
        out = fs.readFileSync(mp3);
        fs.rmSync(tmp, { recursive: true, force: true });
      }
      const bucket = admin.storage().bucket();
      const dest = bucket.file(`chat-feed/polish/${id}.mp3`);
      await dest.save(out, { contentType: 'audio/mpeg', resumable: false });
      await dest.makePublic();
      const url = `https://storage.googleapis.com/${bucket.name}/${dest.name}`;
      await ref.set({ audioUrl: url }, { merge: true });
      res.json({ ok: true, url });
    } finally { polishJobs.delete(id); }
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
