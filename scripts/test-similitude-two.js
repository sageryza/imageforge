#!/usr/bin/env node
// Similitude for two phones (similitude-two.js + public/similitude-two.html).
//
//   1. the pure decisions — the deck is the dominoes deck (61 ids, one
//      source), drawGate (seated, a set of mine, the same cards, one card per
//      set, the $1 cap), costOf, publicCard (the picture and the words, nothing
//      else off the doc)
//   2. the real router over an in-memory Firestore, driven by the REAL page in
//      headless Chromium on two "phones": start a table, the invite, a friend
//      sitting down, the deal, a swap adopted by the other phone, the turn gate
//      refusing the wrong seat, Set! + words claiming and scoring a set, Draw
//      it! reserving the cents and the made card landing in the tile, the cap
//      refusing a draw past the dollar, a challenge stealing a set.
//
// Run: node scripts/test-similitude-two.js   (needs playwright + chromium for part 2)
'use strict';
process.env.TWILIO_ACCOUNT_SID = 'ACtest'; process.env.TWILIO_AUTH_TOKEN = 'x'; process.env.TWILIO_FROM = '+15550000000';
process.env.SIMILITUDE_SITE_ORIGIN = 'http://sim.test';
process.env.OPENAI_API_KEY = 'sk-test';
const path = require('path'), fs = require('fs'), http = require('http');
const sms = require('../sms');
const sent = [];
sms.sendSms = async (to, body) => { sent.push({ to, body }); return { ok: true, sid: 'SM' + sent.length }; };

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

// ── an in-memory Firestore, enough for the table AND the cards ──────────────
const store = new Map();
let autoN = 0;
const deep = (a, b) => { const o = Object.assign({}, a); for (const k of Object.keys(b)) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) ? deep(o[k], b[k]) : b[k]; return o; };
const docRef = (id) => {
  if (!id) id = 'auto' + (++autoN);
  return {
    id,
    async get() { return { exists: store.has(id), data: () => JSON.parse(JSON.stringify(store.get(id))) }; },
    async set(v, o) { store.set(id, o && o.merge && store.has(id) ? deep(store.get(id), v) : JSON.parse(JSON.stringify(v))); },
  };
};
const fakeDb = {
  collection: () => ({ doc: docRef, async get() { return { size: store.size, docs: [] }; } }),
  async runTransaction(fn) { return fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o) }); },
};
const fakeBucket = { name: 'test-bucket', file: (p) => ({ async save() {}, async makePublic() {} }) };

const triset = require('../triset');
const { dreamyStyle } = require('./lib/dreamy-style');
triset.init({ gptStyles: { dreamy: dreamyStyle() }, db: fakeDb, bucket: fakeBucket });
const two = require('../similitude-two'); two.init({ db: fakeDb });
const { drawGate, deckIds, publicCard, spentView } = two._internals;

// the 61 cards, as the pool holds them
const IDS = deckIds();
IDS.forEach((id, i) => store.set(id, {
  title: 'card ' + i, promptContent: 'the words of card ' + i, status: 'ready',
  cut: 'https://storage.googleapis.com/x/triset/cuts/' + id + '.c5.webp',
  url: 'https://storage.googleapis.com/x/triset/cards/' + id + '.webp', createdAt: i,
}));

// the referee and the image model, stubbed at their doors
const anthropic = require('../anthropic');
anthropic.available = () => true;
const judged = [];
anthropic.chatJSON = async ({ user }) => { judged.push(user); return /card 1\b/.test(user) ? { fits: true, why: 'it plainly does' } : { fits: false, why: 'a near miss' }; };
const PIXEL = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const drawn = [];
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  if (String(url).includes('api.openai.com')) { drawn.push(1); return { async json() { return { data: [{ b64_json: PIXEL.toString('base64') }] }; } }; }
  if (/storage\.googleapis\.com/.test(String(url))) return { ok: true, async arrayBuffer() { return PIXEL.buffer.slice(PIXEL.byteOffset, PIXEL.byteOffset + PIXEL.byteLength); } };
  return realFetch(url, opts);
};

