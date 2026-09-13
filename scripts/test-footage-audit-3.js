#!/usr/bin/env node
/* THE THREE AUDITS' OWN FINDINGS (2026-09-13, Sophie: "then find more") —
 * three read-only sweeps over footage.js, the page's player/trimmer/cast
 * areas and the shared modules; these pin the ones fixed in the same pass.
 *
 * Pure where the rule is pure. Every one is a case where the broken version
 * and the fixed version read the same in the source: a canvas silently
 * borrowed from the 480p row, a refusal filed under a label nothing matches,
 * a price map replaced rather than merged, a reference dropped rather than
 * refused, and a job that says "drawing" forever while it drains reads.
 *
 * Run: node scripts/test-footage-audit-3.js
 */
'use strict';
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };

const F = require('../footage');
const V = require('../video-refusals');

// ── 1080p IS NOT PRICED OFF THE 480p CANVAS ───────────────────────────────
// 2.0 offers 1080p and was moved onto the 2.5 canvas table, which has no
// 1080p row — so `fam[res] || fam['480p']` quoted every 1080p clip at the
// 480p pixel count: ~30¢ for a 4s 2.0 1080p 16:9 clip against a real ~151¢,
// and CHEAPER than the same clip at 720p.
{
  const m = F.modelOf('2.0');
  const c = (r) => F.canvasOf(m, r, '16:9').join('x');
  ok('2.0 at 1080p is the 1080p canvas, borrowed from its family — ' + c('1080p'), c('1080p') === '1920x1080');
  ok('and 480p/720p are still its own table\'s (the measured 2.5 shapes)', c('480p') === '854x480' && c('720p') === '1280x720');
  ok('`canvasFrom` says where the row came from',
    F.canvasFrom(m, '480p') === 'own' && F.canvasFrom(m, '1080p') === 'family');
  const at = (r) => F.priceOn(m, 'openrouter', { res: r, ratio: '16:9', seconds: 4, discount: 0 }).cents;
  ok('so 1080p costs MORE than 720p rather than less — ' + at('720p') + ' then ' + at('1080p'), at('1080p') > at('720p'));
  ok('and the 1080p figure is the real canvas\'s, ~151¢ not ~30¢', Math.round(at('1080p')) === 151);
  ok('a borrowed canvas can never answer `exact`',
    !F.priceOn(F.modelOf('mini'), 'openrouter', { res: '480p', ratio: '16:9', seconds: 4, discount: 0 }).about
    && F.priceOn(m, 'openrouter', { res: '1080p', ratio: '16:9', seconds: 4, discount: 0 }).about === true);
}

// ── A REFERENCE THE MODULE WILL NOT SEND REFUSES THE JOB ─────────────────
// The filter ran BEFORE `slotsOf`, so a url failing the http test vanished
// and every slot after it renumbered while her prompt named the old numbers.
{
  const good = { url: 'https://x/a.png', kind: 'image' };
  ok('two good references number 1 and 2',
    F.buildJob({ prompt: 'x', refs: [good, { url: 'https://x/b.png', kind: 'image' }] })
      .refs.map((r) => r.slot).join() === '[Image1],[Image2]');
  ok('a bad one refuses rather than renumbering around itself',
    /not a url the doors can fetch/.test(F.buildJob({ prompt: 'x', refs: [good, { url: 'b.png' }] }).error || ''));
  ok('two bad ones say how many', /2 references are not urls/.test(F.buildJob({ prompt: 'x', refs: [{ url: 'a' }, { url: 'b' }] }).error || ''));
  ok('a keyframe url the doors cannot fetch refuses the job — it used to ride as an ordinary reference',
    /keyframe is not a url/.test(F.buildJob({ prompt: 'x', lastFrameUrl: 'frame.png' }).error || ''));
  ok('and a keyframe that IS a url still takes no slot',
    F.buildJob({ prompt: 'x', firstFrameUrl: 'https://x/f.png',
      refs: [{ url: 'https://x/f.png', kind: 'image' }, good] }).refs.filter((r) => r.slot).map((r) => r.slot).join() === '[Image1]');
}

// ── A REFUSED JOB SPEAKS THE DOORS' OWN VOCABULARY ───────────────────────
// It was filed under the model's LABEL and under `params.ratio`, so `cardOf`
// found no model row — and the page gates "Try again" on `modelOf(j.model)`,
// so a refused Fast or 2.5 scene put back from its own card drew on MINI.
{
  const c = F.cardOf('r1', { prompt: 'p', model: '2.5', status: 'failed', error: 'x',
    params: { duration: 15, resolution: '720p', aspect_ratio: '9:16' } });
  ok('a refusal filed with our own model id resolves its row — ' + c.model + ' / ' + c.modelLabel,
    c.model === '2.5' && /2\.5/.test(c.modelLabel || ''));
  ok('and its shape reads back, so it is searchable and diffs honestly', c.ratio === '9:16' && c.resolution === '720p');
  ok('a door\'s own model id still resolves', F.cardOf('r2', { prompt: 'p', model: F.modelOf('mini').atlas, params: {} }).model === 'mini');
}

