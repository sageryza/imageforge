#!/usr/bin/env node
/* A CLIP IS A FIRST-CLASS ITEM ON A STOCK TEMPLATE PAGE (2026-09-10, Sophie:
 * "make the page take movies also").
 *
 *   node scripts/test-template-video.js
 *
 * Why headless rather than a source assertion: a `<video>` that renders and one
 * that never lays out are the same markup, and the question that matters is
 * whether the clip is a REAL BOX on the page with controls she can reach —
 * `elementFromPoint` over its own middle is the only honest way to ask. The
 * pure half (does `cleanItem` keep `video`/`poster` at all, does an item with
 * nothing but a clip survive validation) runs first and needs no browser.
 *
 * Skips with exit 0 if no Chromium, like its siblings.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { validateTemplate, renderTemplatePage } = require('../page-templates');

const PUB = path.join(__dirname, '..', 'public');

let pass = 0; let fail = 0;
function ok(cond, msg) {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + msg);
  if (cond) pass += 1; else fail += 1;
}

/* ---------------------------------------------------------------- pure ---- */

const CLIP = 'https://storage.googleapis.com/test-bucket/clips/juanita.mp4';
const POST = 'https://storage.googleapis.com/test-bucket/clips/juanita-poster.jpg';

{
  const v = validateTemplate('grid', { groups: [
    { label: 'clips', items: [{ label: 'the take', video: CLIP, poster: POST }] },
  ] });
  ok(v.ok, 'a group whose only item is a CLIP validates');
  const it = v.ok && v.data.groups[0].items[0];
  ok(it && it.video === CLIP, 'the clip url rides through');
  ok(it && it.poster === POST, 'and its poster beside it');
  // the id is what her ♥ and her note are filed under, forever — so a clip
  // item must derive one from its own url rather than falling through to the
  // positional fallback, which moves the day the page is rebuilt
  ok(it && /juanita/.test(it.id), 'its id comes off the clip filename — got ' + (it && it.id));
}

{
  const v = validateTemplate('grid', { groups: [
    { label: 'x', items: [{ label: 'no poster', video: CLIP }] },
  ] });
  ok(v.ok && v.data.groups[0].items[0].video === CLIP
     && v.data.groups[0].items[0].poster === undefined,
  'a clip with no poster keeps no empty poster field');
}

{
  // the refusal is unchanged: an item that is neither a picture, nor words,
  // nor a moment card's parts, nor a clip is still nothing
  const v = validateTemplate('grid', { groups: [{ label: 'x', items: [{ label: 'empty' }] }] });
  ok(!v.ok || !(v.data.groups[0] && v.data.groups[0].items.length),
    'an item with nothing at all is still refused');
}

{
  const v = validateTemplate('deck', { items: [
    { label: 'the take', video: CLIP, poster: POST },
    { label: 'a still', img: 'https://storage.googleapis.com/test-bucket/a/s.png' },
  ] });
  ok(v.ok && v.data.items[0].video === CLIP, 'a DECK item takes a clip too');
}

/* ------------------------------------------------------------- headless ---- */

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } })
  || (() => {
    try {
      const dir = '/opt/pw-browsers';
      const hit = fs.readdirSync(dir).find((d) => d.startsWith('chromium-'));
      const p = hit && path.join(dir, hit, 'chrome-linux', 'chrome');
      return p && fs.existsSync(p) ? p : null;
    } catch (_) { return null; }
  })();
if (!chrome) {
  console.log('no Chromium found — skipping the page half (set CHROME_PATH to run)');
  console.log(`${pass} pure checks passed`);
  process.exit(fail ? 1 : 0);
}

const files = {};
['compare.css', 'compare.js', 'judge.js', 'grid.js', 'asset-lightbox.js',
  'asset-view.js', 'playground-port.js', 'asset-actions.js', 'page-views.js',
].forEach((f) => {
  const type = f.endsWith('.css') ? 'text/css' : 'application/javascript';
  files['/' + f] = [type, fs.readFileSync(path.join(PUB, f), 'utf8')];
});
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

// A REAL DECODABLE CLIP, generated here — a fake src never lays out, so a
// `<video>` pointing at nothing would pass every box assertion at zero height
// and the test would be measuring the poster's absence instead of the clip.
// WebM/VP8: playwright's Chromium has no H.264.
const WEBM = (() => {
  const p = path.join(os.tmpdir(), 'tpl-video-fixture.webm');
  if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  const ff = (() => {
    try { return require('ffmpeg-static'); } catch (_) { return null; }
  })();
  if (!ff) return null;
  const r = require('child_process').spawnSync(ff, ['-y', '-f', 'lavfi',
    '-i', 'color=c=maroon:s=120x180:d=1', '-c:v', 'libvpx', '-b:v', '80k', p],
  { stdio: 'ignore' });
  return r.status === 0 && fs.existsSync(p) ? p : null;
})();
if (!WEBM) {
  console.log('no ffmpeg for the clip fixture — skipping the page half');
  console.log(`${pass} pure checks passed`);
  process.exit(fail ? 1 : 0);
}
const CLIPBYTES = fs.readFileSync(WEBM);
const IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Crect width='40' height='60' fill='%23c99'/%3E%3C/svg%3E";

const SPY = `<script>
try{localStorage.setItem('cmp-tour-deck','1');localStorage.setItem('cmp-tour-grid','1');}catch(_){}
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message), {});
});
</script>`;

