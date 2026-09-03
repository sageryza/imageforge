#!/usr/bin/env node
// THE TRIANGLE DECK REVIEW — the cards still in the running, near-twins side
// by side, decided with "add to deck · maybe add to deck · no" (2026-09-03,
// Sophie: "new tinder compare and also add to ur assets tab · new buttons add
// to deck / maybe add to deck / no · the last thorough review from opus
// yesterday — take the yes maybe, leave out the exes · transfer their decision
// and notes · include any new hearts from playground · triangle cards only ·
// compare similar prompts to each other, ex circus tent — some say peeking,
// some hiding, both are the same card").
//
// THE SET is yesterday's review (scripts/triangle-hearts-deck.js's page) minus
// her ✕'s and minus the cards she passed without a mark, plus every triangle
// card hearted anywhere since — the same gather (scripts/lib/triangle-hearts.js)
// so the deck and the Assets tab can never disagree about what it is.
//
// NEAR-TWINS RIDE ONE CARD. Two prompts that name the same picture ("animals
// peeking out of a circus tent" / "animals hiding in a circus tent") are one
// card drawn twice, and she wants to pick between the draws rather than mark
// each in isolation. The rule is word overlap on the words that DREW the
// card (never a model call): the same words after stemming, or nearly all of
// them shared. Deliberately tight — a loose pair ("dolls high up on a shelf"
// / "a castle high up on a hill") reads as the chat thinking two subjects are
// one, where a missed pair only costs her two single cards. A twin set bigger
// than three is dealt as two or three spreads of equal size, because three
// across is the last size a picture can be compared at (page-views.js).
//
// EACH PICTURE ON A SPREAD IS ITS OWN DECISION (`spreadEach`, judge.js): a no
// takes that draw off the card and into the No pile; the ones left are the
// comparison. Her earlier verdicts and notes are carried onto the new page
// under the same ids (the gather's ids are stable), as HER marks — her own
// decisions moved, never a chat's.
//
// Dry by default. `--go` files the Assets tab, posts the page, carries the
// marks. Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory).
//   node scripts/triangle-deck-review.js --chat <slug> --from <chat> <pageId> [--go]
'use strict';
const fs = require('fs');
const admin = require('firebase-admin');
const { gather, captionOf } = require('./lib/triangle-hearts.js');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const go = args.includes('--go');
const CHAT = flag('--chat', 'tinder-compare-assets');
const FROM_CHAT = flag('--from', 'triangle-cards-tinder-toggle');
const FROM_PAGE = (args.indexOf('--from') >= 0 && args[args.indexOf('--from') + 2]) || 'DufB53EHp4TG2AHSe0FS';
const OUT = flag('--out', '');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });

// the house display-copy rule — a card FACE is a derived thumb; `full` and
// `url` stay the originals (see triangle-hearts-deck.js)
const thumb = (u) => `${BASE}/api/story/thumb?w=900&url=${encodeURIComponent(u)}`;
const post = (path, body) => fetch(BASE + path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json().catch(() => ({ ok: false, status: r.status })));
async function pool(list, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) { const k = i; i += 1; out[k] = await fn(list[k]); }
  }));
  return out;
}

// ── NEAR-TWINS ──────────────────────────────────────────────────────────────
const STOP = new Set(('a an the of in on at with and or to for its it is are as by from into over '
  + 'under one two three some lots lot little small big tiny very my someone').split(' '));
const stem = (w) => w.replace(/ies$/, 'y').replace(/(sses|shes|ches|xes)$/, (m) => m.slice(0, -2))
  .replace(/s$/, '').replace(/ing$/, '').replace(/ed$/, '');
