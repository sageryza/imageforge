#!/usr/bin/env node
// Similitude Dominoes for two phones (dominoes.js + public/dominoes.html).
//
//   1. the pure decisions — seatOf, moveGate (the turn gate), notifyPlan (who
//      gets the text, deduped on the move number), view (never the other's
//      phone or token), normalizePhone
//   2. the real router over an in-memory Firestore, driven by the REAL page in
//      headless Chromium on two "phones": start a table, the invite, a friend
//      sitting down, a deal, a lay, a pass — each move adopted by the other
//      phone, the turn gate refusing the wrong seat, and every text Twilio
//      would have been asked to send.
//
// Run: node scripts/test-dominoes.js   (needs playwright + chromium for part 2)
'use strict';
process.env.TWILIO_ACCOUNT_SID = 'ACtest'; process.env.TWILIO_AUTH_TOKEN = 'x'; process.env.TWILIO_FROM = '+15550000000';
process.env.DOMINOES_SITE_ORIGIN = 'http://dom.test';
const path = require('path'), fs = require('fs'), http = require('http');
const sms = require('../sms');
const sent = [];
sms.sendSms = async (to, body) => { sent.push({ to, body }); return { ok: true, sid: 'SM' + sent.length }; };

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

// ── an in-memory Firestore, enough for this module ──────────────────────────
const store = new Map();
const deep = (a, b) => { const o = Object.assign({}, a); for (const k of Object.keys(b)) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) ? deep(o[k], b[k]) : b[k]; return o; };
const docRef = (id) => ({
  id,
  async get() { return { exists: store.has(id), data: () => JSON.parse(JSON.stringify(store.get(id))) }; },
  async set(v, o) { store.set(id, o && o.merge && store.has(id) ? deep(store.get(id), v) : JSON.parse(JSON.stringify(v))); },
});
const fakeDb = {
  collection: () => ({ doc: docRef }),
  async runTransaction(fn) { return fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o) }); },
};
const dominoes = require('../dominoes'); dominoes.init({ db: fakeDb });
const { _internals } = dominoes;
const { seatOf, moveGate, notifyPlan, view } = _internals;

console.log('normalizePhone — E.164 or nothing');
{
  ok('ten digits get +1', sms.normalizePhone('(503) 555-1234') === '+15035551234');
  ok('eleven starting with 1', sms.normalizePhone('1 503 555 1234') === '+15035551234');
  ok('a + keeps its country', sms.normalizePhone('+44 7700 900123') === '+447700900123');
  ok('nine digits is nothing', sms.normalizePhone('555 1234') === null);
  ok('empty is null', sms.normalizePhone('') === null);
}

console.log('moveGate — only the player on turn writes');
{
  const room = { id: 'r', a: { token: 'ta' }, b: { token: 'tb' }, state: null };
  ok('seatOf', seatOf(room, 'ta') === 'a' && seatOf(room, 'tb') === 'b' && seatOf(room, 'zz') === null);
  ok('an empty table takes a deal from either', moveGate(room, 'b', { game: 'g1', n: 1, turn: 'b' }).ok);
  ok('an unseated token is refused', !moveGate(room, null, { game: 'g1', n: 1, turn: 'a' }).ok);
  room.state = { game: 'g1', n: 3, turn: 'a', over: false };
  ok('the player on turn may move', moveGate(room, 'a', { game: 'g1', n: 4, turn: 'b' }).ok);
  ok('the other may not', moveGate(room, 'b', { game: 'g1', n: 4, turn: 'a' }).why === 'not your turn');
  ok('a stale move is refused', moveGate(room, 'a', { game: 'g1', n: 3, turn: 'b' }).why === 'stale');
  ok('a fresh deal by the player on turn is fine', moveGate(room, 'a', { game: 'g2', n: 1, turn: 'a' }).ok);
  ok('a fresh deal by the other is not', !moveGate(room, 'b', { game: 'g2', n: 1, turn: 'b' }).ok);
  room.state.over = true;
  ok('once over, either may deal', moveGate(room, 'b', { game: 'g2', n: 1, turn: 'b' }).ok);
  ok('once over, a stale same-game write is refused', !moveGate(room, 'b', { game: 'g1', n: 9, turn: 'b' }).ok);
}

