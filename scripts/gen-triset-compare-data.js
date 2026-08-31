#!/usr/bin/env node
/* Data for the "Triset — versions compared" page: EVERY generation of every
   subject (hidden ones included — the retired low versions are exactly the
   comparison material), grouped by the slug in the Storage filename
   (`<ver>-<slug>.webp`), each with its owning chat resolved from the asset
   records so votes/notes sync. Cards without the ver-slug filename shape
   (the game's own made cards) are single-generation and stay off a
   comparison page. Writes /tmp/tricards.json. Env: FIREBASE_SERVICE_ACCOUNT. */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
(async () => {
  const cards = [];
  (await db.collection('forge-triset-cards').get()).forEach(d => {
    const c = d.data() || {};
    const m = String(c.url || '').match(/cards\/([a-z0-9]+)-(.+)\.webp$/);
    if (!m) return;
    cards.push({ id: d.id, ver: m[1], slug: m[2], title: c.title || '', url: c.url || '',
      quality: c.quality || '', createdAt: c.createdAt || 0, hidden: !!c.hidden,
      promptContent: c.promptContent || '' });
  });
  const byUrl = {};
  (await db.collection('forge-chat-assets').select('chat', 'url', 'alts').get()).forEach(d => {
    const a = d.data() || {};
    if (a.url) byUrl[a.url] = a.chat;
    for (const alt of (a.alts || [])) byUrl[alt] = a.chat;
  });
  for (const c of cards) c.chat = byUrl[c.url] || '';
  // group by slug; keep only subjects with 2+ generations
  const groups = {};
  for (const c of cards) (groups[c.slug] = groups[c.slug] || []).push(c);
  const out = Object.keys(groups).map(slug => {
    const vs = groups[slug].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return { slug, title: vs[vs.length - 1].title, versions: vs };
  }).filter(g => g.versions.length > 1);
  // newest work first: order groups by their newest generation
  out.sort((a, b) => (b.versions[b.versions.length - 1].createdAt || 0) - (a.versions[a.versions.length - 1].createdAt || 0));
  require('fs').writeFileSync('/tmp/tricards.json', JSON.stringify(out, null, 1));
  const sizes = {}; out.forEach(g => { sizes[g.versions.length] = (sizes[g.versions.length] || 0) + 1; });
  console.log('groups:', out.length, 'by version count:', JSON.stringify(sizes),
    'chats:', JSON.stringify([...new Set(out.flatMap(g => g.versions.map(v => v.chat)).filter(Boolean))]));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