function words(s) {
  return new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w)).map(stem));
}
/** the same card twice? the same words, or nearly all of them shared */
function twins(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let inter = 0; A.forEach((w) => { if (B.has(w)) inter += 1; });
  const union = A.size + B.size - inter;
  if (inter === union) return true;                                   // the same words
  return inter >= 3 && (inter / union >= 0.6 || inter / Math.min(A.size, B.size) >= 0.8);
}
function cluster(list) {
  const out = []; const seen = new Set();
  list.forEach((a, i) => {
    if (seen.has(i)) return;
    const c = [a]; seen.add(i);
    list.forEach((b, j) => {
      if (j <= i || seen.has(j)) return;
      if (c.some((x) => twins(x.promptContent || x.label, b.promptContent || b.label))) { c.push(b); seen.add(j); }
    });
    out.push(c);
  });
  return out;
}
/** a twin set over three is dealt as equal-sized spreads of 2-3, the
 *  identical prompts kept together where they can be */
function deal(c) {
  if (c.length <= 3) return [c];
  const n = Math.ceil(c.length / 3);
  const size = Math.ceil(c.length / n);
  const sorted = c.slice().sort((a, b) => String(a.promptContent || a.label).localeCompare(String(b.promptContent || b.label)));
  const out = [];
  for (let i = 0; i < sorted.length; i += size) out.push(sorted.slice(i, i + size));
  return out;
}
const shortest = (c) => c.map((x) => x.promptContent || x.label).sort((a, b) => a.length - b.length)[0];

