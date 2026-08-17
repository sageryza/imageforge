#!/usr/bin/env node
/* Drives the REAL /pausing page (public/pausing.html) in headless Chromium,
 * against the REAL injected pill and the REAL shared plan (/pause-plan.js),
 * with a stub server standing in for /api/pausing and /api/search/clip-span.
 *
 *   node scripts/test-pausing-page.js
 *
 * The synthetic recording it plays is a WAV the stub cuts on demand for
 * whatever span the page asks for: loud tone 0-0.6s, quiet ROOM TONE
 * 0.6-2.0s (the gap), loud tone 2.0-4.0s. That is what makes the important
 * assertions possible at all — they are about SAMPLES, not about markup.
 *
 * What it pins:
 *   1. A PAUSE IS NEVER DIGITAL SILENCE. The whole tool exists because a
 *      pause rebuilt as zero samples sounds like a dropout — it is what made
 *      the "45 percent" line sound bungled. The test reads the buffer the
 *      page actually hands the speakers and asserts the pause is quiet AND
 *      non-zero. A regression here is inaudible in code review and obvious
 *      in her ears.
 *   2. An ADDED pause has no gap to borrow from, so it must come out of the
 *      baked room tone — same assertion, different source.
 *   3. PLAY IS HER EDIT, NOT THE SOURCE (Sophie: "I need to be able to hear
 *      it to know how long of a pause I want"). Setting 0.4s on a 1.40s gap
 *      must SHORTEN what plays by a second.
 *   4. The page's own arithmetic matches the shared plan the server renders
 *      from — computed here, in node, off the state the page POSTed.
 *   5. The page script didn't kill the pill at parse time (the recurring
 *      let/const-in-global-scope bug), and [hidden] still wins.
 *
 * Skips with exit 0 when no Chromium is present.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { planEdit } = require('../pause-plan');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
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
if (!chrome) { console.log('no Chromium found — skipping (set CHROME_PATH to run)'); process.exit(0); }

// ── the synthetic recording ─────────────────────────────────────────
const SR = 44100;
const DUR = 4.0;
function sample(t) {
  if (t >= 0.6 && t < 2.0) return Math.sin(t * 9973) * 0.02;   // room tone: quiet, NOT zero
  if (t < 0 || t >= DUR) return 0;
  return Math.sin(2 * Math.PI * 220 * t) * 0.5;                // "speech"
}
function wav(t0, t1, fn) {
  const n = Math.max(1, Math.round((t1 - t0) * SR));
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i += 1) {
    const v = Math.max(-1, Math.min(1, (fn || sample)(t0 + i / SR)));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 2, 28);
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}
const ROOM = wav(0, 0.5, (t) => Math.sin(t * 9973) * 0.02);

const WORDS = [
  { word: 'one', start: 0.0, end: 0.30 },
  { word: 'two', start: 0.30, end: 0.60 },
  { word: 'three', start: 2.00, end: 2.30 },
  { word: 'four', start: 2.75, end: 3.00 },
  { word: 'five', start: 3.20, end: 3.50 },
];
const PAUSES = [{ id: 'p00', a: 0.60, b: 2.00, len: 1.40, wi: 1 }];
const PROJECT = {
  id: 'x1', title: 'test', status: 'ready', seconds: DUR,
  source: { url: 'https://storage.googleapis.com/b/test.wav', name: 'test' },
  wordsUrl: '/words.json', roomUrl: '/room.wav', room: { a: 0.8, b: 1.3 },
  pauses: PAUSES, set: {}, added: {}, renders: [],
};

// The state the page POSTs back — the test compares the page's own arithmetic
// against the shared plan computed here, off exactly this.
let saved = { set: {}, added: {} };

// ── the checks, run inside the page ─────────────────────────────────
const DRIVER = `
<script>
(function(){
  var L=[], realFetch=window.fetch.bind(window);
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  function done(){ realFetch('/result?r='+encodeURIComponent(L.join(' | '))); }

  // watch what the page actually hands the speakers, without touching it
  var d=Object.getOwnPropertyDescriptor(AudioBufferSourceNode.prototype,'buffer');
  Object.defineProperty(AudioBufferSourceNode.prototype,'buffer',{
    configurable:true, get:d.get,
    set:function(b){ window.__buf=b; d.set.call(this,b); }
  });
  // peak |sample| over [a,b] seconds of the last buffer played
  function peak(a,b){
    var buf=window.__buf; if(!buf) return -1;
    var c=buf.getChannelData(0), i0=Math.max(0,Math.round(a*buf.sampleRate)),
        i1=Math.min(c.length,Math.round(b*buf.sampleRate)), m=0;
    for(var i=i0;i<i1;i++) m=Math.max(m,Math.abs(c[i]));
    return m;
  }
  function q(s){ return document.querySelector(s); }
  function qa(s){ return [].slice.call(document.querySelectorAll(s)); }

  setTimeout(function(){
    // 5. the page script did not kill the injected pill at parse time
    ok(!!q('.float') && typeof window.__scrollStart==='function',
       'the injected pill survives the page script');
    ok(!!q('#takes') && !q('#takes').offsetParent, '[hidden] still wins over the author rules');

    // open the one recording
    var src=qa('#srclist .src')[0];
    ok(!!src, 'the recordings list drew');
    if(src) src.click();

    setTimeout(function(){
      var paras=qa('.para');
      ok(paras.length>0, 'the recording opened as paragraphs');
      ok(!qa('.para .w').length, 'and they open FOLDED — no words until she goes in');
      paras[0].querySelector('.hd').click();      // expand
      var chip=q('.para .p');
      ok(qa('.para .w').length===${WORDS.length}, 'expanding draws the words');
      ok(!!chip && chip.querySelector('b').textContent==='1.40',
         'the pause chip carries the gap\\'s real length');
      if(!chip){ done(); return; }
      chip.click();                                // opens the sheet + previews

      setTimeout(function(){
        ok(!q('#sheet').hidden, 'tapping a pause opens the sheet');
        // 3. pick 0.4s on a 1.40s gap
        var btn=qa('#sheet .lens button').filter(function(b){return b.textContent==='0.4';})[0];
        ok(!!btn, 'the sheet offers absolute lengths');
        if(btn) btn.click();

        setTimeout(function(){
          ok(q('.para .p b').textContent==='0.40' && q('.para .p').classList.contains('set'),
             'the chip paints the length she picked');
          ok(q('.para .p s').textContent==='1.40', 'and still shows what it was');

          var buf=window.__buf;
          // the previewed span is [0, 3.6]; 0.6s speech + 0.4s pause + 1.6s speech
          ok(!!buf && Math.abs(buf.duration-2.6)<0.05,
             'PLAY IS HER EDIT: 1.40s of air became 0.40s (got '+(buf&&buf.duration.toFixed(2))+'s)');
          var speech=peak(0.1,0.5), pause=peak(0.68,0.92), after=peak(1.1,1.5);
          ok(speech>0.3, 'the speech before the pause is intact');
          ok(after>0.3, 'and the speech after it');
          // 1. THE ONE THAT MATTERS
          ok(pause>0.002, 'A PAUSE IS NEVER DIGITAL SILENCE — it is real room tone (peak '+pause.toFixed(4)+')');
          ok(pause<0.1, 'and it is room tone, not speech (peak '+pause.toFixed(4)+')');

          // 4. the page's arithmetic, for node to check against the shared plan
          ok(/1.*changed/.test(q('#tally').textContent), 'the tally counts the change');
          L.push('TALLY='+q('#tally').textContent.replace(/\\s+/g,' ').trim());

          q('#sheet .close').click();

          // 2. an ADDED pause — no gap of its own, so it comes out of the
          //    baked room tone
          qa('#bar .modes button')[1].click();
          var w=qa('.para .w')[3];                 // "four", ends at 3.00
          w.click();
          setTimeout(function(){
            ok(qa('.para .p').length===2, '+ PAUSE puts a new pause after the tapped word');
            var b8=qa('#sheet .lens button').filter(function(x){return x.textContent==='0.8';})[0];
            if(b8) b8.click();
            setTimeout(function(){
              var b2=window.__buf;
              // span [1.46, 4.0]: 1.6s speech, 0.8s added pause, 0.94s speech
              ok(!!b2 && Math.abs(b2.duration-3.34)<0.06,
                 'an added pause makes the recording LONGER (got '+(b2&&b2.duration.toFixed(2))+'s)');
              var added=peak(1.75,2.25);
              ok(added>0.002, 'an added pause is room tone too, never silence (peak '+added.toFixed(4)+')');
              ok(added<0.1, 'and it is quiet (peak '+added.toFixed(4)+')');

              // undo puts it back
              q('#sheet .close').click();
              q('#undo').click();
              setTimeout(function(){
                ok(qa('.para .p').length===1, 'undo takes the added pause back out');
                done();
              }, 250);
            }, 900);
          }, 900);
        }, 900);
      }, 900);
    }, 700);
  }, 500);
})();
</script>`;

// ── the stub server ─────────────────────────────────────────────────
let finish = null;
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  const params = new URLSearchParams(qs || '');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };

  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish && finish(decodeURIComponent(params.get('r') || ''));
  }
  if (route === '/pause-plan.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    return res.end(fs.readFileSync(path.join(ROOT, 'pause-plan.js')));
  }
  if (route === '/words.json') return json({ v: 1, words: WORDS });
  if (route === '/room.wav') {
    res.writeHead(200, { 'Content-Type': 'audio/wav' }); return res.end(ROOM);
  }
  if (route === '/api/search/clip-span') {
    // cut the synthetic recording for exactly the span asked for, so the
    // page's base-time arithmetic is really under test
    const t0 = Number(params.get('t0')); const t1 = Number(params.get('t1'));
    return json({ status: 'ready', url: `/clip.wav?t0=${t0}&t1=${t1}` });
  }
  if (route === '/clip.wav') {
    res.writeHead(200, { 'Content-Type': 'audio/wav' });
    return res.end(wav(Number(params.get('t0')), Number(params.get('t1'))));
  }
  if (route === '/api/pausing/sources') {
    return json({ sources: [{ itemId: 'i1', url: PROJECT.source.url, name: 'test', seconds: DUR, projectId: 'x1' }] });
  }
  if (route === '/api/pausing/open') return json({ id: 'x1', started: false });
  if (route === '/api/pausing/x1') return json({ project: { ...PROJECT, ...saved } });
  if (route === '/api/pausing/x1/plan') {
    return json(planEdit({ pauses: PAUSES, set: saved.set, added: saved.added, words: WORDS, dur: DUR }));
  }
  if (route === '/api/pausing/x1/state') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { saved = { ...saved, ...JSON.parse(body).patch }; } catch (_) { /* the page will show it */ }
      json({ ok: true });
    });
    return undefined;
  }
  if (route === '/api/pausing/') return json({ projects: [] });

  // the real page, with the real injected pill and the driver appended
  let html = fs.readFileSync(path.join(PUB, 'pausing.html'), 'utf8');
  html += pill + DRIVER;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(html);
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pausing-page-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + profile, url], { stdio: 'ignore' });

  const done = (verdict, err) => {
    try { kid.kill('SIGKILL'); } catch (_) {}
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (err) { console.error(err); process.exit(1); }
    const lines = verdict.split(' | ').filter(Boolean);
    let bad = 0;
    lines.forEach((l) => {
      if (l.startsWith('TALLY=')) return;
      console.log(l);
      if (l.startsWith('FAIL')) bad += 1;
    });
    if (!lines.length) { console.error('no verdict — the page script never ran'); process.exit(1); }

    // 4. the page's own arithmetic vs the shared plan, off the state it POSTed
    const tally = (lines.find((l) => l.startsWith('TALLY=')) || '').slice(6);
    const p = planEdit({ pauses: PAUSES, set: saved.set, added: {}, words: WORDS, dur: DUR });
    const want = `${p.items.length} changed · ${p.delta >= 0 ? '+' : ''}${p.delta.toFixed(1)}s`;
    const agree = tally.replace(/\s+/g, ' ') === want;
    console.log(`${agree ? 'PASS' : 'FAIL'}: the page's arithmetic is the shared plan's `
      + `(page "${tally}", plan "${want}")`);
    if (!agree) bad += 1;

    if (bad) process.exit(1);
    console.log(`all ${lines.length} checks passed`);
    process.exit(0);
  };
  const timer = setTimeout(() => done('', 'timed out waiting for the page'), 45000);
  finish = (v) => { clearTimeout(timer); done(v); };
});