console.log('the deck — the dominoes page\'s own 61, one source');
{
  ok('61 ids', IDS.length === 61);
  ok('all different', new Set(IDS).size === 61);
  ok('full ids, not the 8-char prefixes', IDS.every(id => /^[0-9a-f]{40}$/.test(id)));
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'dominoes.html'), 'utf8');
  ok('every id is in the dominoes page', IDS.every(id => html.includes(id + '.c')));
  ok('similitude-two.js keeps no card list of its own', !/[0-9a-f]{40}/.test(fs.readFileSync(path.join(__dirname, '..', 'similitude-two.js'), 'utf8')));
  const pc = publicCard('abc', { status: 'ready', cut: 'c', url: 'u', title: 't', promptContent: 'p', fullPrompt: 'SECRET', promptStyle: 'S' });
  ok('a public card is the picture and the words, nothing else', pc && pc.cut === 'c' && pc.words === 'p' && !('fullPrompt' in pc) && !('promptStyle' in pc));
  ok('a hidden or unfinished card is left out', publicCard('x', { status: 'drawing', url: 'u' }) === null && publicCard('x', { status: 'ready', url: 'u', hidden: true }) === null);
}

console.log('drawGate — a set of mine, once, under the dollar');
{
  const room = { id: 'r', a: { token: 'ta' }, b: { token: 'tb' }, spent: { a: 0, b: 0 }, draws: [],
    state: { game: 'g1', wins: [{ by: 'a', cards: ['x', 'y', 'z'], kind: 'same', text: 'round' }, { by: 'b', cards: ['p', 'q', 'r'], kind: 'each' }] } };
  const body = { game: 'g1', win: 0, cards: ['x', 'y', 'z'], kind: 'same' };
  ok('not seated', drawGate(room, null, body).code === 403);
  ok('the finder may draw', drawGate(room, 'a', body).ok && drawGate(room, 'a', body).cost === triset.COST_CENTS);
  ok('the other player may not draw my set', drawGate(room, 'b', body).code === 403);
  ok('the cards must be that set\'s', drawGate(room, 'a', Object.assign({}, body, { cards: ['x', 'y', 'q'] })).code === 400);
  ok('a set from another game is refused', drawGate(room, 'a', Object.assign({}, body, { game: 'g0' })).code === 409);
  ok('an auto set costs more', drawGate(room, 'b', { game: 'g1', win: 1, cards: ['p', 'q', 'r'], kind: 'auto' }).cost === triset.AUTO_COST_CENTS);
  room.draws = [{ game: 'g1', win: 0, status: 'drawing' }];
  ok('one card per set', drawGate(room, 'a', body).code === 409);
  room.draws = [{ game: 'g1', win: 0, status: 'failed' }];
  ok('…but a failed draw may be tried again', drawGate(room, 'a', body).ok);
  room.spent.a = 99;
  ok('the dollar cap refuses with 402', drawGate(room, 'a', body).code === 402);
  room.spent.a = 98.2;
  ok('…and lets the last one under it through', drawGate(room, 'a', body).ok);
  ok('the cap is a dollar', two.CAP_CENTS === 100);
  ok('spentView never invents', JSON.stringify(spentView({})) === '{"a":0,"b":0}');
}

