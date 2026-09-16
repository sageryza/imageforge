// christmas-vo-page2 — the Christmas voiceovers cut down to HER OWN PILES
// (2026-09-16, Sophie, after marking v1: "cut to just my maybes and another
// pile no mark").
//
//   node scripts/christmas-vo-page2.js            # print the html
//   node scripts/christmas-vo-page2.js --go [--supersede <pageId>]
//
// THE PILES ARE READ LIVE, NEVER HARDCODED. Her marks live on the verdict
// sheet, so the build asks for them at run time and sorts every take by what
// she wrote on it — which means re-running this after she marks a few more
// simply re-cuts the page. Her vocabulary is her own: a note starting "maybe"
// is a maybe, one starting "no" is a no, nothing written is the second pile.
//
// THE SHEET NAME DOES NOT MOVE. A new version is a new PAGE, but her notes are
// keyed by chat+sheet+item — so v2 keeps `xmas-vo-v1` and every word she typed
// comes with it, still attached to the same take. The item ids are the Seedance
// job ids, which are stable, so there is no way for a rebuild to re-point her
// answers at different content (the rule a verdict sheet's name exists for).
//
// A MARK OF HERS IS NEVER SILENTLY DROPPED. Two takes carry a note that is
// neither a maybe nor a no ("giftt", "ggloom"); they get their own short pile
// with her words shown, rather than being filed into a pile she did not put
// them in or vanishing off the page.
const fs = require('fs');
const path = require('path');
const https = require('https');

const CHAT = 'christmas-voiceovers-audio';
const SHEET = 'xmas-vo-v1';           // deliberately v1 — see the note above
const TITLE = 'Christmas voiceovers v2 — the maybes, and the ones with no mark';
const HOST = 'imageforge-q125.onrender.com';
const BASE = `https://${HOST}`;

const idx = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'docs/christmas-commercial/voiceovers.json'), 'utf8'));

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const get = (p) => new Promise((ok, no) => {
  https.get({ host: HOST, path: p }, (r) => {
    let b = ''; r.on('data', (c) => b += c);
    r.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { no(new Error(b.slice(0, 200))); } });
  }).on('error', no);
});

const GROUP_NAME = {
  'vo-gloomiest': 'The line', 'vo-parents': 'The parents and the baritone',
  'vo-cottage': 'Presents? Apple cider?', 'vo-sophie': 'Perhaps I just didn’t wanna know',
  'kit-open': 'A kit tagline', 'travel-kit': 'A kit tagline',
};
// Said as a mark, not a decibel reading (v1's own rule).
function bedMark(o) {
  if (o.spread == null) return null;
  if (o.spread >= 20) return ['clear', 'voice sits clear'];
  if (o.spread >= 13) return ['some', 'a bed under it'];
  return ['buried', 'buried in its own music'];
}
function takeRow(o) {
  let beats = (o.beats || []).map(([lbl, at]) => `${esc(lbl)} <b>${at.toFixed(2)}s</b>`).join(' · ');
  if (!beats && o.start != null) beats = `the line runs <b>${o.start.toFixed(2)}s</b> to <b>${o.end.toFixed(2)}s</b>`;
  const m = bedMark(o);
  // HER NOTE IS NOT REPRINTED HERE. __compareNotes already draws it under the
  // item, in the box she typed it in and can edit — a copy of it higher up the
  // card is the same words twice, and PHOTOgraphing v2 is what showed it.
  return `  <div class="card take" data-item="${esc(o.id)}">
    <div class="vo" id="p-${esc(o.id)}"></div>
    <p class="said">${esc(o.text)}${m ? ` <span class="bed ${m[0]}">${esc(m[1])}</span>` : ''}</p>
    ${beats ? `<p class="beats">${beats}</p>` : ''}
    <p class="lnk"><span class="grp">${esc(GROUP_NAME[o.scene] || o.scene)}</span>
      · <a href="${esc(o.audio)}" download>save the audio</a>
      · <a href="${esc(o.video)}">the clip it came out of</a>
      · <span class="jid">${esc(o.id.slice(0, 8))}</span></p>
  </div>`;
}

