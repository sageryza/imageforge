// christmas-vo-page — every voiceover from the Christmas clips, as SEPARATE
// audio, on one Compare page (2026-09-16, Sophie: "find all the voiceovers
// from my christmas scripts · separate audio · we'll need to cut one in at the
// right time since i used different clips").
//
//   node scripts/christmas-vo-page.js            # print the html
//   node scripts/christmas-vo-page.js --go [--supersede <pageId>]
//
// WHERE THE VOICEOVERS ACTUALLY ARE. There is no separately-recorded VO for
// these spots — every Christmas clip was sent to Seedance with
// generate_audio, so the voiceover is BAKED INTO the clip's own soundtrack.
// So "find all the voiceovers" is: read every Christmas job's prompt out of
// the video log, pull each clip's audio track (ffmpeg stream copy — the AAC
// bytes are untouched, never re-encoded), and MEASURE which ones carry actual
// speech with whisper, because a prompt asking for a VO is not evidence the
// model delivered one. 42 of the 71 clips turn out to carry only music and
// SFX; whisper's "Thanks for watching!" on those is hallucination over
// non-speech, not a line.
//
// WHY THE TIMECODES ARE THE POINT. Her third sentence is the ask: the picture
// she is cutting comes from a different take than the voice she wants, so the
// VO has to be laid against footage it was not drawn with. Each take's beats
// therefore carry the second they land at, measured from that clip's own word
// timestamps — so a beat can be slid to the frame it belongs on.
//
// The index is built by hand in the scratchpad (video log → download → extract
// → whisper via scripts/transcribe-media.js, which BANKS every transcript) and
// read from docs/christmas-commercial/voiceovers.json.
const fs = require('fs');
const path = require('path');
const https = require('https');

const CHAT = 'christmas-voiceovers-audio';
const SHEET = 'xmas-vo-v1';
const TITLE = 'Christmas voiceovers v1 — every take, separate audio';
const BASE = 'https://imageforge-q125.onrender.com';

const idx = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'docs/christmas-commercial/voiceovers.json'), 'utf8'));

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// The four VO groups, in the order the spot plays. Each group's takes are
// sorted best-first: a take whose wording is clean and whose line ends
// earliest leaves the most room to cut against.
const GROUPS = [
  { key: 'vo-gloomiest', name: 'The line',
    said: 'This Christmas… even your “GLOOmiest” daughter… can be happy. Give the gift… of magic. Secretly a Witch. She already knows.' },
  { key: 'vo-parents', name: 'The parents and the baritone',
    said: 'honeyyy — you get her a *witch* kit? for *christmas*?! … ACTUALLY, christmas was originally a pagan holiday.' },
  { key: 'vo-cottage', name: 'Presents? Apple cider?', said: 'mom, over the cottage' },
  { key: 'vo-sophie', name: 'Perhaps I just didn’t wanna know', said: 'sophie' },
  { key: 'tagline', name: 'The kit taglines', said: 'one line each, at the end of a kit clip' },
];

// WHAT MAKES A TAKE USABLE. Seedance mixes the voiceover into the clip's own
// music and effects — there is no separate voice stem — so a take can only be
// laid over OTHER footage if its bed is quiet under the line. That is measured
// per take (`spread`: the loud 90th percentile of 0.4s windows across the
// spoken span minus the quiet 10th, i.e. voice over bed), and it matters more
// than tidy wording: a perfectly read line welded to its own jingle cannot be
// cut in anywhere.
const GARBLE = /seek leah|which, secretly|圣诞|영상|시청/i;
const DUPE = /this christmas[\s\S]*this christmas/i;
function rank(o) {
  const bad = GARBLE.test(o.text) ? 1000 : 0;
  const dupe = DUPE.test(o.text) ? 500 : 0;
  return bad + dupe - (o.spread || 0) * 2 + (o.end || 99) / 10;
}
// Said as a mark, not a decibel reading.
function bedMark(o) {
  if (o.spread == null) return null;
  if (o.spread >= 20) return ['clear', 'voice sits clear'];
  if (o.spread >= 13) return ['some', 'a bed under it'];
  return ['buried', 'buried in its own music'];
}

