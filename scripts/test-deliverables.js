#!/usr/bin/env node
// The deliverables list — the pure rules, no network, no Firestore.
//
//   1. kindOf()        — kind read off the url when not given.
//   2. pinDeliverable() — only a MEDIA pin auto-records (a link pin is
//      usually a page being worked on, not a hand-over).
//   3. decideRecord()  — a NEW url is a new row (→ push); the same url again
//      is a silent update that bumps updatedAt + versions and can fix a title.
//   4. rowsOf()      — ONE row per work (workKey), its latest version, older
//      takes folded onto `older`; newest first; display names joined.
//
// Run: node scripts/test-deliverables.js
'use strict';
const { _internals, pinDeliverable } = require('../deliverables');
const { kindOf, decideRecord, rowsOf, idFor, backfillPlan, backfillDoc, workKey } = _internals;

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

console.log('kindOf — the kind is read off the url when not given');
{
  ok('an mp4 is video', kindOf(undefined, 'https://x/film-v6.mp4') === 'video');
  ok('an m4a is audio', kindOf('', 'https://x/cut.m4a?sig=1') === 'audio');
  ok('a webp is image', kindOf(null, 'https://x/pic.webp') === 'image');
  ok('a page is a link', kindOf(undefined, 'https://x/science') === 'link');
  ok('an explicit kind wins', kindOf('video', 'https://x/science') === 'video');
  ok('an unknown kind falls back to the url', kindOf('movie', 'https://x/a.mp4') === 'video');
}

console.log('pinDeliverable — only media pins auto-record');
{
  ok('a video pin records', pinDeliverable({ url: 'https://x/a.mp4', kind: 'video' }) === true);
  ok('an audio pin records', pinDeliverable({ url: 'https://x/a.m4a', kind: 'audio' }) === true);
  ok('a link pin does NOT', pinDeliverable({ url: 'https://x/science', kind: 'link' }) === false);
  ok('a cleared pin does NOT', pinDeliverable(null) === false);
  ok('a pin with no url does NOT', pinDeliverable({ kind: 'video' }) === false);
}

console.log('decideRecord — new url pushes, same url updates silently');
{
  const now = '2026-08-27T20:00:00.000Z';
  const a = decideRecord(null, { url: 'https://x/film-v1.mp4', title: 'Evan — the long cut v1', chat: 'evan-film' }, now);
  ok('a new url is NEW', a.isNew === true);
  ok('…kind derived', a.doc.kind === 'video');
  ok('…versions start at 1', a.doc.versions === 1);
  ok('…at and updatedAt stamped', a.doc.at === now && a.doc.updatedAt === now);
  ok('…source defaults to post', a.doc.source === 'post');

  const b = decideRecord(null, { url: 'https://x/thing.mp4', title: '', chat: 'c' }, now);
  ok('no title falls back to the filename', b.doc.title === 'thing.mp4', b.doc.title);

  const later = '2026-08-28T01:00:00.000Z';
  const c = decideRecord(a.doc, { url: 'https://x/film-v1.mp4', title: 'Evan — the long cut v1 (4:54)', chat: 'evan-film' }, later);
  ok('the same url again is NOT new', c.isNew === false);
  ok('…updatedAt moves', c.doc.updatedAt === later);
  ok('…versions bump', c.doc.versions === 2);
  ok('…a re-post can correct the title', c.doc.title === 'Evan — the long cut v1 (4:54)');
  const d = decideRecord(a.doc, { url: 'https://x/film-v1.mp4', title: '', chat: 'evan-film' }, later);
  ok('…an empty re-post title leaves the old one alone', d.doc.title === undefined);

  const pin = decideRecord(null, { url: 'https://x/p.mp4', title: 't', chat: 'c', source: 'pin', at: '2026-08-01T00:00:00.000Z' }, now);
  ok('a backdated record keeps its own at', pin.doc.at === '2026-08-01T00:00:00.000Z');
  ok('…and its source', pin.doc.source === 'pin');
}

