#!/usr/bin/env node
// test-filmeditor.js — the Film Editor's pure pieces (no network), plus the
// static page contracts. Run: node scripts/test-filmeditor.js
//
// The pure half drives filmeditor.js's exported functions: the piece
// normalizer (clamping, sliver-dropping, unknown lengths staying null), the
// split arithmetic (two references into one source, refusal near the edges),
// the audio-track normalizer, and the mix graph (normalize=0 is load-bearing
// — amix's default halves both voices).
// The page half asserts the contracts that keep shipping broken when skipped:
// the IIFE, the [hidden] rule, no gradients, the title once, empty boxes.

const fs = require('fs');
const path = require('path');

const fe = require('../filmeditor');

let pass = 0;
let failCount = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok — ' + name); }
  else { failCount++; console.log('  FAIL — ' + name); }
}

console.log('cleanPieces:');
{
  const c = fe.cleanPieces([
    { key: 'a', url: 'https://x/y.mp4', seconds: 10, in: 0, out: 10, title: 't', poster: null },
    { key: 'b', url: 'https://x/y.mp4', seconds: 10, in: 2.5, out: 7.25 },
    { key: 'sliver', url: 'https://x/y.mp4', seconds: 10, in: 5, out: 5.05 },
    { key: 'nourl', url: 'ftp://nope', seconds: 5, in: 0, out: 5 },
    { key: '', url: 'https://x/z.mp4', seconds: 5, in: 0, out: 5 },
    { key: 'clamp', url: 'https://x/z.mp4', seconds: 8, in: -3, out: 99 },
    { key: 'unknown', url: 'https://x/w.mp4', seconds: null, in: 0, out: 6 },
  ]);
  ok(c.length === 4, 'keeps the valid pieces, drops sliver / bad url / no key');
  ok(c[0].out === 10 && c[1].in === 2.5 && c[1].out === 7.25, 'spans survive verbatim');
  ok(c[3].seconds === null, 'an unknown source length stays null, never a confident 0');
  const clamp = c.filter((p) => p.key === 'clamp')[0];
  ok(clamp.in === 0 && clamp.out === 8, 'in/out clamp to the source');
  ok(fe.cleanPieces(null).length === 0 && fe.cleanPieces('x').length === 0, 'garbage in, empty out');
}

console.log('pieceSeconds / totalSeconds:');
{
  ok(fe.pieceSeconds({ in: 2, out: 7.5 }) === 5.5, 'a piece is out minus in');
  ok(fe.totalSeconds([{ in: 0, out: 4 }, { in: 2, out: 5 }]) === 7, 'the cut is the sum of its pieces');
}

console.log('splitPiece:');
{
  const p = { key: 'a', url: 'https://x/y.mp4', seconds: 10, in: 2, out: 8, title: 't', poster: null };
  const pair = fe.splitPiece(p, 2.5, 'newkey');
  ok(!!pair, 'a mid-piece split works');
  ok(pair[0].out === 4.5 && pair[1].in === 4.5, 'the two halves meet exactly at the cut');
  ok(pair[0].key === 'a' && pair[1].key === 'newkey', 'the second half gets the new key');
  ok(pair[0].url === pair[1].url, 'both halves reference the SAME source');
  ok(Math.abs(fe.pieceSeconds(pair[0]) + fe.pieceSeconds(pair[1]) - fe.pieceSeconds(p)) < 1e-9,
    'nothing is lost across a split');
  ok(fe.splitPiece(p, 0.05, 'k') === null, 'a split at the very start is refused');
  ok(fe.splitPiece(p, 5.95, 'k') === null, 'a split at the very end is refused');
}

console.log('cleanAudio:');
{
  const a = fe.cleanAudio({ url: 'https://x/a.mp3', name: 'song', offset: 3.2 });
  ok(a && a.offset === 3.2 && a.name === 'song', 'a real track survives');
  ok(fe.cleanAudio({ url: 'https://x/a.mp3', offset: -4 }).offset === 0, 'a negative offset lands on 0');
  ok(fe.cleanAudio(null) === null && fe.cleanAudio({ url: 'nope' }) === null, 'no track is null');
}

console.log('mixGraph:');
{
  const g = fe.mixGraph(2.5);
  ok(g.indexOf('adelay=2500|2500') !== -1, 'the offset lands as milliseconds on both channels');
  ok(g.indexOf('normalize=0') !== -1, 'normalize=0 — amix must not halve both voices');
  ok(fe.mixGraph(0).indexOf('adelay=0|0') !== -1, 'offset 0 still builds a valid graph');
}