function gridVideoPage() {
  const v = validateTemplate('grid', { groups: [
    { label: 'Juanita — the clips', items: [
      { id: 'take1', label: 'the first take', video: '/clip.webm' },
      { id: 'take2', label: 'the redo', video: '/clip.webm' },
    ] },
    { label: 'the stills beside them', items: [
      { id: 'still1', label: 'the corridor', img: IMG },
    ] },
  ] });
  if (!v.ok) throw new Error(v.error);
  const TEST = `<script>
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var rows=document.querySelectorAll('#grid .gd-row');
  var cells=rows[0].querySelectorAll('.gd-it');
  var vid=cells[0].querySelector('video');
  ok(!!vid, 'a clip item renders a <video>, not a link');
  ok(vid && vid.controls, 'with controls — she plays it where it sits');
  ok(vid && vid.getAttribute('preload')==='metadata',
     'preload=metadata — a page of clips costs a poster each, not a download each');
  var r=vid ? vid.getBoundingClientRect() : {width:0,height:0};
  ok(r.width>40 && r.height>40, 'and it is a REAL BOX — ' + Math.round(r.width) + 'x' + Math.round(r.height));
  ok(Math.abs(cells[0].getBoundingClientRect().width - r.width) < 3,
     'the clip fills its cell edge to edge, like a picture');
  // the tap has to reach the video's own controls, never a lightbox over them
  var hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height*0.9);
  ok(hit===vid || vid.contains(hit),
     'a tap on the clip reaches the clip — got ' + (hit&&hit.tagName));
  ok(cells[0].querySelector('.gd-sub')
     && cells[0].querySelector('.gd-sub').textContent==='the first take',
     'its what-it-is line sits under it, same as a still');
  // a still on the same page is untouched
  ok(rows[1].querySelector('.gd-it img') && !rows[1].querySelector('video'),
     'a picture on the same page still renders as a picture');
  ok(cells[0].querySelectorAll('.gd-acts > button').length >= 2,
     'a clip carries her marks like anything else');
  fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
}, 900);
</script>`;
  return SPY + renderTemplatePage({
    template: 'grid', title: 'Clips on a grid', chat: 't', sheet: 'page-vid', data: v.data,
  }) + pill + TEST;
}

function deckVideoPage() {
  const v = validateTemplate('deck', { items: [
    { id: 'take1', label: 'the first take', video: '/clip.webm' },
    { id: 'still1', label: 'the corridor', img: IMG },
  ] });
  if (!v.ok) throw new Error(v.error);
  const TEST = `<script>
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var card=document.querySelector('.jg');
  var vid=card && card.querySelector('video');
  ok(!!vid, 'the deck card plays its clip');
  var r=vid ? vid.getBoundingClientRect() : {width:0,height:0};
  ok(r.width>40 && r.height>40, 'as a real box — ' + Math.round(r.width) + 'x' + Math.round(r.height));
  ok(r.height <= window.innerHeight,
     'capped to the screen, so a clip card is one screen like every other');
  var hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height*0.9);
  ok(hit===vid || vid.contains(hit),
     'the controls take their own tap, over the browse zones — got ' + (hit&&hit.className));
  fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
}, 900);
</script>`;
  return SPY + renderTemplatePage({
    template: 'deck', title: 'Clips in a deck', chat: 't', sheet: 'page-vid-deck', data: v.data,
  }) + pill + TEST;
}

function run(name, html) {
  return new Promise((resolve, reject) => {
    let finish = null;
    const server = http.createServer((req, res) => {
      const [route, qs] = req.url.split('?');
      if (route === '/result') {
        res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
        return finish && finish(new URLSearchParams(qs).get('r') || '');
      }
      if (route === '/clip.webm') {
        // Range support: without it `seekable` is [0,0] and a video element
        // behaves nothing like the one she gets from Storage.
        const range = req.headers.range;
        const len = CLIPBYTES.length;
        if (range) {
          const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
          const s = m[1] ? parseInt(m[1], 10) : 0;
          const e = m[2] ? parseInt(m[2], 10) : len - 1;
          res.writeHead(206, { 'Content-Type': 'video/webm',
            'Content-Range': `bytes ${s}-${e}/${len}`,
            'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 });
          return res.end(CLIPBYTES.slice(s, e + 1));
        }
        res.writeHead(200, { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes',
          'Content-Length': len });
        return res.end(CLIPBYTES);
      }
      if (route === '/api/chatfeed/verdict' || route === '/api/gallery/assets/vote'
        || route === '/api/gallery/assets/note') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"ok":true,"items":{},"texts":{}}');
      }
      if (route === '/api/gallery/assets' || route === '/api/gallery/assets/notes') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"assets":[],"notes":[]}');
      }
      const hit = files[route];
      if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/`;
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tplvid-'));
      const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
        '--window-size=390,844', '--user-data-dir=' + profile, url], { stdio: 'ignore' });
      const done = (verdict, err) => {
        try { kid.kill('SIGKILL'); } catch (_) {}
        server.close();
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
        if (err) return reject(new Error(`${name}: ${err}`));
        const lines = verdict.split(' | ').filter(Boolean);
        lines.forEach((l) => console.log(`${name} — ${l}`));
        if (!lines.length) return reject(new Error(`${name}: no verdict — the page script never ran`));
        if (lines.some((l) => l.startsWith('FAIL'))) return reject(new Error(`${name}: failures above`));
        resolve(lines.length);
      };
      const timer = setTimeout(() => done('', 'timed out waiting for the page'), 30000);
      finish = (vd) => { clearTimeout(timer); done(vd); };
    });
  });
}

(async () => {
  try {
    const a = await run('grid', gridVideoPage());
    const b = await run('deck', deckVideoPage());
    if (fail) { console.error(`${fail} pure checks failed`); process.exit(1); }
    console.log(`all ${pass + a + b} checks passed`);
  } catch (err) { console.error(err.message); process.exit(1); }
})();