console.log('rowsOf — newest first, names joined from the registry');
{
  const docs = [
    { url: 'u1', title: 'old', chat: 'a', at: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
    { url: 'u2', title: 'new', chat: 'b', at: '2026-08-20T00:00:00Z', updatedAt: '2026-08-27T00:00:00Z' },
    { url: 'u3', title: 'mid', chat: 'c', at: '2026-08-10T00:00:00Z', updatedAt: '2026-08-10T00:00:00Z' },
  ];
  const rows = rowsOf(docs, { b: { displayName: 'The Evan film' } });
  ok('newest updatedAt leads', rows[0].url === 'u2', rows.map((r) => r.url));
  ok('…then mid, then old', rows[1].url === 'u3' && rows[2].url === 'u1');
  ok('display name joined', rows[0].chatName === 'The Evan film');
  ok('a chat with no name keeps its slug', rows[2].chatName === 'a');
  ok('input order untouched (no in-place sort)', docs[0].url === 'u1');
}

console.log('backfill — the launch-day date bug, pinned (2026-08-27, "evan says today")');
{
  // Two chats pinning the SAME file are one hand-over: one plan entry, the
  // newest pin's chat and time. Recording both is what stamped today on
  // week-old films.
  const chats = {
    'evan-film-collected': { pinned: { url: 'https://x/evan-v17.mp4', kind: 'video', title: 'Evan v17', at: '2026-08-19T21:16:47Z' } },
    'evan-story-visual-summary': { pinned: { url: 'https://x/evan-v17.mp4', kind: 'video', title: 'Evan v17 too', at: '2026-08-12T00:00:00Z' } },
    'science-page': { pinned: { url: 'https://x/science', kind: 'link', title: 'The science page', at: '2026-08-20T00:00:00Z' } },
    'quiet-chat': {},
  };
  const plan = backfillPlan(chats);
  ok('one url pinned by two chats is ONE entry', plan.length === 1, plan);
  ok('…keeping the newest pin', plan[0].chat === 'evan-film-collected' && plan[0].at === '2026-08-19T21:16:47Z');
  ok('link pins stay out of the plan', !plan.some((e) => e.url === 'https://x/science'));

  const now = '2026-08-27T03:00:00.000Z';
  const fresh = backfillDoc(null, plan[0], now);
  ok('a backfill doc carries the PIN’s date, not now', fresh.at === '2026-08-19T21:16:47Z' && fresh.updatedAt === '2026-08-19T21:16:47Z', fresh);
  ok('…and versions 1 (one hand-over)', fresh.versions === 1);

  // Re-running REPAIRS the backfill's own damaged records…
  const damaged = { ...fresh, updatedAt: '2026-08-27T02:55:18Z', versions: 2, source: 'pin-backfill' };
  const repaired = backfillDoc(damaged, plan[0], now);
  ok('re-running repairs a damaged backfill doc', repaired && repaired.updatedAt === '2026-08-19T21:16:47Z' && repaired.versions === 1, repaired);
  // …and never touches a doc a LIVE door made.
  const live = { ...fresh, source: 'pin' };
  ok('a live-door doc is left alone', backfillDoc(live, plan[0], now) === null);
  const posted = { ...fresh, source: 'post' };
  ok('…a POSTed one too', backfillDoc(posted, plan[0], now) === null);
  const noAt = backfillDoc(null, { chat: 'c', url: 'https://x/a.mp4', title: '', kind: 'video', at: '' }, now);
  ok('a pin with no at falls back to now', noAt.at === now);
}

console.log('workKey / rowsOf — one row per work, its latest version');
{
  // Her REAL titles the day she asked (2026-08-27, "only put the latest
  // version"): the Water reel filled seven rows, PWC three, Evan two.
  const real = [
    ['Water reel v16 — ramps from the spine line to 3x (1:31)', 'water reel'],
    ['Water reel v15 SLOW — the crop lands on the last word (1:42)', 'water reel'],
    ['Water reel v14 ramp — 1.15 to 1.55 (1:34)', 'water reel'],
    ['Water reel v13 fast (1:20) — slower cuts coming', 'water reel'],
    ['Water reel v8 — her voice, 2:12 (the base for the re-cut)', 'water reel'],
    ['PWC Training Film No. 001 — v11, FAIL slams on (1:26)', 'pwc training film no. 001'],
    ['PWC Training Film No. 001 — v7, tight open (1:27)', 'pwc training film no. 001'],
    ['Evan — v17: your ten notes, fixed (4:24)', 'evan'],
    ['Evan v13 — your cut, read back and repaired, 4:21', 'evan'],
    ['dreams — the bird costume, all her art (v2, 0:45)', 'dreams — the bird costume, all her art'],
    ['Vibrilify MAX — live action v3 (1:13)', 'vibrilify max — live action'],
    ['Abundance and scarcity — v2, one voice take (0:33)', 'abundance and scarcity'],
  ];
  real.forEach(([t, want]) => ok('“' + t.slice(0, 42) + '…” → ' + want, workKey(t) === want, workKey(t)));

  // A title with NO version marker is its own stem — which is what keeps two
  // EPISODES apart. Merging these would hide a whole film.
  const ep5 = 'PWC ep005 — Chicago + logo end card (0:35)';
  const ep6 = 'PWC ep006 — the building across the street (0:41)';
  ok('ep005 and ep006 do NOT merge', workKey(ep5) !== workKey(ep6));
  ok('…and neither is mistaken for a version', /ep00/.test(workKey(ep6)));
  ok('a title that is only a version keeps itself', workKey('v3 — the cut') === 'v3 — the cut');
  ok('“version 2” spelled out also cuts', workKey('The spot version 2 (0:43)') === 'the spot');

  // Two DIFFERENT reels must not collide on a shared word.
  ok('“Hands — the reel” ≠ “PROOF reel — draft”',
    workKey('Hands — the reel v1 (0:18)') !== workKey('PROOF reel — draft v1 (4:55)'));

  const docs = [
    { url: 'u16', title: 'Water reel v16 — ramps (1:31)', chat: 'a', updatedAt: '2026-08-27T07:00:00Z' },
    { url: 'u14', title: 'Water reel v14 ramp — 1.15 (1:34)', chat: 'b', updatedAt: '2026-08-27T05:00:00Z' },
    { url: 'u8',  title: 'Water reel v8 — her voice', chat: 'c', updatedAt: '2026-08-25T00:00:00Z' },
    { url: 'ev',  title: 'Evan — v17: your ten notes', chat: 'd', updatedAt: '2026-08-19T00:00:00Z' },
  ];
  const rows = rowsOf(docs, { a: { displayName: 'Water notes' } });
  ok('several takes of one reel become ONE row', rows.length === 2, rows.map((r) => r.title));
  ok('…the newest by DATE leads', rows[0].url === 'u16');
  ok('…crossing chats (v14 was a different chat)', rows[0].older.map((o) => o.url).join() === 'u14,u8');
  ok('…older takes stay newest-first', rows[0].older[0].url === 'u14');
  ok('…nothing is dropped', 1 + rows[0].older.length + 1 + rows[1].older.length === docs.length);
  ok('a lone work carries an empty older list', rows[1].older.length === 0);
  ok('display names still join', rows[0].chatName === 'Water notes');
}

console.log('idFor — content-addressed by url');
{
  ok('same url, same id', idFor('https://x/a.mp4') === idFor('https://x/a.mp4'));
  ok('different url, different id', idFor('https://x/a.mp4') !== idFor('https://x/b.mp4'));
}

console.log(fails ? '\n' + fails + ' FAILING' : '\nall green');
process.exit(fails ? 1 : 0);