console.log('preview proxies:');
{
  ok(/^[0-9a-f]{40}$/.test(fe.proxyId('https://x/y.mp4')), 'the proxy id is a sha1 of the url');
  ok(fe.proxyId('https://x/a.mp4') !== fe.proxyId('https://x/b.mp4'), 'different urls, different ids');
  // her real case, measured 2026-08-22: 784x1168 at 19 Mbps stalls the player
  ok(fe.proxyNeeded({ seconds: 5.2, width: 784, height: 1168 }, 12336709) === true,
    'a 19 Mbps Midjourney export gets a proxy');
  ok(fe.proxyNeeded({ seconds: 5.2, width: 484, height: 720 }, 277669) === false,
    'a small light file streams as itself — no proxy');
  ok(fe.proxyNeeded({ seconds: 5.2, width: 3840, height: 2160 }, 1000000) === true,
    'a big frame needs shrinking even at a low bitrate');
  const args = fe.proxyArgs('/in', '/out.mp4', true).join(' ');
  ok(args.indexOf('force_original_aspect_ratio=decrease') !== -1
    && args.indexOf('+faststart') !== -1, 'the bake caps the frame and fronts the moov');
  ok(fe.proxyArgs('/in', '/o', false).join(' ').indexOf('-an') !== -1,
    'a silent source bakes a silent proxy');
  // The music track's own proxy (2026-08-23 — her real track was a 13.9MB
  // 480p VIDEO mp4 streamed through the <audio> element).
  ok(fe.audioProxyId('https://x/y.mp4') === fe.proxyId('https://x/y.mp4') + '-aud',
    'the audio proxy lives beside the video proxy, never over it');
  ok(fe.audioProxyNeeded({ hasVideo: true, hasAudio: true }, 500000) === true,
    'a VIDEO file used as a music track always gets an audio-only copy');
  ok(fe.audioProxyNeeded({ hasVideo: false, hasAudio: true }, 3 * 1024 * 1024) === false,
    'a small pure-audio file streams as itself');
  ok(fe.audioProxyNeeded({ hasVideo: false, hasAudio: true }, 40 * 1024 * 1024) === true,
    'a heavy audio file still gets shrunk');
  const aargs = fe.audioProxyArgs('/in', '/out.m4a').join(' ');
  ok(aargs.indexOf('-vn') !== -1 && aargs.indexOf('+faststart') !== -1,
    'the audio bake drops the video stream and fronts the moov');
}

console.log('trimmedCut:');
{
  const t = fe.trimmedCut({
    id: 'x', title: 'T',
    clips: [{ in: 0, out: 4, poster: 'https://p' }, { in: 1, out: 3 }],
    audio: { url: 'https://a' }, renders: [{}, {}],
    job: { status: 'running', kind: 'render', label: 'l' }, updatedAt: 5,
  });
  ok(t.pieces === 2 && t.seconds === 6 && t.renders === 2, 'counts derive from the pieces');
  ok(t.hasAudio === true && t.poster === 'https://p', 'audio flag + first poster ride along');
  ok(t.job && t.job.kind === 'render', 'a running job shows; a finished one would not');
}

