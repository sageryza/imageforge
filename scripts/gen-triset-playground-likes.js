#!/usr/bin/env node
/* "1 new page, just my playground triangle likes" (Sophie, 2026-09-03). Every
   picture she hearted on a Playground run drawn with the Triangle tile, oldest
   first, one grid page in the triset-card-inventory chat. The hike one is left
   out by id (her word: an accident, and it has people). Re-run to re-post as a
   new version (the last one is superseded, read back from
   docs/triset/playground-likes-page.json). Costs nothing. --post to post. */
const fs = require('fs'); const path = require('path');
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'triset-card-inventory';
const SESSION = process.env.FORGE_SESSION || '01JGPeGipufHM7P3XCXPs8cJ';
const SKIP = new Set(['bom9yqioA7NshqaC9X9p']);   // the hike
const STATE = path.join(__dirname, '../docs/triset/playground-likes-page.json');
(async () => {
  const runs = (await db.collection('forge-promptlab').where('gptStyle', '==', 'triangle').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const liked = [];
  for (const r of runs) {
    if (SKIP.has(r.id)) continue;
    (r.images || []).forEach((im, i) => {
      const url = typeof im === 'string' ? im : im.url;
      if ((r.votes || {})[i] !== 'like') return;
      const words = ((r.panels && r.panels[i]) || r.prompt || '').trim();
      liked.push({ id: `${r.id}-${i}`, img: url, url, label: words.split('\n')[0].slice(0, 200),
        model: 'gpt-image-2', quality: r.quality || '', promptContent: words, promptStyle: (r.fullPrompt || '').replace(words, '[content]'), createdAt: r.createdAt || 0 });
    });
  }
  liked.sort((a, b) => a.createdAt - b.createdAt);
  const items = liked.map(({ createdAt, ...it }) => it);
  const title = `Playground triangle hearts v${(fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')).version + 1 : 1)} (${items.length})`;
  console.log(title); items.forEach(i => console.log(' ', i.quality, i.label));
  if (!process.argv.includes('--post')) process.exit(0);
  const data = { groups: items.map(it => ({ items: [it] })),   // 1-up: one picture per row (2026-09-03, "1 up compare playground hearts")
  help: 'Every triangle you hearted in the Playground, oldest first. Tap a picture for its prompt.', start: 'compare', stamp: false, voice: true };
  const r = await fetch(BASE + '/api/chatfeed/page', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat: CHAT, session: SESSION, title, template: 'grid', data }) });
  const j = await r.json(); if (!j.ok) { console.error(j); process.exit(1); }
  console.log('posted', j.id, j.warnings || '');
  let prev = null; try { prev = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {}
  if (prev && prev.id) await fetch(`${BASE}/api/chatfeed/page/${prev.id}/supersede`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat: CHAT, session: SESSION, by: j.id }) }).catch(() => {});
  fs.writeFileSync(STATE, JSON.stringify({ id: j.id, title, version: prev ? prev.version + 1 : 1, count: items.length, posted: new Date().toISOString() }, null, 1));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
