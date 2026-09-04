#!/usr/bin/env node
// A FOR-CLAUDE LIST NOTE RIDES THE ONE NOTES INBOX (2026-09-04, Sophie: "if
// they weren't in an obvious place at first, that's on you · what's a better
// place for them"). `itemNoteRows` in chatfeed.js turns the `forge-item-notes`
// docs into the rows `GET /api/gallery/assets/notes` lists beside the picture
// and film notes — same shape, same `waiting`. Pure, no network.
//   node scripts/test-item-notes.js
const { itemNoteRows } = require('../chatfeed');
let failed = 0;
const ok = (m) => console.log('ok - ' + m);
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const rows = itemNoteRows([
  { chat: 'c', msgId: 'm1', key: 'k1', item: 'Music. The script has none.', text: 'later', at: '2026-09-04T23:13:18Z', thread: [{ from: 'sophie', text: 'later', at: '2026-09-04T23:13:18Z' }] },
  { chat: 'c', msgId: 'm1', key: 'k2', item: 'Hard sell.', text: 'over the footage', at: '2026-09-04T23:12:28Z',
    thread: [{ from: 'sophie', text: 'over the footage', at: '2026-09-04T23:12:28Z' }, { from: 'chat', text: 'done — v4 puts it over', at: '2026-09-04T23:30:00Z' }] },
  // an older doc with no thread array at all still reads as her one note
  { chat: 'c', msgId: 'm2', key: 'k3', item: 'Name the course.', text: 'later', at: '2026-09-04T23:12:40Z' },
  // nothing to say → no row
  { chat: 'c', msgId: 'm2', key: 'k4', item: 'x', text: '', at: '2026-09-04T23:12:40Z', thread: [] },
]);
if (rows.length === 3) ok('three rows, the empty one dropped'); else fail('rows: ' + rows.length);
const r1 = rows[0], r2 = rows[1], r3 = rows[2];
if (r1.kind === 'item' && r1.description === 'Music. The script has none.' && r1.waiting === 'chat' && r1.thread.length === 1 && r1.thread[0].from === 'sophie') ok('an unanswered note: the item\'s words as the description, waiting on the chat');
else fail('r1: ' + JSON.stringify(r1));
if (r2.waiting === 'sophie' && r2.thread[1].from === 'chat' && r2.msgId === 'm1' && r2.key === 'k2') ok('an answered note waits on her, and carries msgId + key for /tick/reply');
else fail('r2: ' + JSON.stringify(r2));
if (r3.thread.length === 1 && r3.thread[0].text === 'later' && r3.thread[0].at === '2026-09-04T23:12:40Z') ok('a doc with no thread array reads as her one note');
else fail('r3: ' + JSON.stringify(r3));
console.log(failed ? failed + ' failed' : 'all passed');
