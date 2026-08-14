// The Science School notes route, driven for real against a stubbed
// Firestore — the question is what it WRITES, which no source-shape assertion
// can answer.
//
//   node scripts/test-science-notes.js
//
// Needs no network and no credentials.
const path = require('path');
const Module = require('module');
const ROOT = path.join(__dirname, '..');

const fails = [];
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails.push(msg); };

// ── the stubbed Firestore ─────────────────────────────────────────────────
// firebase-admin cannot be monkeypatched in place (assigning admin.firestore
// looks like it takes and doesn't — the real one still answers, and throws
// "the default Firebase app does not exist"). So intercept the module LOAD,
// the same way scripts/test-chats-chapters.js does.
const store = new Map();
const fakeAdmin = {
  apps: [{}],
  firestore: () => ({
    collection: () => ({
      doc: (id) => ({
        set: async (patch) => { store.set(id, Object.assign({}, store.get(id) || {}, patch)); },
        delete: async () => { store.delete(id); },
      }),
      get: async () => ({
        forEach: (fn) => { for (const [id, data] of store) fn({ id, data: () => data }); },
      }),
    }),
  }),
};
function loadRouter() {
  const orig = Module._load;
  Module._load = function (request) {
    if (request === 'firebase-admin') return fakeAdmin;
    return orig.apply(this, arguments);
  };
  try {
    delete require.cache[require.resolve(path.join(ROOT, 'science.js'))];
    return require(path.join(ROOT, 'science.js'));
  } finally { Module._load = orig; }
}

const express = require('express');
const app = express();
app.use('/api/science', loadRouter());

(async () => {
  const srv = app.listen(0);
  await new Promise(r => srv.on('listening', r));
  const base = 'http://localhost:' + srv.address().port + '/api/science';
  const post = (body) => fetch(base + '/note', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const notes = async () => (await (await fetch(base + '/notes')).json()).notes;

  let r = await post({ lesson: 'cell', text: 'make the second card bigger' });
  ok(r.status === 200, 'a note saves (' + r.status + ')');
  ok((await notes()).cell.text === 'make the second card bigger', 'and reads back');
  ok(!!(await notes()).cell.at, 'carrying when it was written');

  // A note on a lesson that exists only as text is the whole point — the
  // route must not require the lesson to be built, because it cannot know.
  r = await post({ lesson: 'dna', text: 'do this one next' });
  ok(r.status === 200 && (await notes()).dna, 'a not-yet-built lesson takes a note');

  // Clearing the box takes the note BACK. Storing a blank instead would keep
  // the row alive in every reader's sweep, which reads as an unanswered note.
  r = await post({ lesson: 'cell', text: '   ' });
  ok(r.status === 200, 'an empty note is accepted (' + r.status + ')');
  ok(!('cell' in await notes()), 'and DELETES rather than storing a blank');

  // The write is open, so it has to be bounded.
  r = await post({ lesson: '../../etc/passwd', text: 'x' });
  ok(r.status === 400, 'a lesson key that is not a lesson key is refused (' + r.status + ')');
  r = await post({ lesson: 'Cell', text: 'x' });
  ok(r.status === 400, 'the key is lower-case only (' + r.status + ')');
  r = await post({ text: 'x' });
  ok(r.status === 400, 'a missing lesson is refused (' + r.status + ')');

  await post({ lesson: 'long', text: 'z'.repeat(5000) });
  ok((await notes()).long.text.length === 2000, 'a very long note is capped at 2000, never refused');

  // 60 writes an hour per IP; the 61st is turned away rather than served.
  let last = 200;
  for (let i = 0; i < 62; i++) last = (await post({ lesson: 'spam', text: 'n' + i })).status;
  ok(last === 429, 'the open write is rate-limited (' + last + ')');

  srv.close();
  console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
