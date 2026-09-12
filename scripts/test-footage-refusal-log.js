#!/usr/bin/env node
/* A REFUSED JOB IS LOGGED (2026-09-12, Sophie, after an OpenRouter refusal
   cost her a fifteen-second scene: "can you log refuse jobs?").

   Every door throws inside `startVideo` BEFORE `forge-video-jobs` is written,
   so until this a refusal was the one thing that left no trace anywhere — her
   prompt and her references lived only in the box she typed them in.

   Every assertion here is a MEASUREMENT of what really landed in the store,
   because a `refusedRecord` that builds a perfect doc and never reaches
   Firestore, one that writes a status no reader knows, and one whose own
   failure swallows the door's refusal all look identical in the source.

   Run: node scripts/test-footage-refusal-log.js */
const path = require('path');
const Module = require('module');

const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };

// ── an in-memory Firestore, and a door that refuses ──────────────────────
const written = [];
const fakeDb = {
  collection: () => ({
    doc: (id) => ({ set: async (doc) => { written.push({ id, doc }); } }),
    get: async () => ({ docs: [] }),
  }),
};
const ROOT = path.join(__dirname, '..');
const realResolve = Module._resolveFilename;
require.cache[require.resolve('firebase-admin')] = {
  id: 'firebase-admin', filename: 'firebase-admin', loaded: true,
  exports: { apps: [{}], firestore: () => fakeDb, storage: () => ({ bucket: () => null }) },
};
void realResolve;

const footage = require(path.join(ROOT, 'footage.js'));

function refusingDoor(message, refusal) {
  return {
    configured: () => true,
    startVideo: async () => { const e = new Error(message); e.refusal = refusal; throw e; },
  };
}
const JOB = {
  prompt: 'Voiceover: “It’s Sophie.”\n\nSophie [Image1], walking along a white path.',
  model: '2.5', seconds: 15, resolution: '480p', ratio: '9:16', sound: true, door: 'openrouter',
  refs: [{ url: 'https://example.com/sophie.png', kind: 'image', slot: '[Image1]', name: 'sophie.png' }],
  project: 'secretly-a-witch', folder: 'its-sophie',
};

(async () => {
  // ── 1. a content refusal is filed, with her words and her reference ────
  written.length = 0;
  footage.init({ openrouter: refusingDoor(
    'InputImageSensitiveContentDetected.PrivacyInformation: the input image may contain real person', 'content') });
  let threw = null;
  try { await footage.startJob({ ...JOB }); } catch (e) { threw = e; }

  ok('the refusal still reaches the caller', threw && /PrivacyInformation/.test(threw.message));
  ok('the refusal still names its door', threw && threw.door === 'openrouter');
  ok('exactly one doc was written', written.length === 1);

  const d = (written[0] || {}).doc || {};
  ok('her prompt is on the log, verbatim', d.prompt === JOB.prompt);
  ok('the reference url is on the log', (d.references && d.references.images || [])[0] === 'https://example.com/sophie.png');
  ok('the slot is kept on refs', (d.refs || []).some((r) => r.slot === '[Image1]' && r.url === 'https://example.com/sophie.png'));
  ok('the settings are on the log', d.seconds === 15 && d.resolution === '480p' && d.ratio === '9:16');
  ok('the project rides along', d.project === 'secretly-a-witch' && d.folder === 'its-sophie');

  // THE STATUS IS `failed`, NEVER A NEW WORD — an older cached page draws an
  // unknown status as a clip that draws forever.
  ok('the status is failed, not a new word', d.status === 'failed');
  ok('it is marked as a refusal', d.refused === true && d.refusal === 'content');
  ok('the door that refused it is named', d.door === 'openrouter');
  ok('the door\'s own words are kept', /PrivacyInformation/.test(d.error || ''));
  ok('her own line explains it', /real face|real person|blur/i.test(d.why || ''));
  ok('it does not sit drawing forever', Boolean(d.doneAt));
  ok('the id is the doc id', Boolean(written[0]) && written[0].id === d.job && String(d.job).length > 8);

  // ── 2. a SHAPE refusal is filed too ───────────────────────────────────
  written.length = 0;
  footage.init({ openrouter: refusingDoor('reference media cannot be combined with a first frame', 'shape') });
  try { await footage.startJob({ ...JOB }); } catch (e) { void e; }
  ok('a shape refusal is logged as well', written.length === 1 && written[0].doc.refusal === 'shape');

  // ── 3. A LOG THAT FAILS MUST NOT SWALLOW THE REFUSAL ──────────────────
  // Her words reaching her matters more than the record of them.
  written.length = 0;
  const bad = { collection: () => ({ doc: () => ({ set: async () => { throw new Error('firestore is down'); } }) }) };
  fakeDb.collection = bad.collection;
  footage.init({ openrouter: refusingDoor('InputImageSensitiveContentDetected.PrivacyInformation', 'content') });
  let second = null;
  try { await footage.startJob({ ...JOB }); } catch (e) { second = e; }
  ok('a dead log still lets the refusal through', second && /PrivacyInformation/.test(second.message));
  ok('a dead log does not become a different error', second && !/firestore/i.test(second.message));

  if (fails.length) { console.error('FAIL:'); fails.forEach((f) => console.error(' -', f)); console.error(`${pass} passed, ${fails.length} failed`); process.exit(1); }
  console.log(`all good — ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