(async () => {
  const db = admin.firestore(); const bucket = admin.storage().bucket();
  // ── yesterday's review: her marks and notes, and which cards it held ──
  const [buf] = await bucket.file(`chat-pages/${FROM_PAGE}.json`).download();
  const oldPage = JSON.parse(buf.toString());
  const oldIds = new Set((oldPage.items || []).concat(...(oldPage.groups || []).map((g) => g.items || [])).map((i) => i.id));
  const vdoc = await db.collection('forge-chat-verdicts').doc(`${FROM_CHAT}__page-${FROM_PAGE}`).get();
  const vd = vdoc.exists ? vdoc.data() : {};
  const marks = vd.items || {}; const texts = vd.texts || {};

  const { items, stats } = await gather({ db, bucket });
  const idOf = (c) => c.id.slice(0, 60);
  const keep = items.filter((c) => {
    const id = idOf(c);
    if (!oldIds.has(id)) return true;                      // hearted since — new
    return marks[id] === true || marks[id] === 'maybe';    // her yes and her maybe
  });
  const counts = { yes: 0, maybe: 0, fresh: 0, out: 0, passed: 0 };
  items.forEach((c) => {
    const id = idOf(c);
    if (!oldIds.has(id)) counts.fresh += 1;
    else if (marks[id] === true) counts.yes += 1;
    else if (marks[id] === 'maybe') counts.maybe += 1;
    else if (marks[id] === false) counts.out += 1;
    else counts.passed += 1;
  });
  console.log(`gathered ${items.length} hearted triangle cards; yesterday: ${counts.yes} yes · ${counts.maybe} maybe · ${counts.out} no (left out) · ${counts.passed} passed unmarked (left out); ${counts.fresh} hearted since → ${keep.length} on the deck`);

  // ── near-twins side by side, newest first ──
  const clusters = cluster(keep);
  const groups = [];
  clusters.forEach((c) => deal(c).forEach((sp) => {
    const item = (x) => {
      const it = { id: idOf(x), label: x.label || x.promptContent || '', img: thumb(x.img), full: x.img, url: x.url };
      for (const k of ['model', 'quality', 'promptContent', 'promptStyle']) if (x[k]) it[k] = x[k];
      return it;
    };
    groups.push(sp.length > 1 ? { label: shortest(sp).slice(0, 60), items: sp.map(item) } : { items: [item(sp[0])] });
  }));
  const spreads = groups.filter((g) => g.items.length > 1);
  console.log(`${groups.length} cards to swipe: ${spreads.length} spreads of near-twins (${spreads.map((g) => g.items.length).join(',')}) and ${groups.length - spreads.length} singles`);
  spreads.forEach((g) => console.log('  ' + g.items.map((i) => i.label.slice(0, 44)).join('  |  ')));

  const carried = {}; const carriedTexts = {};
  keep.forEach((c) => {
    const id = idOf(c);
    if (marks[id] === true || marks[id] === 'maybe') carried[id] = marks[id];
    if (texts[id]) carriedTexts[id] = texts[id];
  });
  console.log(`carrying ${Object.keys(carried).length} marks and ${Object.keys(carriedTexts).length} notes`);

  const body = {
    chat: CHAT,
    title: flag('--title', `Triangle deck review v2 (${keep.length}) — add · maybe · no`),
    template: 'grid',
    data: {
      groups, aspect: 'square', start: 'swipe', browse: true, pace: 'quick', voice: true,
      note: 'small', spreadEach: true,
      buttons: { yes: { label: 'Add to deck', icon: 'triangle' },
        maybe: { label: 'Maybe add to deck', icon: 'maybe' }, no: { label: 'No', icon: 'x' } },
      goodWord: 'ADDED', badWord: 'NO',
      help: 'Every triangle card still in the running: your yes and maybe from yesterday’s review '
        + '(the no’s are gone) plus everything hearted since, with your marks and notes carried over. '
        + 'The triangle adds a card to the deck, ? is maybe, ✕ is no. Near-twin prompts sit side by side '
        + 'on one card, each with its own three buttons: a ✕ under one takes it off the card into the No '
        + 'pile so you can compare the ones left; the big buttons mark every picture still on the card. '
        + 'Tap a picture for the prompt, the notes and the Playground; tap its left or right side to step.',
    },
  };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ body, carried, carriedTexts }, null, 1));
  if (!go) { console.log(`(dry — add --go to file ${keep.length} into "${CHAT}", post the page and carry the marks)`); return; }

  // ── 1. the Assets tab: label, MODEL · QUALITY · SIZE, both exact halves ──
  const filed = await pool(keep, 5, (it) => post('/api/gallery', {
    assetsOnly: true, chat: CHAT, url: it.url, description: it.label, prompt: captionOf(it),
  }).catch((e) => ({ ok: false, err: String(e) })));
  console.log('assets filed ok:', filed.filter((r) => r && r.ok).length, 'of', keep.length);
  const withPrompt = keep.filter((i) => i.promptContent || i.promptStyle);
  for (let i = 0; i < withPrompt.length; i += 40) {
    const chunk = withPrompt.slice(i, i + 40);
    const r = await post('/api/gallery/assets/prompt', {
      chat: CHAT, items: chunk.map((it) => ({ url: it.url, style: it.promptStyle, content: it.promptContent })),
    });
    console.log(`prompts ${i + 1}-${i + chunk.length}: ${(r.results || []).filter((x) => x && x.ok).length} ok${r.error ? ' — ' + r.error : ''}`);
  }

  // ── 2. the page ──
  const r = await post('/api/chatfeed/page', body);
  console.log('page:', JSON.stringify(r).slice(0, 300));
  if (!r.ok || !r.id) throw new Error('page not posted');

  // ── 3. her marks and notes, carried — checked against the page's own JSON ──
  const [nb] = await bucket.file(`chat-pages/${r.id}.json`).download();
  const np = JSON.parse(nb.toString());
  const newIds = new Set((np.items || []).concat(...(np.groups || []).map((g) => g.items || [])).map((i) => i.id));
  const lost = Object.keys(carried).filter((id) => !newIds.has(id));
  if (lost.length) throw new Error('ids moved on the way through the template: ' + lost.join(','));
  await db.collection('forge-chat-verdicts').doc(`${CHAT}__page-${r.id}`).set({
    chat: CHAT, sheet: `page-${r.id}`, items: carried, texts: carriedTexts, updatedAt: new Date().toISOString(),
  }, { merge: true });
  // …and the yes marks reach this chat's Assets tab too (the deck's own mirror)
  const yes = keep.filter((c) => carried[idOf(c)] === true);
  const voted = await pool(yes, 5, (c) => post('/api/gallery/assets/vote', { chat: CHAT, url: c.url, vote: 'like' }));
  console.log(`carried ${Object.keys(carried).length} marks, ${Object.keys(carriedTexts).length} notes; ${voted.filter((v) => v && v.ok).length} hearts mirrored to the Assets tab`);
  console.log(`https://imageforge-q125.onrender.com/api/chatfeed/page/${r.id}`);
})().catch((e) => { console.error(e); process.exit(1); });
