#!/usr/bin/env node
// WHICH ELEVENLABS GENERATION IS THIS KILLED RENDER — voicelab-recover.js,
// pure, no network, no node_modules.
//
// A Voice Studio render is a fire-and-forget background job, so a deploy kills
// it between "ElevenLabs finished the audio" and "we saved it" and the doc
// sits on `rendering` forever. The audio survives in ElevenLabs' own history
// and comes back free, so the recovery is worth having — and the ONE thing it
// must never do is hand her the wrong take. She re-renders the same words over
// and over (six "magic pills" takes in ninety seconds), so these are the cases
// that matter:
//
//   * her real killed render is found (the 2026-08-27 Max take),
//   * a stuck take never steals the generation a finished take already used,
//   * a conversion, which carries no words of its own, is refused when two of
//     them sit in the same window rather than guessed at,
//   * and the request id, when there is one, beats every heuristic.
//
//   node scripts/test-voicelab-recover.js
const fs = require('fs');
const path = require('path');
const { pickHistoryItem } = require('../voicelab-recover');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}
const iso = (t) => new Date(t).toISOString();
const unix = (t) => Math.floor(t / 1000);

// ── 1. her real killed render (measured off the live data) ───────────
// doc created 2026-08-27T03:16:30.358Z, the generation stamped 03:17:18 —
// 48 seconds of generation time between the two.
const MAX = 'dqbqOZM4uhsyx1WtTAgT';
const T0 = Date.parse('2026-08-27T03:16:30.358Z');
const HERS = {
  id: 'vle76c77d7c788', kind: 'tts', voiceId: MAX, status: 'rendering',
  text: 'It’s not a coincidence that two things often trade places in public opinion.',
  createdAt: iso(T0),
};
const HER_ITEM = {
  history_item_id: 'k5uxbm5pMZ53qHwPRQnZ', request_id: 'LrLd88lx4mIb3KGkc9fp',
  voice_id: MAX, source: 'TTS', date_unix: unix(T0 + 48000), text: HERS.text,
};

let r = pickHistoryItem(HERS, [HER_ITEM]);
ok(r.item === HER_ITEM && r.by === 'text+voice+time',
  'her killed Max take finds its own generation, 48s later');

// The generation is stamped AFTER the doc, always — so an item BEFORE it, past
// the skew slack, is somebody else's.
ok(pickHistoryItem(HERS, [{ ...HER_ITEM, date_unix: unix(T0 - 5 * 60 * 1000) }]).item === null,
  'a generation five minutes BEFORE the render is not this render');
ok(pickHistoryItem(HERS, [{ ...HER_ITEM, date_unix: unix(T0 - 20 * 1000) }]).item === HER_ITEM.history_item_id
  || pickHistoryItem(HERS, [{ ...HER_ITEM, date_unix: unix(T0 - 20 * 1000) }]).item !== null,
  'a few seconds of clock skew either way is still a match');
ok(pickHistoryItem(HERS, [{ ...HER_ITEM, date_unix: unix(T0 + 40 * 60 * 1000) }]).item === null,
  'a generation forty minutes later is not this render');
ok(pickHistoryItem(HERS, [{ ...HER_ITEM, voice_id: 'someoneelsevoiceid00' }]).item === null,
  'the same words in another voice is another take');
ok(pickHistoryItem(HERS, [{ ...HER_ITEM, text: 'It’s not a coincidence that two things often trade places.' }]).item === null,
  'nearly her words is not her words — TTS matches EXACTLY');
ok(pickHistoryItem(HERS, [{ ...HER_ITEM, text: `  ${HERS.text}  ` }]).item !== null,
  'but whitespace either end is not a difference');
ok(pickHistoryItem(HERS, [{ ...HER_ITEM, source: 'STS' }]).item === null,
  'a CONVERSION never answers for a TTS render');
ok(pickHistoryItem({ ...HERS, createdAt: null }, [HER_ITEM]).item === null,
  'a render with no start time is refused rather than matched on text alone');
ok(pickHistoryItem(HERS, []).item === null && pickHistoryItem(HERS, []).why,
  'nothing in the history answers with a reason, never a throw');

// ── 2. the request id beats every heuristic ──────────────────────────
const byId = pickHistoryItem({ ...HERS, requestId: 'LrLd88lx4mIb3KGkc9fp' },
  [{ ...HER_ITEM, date_unix: unix(T0 - 3 * 60 * 60 * 1000), text: 'something else entirely' }]);
ok(byId.item !== null && byId.by === 'request-id',
  'the request id matches outright — no window, no text');
ok(pickHistoryItem({ ...HERS, requestId: 'nope' }, [HER_ITEM]).item === HER_ITEM,
  'a request id that matches nothing falls through to the heuristics');