// ── A JOB THE DOOR NEVER ANSWERS FOR STOPS BEING "DRAWING" ───────────────
// Nothing aged a job out, so a job whose poll always throws said "drawing…"
// forever — and `/jobs` reads the whole collection every 7s while anything
// is drawing, so one stuck clip cost ~70 document reads a second.
{
  const old = new Date(Date.now() - 3 * 3600e3).toISOString();
  const fresh = new Date(Date.now() - 60e3).toISOString();
  ok('two hours with no answer reads as failed', F.statusOf({ status: 'sent', sentAt: old }) === 'failed');
  ok('a minute old is still drawing', F.statusOf({ status: 'sent', sentAt: fresh }) === 'drawing');
  ok('a FINISHED clip is never aged out whatever its date',
    F.statusOf({ status: 'completed', sentAt: old }) === 'done' && !F.staleJob({ status: 'completed', sentAt: old }));
  ok('a doc with no date at all is left alone rather than guessed stale', !F.staleJob({ status: 'sent' }));
  ok('and the card says what happened, in her words',
    /never answered/.test(F.cardOf('s1', { prompt: 'p', status: 'sent', sentAt: old, params: {} }).why || ''));
  ok('nothing is WRITTEN — the reason is derived, so a job that lands later is still the record',
    F.staleJob({ status: 'sent', sentAt: old }) === true);
}

// ── THE REFUSAL TABLE READS A CODE UNDER EITHER SPELLING ─────────────────
{
  const c = F.cardOf('e1', { prompt: 'p', status: 'failed', params: {},
    error: 'The generated content may contain sensitive information', error_code: 1012006, door: 'atlascloud' });
  ok('a wording the table has not met still finds its line by CODE — ' + String(c.why).slice(0, 40), !!c.why);
}

// ── AN OVERSIZE REFERENCE VIDEO IS NOT DIAGNOSED AS "TOO SMALL" ──────────
// ByteDance sends the SAME sentence for both ends of the range, and the one
// row said "too small … the page upscales these by itself now; send it
// again" — so a 4K reference was told the fix was already in, forever.
{
  const small = V.explain('InputVideoPixelCountTooSmall: Pixel count must be between 407696 and 8295044.');
  const big = V.explain('InputVideoPixelCountTooLarge: Pixel count must be between 407696 and 8295044.');
  const both = V.explain('InvalidParameter: Pixel count must be between 407696 and 8295044.');
  ok('too small still says the page upscales it — send it again', /too small/.test(small.line) && /send it again/.test(small.line));
  ok('too BIG says so, and says nothing here shrinks one', /too BIG/.test(big.line) && /[Nn]othing here shrinks/.test(big.line));
  ok('the bare range sentence names BOTH ends rather than guessing', /0\.4 and 8\.3/.test(both.line) && /[Nn]othing here shrinks/.test(both.line));
  ok('and none of the three claims a fix she has already had', !/upscales these by itself now; send it again/.test(big.line));
  ok('all three are free shape refusals', small.kind === 'shape' && big.kind === 'shape' && both.kind === 'shape' && both.free === true);
}

// ── A PARTIAL ATLAS PRICE READ KEEPS THE ROWS IT DID NOT ANSWER FOR ──────
// The guard protected an EMPTY answer and not an incomplete one, so one
// missing row dropped that model to the table's LIST rate for ten minutes —
// and since the door is chosen by price, ~3x billing, silently.
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'footage.js'), 'utf8');
  ok('the read is MERGED onto the last good map',
    /val: Object\.keys\(out\)\.length \? \{ \.\.\.atlasCache\.val, \.\.\.out \} : atlasCache\.val/.test(src));
  ok('every trim write is pinned to the read it was planned from', /const trimTx = \(id, work\)/.test(src) && /runTransaction/.test(src));
  ok('the poll stops asking about a stale job', /if \(staleJob\(x\.d\)\) return;/.test(src));
}

// ── THE PAGE'S TWO, BY SOURCE (the headless half lives in audit-2) ───────
{
  const page = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'footage.html'), 'utf8');
  ok('a look that owns a marked picture does not attach it twice',
    /before\.forEach\(function \(r\) \{ if \(roleOfUrl\(r\.url\)\) isMark\[r\.url\] = 1; \}\)/.test(page));
  ok('and its line is re-resolved against the strip that really rides',
    /function castLine\(p, ent, look\)/.test(page) && /castLine\(p, ent, look\)/.test(page));
  ok('`newer ›` never steps past the clip the panel was opened on', /idx - 1 > ib \? sib\[idx - 1\] : null/.test(page));
  ok('a failed save-all fetch is retried rather than cached', /delete saveBlobs\[u\]; return null/.test(page));
  ok('and save-all answers "not ready" BEFORE awaiting the bytes', /var ready = urls\.every/.test(page) && /function markDone\(u\)/.test(page));
}

if (fails.length) {
  console.log('FOOTAGE AUDIT 3 — ' + pass + ' passed, ' + fails.length + ' FAILED');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('FOOTAGE AUDIT 3 — ' + pass + ' passed');
