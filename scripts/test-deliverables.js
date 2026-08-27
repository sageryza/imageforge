#!/usr/bin/env node
// The deliverables list — the pure rules, no network, no Firestore.
//
//   1. kindOf()        — kind read off the url when not given.
//   2. pinDeliverable() — only a MEDIA pin auto-records (a link pin is
//      usually a page being worked on, not a hand-over).
//   3. decideRecord()  — a NEW url is a new row (→ push); the same url again
//      is a silent update that bumps updatedAt + versions and can fix a title.
//   4. rowsOf()        — newest first by updatedAt, display names joined from
//      the registry map, slugs surviving where no name exists.
//
// Run: node scripts/test-deliverables.js
'use strict';
const { _internals, pinDeliverable } = require('../deliverables');
const { kindOf, decideRecord, rowsOf, idFor } = _internals;

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

console.log('idFor — content-addressed by url');
{
  ok('same url, same id', idFor('https://x/a.mp4') === idFor('https://x/a.mp4'));
  ok('different url, different id', idFor('https://x/a.mp4') !== idFor('https://x/b.mp4'));
}

console.log(fails ? '\n' + fails + ' FAILING' : '\nall green');
process.exit(fails ? 1 : 0);