function takeRow(o, i) {
  let beats = (o.beats || []).map(([lbl, at]) => `${esc(lbl)} <b>${at.toFixed(2)}s</b>`).join(' · ');
  // a one-line take has no beats, but WHEN it lands is the whole ask
  if (!beats && o.start != null) beats = `the line runs <b>${o.start.toFixed(2)}s</b> to <b>${o.end.toFixed(2)}s</b>`;
  const m = bedMark(o);
  return `  <div class="card take" data-item="${esc(o.id)}">
    <div class="vo" id="p-${esc(o.id)}"></div>
    <p class="said">${esc(o.text)}${m ? ` <span class="bed ${m[0]}">${esc(m[1])}</span>` : ''}</p>
    ${beats ? `<p class="beats">${beats}</p>` : ''}
    <p class="lnk"><a href="${esc(o.audio)}" download>save the audio</a>
      · <a href="${esc(o.video)}">the clip it came out of</a>
      · <span class="jid">${esc(o.id.slice(0, 8))}</span></p>
  </div>`;
}

const withVO = idx.filter((o) => o.hasVO);
const noVO = idx.filter((o) => !o.hasVO);

let body = '';
const rows = [];
for (const g of GROUPS) {
  const takes = withVO.filter((o) => (g.key === 'tagline' ? o.scene !== 'vo-gloomiest'
    && o.scene !== 'vo-parents' && o.scene !== 'vo-cottage' && o.scene !== 'vo-sophie'
    : o.scene === g.key)).sort((a, b) => rank(a) - rank(b));
  if (!takes.length) continue;
  body += `\n  <h2 class="grp">${esc(g.name)} <span class="n">${takes.length} ${takes.length === 1 ? 'take' : 'takes'}</span></h2>`;
  body += `\n  <p class="asked">${esc(g.said)}</p>\n`;
  body += takes.map(takeRow).join('\n') + '\n';
  takes.forEach((o, i) => rows.push({ ...o, label: `Take ${i + 1}` }));
}

