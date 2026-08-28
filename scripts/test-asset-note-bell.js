#!/usr/bin/env node
// A NOTE SHE LEAVES MUST RING THE CHAT'S DOORBELL (2026-08-28, Sophie: "fix
// the note bell"). Source pins, no network: the ring lives in the ONE place
// every note path funnels through, and it must never fire for a chat's own
// reply. This exists because the failure is SILENT — a chat that is never
// woken looks exactly like a chat with no notes waiting, and one of them
// built 135 pictures ignoring every ask she had left.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
let fails = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) fails++; };

// the single choke point, and its bounds
const i = src.indexOf('async function appendAssetMessage(');
ok(i > 0, 'appendAssetMessage exists — the one place every note path lands');
const body = src.slice(i, src.indexOf('\n}\n', i));

ok(/require\('\.\/chat-wake'\)/.test(body), 'it requires chat-wake — the ONE shared doorbell');
ok(/wake\.ring\(/.test(body), 'it calls wake.ring');
ok(/followMoves/.test(body) && /registry/.test(body),
  'it passes registry + followMoves, so a moved/forked chat still resolves');

// her notes ring; a chat's own reply must not, or it wakes itself forever
const ringAt = body.indexOf('wake.ring(');
const guard = body.lastIndexOf("who === 'sophie'", ringAt);
ok(guard > 0 && guard < ringAt, "the ring is guarded by who === 'sophie' — a chat reply never rings itself");

// the note must land whether or not anything can be woken
ok(/\.catch\(/.test(body.slice(ringAt - 400, ringAt + 400)),
  'the ring is best-effort (caught) — a note lands even when nothing is wakeable');
ok(!/await\s+wake\.ring\(/.test(body),
  'the ring is NOT awaited — it can never delay or fail her note landing');

// every path really does funnel through it (else the bell has holes)
const callers = (src.match(/appendAssetMessage\(/g) || []).length - 1;
ok(callers >= 3, `every note path funnels through it (${callers} call sites: text, legacy, voice/film)`);

// and the sibling module's identical pattern still exists, so there is one design
const wv = fs.readFileSync(path.join(root, 'witchvideo.js'), 'utf8');
ok(/wake\.ring\(/.test(wv), 'witchvideo.js still rings the same way — one design, not two');

console.log(fails ? `\ntest-asset-note-bell: ${fails} FAILED` : '\ntest-asset-note-bell: all good');
process.exit(fails ? 1 : 0);
