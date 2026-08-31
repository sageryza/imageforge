#!/usr/bin/env node
/* Build the "Triset cards — all chats" Compare page. Step 1 queries the pool
   + owning chats into /tmp/tricards.json; step 2 emits /tmp/tripage.html.
   Post it with POST /api/chatfeed/page (a re-post is a NEW page — bump the
   version in the title). Votes/notes ride each card's OWN chat's Assets
   thread so they sync both ways; the page's three toggles are hearted-only,
   hide-the-✕, show-notes. Env: FIREBASE_SERVICE_ACCOUNT.
   Test: node scripts/test-triset-compare.js */
// Build data for the all-cards compare page: every visible triset card +
// which chat's Assets tab holds it (that chat is where a ♥/note syncs).
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
(async () => {
  const cards = [];
  (await db.collection('forge-triset-cards').get()).forEach(d => {
    const c = d.data() || {};
    if (c.hidden) return;
    cards.push({ id: d.id, title: c.title || '', url: c.url || '', cut: (c.cut && c.cut.url) || (typeof c.cut === 'string' ? c.cut : ''), quality: c.quality || '', createdAt: c.createdAt || 0, flip: !!c.flip, source: c.source || '' });
  });
  // url -> owning chat, from the assets records
  const byUrl = {};
  (await db.collection('forge-chat-assets').select('chat', 'url', 'alts').get()).forEach(d => {
    const a = d.data() || {};
    if (a.url) byUrl[a.url] = a.chat;
    for (const alt of (a.alts || [])) byUrl[alt] = a.chat;
  });
  let unmapped = 0;
  for (const c of cards) { c.chat = byUrl[c.url] || ''; if (!c.chat) unmapped++; }
  cards.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  require('fs').writeFileSync('/tmp/tricards.json', JSON.stringify(cards, null, 1));
  const chats = {}; cards.forEach(c => { chats[c.chat || '?'] = (chats[c.chat || '?'] || 0) + 1; });
  console.log('cards:', cards.length, 'unmapped:', unmapped, JSON.stringify(chats));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