console.log('notifyPlan — the other player, once per move, only with a number');
{
  const room = { id: 'r1', a: { token: 'ta', phone: '+15035551234', name: 'Sophie' }, b: { token: 'tb', phone: null, name: 'Miriam' } };
  const toB = notifyPlan(room, 'a', { game: 'g', n: 2, turn: 'b' }, 'Sophie laid');
  ok('no number → no text', toB === null);
  const toA = notifyPlan(room, 'b', { game: 'g', n: 3, turn: 'a' }, 'Miriam laid the <b>x</b> (1). Sophie\'s turn.');
  ok('the host is texted on the turn', toA && toA.to === 'a' && toA.phone === '+15035551234');
  ok('the text is plain words plus her seat link', toA && /^Similitude Dominoes — Miriam laid the x \(1\)\. Sophie's turn\. http:\/\/dom\.test\/dominoes\?room=r1&t=ta$/.test(toA.body), toA && toA.body);
  ok('the mover is never texted', notifyPlan(room, 'a', { game: 'g', n: 4, turn: 'a' }, 'x') === null);
  room.notifiedN = 3; room.notifiedGame = 'g';
  ok('the same move number does not text twice', notifyPlan(room, 'b', { game: 'g', n: 3, turn: 'a' }, 'x') === null);
  ok('a new game resets the dedupe', notifyPlan(room, 'b', { game: 'g2', n: 1, turn: 'a' }, 'x') !== null);
  const over = notifyPlan(room, 'b', { game: 'g', n: 9, turn: 'b', over: true }, 'All down. Miriam wins.');
  ok('the end of a round texts the other player', over && over.to === 'a');
}

console.log('view — never the other seat\'s phone or token');
{
  const room = { id: 'r1', invite: 'inv', a: { token: 'tokA9', phone: '+1', name: 'S' }, b: { token: 'tokB9', phone: null, name: 'M' }, state: null, links: {} };
  const va = view(room, 'a'), s = JSON.stringify(va);
  ok('no tokens in a view', s.indexOf('tokA9') < 0 && s.indexOf('tokB9') < 0 && s.indexOf('inv') < 0);
  ok('no numbers in a view', s.indexOf('+1') < 0 && va.b.phone === false && va.a.phone === true);
  ok('the invite shows only while the seat is empty', va.invite === undefined && view(Object.assign({}, room, { b: null }), 'a').invite.indexOf('join=inv') > 0);
}

// ── part 2: the real page on two phones over the real router ────────────────
(async () => {
  let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('  (playwright missing — skipping the page half)'); return finish(); }
  const express = require('express');
  const app = express();
  app.use('/api/dominoes', require('../dominoes').router);
  const PUB = path.join(__dirname, '..', 'public');
  app.get('/dominoes', (req, res) => res.sendFile(path.join(PUB, 'dominoes.html')));
  app.use(express.static(PUB));
  const server = http.createServer(app); await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = () => { for (const k of fs.readdirSync('/opt/pw-browsers')) { const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p; } };
  const browser = await chromium.launch({ executablePath: exe() });
  const phone = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => ok('page error: ' + e, false));
    await pg.route('https://storage.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/webp', body: Buffer.alloc(0) }));
    return pg;
  };
  const msg = (pg) => pg.evaluate(() => document.getElementById('msg').textContent.trim());
  const turn = (pg) => pg.evaluate(() => document.getElementById('sTurn').textContent);

  console.log('the page — start, invite, sit down, deal, lay, pass');
  const A = await phone();
  await A.goto(base + '/dominoes'); await A.waitForTimeout(300);
  ok('the lobby shows and the table does not', await A.evaluate(() => !document.getElementById('lobby').hidden && getComputedStyle(document.getElementById('board')).display === 'none'));
  ok('the name box ships empty', await A.evaluate(() => document.getElementById('fName').value === '' && !document.getElementById('fName').placeholder));
  await A.fill('#fName', 'Sophie'); await A.fill('#fPhone', '503 555 1234'); await A.click('#bStart'); await A.waitForTimeout(800);
  const urlA = A.url();
  ok('starting a table lands on its seat url', /\/dominoes\?room=[0-9a-f]{10}&t=[0-9a-f]{16}$/.test(urlA), urlA);
  ok('the invite panel shows with a link', await A.evaluate(() => !document.getElementById('invite').hidden && /join=/.test(document.getElementById('inviteUrl').value)));
  ok('no New round before a friend sits down', await A.evaluate(() => document.getElementById('bRound').hidden));
  const invite = await A.evaluate(() => document.getElementById('inviteUrl').value);
  const room = new URL(urlA).searchParams.get('room');

  const B = await phone();
  await B.goto(invite.replace('http://dom.test', base)); await B.waitForTimeout(600);
  ok('the invite names the host', /Sophie is inviting you/.test(await B.evaluate(() => document.getElementById('joinLede').textContent)));
  await B.fill('#jName', 'Miriam'); await B.click('#bJoin'); await B.waitForTimeout(800);
  ok('sitting down lands on the seat url', /room=/.test(B.url()) && /&t=/.test(B.url()));
  ok('the host got the sit-down text', sent.length === 1 && sent[0].to === '+15035551234' && /Miriam sat down/.test(sent[0].body), sent);
  await A.waitForTimeout(3000);
  ok('the host phone sees the friend and the deal button', await A.evaluate(() => document.getElementById('invite').hidden && !document.getElementById('bRound').hidden && document.getElementById('lIt').textContent === 'Miriam'));

  const C = await phone(); // a second try at the same invite
  await C.goto(invite.replace('http://dom.test', base)); await C.waitForTimeout(600);
  ok('a used invite says the seat is taken', /already sat down/.test(await C.evaluate(() => document.getElementById('joinLede').textContent)));

  await A.click('#bRound'); await A.waitForTimeout(800); await B.waitForTimeout(3200);
  ok('A dealt and sees it as her turn', /^You dealt/.test(await msg(A)) && (await turn(A)) === 'your turn', await msg(A));
  ok('B adopts the deal a moment later', /^Sophie dealt/.test(await msg(B)) && (await turn(B)) === "Sophie's turn", await msg(B));
  ok('B cannot act', await B.evaluate(() => document.getElementById('bPass').hidden && document.getElementById('bRound').hidden));
  ok('no text for a deal to a player with no number', sent.length === 1);

  await A.evaluate(() => document.querySelector('.hand > span').click()); await A.waitForTimeout(200);
  await A.evaluate(() => document.querySelector('[data-slot]').click()); await A.waitForTimeout(200);
  await A.fill('#say input', 'both round'); await A.click('#bLay'); await A.waitForTimeout(800); await B.waitForTimeout(3200);
  ok('A laid and handed over', /Miriam's turn/.test(await msg(A)) && (await turn(A)) === "Miriam's turn", await msg(A));
  ok('B sees the lay with the words', /^Sophie laid .* both round \(1\)\. Your turn\./.test(await msg(B)) && (await turn(B)) === 'your turn', await msg(B));
  ok('B sees two cards on the table', (await B.evaluate(() => document.querySelectorAll('[data-card]').length)) === 2);

  // the gate: a stale write from A (not on turn) is refused by the server
  const tokA = new URL(urlA).searchParams.get('t');
  const st = JSON.parse(JSON.stringify(store.get(room).state)); st.n += 1;
  const r = await fetch(base + '/api/dominoes/rooms/' + room + '/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokA, state: st, line: 'x' }) });
  ok('the server refuses a move from the seat not on turn', r.status === 409 && /not your turn/.test((await r.json()).error));

  await B.click('#bPass'); await B.waitForTimeout(200); await B.click('#bNoSwap'); await B.waitForTimeout(800); await A.waitForTimeout(3200);
  ok('B passed, A sees it', /^Miriam passed\. Your turn\./.test(await msg(A)) && (await turn(A)) === 'your turn', await msg(A));
  ok('the pass texted the host', sent.length === 2 && sent[1].to === '+15035551234' && /Miriam passed\. Sophie's turn\. http:\/\/dom\.test\/dominoes\?room=/.test(sent[1].body), sent[1]);
  ok('the host\'s seat link in the text is her own', sent[1].body.indexOf('t=' + tokA) > 0);

  // coming back without the token: the phone remembers its seat
  await A.goto(base + '/dominoes?room=' + room); await A.waitForTimeout(800);
  ok('a seat is remembered on the phone', /&t=/.test(A.url()) && (await turn(A)) === 'your turn');
  await A.goto(base + '/dominoes'); await A.waitForTimeout(300);
  ok('the lobby lists her table', await A.evaluate(() => /Sophie's table/.test(document.getElementById('mine').textContent)));

  const st2 = store.get(room);
  ok('the room doc keeps the links by cell', Object.keys(st2.links).length === 1 && st2.links[Object.keys(st2.links)[0]][0].why === 'both round');
  ok('the room doc never grew a phone for B', st2.b.phone === null);

  await browser.close(); server.close();
  finish();
})().catch((e) => { console.error(e); process.exit(1); });

function finish() {
  console.log(fails ? `\n${fails} FAILED` : '\nall good');
  process.exit(fails ? 1 : 0);
}