// The rest: music and effects only, no line in them. Grouped by scene so a
// bed can be found by what it is under, and numbered within its scene.
const SCENE_NAMES = {
  'stairs': 'Coming down the stairs', 'kit-open': 'Opening the kit',
  'travel-kit': 'The travel kit', 'tree-theft': 'The tree taken',
  'druids': 'The druid circle', 'cottage': 'The cottage', 'boys': 'The boys',
  'sophie-kid': 'Sophie, small', 'other': 'Other',
};
const noRows = [];
let noBody = '';
for (const k of Object.keys(SCENE_NAMES)) {
  const takes = noVO.filter((o) => o.scene === k).sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1));
  if (!takes.length) continue;
  noBody += `\n  <h2 class="grp">${esc(SCENE_NAMES[k])} <span class="n">${takes.length}</span></h2>\n`;
  noBody += takes.map((o, i) => {
    noRows.push({ ...o, label: `Take ${i + 1}` });
    return `  <div class="card thin" data-item="${esc(o.id)}">
    <div class="vo" id="p-${esc(o.id)}"></div>
    <p class="lnk"><a href="${esc(o.audio)}" download>save the audio</a>
      · <a href="${esc(o.video)}">the clip</a> · <span class="jid">${esc(o.id.slice(0, 8))}</span></p>
  </div>`;
  }).join('\n') + '\n';
}

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLE)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .acctabs{display:flex;gap:0;border-bottom:1px solid var(--rule,#e2d9c9);margin:14px 0 4px;position:relative}
  .acctabs button{flex:0 0 auto;background:none;border:0;border-radius:0;padding:9px 14px;
    font:inherit;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2,#8b7d68);cursor:pointer}
  .acctabs button.on{color:var(--ink,#2e2a24)}
  .acctabs .bar{position:absolute;bottom:-1px;height:2px;background:var(--accent,#b08d57);transition:left .18s,width .18s}
  h2.grp{font-size:15px;margin:22px 0 2px;display:flex;align-items:baseline;gap:8px}
  h2.grp .n{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2,#8b7d68)}
  p.asked{margin:0 0 10px;font-size:12px;color:var(--ink2,#8b7d68);font-style:italic}
  .take{padding:10px 12px}
  .thin{padding:7px 12px}
  p.said{margin:7px 0 3px;font-size:13px;line-height:1.45}
  p.beats{margin:2px 0 4px;font-size:11px;color:var(--ink2,#8b7d68);line-height:1.6}
  p.beats b{color:var(--ink,#2e2a24);font-weight:600}
  p.lnk{margin:3px 0 0;font-size:11px;color:var(--ink2,#8b7d68)}
  p.lnk a{color:var(--accent,#b08d57)}
  .jid{opacity:.55;font-variant-numeric:tabular-nums}
  .bed{display:inline-block;margin-left:5px;padding:1px 6px;border-radius:6px;
    font-size:10px;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;
    border:1px solid var(--rule,#e2d9c9);color:var(--ink2,#8b7d68)}
  .bed.clear{border-color:var(--accent,#b08d57);color:var(--accent,#b08d57)}
  .bed.buried{border-color:#c0705f;color:#c0705f}
  [hidden]{display:none !important}
</style>

<div class="wrap">
  <h1>${esc(TITLE)}</h1>

  <div class="acctabs" id="tabs">
    <button type="button" class="on" data-pane="vo">Voiceovers <span class="n">${withVO.length}</span></button>
    <button type="button" data-pane="novo">No voice <span class="n">${noVO.length}</span></button>
    <span class="bar"></span>
  </div>

  <div id="pane-vo">${body}</div>

  <div id="pane-novo" hidden>
${noBody}
  </div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var ROWS = ${JSON.stringify(rows.map((o) => ({ id: o.id, u: o.audio, l: o.label, m: `${o.dur}s` })))};
  var NOROWS = ${JSON.stringify(noRows.map((o) => ({ id: o.id, u: o.audio, l: o.label, m: `${o.dur}s` })))};
  function mount(list) {
    list.forEach(function (o) {
      var at = document.getElementById('p-' + o.id);
      if (!at) return;
      window.__filmRow({ url: o.u, label: o.l, meta: o.m, kind: 'audio', mount: at });
    });
  }
  mount(ROWS); mount(NOROWS);

  // the hairline tabs measure their own underline (house rule)
  var tabs = document.getElementById('tabs');
  var bar = tabs.querySelector('.bar');
  function level() {
    var on = tabs.querySelector('button.on');
    if (!on) return;
    bar.style.left = on.offsetLeft + 'px';
    bar.style.width = on.offsetWidth + 'px';
  }
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-pane]');
    if (!b) return;
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    document.getElementById('pane-vo').hidden = b.dataset.pane !== 'vo';
    document.getElementById('pane-novo').hidden = b.dataset.pane !== 'novo';
    level();
    if (window.__pillSync) window.__pillSync();
  });
  level();
  window.addEventListener('resize', level);

  window.__compareNotes({ chat: '${CHAT}', sheet: '${SHEET}' });
  window.__compareHelp({ html: '<b>There is no separately recorded VO.</b> Every '
    + 'Christmas clip was sent with sound on, so the voice is baked into the clip. '
    + 'Each row here is that clip&rsquo;s audio track pulled out on its own — the AAC bytes '
    + 'untouched, nothing re-encoded. Tap a row to hear it, tap again to stop.'
    + '<br><br><b>The seconds under a take are where each beat lands in that take</b>, '
    + 'measured from the audio itself — so a line can be slid onto footage from a different clip. '
    + '<br><br><b>&ldquo;Voice sits clear&rdquo; means the music under the line is quiet enough to lift the '
    + 'voice off</b> — measured, not guessed. &ldquo;Buried&rdquo; means the bed is as loud as the voice, so that '
    + 'take brings its own music with it wherever you put it. Takes are ordered by that first. '
    + '<br><br><b>No voice</b> holds the ${noVO.length} tracks that turned out to be music and effects only.' });
})();
</script>
`;

if (!process.argv.includes('--go')) { process.stdout.write(html); process.exit(0); }

const post = (p, obj) => new Promise((ok, no) => {
  const b = Buffer.from(JSON.stringify(obj));
  const r = https.request({ host: 'imageforge-q125.onrender.com', path: p, method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': b.length } }, (res) => {
    let s = ''; res.on('data', (c) => s += c); res.on('end', () => { try { ok(JSON.parse(s)); } catch (e) { no(new Error(s.slice(0, 300))); } });
  });
  r.on('error', no); r.end(b);
});

(async () => {
  const res = await post('/api/chatfeed/page', { chat: CHAT, title: TITLE, html });
  console.log(JSON.stringify(res, null, 1));
  const sup = process.argv[process.argv.indexOf('--supersede') + 1];
  if (process.argv.includes('--supersede') && sup) {
    console.log(JSON.stringify(await post(`/api/chatfeed/page/${sup}/supersede`, { chat: CHAT })));
  }
  if (res.id) console.log(`${BASE}/api/chatfeed/page/${res.id}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