// ── 3. she renders the same words over and over ──────────────────────
// The six "magic pills" takes, ninety seconds apart. One died; the other five
// finished normally and are USING their generations.
const PILLS = 'someone gave me these magic pills yesterday';
const takes = [0, 22000, 43000, 65000].map((d, i) => ({
  id: `vlpill${i}`, kind: 'tts', voiceId: MAX, text: PILLS,
  createdAt: iso(T0 + d), status: i === 2 ? 'rendering' : 'done',
}));
const pillItems = [0, 22000, 43000, 65000].map((d, i) => ({
  history_item_id: `pill${i}`, voice_id: MAX, source: 'TTS',
  date_unix: unix(T0 + d + 2000), text: PILLS,
}));
const stuckPill = takes[2];
r = pickHistoryItem(stuckPill, pillItems, { others: takes });
ok(r.item && r.item.history_item_id === 'pill2',
  'of four identical takes, the killed one claims the generation stamped in ITS window');
ok(pickHistoryItem(takes[0], pillItems, { others: takes }).item.history_item_id === 'pill0',
  'and each of the others still points at its own');
ok(pickHistoryItem(stuckPill, pillItems, { others: takes, claimed: ['pill2'] }).item === null,
  'a generation another take already saved is never handed over twice');

// With the neighbours unknown to the matcher it would take the nearest one
// anyway — the `others` list is what makes that reliable rather than lucky.
r = pickHistoryItem(stuckPill, [pillItems[1], pillItems[3]], { others: takes });
ok(r.item === null,
  'if only OTHER takes\' generations are on offer, it refuses rather than pick one');

// ── 4. a conversion has no words to be told apart by ─────────────────
const sts = { id: 'vlsts1', kind: 'sts', voiceId: MAX, createdAt: iso(T0), status: 'rendering' };
const conv = (n, d) => ({ history_item_id: n, voice_id: MAX, source: 'STS',
  date_unix: unix(T0 + d), text: 'the trouble is, science no longer agrees with science' });
ok(pickHistoryItem(sts, [conv('c1', 20000)]).item.history_item_id === 'c1',
  'one conversion in the window is that conversion');
ok(pickHistoryItem(sts, [conv('c1', 20000)]).by === 'voice+time',
  'and it says which rule found it');
r = pickHistoryItem(sts, [conv('c1', 20000), conv('c2', 60000)]);
ok(r.item === null && /more than one/.test(r.why || ''),
  'TWO conversions in one window are refused — guessing hands her another take\'s audio');
ok(pickHistoryItem(sts, [{ ...conv('c1', 20000), source: 'TTS' }]).item === null,
  'a TTS generation never answers for a conversion');
ok(pickHistoryItem({ ...sts, requestId: 'rq9' },
  [{ ...conv('c1', 20000), request_id: 'rq9' }, conv('c2', 60000)]).by === 'request-id',
  'but with a request id even two conversions are unambiguous');

// ── 5. the wiring — the module really is what voicelab.js asks ───────
const src = fs.readFileSync(path.join(__dirname, '..', 'voicelab.js'), 'utf8');
ok(/require\('\.\/voicelab-recover'\)/.test(src),
  'voicelab.js reads the matcher from this file, never a second copy of the rules');
ok(/setInterval\(sweepStuckRenders/.test(src) && /setTimeout\(sweepStuckRenders/.test(src),
  'the sweep runs shortly after boot AND on an interval (a deploy is exactly when this is needed)');
ok(/status === 'rendering'/.test(src) && /STUCK_AFTER_MS/.test(src),
  'the sweep is scoped to renders still saying `rendering` past a cutoff');
const sweep = src.slice(src.indexOf('async function sweepStuckRenders'));
ok(sweep.indexOf('recoverRender(') > -1
  && sweep.indexOf('recoverRender(') < sweep.indexOf("status: 'failed'")
  && /if \(done\) continue;/.test(sweep),
  'recovery is tried BEFORE a stuck render is marked failed — paid work is never written off first');
const jobBody = (name) => {
  const from = src.indexOf(`async function ${name}(`);
  return src.slice(from, src.indexOf('\n}\n', from));
};
['renderJob', 'changeJob'].forEach((n) => {
  const b = jobBody(n);
  ok(b.indexOf('stampRequestId(id, res)') > -1 && b.indexOf('stampRequestId(id, res)') < b.indexOf('.buffer()'),
    `${n} stamps the request id from the response headers — before the body, before the upload`);
});
ok(/async function saveTake/.test(src) && (src.match(/saveTake\(/g) || []).length >= 4,
  'one finishing tail, shared by the render, the changer and the recovery');
ok(!/\/text-to-speech\//.test(src.slice(src.indexOf('async function recoverRender'))),
  'the recovery never re-renders — it only ever asks the history for what was already paid for');

console.log(failures ? `\n${failures} FAILED` : '\nall good');
process.exit(failures ? 1 : 0);
