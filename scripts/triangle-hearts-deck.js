#!/usr/bin/env node
// Every triangle card Sophie hearted, anywhere, as ONE swipe deck (a `deck`
// template Compare page). Sophie, 2026-09-01: "gather all the triangle cards
// i hearted including playground etc. 1 up tinder swipe … add to compare page".
//
// Four places a heart on a triangle card can live, and this reads all four:
//   1. an Assets-tab / Meta Assets ♥ on a pool card's url   (forge-asset-votes)
//   2. a ♥ left on an OLDER cut of a pool card (triset/cuts/<id>.c1.webp)
//   3. a ♥ on one of the triset Compare pages (item id = filename stem / slug)
//   4. a ♥ on a Playground run drawn on the Triangle tile (forge-promptlab)
// Deduped by card, newest first. The page's `url` is the url her heart sits
// on, so the deck's ♥/✕ mirror back to the same vote; `img` is the game's cut.
//
// A QUICK deck (Sophie, 2026-09-01: "shud be quick swipe") — a ♥/✕/? steps
// forward by itself, since this is a yes/no sweep rather than something she
// reads and changes her mind about. Flip an already-posted page without
// re-posting: POST /api/chatfeed/page/<id>/pace {pace:'quick'|'labored'}.
//
// TWO PAGES, split by whether the card is IN the Similitude deal (Sophie,
// 2026-09-01: "separate to cards already in deck and not"). A pool card is in
// the deal when it carries `edition:'nature'` and is not hidden — the one rule
// triset.js's own sync uses, never a second definition. Everything else she
// hearted is waiting: an alternate generation, a subject outside her nature
// vocabulary, and every Playground picture (those live in no deal at all).
//
// Dry by default (prints the counts and the first items). `--go` posts the pages
// into the chat named by --chat. Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory).
const admin = require('firebase-admin');
const args = process.argv.slice(2);
const go = args.includes('--go');
const chatArg = args.indexOf('--chat');
const CHAT = chatArg >= 0 ? args[chatArg + 1] : 'triangle-cards-compare';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const ms = t => (t && t.toMillis ? t.toMillis() : (t || 0));
const stem = u => ((u || '').match(/triset\/cards\/([^.]+)\./) || [])[1];

function buildItems({ cards, votes, runs, verdicts }) {
  const likeUrls = new Set(votes.filter(v => v.vote === 'like').map(v => v.url));
  const byId = new Map(cards.map(c => [c.id, c]));
  const picked = new Map();
  const add = (c, why) => { if (c && c.url && !picked.has(c.id)) picked.set(c.id, { c, why }); };
  cards.forEach(c => { if (likeUrls.has(c.url) || (c.cut && likeUrls.has(c.cut))) add(c, 'asset'); });
  likeUrls.forEach(u => { const m = u.match(/triset\/cuts\/([0-9a-f]{40})\./); if (m) add(byId.get(m[1]), 'old-cut'); });
  const trueIds = new Set();
  verdicts.forEach(v => Object.entries(v.items || {}).forEach(([k, val]) => { if (val === true && !k.startsWith('s:')) trueIds.add(k); }));
  trueIds.forEach(id => add(cards.find(x => stem(x.url) === id)
    || cards.find(x => x.subject === id && x.edition === 'nature' && !x.hidden)
    || cards.find(x => x.subject === id), 'page'));
  const items = [];
  for (const { c, why } of picked.values()) {
    items.push({
      id: c.id.slice(0, 12), label: c.title || c.promptContent || '',
      img: c.cut || c.url, url: c.url,
      model: c.model || 'gpt-image-2', quality: c.quality || '',
      promptContent: c.promptContent || '', promptStyle: c.promptStyle || '',
      _at: ms(c.createdAt), _why: why, _inDeck: c.edition === 'nature' && !c.hidden,
    });
  }
  runs.forEach(r => (r.images || []).forEach((u, i) => {
    if ((r.votes || {})[i] !== 'like' && !likeUrls.has(u)) return;
    const full = r.fullPrompt || ''; const content = r.prompt || '';
    const style = full && content && full.includes(content) ? full.replace(content, '[content]') : '';
    items.push({ id: `pl-${r.id}-${i}`, label: content, img: u, url: u, model: 'gpt-image-2',
      quality: r.quality || '', promptContent: content, promptStyle: style,
      _at: ms(r.createdAt), _why: 'playground', _inDeck: false });
  }));
  items.sort((a, b) => b._at - a._at);
  return items;
}

function pageBody(chat, title, items, help) {
  return {
    chat, title, template: 'deck',
    data: {
      items: items.map(({ _at, _why, _inDeck, ...i }) => i),
      aspect: 'square', browse: true, stamp: false, voice: true, pace: 'quick', help,
    },
  };
}

async function post(body) {
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return r.text();
}

(async () => {
  const [cardSnap, voteSnap, runSnap, verdictSnap] = await Promise.all([
    db.collection('forge-triset-cards').get(),
    db.collection('forge-asset-votes').get(),
    db.collection('forge-promptlab').where('gptStyle', '==', 'triangle').get(),
    db.collection('forge-chat-verdicts').where('chat', '==', 'triset-nature-classification').get(),
  ]);
  const rows = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
  const items = buildItems({ cards: rows(cardSnap), votes: rows(voteSnap), runs: rows(runSnap), verdicts: rows(verdictSnap) });
  const inDeck = items.filter(i => i._inDeck);
  const waiting = items.filter(i => !i._inDeck);
  console.log(`${items.length} hearted — ${inDeck.length} in the Similitude deal, ${waiting.length} not`);
  const pages = [
    pageBody(CHAT, `Hearted · in the deck (${inDeck.length})`, inDeck,
      'The triangle cards you hearted that Similitude actually deals — the nature edition. '
      + 'Tap the left or right edge to step; a mark moves you on. Tap the picture for the prompt.'),
    pageBody(CHAT, `Hearted · not in the deck (${waiting.length})`, waiting,
      'Triangle cards you hearted that Similitude does NOT deal — an alternate take, a subject outside '
      + 'the nature set, or a Playground picture. Tap the picture for the prompt and the Playground button.'),
  ];
  if (!go) { console.log(JSON.stringify(pages.map(p => p.title), null, 1)); console.log('(dry — add --go to post)'); return; }
  for (const p of pages) console.log(await post(p));
})().catch(e => { console.error(e); process.exit(1); });