// ── part 2: the real page on two phones over the real router ────────────────
(async () => {
  let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('  (playwright missing — skipping the page half)'); return finish(); }
  const express = require('express');
  const app = express();
  app.use('/api/similitude', two.router);
  const PUB = path.join(__dirname, '..', 'public');
  app.get('/similitude/play', (req, res) => res.sendFile(path.join(PUB, 'similitude-two.html')));
  app.use(express.static(PUB));
  const server = http.createServer(app); await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = () => { for (const k of fs.readdirSync('/opt/pw-browsers')) { const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p; } };
  const browser = await chromium.launch({ executablePath: exe() });
  const phone = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => ok('page error: ' + e, false));
    await pg.route('https://storage.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/webp', body: PIXEL }));
    return pg;
  };
  const msg = (pg) => pg.evaluate(() => document.getElementById('msg').textContent.trim());
  const turn = (pg) => pg.evaluate(() => document.getElementById('turnline').textContent);
  const roomDoc = () => { for (const [k, v] of store) if (v && v.invite) return v; return null; };

  console.log('the page — start, invite, sit down, deal');
  const A = await phone();
  await A.goto(base + '/similitude/play'); await A.waitForTimeout(400);
  ok('the lobby shows and the game does not', await A.evaluate(() => !document.getElementById('lobby').hidden && document.getElementById('game').hidden));
  ok('the name box ships empty', await A.evaluate(() => document.getElementById('fName').value === '' && !document.getElementById('fName').placeholder && document.getElementById('middle').value === '' && !document.getElementById('middle').placeholder));
  await A.fill('#fName', 'Sophie'); await A.fill('#fPhone', '503 555 1234'); await A.click('#bStart'); await A.waitForTimeout(800);
  const urlA = A.url();
  ok('starting a table lands on its seat url', /\/similitude\/play\?room=[0-9a-f]{10}&t=[0-9a-f]{16}$/.test(urlA), urlA);
  ok('the invite panel shows with a link', await A.evaluate(() => !document.getElementById('invite').hidden && /similitude\/play\?room=.*join=/.test(document.getElementById('inviteUrl').value)));
  const invite = await A.evaluate(() => document.getElementById('inviteUrl').value);
  const room = new URL(urlA).searchParams.get('room');
  const tokA = new URL(urlA).searchParams.get('t');

  const B = await phone();
  await B.goto(invite.replace('http://sim.test', base)); await B.waitForTimeout(600);
  ok('the invite names the host', /Sophie is inviting you/.test(await B.evaluate(() => document.getElementById('joinLede').textContent)));
  await B.fill('#jName', 'Miriam'); await B.click('#bJoin'); await B.waitForTimeout(800);
  ok('sitting down lands on the seat url', /room=/.test(B.url()) && /&t=/.test(B.url()));
  ok('the host got the sit-down text with the Similitude name', sent.length === 1 && /^Similitude — Miriam sat down/.test(sent[0].body) && /similitude\/play\?room=/.test(sent[0].body), sent);
  await A.waitForTimeout(3000);
  ok('the host sees the friend and New game', await A.evaluate(() => document.getElementById('invite').hidden && !document.getElementById('game').hidden && !document.getElementById('newgame').hidden));

  await A.click('#newgame'); await A.waitForTimeout(800); await B.waitForTimeout(3200);
  const stA = roomDoc().state;
  ok('a deal is three on the board, three each, the rest in the deck — 61 in all, none twice',
    stA && stA.board.length === 3 && stA.h.a.length === 3 && stA.h.b.length === 3
    && stA.board.length + stA.h.a.length + stA.h.b.length + stA.deck.length === 61
    && new Set(stA.board.concat(stA.h.a, stA.h.b, stA.deck)).size === 61, stA && { board: stA.board.length, deck: stA.deck.length });
  ok('A sees it as her turn', (await turn(A)) === 'your turn');
  ok('B adopts the deal and cannot act', (await turn(B)) === "Sophie's turn" && await B.evaluate(() => document.getElementById('pass').hidden && document.getElementById('found').hidden));
  ok('B sees his own three cards and only a count of hers', await B.evaluate(() => document.querySelectorAll('#hand .hcard:not(.gone)').length === 3 && /Sophie holds 3/.test(document.getElementById('theirs').textContent)));
  ok('the board shows the die-cuts filling the slots', await A.evaluate(() => ['top', 'left', 'right'].every(s => { const el = document.getElementById('s-' + s); const r = el.querySelector('img').getBoundingClientRect(), b = el.getBoundingClientRect(); return /cuts\//.test(el.querySelector('img').src) && Math.abs(r.width - b.width) <= 2; })));

  console.log('a swap, the gate, a pass');
  const before = stA.board.slice();
  await A.click('#s-top', { position: { x: 90, y: 120 } }); await A.waitForTimeout(200);
  await A.evaluate(() => document.querySelector('#hand .hcard[data-h="0"]').click()); await A.waitForTimeout(800); await B.waitForTimeout(3200);
  const st2 = roomDoc().state;
  ok('the swap put her hand card on the board and refilled her hand', st2.board[0] !== before[0] && st2.h.a.length === 3 && st2.discard[0] === before[0] && st2.deck.length === stA.deck.length - 1);
  ok('A handed the turn over', /Miriam's turn/.test(await msg(A)) && (await turn(A)) === "Miriam's turn");
  ok('B sees the swap and his turn', /^Sophie swapped a card/.test(await msg(B)) && (await turn(B)) === 'your turn');
  ok('no text for a player with no number', sent.length === 1);
  const st = JSON.parse(JSON.stringify(roomDoc().state)); st.n += 1;
  const r = await realFetch(base + '/api/similitude/rooms/' + room + '/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokA, state: st, line: 'x' }) });
  ok('the server refuses a move from the seat not on turn', r.status === 409 && /not your turn/.test((await r.json()).error));
  await B.click('#pass'); await B.waitForTimeout(800); await A.waitForTimeout(3200);
  ok('B passed, A sees it and her turn', /^Miriam passed/.test(await msg(A)) && (await turn(A)) === 'your turn');
  ok('the pass texted the host with her own seat link', sent.length === 2 && /Miriam passed\. Sophie's turn\. http:\/\/sim\.test\/similitude\/play\?room=/.test(sent[1].body) && sent[1].body.indexOf('t=' + tokA) > 0, sent[1]);

  console.log('Set! — the claim scores, the tile appears, Draw it! pays under the cap');
  await A.click('#found'); await A.waitForTimeout(200);
  ok('Set! lights the board and opens the words', await A.evaluate(() => document.getElementById('board').classList.contains('claimed') && !document.getElementById('kinds').hidden && !document.getElementById('middle').disabled));
  ok('the button waits for words', (await A.evaluate(() => document.getElementById('foundword').textContent)) === 'Set!');
  const boardBefore = roomDoc().state.board.slice();
  await A.fill('#middle', 'all of them are round'); await A.waitForTimeout(100);
  ok('…and says Claim once there are', (await A.evaluate(() => document.getElementById('foundword').textContent)) === 'Claim');
  await A.click('#found'); await A.waitForTimeout(800); await B.waitForTimeout(3200);
  const st3 = roomDoc().state;
  ok('the claim is a win with her words, scored to her', st3.wins.length === 1 && st3.wins[0].by === 'a' && st3.wins[0].text === 'all of them are round' && st3.score.a === 1 && st3.wins[0].cards.join() === boardBefore.join());
  ok('the three left play and the board refilled', st3.board.every(id => boardBefore.indexOf(id) < 0) && st3.gone.join() === boardBefore.join());
  ok('the turn passed', st3.turn === 'b' && (await turn(B)) === 'your turn');
  ok('both phones show the set in the shelf', (await A.evaluate(() => document.querySelectorAll('#won .setcard').length)) === 1 && (await B.evaluate(() => document.querySelectorAll('#won .setcard').length)) === 1);
  ok('B\'s shelf names whose set it is', await B.evaluate(() => document.querySelector('#won .setcard .who').textContent === 'Sophie'));
  ok('A is offered Draw it! with her dollar', await A.evaluate(() => !document.getElementById('drawit').hidden && /100¢ left/.test(document.getElementById('drawcost').textContent)));
  ok('B is not offered a draw of her set', await B.evaluate(() => document.getElementById('drawit').hidden));

  await A.click('#drawit'); await A.waitForTimeout(1500);
  const rd = roomDoc();
  ok('the draw reserved the cents on her seat only', rd.spent.a === triset.COST_CENTS && (rd.spent.b || 0) === 0, rd.spent);
  ok('one card was drawn through the real found path', drawn.length === 1 && rd.draws.length === 1 && rd.draws[0].by === 'a' && rd.draws[0].win === 0 && rd.draws[0].game === st3.game);
  ok('the card is a made, upside-down card in the pool', (() => { const c = store.get(rd.draws[0].card); return c && c.source === 'made' && c.flip === true && c.from.middle === 'all of them are round'; })());
  await A.waitForTimeout(3200);
  ok('the room read resolved the draw to its picture', roomDoc().draws[0].status === 'ready' && !!roomDoc().draws[0].url, roomDoc().draws[0]);
  ok('the made card sits in the middle of her tile', await A.evaluate(() => { const img = document.querySelector('#won .setcard .sl.p-mid img'); return img && !img.hidden && /\/cards\//.test(img.src); }));
  ok('Draw it! is put away once the set has its card', await A.evaluate(() => document.getElementById('drawit').hidden));
  ok('a second draw of the same set is refused', (await realFetch(base + '/api/similitude/rooms/' + room + '/draw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokA, game: st3.game, win: 0, cards: st3.wins[0].cards, kind: 'same', middle: 'x' }) })).status === 409);

  // the cap: spend her seat up to the line, then one more is refused
  store.set(room, Object.assign(roomDoc(), { spent: { a: 99, b: 0 } }));
  await B.click('#pass'); await B.waitForTimeout(800); await A.waitForTimeout(3200);
  await A.click('#found'); await A.fill('#middle', 'all of them are green'); await A.click('#found'); await A.waitForTimeout(800);
  ok('a second set is scored', roomDoc().state.wins.length === 2 && roomDoc().state.score.a === 2);
  ok('past the dollar the page says so and the button is dead', await A.evaluate(() => document.getElementById('drawit').disabled && /dollar is spent/.test(document.getElementById('drawcost').textContent)));
  const capped = await realFetch(base + '/api/similitude/rooms/' + room + '/draw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokA, game: roomDoc().state.game, win: 1, cards: roomDoc().state.wins[1].cards, kind: 'same', middle: 'all of them are green' }) });
  ok('the server refuses the draw past the cap with 402', capped.status === 402 && /dollar/.test((await capped.json()).error));
  ok('…and nothing was drawn or charged', drawn.length === 1 && roomDoc().spent.a === 99);

  console.log('the challenge — a card from his hand against her rule');
  await B.waitForTimeout(3200);
  ok('B is on turn', (await turn(B)) === 'your turn');
  await B.evaluate(() => document.querySelectorAll('#won .setcard')[1].click()); await B.waitForTimeout(200);
  ok('her set opens big with Challenge on it', await B.evaluate(() => !document.getElementById('setbig').hidden && !document.getElementById('steal').hidden && /Sophie's set/.test(document.getElementById('bigwho').textContent)));
  await B.click('#stealbtn'); await B.waitForTimeout(200);
  ok('his three cards are offered', (await B.evaluate(() => document.querySelectorAll('#stealrow .hcard').length)) === 3);
  // the stubbed referee says yes to "card 1" — make sure B holds it
  const idx1 = IDS[1];
  store.set(room, (() => { const d = roomDoc(); d.state.h.b[0] = idx1; d.n += 1; d.state.n = d.n; return d; })());
  await B.goto(B.url()); await B.waitForTimeout(1200);
  await B.evaluate(() => document.querySelectorAll('#won .setcard')[1].click()); await B.waitForTimeout(200);
  await B.click('#stealbtn'); await B.waitForTimeout(200);
  await B.evaluate(() => document.querySelector('#stealrow .hcard').click()); await B.waitForTimeout(1200); await A.waitForTimeout(3200);
  const st4 = roomDoc().state;
  ok('the referee was asked about that card and that rule', judged.length === 1 && /all of them are green/.test(judged[0]) && /the words of card 1\b/.test(judged[0]), judged);
  ok('the set is his now and the score moved', st4.wins[1].by === 'b' && st4.wins[1].stolen === true && st4.score.a === 1 && st4.score.b === 1);
  ok('the challenge was his turn — it passed', st4.turn === 'a' && (await turn(A)) === 'your turn');
  ok('A sees the steal', /Miriam challenged and took the set/.test(await msg(A)), await msg(A));
  const offturn = await realFetch(base + '/api/similitude/rooms/' + room + '/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: new URL(B.url()).searchParams.get('t'), card: idx1, rule: 'x' }) });
  ok('a challenge off turn is refused before the referee is asked', offturn.status === 409 && judged.length === 1);

  ok('the room doc never grew a phone for B', roomDoc().b.phone === null);
  ok('a view never carries the other seat\'s token', !JSON.stringify(await (await realFetch(base + '/api/similitude/rooms/' + room + '?token=' + tokA)).json()).includes(roomDoc().b.token));
  const deckRes = await (await realFetch(base + '/api/similitude/deck')).json();
  ok('/deck answers the 61 with pictures and words and nothing else', deckRes.cards.length === 61 && deckRes.cards.every(c => c.cut && c.words && !c.fullPrompt));

  await browser.close(); server.close();
  finish();
})().catch((e) => { console.error(e); process.exit(1); });

function finish() {
  console.log(fails ? `\n${fails} FAILED` : '\nall good');
  process.exit(fails ? 1 : 0);
}
