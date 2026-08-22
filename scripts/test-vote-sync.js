#!/usr/bin/env node
/*
 * test-vote-sync.js — hearts sync both ways between the Playground and the
 * Assets tabs (Aug 2026, Sophie: "i don't know if the hearts in playground
 * are syncing to the hearts in meta-assets" — they were not; measured that
 * day, 21 of the 22 hearted Playground pictures in the newest 100 runs sat
 * unhearted in Meta Assets).
 *
 * Lifts syncVoteToAssets / syncVoteToPlayground out of server.js BY SOURCE
 * (the house pattern — this tests the real functions, not a re-statement)
 * and drives them against an in-memory Firestore. The cases that matter:
 * a ♥ crosses, a CLEAR crosses (a stuck heart on the other surface was the
 * failure mode to design out), a urlKey match still finds the record, and a
 * picture the other surface doesn't hold writes nothing.
 *
 *   node scripts/test-vote-sync.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// Lift a function out of server.js by source.
function lift(name) {
  const i = serverSrc.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('no such function in server.js: ' + name);
  const body = serverSrc.slice(i);
  return body.slice(0, body.indexOf('\n}\n') + 2);
}
const liftAsync = (name) => {
  const i = serverSrc.indexOf('async function ' + name + '(');
  if (i < 0) throw new Error('no such async function in server.js: ' + name);
  const body = serverSrc.slice(i);
  return body.slice(0, body.indexOf('\n}\n') + 2);
};

// ── an in-memory Firestore, just deep enough for the two helpers ─────────
const DELETE = { __sentinel: 'delete' };
const state = {
  chatAssets: [],       // {chat, url, urlKey}
  runs: [],             // {id, images: [], votes: {}, updates: []}
  voteWrites: [],       // {id-ish chat|url, patch}
};
function query(rows) {
  return {
    where(field, op, val) {
      return query(rows.filter((r) => (op === 'array-contains'
        ? Array.isArray(r[field]) && r[field].includes(val)
        : r[field] === val)));
    },
    limit(n) { return query(rows.slice(0, n)); },
    async get() {
      return {
        empty: !rows.length,
        docs: rows.map((r) => ({
          data: () => r,
          ref: { update: async (patch) => { r.updates = (r.updates || []).concat([patch]); } },
        })),
      };
    },
  };
}
const fakeDb = {
  collection(name) {
    if (name === 'forge-chat-assets') return query(state.chatAssets);
    if (name === 'forge-promptlab') return query(state.runs);
    if (name === 'forge-asset-votes') {
      return {
        doc: (id) => ({
          set: async (patch) => { state.voteWrites.push({ id, patch }); },
        }),
      };
    }
    throw new Error('unexpected collection ' + name);
  },
};
const admin = {
  apps: [1],
  firestore: Object.assign(() => fakeDb, { FieldValue: { delete: () => DELETE } }),
};

/* eslint-disable no-eval */
const { syncVoteToAssets, syncVoteToPlayground } = eval(
  '(function (admin, require) {'
  + lift('canonicalAssetUrl') + lift('assetVoteRef')
  + liftAsync('syncVoteToAssets') + liftAsync('syncVoteToPlayground')
  + 'return { syncVoteToAssets, syncVoteToPlayground };})'
)(admin, require);
/* eslint-enable no-eval */

const PL_URL = 'https://storage.googleapis.com/b/promptlab/1755-abc.webp';

(async () => {
  console.log('playground ♥ → the Assets tabs');
  state.chatAssets = [
    { chat: 'witch-reels', url: PL_URL },
    { chat: 'dating-book', url: PL_URL + '?x=1', urlKey: PL_URL },  // urlKey match
  ];
  state.voteWrites = [];
  await syncVoteToAssets(PL_URL, 'like');
  ok(state.voteWrites.length === 2, 'every chat holding the picture gets the vote ('
    + state.voteWrites.length + ' of 2)');
  ok(state.voteWrites.every((w) => w.patch.vote === 'like'), 'and it is the ♥ she cast');
  ok(state.voteWrites.some((w) => w.patch.chat === 'dating-book'),
    'a record matched by urlKey is found too');

  state.voteWrites = [];
  await syncVoteToAssets(PL_URL, null);
  ok(state.voteWrites.length === 2 && state.voteWrites.every((w) => w.patch.vote === DELETE),
    'a CLEAR crosses as a clear — no stuck heart on the other surface');

  state.voteWrites = [];
  await syncVoteToAssets('https://storage.googleapis.com/b/promptlab/nobody-filed.webp', 'like');
  ok(state.voteWrites.length === 0, 'a picture no chat filed writes nothing');

  console.log('\nassets ♥ → the Playground run');
  state.runs = [{ id: 'r1', images: ['other.webp', PL_URL], votes: {} }];
  await syncVoteToPlayground(PL_URL, 'like');
  ok(state.runs[0].updates && state.runs[0].updates.length === 1
    && state.runs[0].updates[0]['votes.1'] === 'like',
    'the vote lands on the run doc at the RIGHT image index');

  await syncVoteToPlayground(PL_URL, null);
  ok(state.runs[0].updates.length === 2 && state.runs[0].updates[1]['votes.1'] === DELETE,
    'a clear crosses as a clear here too');

  state.runs[0].updates = [];
  await syncVoteToPlayground('https://storage.googleapis.com/b/witch-school/assets/x.png', 'like');
  ok(state.runs[0].updates.length === 0, 'a non-Playground picture never touches a run');

  console.log('\nboth routes actually call the sync');
  ok(/syncVoteToAssets\(url, vote\)/.test(serverSrc.slice(serverSrc.indexOf("app.post('/api/promptlab/:id/vote'"))),
    'the Playground vote route carries it across');
  ok(/syncVoteToPlayground\(url, vote\)/.test(serverSrc.slice(serverSrc.indexOf("app.post('/api/gallery/assets/vote'"))),
    'the Assets vote route carries it back');

  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
