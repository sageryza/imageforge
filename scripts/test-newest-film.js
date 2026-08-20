#!/usr/bin/env node
/* WHICH CUT IS THE CURRENT ONE — the decision behind GET /api/chatfeed/newest
 * (Aug 2026, Sophie: "there's a new version of the song commercial … how can
 * you automatically update based on the latest version of the movies to the
 * Instagram thing").
 *
 *   node scripts/test-newest-film.js        (pure — no bucket, no registry)
 *
 * The rule under test: a chat's PIN wins when it is unmistakably this film,
 * otherwise the newest video Storage has under the prefix, otherwise nothing
 * — and "nothing" matters as much as the others, because it is what leaves a
 * page showing the cut it was built with instead of a wrong one.
 */
const { pickFilm } = require('../chatfeed.js');

const B = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/';
const fails = [];
const ok = (c, m) => { console.log((c ? 'PASS: ' : 'FAIL: ') + m); if (!c) fails.push(m); };

const pin = (url, title) => ({ url: B + url, title: title || '' });
const st = (name, updated) => ({ name, updated: updated || '2026-08-01T00:00:00Z' });

// 1 — the pin wins when it is this film
let r = pickFilm('dream-commercial/spot-', pin('dream-commercial/spot-v8.mp4', 'The song spot v8 (0:28)'),
  st('dream-commercial/spot-v4.mp4'), B);
ok(r && r.from === 'pin' && /spot-v8/.test(r.url), 'a pin inside the prefix wins over an older storage hit');
ok(r && r.title === 'The song spot v8 (0:28)', "and it carries the chat's own title for the cut");

// 2 — THE GUARD. One chat makes several films and can only pin one; its pin
// must never be served as a different film.
r = pickFilm('commercials/reels/everydream',
  pin('commercials/reels/memoryfight-warm/memoryfight-warm-reel-draft-v1.mp4', 'the fight'),
  st('commercials/reels/everydream3/everydream3-reel-draft-v1.mp4'), B);
ok(r && r.from === 'storage' && /everydream3/.test(r.url),
  "a pin on a DIFFERENT film is ignored — storage answers instead");

// 3 — the boundary: a prefix must not match mid-segment
r = pickFilm('dream-commercial/spot-',
  pin('other-dream-commercial/spot-v9.mp4', 'not ours'), null, B);
ok(!r, 'a url that merely CONTAINS the prefix does not count — the match is on a path boundary');

// 4 — a pin that is not a video (a page, a doc) is not a cut
r = pickFilm('dream-commercial/spot-', pin('dream-commercial/notes.pdf', 'notes'),
  st('dream-commercial/spot-v4.mp4'), B);
ok(r && r.from === 'storage', 'a non-video pin is ignored');

// 5 — no pin at all: storage answers, and the url is built from the bucket
r = pickFilm('commercials/reels/reverie', null, st('commercials/reels/reverie3/reverie3-reel-draft-v1.mp4'), B);
ok(r && r.url === B + 'commercials/reels/reverie3/reverie3-reel-draft-v1.mp4', 'with no pin, storage answers');

// 6 — nothing known: the caller keeps what it was built with
ok(pickFilm('commercials/reels/nothinghere', null, null, B) === null,
  'nothing under the prefix and no pin → null, so the page keeps its own url');
ok(pickFilm('x/', { title: 'a pin with no url' }, null, B) === null, 'a pin with no url is not a pin');

// 7 — the pin is preferred even when storage has something NEWER, because a
// chat pinning a cut is a person saying "this one"
r = pickFilm('dream-commercial/spot-', pin('dream-commercial/spot-v8.mp4', 'v8'),
  st('dream-commercial/spot-v7-from-104.mp4', '2026-12-31T00:00:00Z'), B);
ok(r && r.from === 'pin', 'a curated pin beats a newer timestamp');

console.log(fails.length ? `\n${fails.length} failed` : `\nall 9 checks passed`);
process.exit(fails.length ? 1 : 0);