(async () => {
  const v = await get(`/api/chatfeed/verdict?chat=${encodeURIComponent(CHAT)}&sheet=${encodeURIComponent(SHEET)}`);
  const texts = v.texts || {};
  const norm = (s) => String(s || '').replace(/^—\s*me:\s*/i, '').trim();
  const pileOf = (o) => {
    const n = norm(texts[o.id]);
    if (!n) return 'nomark';
    if (/^(maybe|mayve)/i.test(n)) return 'maybe';
    if (/^no\b|^no$/i.test(n)) return 'no';
    return 'other';
  };
  const vo = idx.filter((o) => o.hasVO);
  // within a pile: the takes whose voice can actually be lifted come first
  const byLift = (a, b) => (b.spread || 0) - (a.spread || 0);
  const piles = { maybe: [], nomark: [], other: [] };
  for (const o of vo) { const p = pileOf(o); if (piles[p]) piles[p].push(o); }
  for (const k of Object.keys(piles)) piles[k].sort(byLift);

  const sec = (list, title, sub) => !list.length ? '' :
    `\n  <h2 class="grp2">${esc(title)} <span class="n">${list.length}</span></h2>`
    + (sub ? `\n  <p class="asked">${esc(sub)}</p>` : '') + '\n'
    + list.map(takeRow).join('\n') + '\n';

  const body = sec(piles.maybe, 'My maybes', '')
    + sec(piles.other, 'The two I wrote something else on', '');
  const body2 = sec(piles.nomark, 'No mark yet', '');

  const rows = piles.maybe.concat(piles.other).map((o, i) => ({ id: o.id, u: o.audio, l: `Take ${i + 1}`, m: `${o.dur}s` }));
  const rows2 = piles.nomark.map((o, i) => ({ id: o.id, u: o.audio, l: `Take ${i + 1}`, m: `${o.dur}s` }));

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
  h2.grp2{font-size:15px;margin:22px 0 8px;display:flex;align-items:baseline;gap:8px}
  h2.grp2 .n{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2,#8b7d68)}
  p.asked{margin:0 0 10px;font-size:12px;color:var(--ink2,#8b7d68);font-style:italic}
  .take{padding:10px 12px}
  p.said{margin:6px 0 3px;font-size:13px;line-height:1.45}
  p.beats{margin:2px 0 4px;font-size:11px;color:var(--ink2,#8b7d68);line-height:1.6}
  p.beats b{color:var(--ink,#2e2a24);font-weight:600}
  p.lnk{margin:3px 0 0;font-size:11px;color:var(--ink2,#8b7d68)}
  p.lnk a{color:var(--accent,#b08d57)}
  p.lnk .grp{color:var(--ink,#2e2a24)}
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
    <button type="button" class="on" data-pane="mine">Maybes <span class="n">${piles.maybe.length}</span></button>
    <button type="button" data-pane="none">No mark <span class="n">${piles.nomark.length}</span></button>
    <span class="bar"></span>
  </div>

  <div id="pane-mine">${body}</div>
  <div id="pane-none" hidden>${body2}</div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var A = ${JSON.stringify(rows)}, B = ${JSON.stringify(rows2)};
  function mount(list) {
    list.forEach(function (o) {
      var at = document.getElementById('p-' + o.id);
      if (!at) return;
      window.__filmRow({ url: o.u, label: o.l, meta: o.m, kind: 'audio', mount: at });
    });
  }
  mount(A); mount(B);

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
    document.getElementById('pane-mine').hidden = b.dataset.pane !== 'mine';
    document.getElementById('pane-none').hidden = b.dataset.pane !== 'none';
    level();
    if (window.__pillSync) window.__pillSync();
  });
  level();
  window.addEventListener('resize', level);

  window.__compareNotes({ chat: '${CHAT}', sheet: '${SHEET}' });
  window.__compareHelp({ html: '<b>Same notes, same takes.</b> This is the same sheet as v1, '
    + 'so everything you typed is still on the take you typed it on — the six you said no to are '
    + 'just off the page.'
    + '<br><br><b>The seconds under a take are where each beat lands</b>, measured from the audio '
    + 'itself, so a line can be slid onto footage from a different clip.'
    + '<br><br><b>&ldquo;Voice sits clear&rdquo; means the music under the line is quiet enough to lift the '
    + 'voice off.</b> &ldquo;Buried&rdquo; means the bed is as loud as the voice, so that take brings its own '
    + 'music wherever you put it. Takes are ordered by that.' });
})();
</script>
`;

  if (!process.argv.includes('--go')) { process.stdout.write(html); return; }

  const post = (p, obj) => new Promise((ok, no) => {
    const b = Buffer.from(JSON.stringify(obj));
    const r = https.request({ host: HOST, path: p, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': b.length } }, (res) => {
      let s = ''; res.on('data', (c) => s += c);
      res.on('end', () => { try { ok(JSON.parse(s)); } catch (e) { no(new Error(s.slice(0, 300))); } });
    });
    r.on('error', no); r.end(b);
  });
  const res = await post('/api/chatfeed/page', { chat: CHAT, title: TITLE, html });
  console.log(JSON.stringify(res, null, 1));
  const i = process.argv.indexOf('--supersede');
  if (i > 0 && process.argv[i + 1]) {
    console.log(JSON.stringify(await post(`/api/chatfeed/page/${process.argv[i + 1]}/supersede`, { chat: CHAT })));
  }
  if (res.id) console.log(`${BASE}/api/chatfeed/page/${res.id}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