console.log('the page contracts (static):');
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'filmeditor.html'), 'utf8');
  ok(/\(function \(\)/.test(html), 'the page script is wrapped in an IIFE (the injected-pill rule)');
  ok(/\[hidden\]\{ display:none !important; \}/.test(html), '[hidden] wins over author display rules');
  ok(!/gradient/i.test(html), 'NO gradients — anywhere (the prototype had three)');
  ok((html.match(/tool-eyebrow/g) || []).length === 1, 'the title appears once (?embed=1 hides it)');
  ok(!/placeholder=/.test(html), 'no placeholder text in any box she writes in');
  ok(/pointer-events:none/.test(html), 'dimmed tools are inert, never tappable ghosts');
  ok(/overflow-x:auto/.test(html), 'the timeline scrolls instead of running off the screen');
  ok(/id="vA"/.test(html) && /id="vB"/.test(html), 'two video elements — a source boundary must not flash');
  ok(/window\.__navBack/.test(html), 'the native chevron can walk open → shelf');
  ok(/helpcard/.test(html), 'the instructions live behind the "?"');
  // Sophie's live bugs, 2026-08-22 — all three were object-identity or
  // stale-clock mistakes in the playback engine. Pinned so they stay dead.
  ok(/next\.c\.key === seg\.c\.key/.test(html),
    'end-of-film compares KEYS, not object identity (the last-clip loop)');
  ok(!/next === seg/.test(html), 'the identity comparison is gone outright');
  ok((html.match(/lastTs = null/g) || []).length >= 3,
    'the tick clock resets on every play AND stop (the instant-skip bug)');
  ok(/Math\.min\(0\.1, \(ts - lastTs\)/.test(html),
    'a late frame nudges the playhead, never flings it');
  ok(!/var cur = segAt\(playhead\)/.test(html),
    'the strip finds the current piece in its OWN array (the invisible playhead)');
  ok(/at >= 0 && a\.getAttribute\('data-src'\) === audSrc\(\)/.test(html),
    'the audio track starts when the playhead crosses its offset mid-play');
  // Her "fine for a while, then choppy at 3/4" (2026-08-23): joint holds
  // accumulate as music drift, and the old hard >0.5s reseek yanked the
  // track backward once the film had enough joints behind it. Paced now.
  ok(/function audioPace/.test(html) && /playbackRate/.test(html),
    'moderate music drift is PACED with a 4% rate lean, never seeked');
  ok(/Math\.abs\(dr\) > 2/.test(html),
    'only a drift past 2s — a broken state — is hard-resynced');
  ok(/function audSrc/.test(html) && /PROXY_AUD/.test(html),
    'the music track plays its audio-only baked copy when one exists');
  // The lag-and-leap playhead + the music chop, 2026-08-23: iOS batches the
  // quality counters, so the frame truth is rVFC where it exists, the
  // counter hold is capped, and a joint never seeks a running music track.
  ok(/requestVideoFrameCallback/.test(html) && /armFrameWatch/.test(html),
    'the frame truth is per PRESENTED frame (rVFC), not the batched counters');
  ok(/ts - frameAt > 350 && ts - frameAt < 1200/.test(html),
    'a flatlined frame counter can never hold the playhead forever');
  ok(/getVideoPlaybackQuality/.test(html),
    'the playhead holds when no new frame has been decoded (the waffle guard)');
  ok(!/a\.paused \|\| drift > 0\.35/.test(html),
    'a joint never yanks a RUNNING music track back to a lagging playhead');
  ok(/addEventListener\('canplay', reveal/.test(html),
    'the old frame stays up until the new source can paint (no black gap)');
  // The little-pauses chop, 2026-08-23: #1564 fixed seek-at-every-joint for
  // the AUDIO track only — the video half lived on. Pinned both ways.
  ok(/function warmNext/.test(html),
    'the idle element is PARKED on the next joint\'s frame, not merely loaded');
  ok(/seekless/.test(html),
    'an element already on the joint\'s frame is never re-seeked (the visible hiccup)');
  ok(/function srcOf/.test(html) && /askProxies/.test(html),
    'the player prefers the baked preview copy; the render keeps the original');
  // The music "starts late" + "keeps pausing about 3/4 of the way through"
  // (Sophie, 2026-08-23, round two): iOS treats preload=auto as a SUGGESTION
  // on <audio> exactly as on <video>, so the track's fetch began at her play
  // tap (the late start) and the buffer ran dry mid-film (the pause) — the
  // warmNext lesson, never applied to the audio element. Three pins:
  ok(/function primeAudio/.test(html) && /canplaythrough/.test(html),
    'the track is PRIMED — a muted play forces the fetch before the play tap');
  ok(/pointerdown', function \(\) \{ primeAudio\(\)/.test(html),
    'a refused no-gesture prime retries on her next tap');
  ok(/audEntry/.test(html) && /addEventListener\('playing'/.test(html),
    'the track re-aligns the moment it actually STARTS sounding (entry, never a joint)');
  ok(/if \(!\$\('audEl'\)\.seeking\) \{\s*\n\s*audEntry = true;/.test(html),
    'a seek\'s own waiting echo never arms the entry realign (pacing owns a rolling track)');
  ok(/a\.seeking \|\| a\.readyState < 3/.test(html),
    'a stalled clock is not drift — pacing and the 2s resync skip a buffering track');
  // Round three (2026-08-23, on the phone): "lagging playhead … black
  // sometimes" survived every Chromium-verified fix. Device-shaped guards:
  ok(/el\.__frameAt && fAge > 350 && fAge < 1200/.test(html),
    'the rVFC playhead hold is CAPPED — an under-delivering rVFC cannot lag the playhead');
  ok(/el\.readyState >= 2 && \(el\.__frameAt \|\| !el\.__rvfc\)/.test(html),
    'a boundary reveals on a PRESENTED frame, not canplay (iOS paints later than Chromium)');
  ok((html.match(/el\.__frameAt = 0/g) || []).length >= 2,
    'the presented-frame mark is cleared on every src set (ensureSrc and warmNext)');
  ok(/var BUILD = 'fe-/.test(html) && /function telSend/.test(html) && /telSend\(\)/.test(html),
    'every play session posts a telemetry beacon — the device answers, not a guess');
  ok(html.indexOf('id="msg"') > html.indexOf('</div>', html.indexOf('id="tools"')),
    'the progress line lives OUTSIDE the editor panel, visible on first upload');
}

console.log('');
console.log(pass + ' passed, ' + failCount + ' failed');
process.exit(failCount ? 1 : 0);
