'use strict';
// atlascloud.js — a prediction Atlas has FAILED comes back under HTTP 400
// with the record in the body. The poll must read it as the answer (status
// failed + the error text), never as a transport error that leaves the card
// "drawing" forever. Drives the real pollVideo over a stubbed node-fetch with
// the exact body Atlas answered on 2026-09-10. No network.
const path = require('path');
let fails = 0;
function ok(n, c, x) { if (c) console.log('  ok   ' + n); else { fails++; console.log('  FAIL ' + n + (x ? '\n       ' + x : '')); } }
console.log('atlascloud: a failed prediction under a 400');

const ERR = 'Total duration of all reference videos must not exceed 15.2 seconds. Please shorten or remove some reference videos and try again.';
const BODY = JSON.stringify({ code: 400, message: ERR, data: {
  id: 'abc123', model: 'bytedance/seedance-2.0-mini/reference-to-video', outputs: null,
  status: 'failed', created_at: '2026-09-10T18:41:06.811Z', error: ERR, error_code: 1013030,
  executionTime: 0, latency_ms: 1610, completed_at: '2026-09-10T18:41:08.428Z' } });

// stub node-fetch BEFORE the module loads it
const calls = [];
let answer = { status: 400, text: BODY };
const fakeFetch = async (url) => { calls.push(String(url)); return { ok: answer.status < 400, status: answer.status, text: async () => answer.text }; };
require.cache[require.resolve('node-fetch')] = { id: 'node-fetch', filename: 'node-fetch', loaded: true, exports: fakeFetch };
process.env.ATLASCLOUD_API_KEY = 'test';
const a = require(path.join(__dirname, '..', 'atlascloud.js'));

(async () => {
  const r = await a.pollVideo('abc123');
  ok('the poll answers instead of throwing', r && r.id === 'abc123');
  ok('the status is failed', r.status === 'failed', JSON.stringify(r && r.status));
  ok('the patch marks the doc failed with Atlas\'s own words', r.patch && r.patch.status === 'failed' && r.patch.error === ERR, JSON.stringify(r && r.patch));
  ok('nothing is mirrored and no cost is invented', !r.video && !('cost' in (r.patch || {})));
  ok('one read of the prediction, nothing retried', calls.length === 1 && /\/model\/prediction\/abc123$/.test(calls[0]));

  // a 400 that carries NO record is still an error
  answer = { status: 400, text: JSON.stringify({ code: 400, message: 'bad id' }) };
  let threw = null; try { await a.pollVideo('nope'); } catch (e) { threw = e; }
  ok('a 400 without a prediction record still throws', threw && threw.status === 400);
  // a gateway page on a 5xx is still "down"
  answer = { status: 503, text: '<html>gateway</html>' };
  threw = null; try { await a.pollVideo('x'); } catch (e) { threw = e; }
  ok('a gateway 5xx is still the down error', threw && threw.refusal === 'down');
  ok('failedRecord is pure and exported', a.failedRecord({ body: BODY }).data.status === 'failed' && a.failedRecord({ body: 'x' }) === null);
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
})();
