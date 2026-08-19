#!/usr/bin/env node
// TAGGING — you were in my dreams (Sophie, 2026-08-19: "the ability to tag
// someone in your dream … should be on the dream sharing page"). The pure
// resolution rule first, then the REAL page headless:
//   1. tagsFromPairs resolves only ACCEPTED pairs the owner is in — a pending
//      ask, a stranger's pair and an unknown id all drop silently,
//   2. the feed whispers "you were in this dream" on a taggedYou card and on
//      no other — nobody else even learns tags exist,
//   3. the dream screen (the sharing page) grows "who was in it?" chips of
//      your friends; a tap POSTs the whole selection by PAIR id.
//
//   npm install playwright-core --no-save && node scripts/test-dreamapp-tags.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { tagsFromPairs, friendPairId } = require(path.join(__dirname, '..', 'dreamapp'));

let fails = 0;
const ok = (cond, name) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} — ${name}`); if (!cond) fails++; };

// ── the pure rule ──
const pairs = [
  { id: 'me__penny', uids: ['me', 'penny'], names: { penny: 'penny' }, acceptedAt: 'x' },
  { id: 'jude__me', uids: ['jude', 'me'], names: { jude: 'jude' }, acceptedAt: null, requestedBy: 'me' },
  { id: 'sam__theo', uids: ['sam', 'theo'], names: { theo: 'theo' }, acceptedAt: 'x' },
];
ok(JSON.stringify(tagsFromPairs(pairs, ['me__penny'], 'me')) === '[{"uid":"penny","name":"penny"}]',
  'an accepted friend resolves to a tag');
ok(tagsFromPairs(pairs, ['jude__me'], 'me').length === 0, 'a pending ask cannot be tagged');
ok(tagsFromPairs(pairs, ['sam__theo'], 'me').length === 0, 'someone else’s pair cannot be tagged');
ok(tagsFromPairs(pairs, ['nope'], 'me').length === 0, 'an unknown id drops silently');
ok(friendPairId('me', 'penny') === 'me__penny', 'the chip key is the pair id, both orders');

// ── the real page ──
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'public', 'dreamapp.html'), 'utf8');
const today = '2026-08-18';
const feed = [
  { id: 'd1', title: 'The Xylophone Teeth', mine: false, publicOn: today, createdAt: today + 'T08:00:00Z',
    audience: 'everyone', words: 'My teeth were a xylophone.', panels: [], cover: null,
    feltCount: 0, felt: false, commentCount: 0, taggedYou: true },
  { id: 'd2', title: 'The Whale Again', mine: false, publicOn: today, createdAt: today + 'T07:00:00Z',
    audience: 'everyone', words: 'The whale is back.', panels: [], cover: null,
    feltCount: 0, felt: false, commentCount: 0, taggedYou: false },
];
const own = { id: 'm1', title: 'Weather Chess', text: 'Her bishop was a light drizzle.', night: today,
  createdAt: today + 'T06:00:00Z', publicOn: null, audience: 'private', wordsPublic: true,
  panels: [], drawJob: null, drawnAt: null, feltCount: 0, mood: null, lucid: false, recurring: false,
  elems: [], tags: [{ pair: 'me__penny', name: 'penny' }] };
const tagPosts = [];
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const body = (cb) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => cb(b ? JSON.parse(b) : {})); };
  if (u === '/' || u === '/dreamfeed') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  if (u === '/api/witch/firebase-config') return json({ apiKey: 'x' });
  if (u === '/api/dreamapp/feed') return json({ sealed: false, today, dreams: feed });
  if (u === '/api/dreamapp/dreams' && req.method === 'GET') return json({ dreams: [own] });
  if (u === '/api/dreamapp/dreams/m1' && req.method === 'GET') return json(own);
  if (u === '/api/dreamapp/dreams/m1/tags' && req.method === 'POST') {
    return body((b) => { tagPosts.push(b); json({ ok: true, tags: [] }); });
  }
  if (u === '/api/dreamapp/friends' && req.method === 'GET') {
    return json({ friends: [{ id: 'me__penny', name: 'penny' }, { id: 'jude__me', name: 'jude' }],
                  asks: [], waiting: [] });
  }
  res.writeHead(404); res.end('{}');
});

const FIREBASE_STUB = `
  window.firebase = { initializeApp: function(){},
    auth: Object.assign(function(){ return window.__auth; }, { GoogleAuthProvider: function(){}, OAuthProvider: function(){} }) };
  window.__auth = {
    currentUser: { getIdToken: async function(){ return 'tok'; } },
    getRedirectResult: function(){ return Promise.resolve({}); },
    onAuthStateChanged: function(cb){ setTimeout(function(){ cb(window.__auth.currentUser); }, 0); },
    signOut: function(){} };`;

(async () => {
  let chromium;
  try { chromium = require('playwright-core').chromium; }
  catch (e) { console.log('SKIP — playwright-core not installed'); process.exit(fails ? 1 : 0); }
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    process.env.CHROMIUM_PATH].filter(Boolean).find((p) => fs.existsSync(p));
  await new Promise((r) => srv.listen(0, r));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://www.gstatic.com/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: r.request().url().includes('firebase-app') ? FIREBASE_STUB : '/*auth*/' }));
  await page.route(/fonts\.(googleapis|gstatic|cdnfonts)\.com|cdnfonts\.com/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/dreamfeed`);
  await page.waitForSelector('.dcard');

  // 2 · the whisper, for exactly one reader
  ok(await page.locator('[data-id="d1"] .youin').count() === 1
     && (await page.locator('[data-id="d1"] .youin').textContent()) === 'you were in this dream',
    'a taggedYou card whispers "you were in this dream"');
  ok(await page.locator('[data-id="d2"] .youin').count() === 0, 'and no other card does');

  // 3 · the sharing page grows the chips
  await page.$eval('#navMine', (el) => el.click());
  await page.waitForSelector('.jitem');
  await page.$eval('.jitem', (el) => el.click());
  await page.waitForSelector('#dreamTags:not([hidden])');
  ok(await page.locator('#dreamTags .moods button').count() === 2, 'chips for each friend');
  ok(await page.locator('#dreamTags button[data-pair="me__penny"].on').count() === 1,
    'an already-tagged friend arrives lit');
  await page.$eval('#dreamTags button[data-pair="jude__me"]', (el) => el.click());
  await page.waitForFunction(() => window.__tagged || true);
  await page.waitForTimeout(400);
  ok(tagPosts.length === 1 && JSON.stringify(tagPosts[0].pairs.slice().sort()) === '["jude__me","me__penny"]',
    'a tap POSTs the whole selection by pair id');

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
