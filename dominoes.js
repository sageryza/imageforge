// dominoes.js — Similitude Dominoes for two people on two phones, anyone's.
//
// Sophie (2026-09-04): "i want to play against my friend miriam. no computer"
// → "i'm more wanting to build it for anyone so i can share it on ig". So this
// is a PUBLIC table, not a Compare page: someone starts a table with their
// name, sends the invite link, the friend joins with theirs, and the two play
// from their own phones. The page (public/dominoes.html) holds the whole
// game — the rules, the cards, the words she types — and the TABLE (seats,
// turn gate, the your-turn text, the per-player view) is table.js's, the one
// copy every two-phone game here shares (lifted out of this file the day the
// triangle game went multiplayer too). Routes, Firestore shape and the seat
// links are byte-for-byte what they were; see table.js for the contract.
//
// Firestore: forge-dominoes-rooms, one doc per table. It costs nothing — no
// model call anywhere; a text is Twilio's own fraction of a cent.
'use strict';
const { makeTable } = require('./table');

const table = makeTable({
  collection: 'forge-dominoes-rooms',
  page: '/dominoes',
  title: 'Similitude Dominoes',
  siteEnv: 'DOMINOES_SITE_ORIGIN',
});

module.exports = { router: table.router, init: table.init, _internals: table._internals };
