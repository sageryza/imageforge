// test-witchvideo.js — the witch-video review room: the pure halves with no
// network, a static audit of the page against the house rules, then the real
// page driven in headless Chromium (skips cleanly when none is found).
//
//   node scripts/test-witchvideo.js
//
// Pins the things a bug here would put in front of the reviewer: the state
// table (a note must hand the ball back to the chat), the note refusals
// (over-length is refused whole, never truncated), the public shape (emails
// must never ride a public read), the tap-to-pause-opens-the-note-box wiring,
// and the lightbox freezing the page behind it.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const wv = require(path.join(ROOT, 'witchvideo.js'));

let pass = 0;
function ok(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('witch-video pipeline\n');

/* ── the state table ───────────────────────────────────────────────────── */
ok('a cut puts the ball with the reviewer', () => {
  assert.strictEqual(wv.stateAfter('idea', 'cut'), 'review');
  assert.strictEqual(wv.stateAfter('changes', 'cut'), 'review');
});
ok('a note hands it back to the chat', () => {
  assert.strictEqual(wv.stateAfter('review', 'note'), 'changes');
  assert.strictEqual(wv.stateAfter('approved', 'note'), 'changes');
});
ok('a note on a video still in the cauldron does not fake a review round', () => {
  assert.strictEqual(wv.stateAfter('idea', 'note'), 'idea');
  assert.strictEqual(wv.stateAfter('working', 'note'), 'working');
});
ok('♥ approves, ✕ reopens', () => {
  assert.strictEqual(wv.stateAfter('review', 'verdict', 'love'), 'approved');
  assert.strictEqual(wv.stateAfter('review', 'verdict', 'changes'), 'changes');
});
ok('stills only wake an idea into working', () => {
  assert.strictEqual(wv.stateAfter('idea', 'stills'), 'working');
  assert.strictEqual(wv.stateAfter('review', 'stills'), 'review');
});

/* ── notes ─────────────────────────────────────────────────────────────── */
ok('an empty note is refused', () => {
  assert.ok(wv.cleanNote({ text: '   ' }).error);
});
ok('an over-length note is REFUSED whole, never truncated', () => {
  const r = wv.cleanNote({ text: 'x'.repeat(wv.NOTE_MAX + 1) });
  assert.ok(r.error && /trim/.test(r.error), JSON.stringify(r));
});
ok('the pause second rides along, rounded to a tenth', () => {
  assert.strictEqual(wv.cleanNote({ text: 'hi', t: 41.97 }).entry.t, 42);
  assert.strictEqual(wv.cleanNote({ text: 'hi', t: 3.14 }).entry.t, 3.1);
  assert.ok(!('t' in wv.cleanNote({ text: 'hi', t: -2 }).entry));
});

/* ── the NEW dot ───────────────────────────────────────────────────────── */
ok('a video is new until this person has seen its newest move', () => {
  const v = { updatedAt: '2026-08-21T10:00:00Z', seenAt: { a: '2026-08-21T09:00:00Z' } };
  assert.strictEqual(wv.isNew(v, 'a'), true);
  assert.strictEqual(wv.isNew(v, 'b'), true);
  assert.strictEqual(wv.isNew({ ...v, seenAt: { a: '2026-08-21T11:00:00Z' } }, 'a'), false);
});

/* ── the public shape ──────────────────────────────────────────────────── */
ok('the public shape resolves the NEWEST cut and never mentions email', () => {
  const p = wv.publicVideo('vid1', {
    title: 'T', state: 'review', chat: 'secret-chat',
    cuts: [{ v: 1, url: 'https://a/1.mp4', at: 'x' }, { v: 2, url: 'https://a/2.mp4', seconds: 58, at: 'y' }],
    thread: [{ from: 'Mom', text: 'hi', at: 'z', email: 'leak@x.y' }],
    seenAt: { p1: '2026-01-01' }, updatedAt: '2026-02-01',
  }, 'p1');
  assert.strictEqual(p.cut.v, 2);
  assert.strictEqual(p.cut.seconds, 58);
  assert.strictEqual(p.isNew, true);
  assert.ok(!JSON.stringify(p).includes('email'), 'email field leaked');
  assert.ok(!JSON.stringify(p).includes('seenAt'), 'seenAt leaked');
});

/* ── links + the email ─────────────────────────────────────────────────── */
ok('the reviewer link carries the encoded token', () => {
  const l = wv.reviewerLink('a b/c');
  assert.ok(l.includes('/witchvideo?who=a%20b%2Fc'), l);
  assert.ok(l.startsWith('http'), l);
});
ok('the cut email escapes names and shows the link as text too', () => {
  const { html, subject } = wv.buildCutEmail({ toName: 'A"><b>x', link: 'https://ex.test/witchvideo?who=q', title: 'Candle <magic>' });
  assert.ok(!html.includes('<b>x'), 'name escaped');
  assert.ok(subject.includes('Candle <magic>') === true, 'subject is plain text, not html');
  assert.ok((html.match(/ex\.test\/witchvideo/g) || []).length >= 2, 'link shown as text too');
  assert.ok(!/gradient/i.test(html), 'no gradients (house rule)');
});

/* ── the doorbell is the SHARED one ────────────────────────────────────── */
ok('chat-wake exports ring() — one wake implementation, never a copy', () => {
  const wake = require(path.join(ROOT, 'chat-wake.js'));
  assert.strictEqual(typeof wake.ring, 'function');
});

/* ── the page, statically, against the house rules ─────────────────────── */
const PAGE = fs.readFileSync(path.join(ROOT, 'public/witchvideo.html'), 'utf8');
ok('no gradients anywhere on the page', () => {
  assert.ok(!/gradient/i.test(PAGE));
});
ok('[hidden] wins over author display rules', () => {
  assert.ok(PAGE.includes('[hidden]{display:none !important}'));
});
ok('every placeholder is a NAME, never words (the prewritten-text rule)', () => {
  const allowed = new Set(['Note…', 'Idea…']);
  const found = [...PAGE.matchAll(/placeholder="([^"]*)"/g)].map(m => m[1]);
  found.forEach(p => assert.ok(allowed.has(p), `placeholder "${p}" is not a bare name`));
});
ok('no textarea ships with content inside it', () => {
  [...PAGE.matchAll(/<textarea[^>]*>([\s\S]*?)<\/textarea>/g)]
    .forEach(m => assert.strictEqual(m[1].trim(), '', 'textarea has prefilled content'));
});
ok('no text input ships with a value', () => {
  assert.ok(![...PAGE.matchAll(/<input[^>]*>/g)].some(m => /value=/.test(m[0])));
});
ok('the page script is wrapped in an IIFE', () => {
  assert.ok(/\(function \(\) \{\s*'use strict';/.test(PAGE));
});
ok('the note boxes sit on the 16px iOS floor (the asset-lightbox lesson)', () => {
  const boxes = (PAGE.match(/font:16px\/1\.5 Georgia/g) || []).length;
  assert.ok(boxes >= 3, `only ${boxes} of the three note boxes are 16px`);
  assert.ok(!/font:15px\/1\.5 Georgia/.test(PAGE), 'a note box is still under the floor');
});
ok('the sheet rides above the iOS keyboard (visualViewport wired)', () => {
  assert.ok(PAGE.includes('visualViewport'), 'nothing lifts the fixed-bottom sheet over the keyboard');
});
ok('a failed send has somewhere to say so', () => {
  assert.ok(PAGE.includes('id="sheeterr"') && PAGE.includes('id="lberr"'));
});

console.log(`\n${pass} pure checks passed`);
if (process.exitCode) process.exit(1);

/* ── the page, driven ──────────────────────────────────────────────────── */
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } })
  || (() => {
    try {
      const dirs = fs.readdirSync('/opt/pw-browsers');
      for (const d of dirs) {
        for (const rel of ['chrome-linux/chrome', 'chrome']) {
          const p = path.join('/opt/pw-browsers', d, rel);
          if (fs.existsSync(p)) return p;
        }
      }
      const flat = '/opt/pw-browsers/chromium';
      if (fs.existsSync(flat) && fs.statSync(flat).isFile()) return flat;
    } catch (_) {}
    return null;
  })();

if (!chrome) { console.log('\nno Chromium found — skipping the page half'); process.exit(0); }

const FEED = {
  reviewer: { id: 'tok1', name: 'Mom' },
  videos: [
    {
      id: 'candle-magic-ab12', title: 'Candle magic for beginners', pitch: '', state: 'review',
      from: 'Theo', updatedAt: '2026-08-21T00:00:00Z',
      cut: { v: 2, url: 'https://example.invalid/cut2.mp4', seconds: 58, at: '2026-08-21T00:00:00Z' },
      cutsCount: 2,
      stills: [{
        batch: 'scene stills', at: '2026-08-20T00:00:00Z',
        items: [{ url: 'https://example.invalid/s1.png', label: 'opening altar' },
                { url: 'https://example.invalid/s2.png', label: 'candle lit' }],
      }],
      thread: [{ from: 'Mom', text: 'love the intro', t: 4.2, at: '2026-08-20T01:00:00Z' },
               { from: 'chat', text: 'brightened the second scene', at: '2026-08-20T02:00:00Z' }],
      isNew: true,
    },
    { id: 'moon-water-cd34', title: 'Moon water', state: 'idea', pitch: 'a pitch', from: 'Theo',
      updatedAt: '2026-08-20T00:00:00Z', cut: null, cutsCount: 0, stills: [], thread: [], isNew: false },
  ],
};

const DRIVE = `
<script>
(function(){
  var L = [];
  function ok(c, m, got){ L.push((c ? 'ok  ' : 'FAIL ') + m + (c ? '' : '  got: ' + got)); }
  var send = window.fetch.bind(window);
  setTimeout(function(){
    ok(document.getElementById('vtitle').textContent === 'Candle magic for beginners', 'the newest video opens first', document.getElementById('vtitle').textContent);
    ok(/ready to watch/.test(document.getElementById('vmeta').textContent), 'with its state in words', document.getElementById('vmeta').textContent);
    ok(/v2/.test(document.getElementById('vmeta').textContent), 'and the cut version', document.getElementById('vmeta').textContent);
    ok(document.getElementById('sheet').hidden, 'the note sheet starts closed', document.getElementById('sheet').hidden);
    ok(document.getElementById('lb').hidden, 'the still overlay starts closed', document.getElementById('lb').hidden);
    ok(document.querySelectorAll('#thread .nt').length === 2, 'the thread is painted', document.querySelectorAll('#thread .nt').length);
    ok(/studio/.test(document.querySelectorAll('#thread .nt')[1].textContent), 'a chat reply reads as the studio', document.querySelectorAll('#thread .nt')[1].textContent.slice(0,40));
    ok(document.querySelectorAll('.sgrid button').length === 2, 'the stills grid is painted', document.querySelectorAll('.sgrid button').length);
    var rows = document.querySelectorAll('.vrow');
    ok(rows.length === 1, 'the shelf lists the other video', rows.length);
    ok(/in the cauldron/.test(rows[0].textContent), 'with its state', rows[0].textContent);
    ok(!rows[0].querySelector('.dot'), 'and no NEW dot on a seen one', rows[0].innerHTML.slice(0,60));
    ok(document.getElementById('ideabox').value === '', 'the idea box ships empty', document.getElementById('ideabox').value);

    // tap the video mid-play → pause + the note box, stamped with the second
    var player = document.getElementById('player');
    var paused = false;
    Object.defineProperty(player, 'paused', { get: function(){ return paused; } });
    player.pause = function(){ paused = true; };
    player.play = function(){ paused = false; return Promise.resolve(); };
    document.getElementById('stage').click();
    ok(!document.getElementById('sheet').hidden, 'tapping the playing video opens the note sheet', document.getElementById('sheet').hidden);
    ok(paused === true, 'and pauses it', paused);
    ok(/at 0:00/.test(document.getElementById('attime').textContent), 'stamped with the second she stopped at', document.getElementById('attime').textContent);
    document.getElementById('sheetclose').click();
    ok(document.getElementById('sheet').hidden, 'the chevron closes it', document.getElementById('sheet').hidden);
    ok(paused === true, 'without restarting the video on its own', paused);

    // tap again → resume; tap mid-play with the sheet up → the sheet closes
    // and the video rolls on (never playback under an open note box)
    document.getElementById('stage').click();
    ok(paused === false, 'a tap on the paused video resumes it', paused);
    document.getElementById('stage').click();
    ok(!document.getElementById('sheet').hidden && paused === true, 'the next tap pauses into the sheet again', paused);
    document.getElementById('stage').click();
    ok(document.getElementById('sheet').hidden, 'a tap with the sheet up closes it', document.getElementById('sheet').hidden);
    ok(paused === false, 'and resumes the video', paused);

    // a video note: double-tapping Send must post ONCE, close, resume
    document.getElementById('stage').click();
    document.getElementById('notebox').value = 'tighten the ending';
    document.getElementById('notesend').click();
    document.getElementById('notesend').click();
    setTimeout(function(){
      ok(document.getElementById('sheet').hidden, 'sending the note closes the sheet', document.getElementById('sheet').hidden);
      ok(paused === false, 'and resumes playback', paused);
      ok(document.querySelectorAll('#thread .nt').length === 3, 'the video note lands in the thread once', document.querySelectorAll('#thread .nt').length);

      // ♥ on this video must NOT stay lit on the next one (the leak), and
      // switching videos closes any open sheet with it
      document.getElementById('love').click();
      setTimeout(function(){
        ok(document.getElementById('love').classList.contains('on'), 'the heart lights on its own video', document.getElementById('love').className);
        document.getElementById('stage').click();       // playing → pause + sheet
        document.querySelectorAll('.vrow')[0].click();  // switch to Moon water
        ok(document.getElementById('vtitle').textContent === 'Moon water', 'the shelf switches videos', document.getElementById('vtitle').textContent);
        ok(document.getElementById('sheet').hidden, 'switching videos closes the note sheet', document.getElementById('sheet').hidden);
        ok(!document.getElementById('love').classList.contains('on'), 'the heart does not leak onto the next video', document.getElementById('love').className);
        document.querySelectorAll('.vrow')[0].click();  // back to Candle magic

        // a still opens the overlay and FREEZES the page behind it
        document.querySelectorAll('.sgrid button')[0].click();
        ok(!document.getElementById('lb').hidden, 'a still opens big', document.getElementById('lb').hidden);
        ok(document.body.style.overflow === 'hidden', 'with the page frozen behind it', document.body.style.overflow);
        ok(/opening altar/.test(document.getElementById('lblabel').textContent), 'named', document.getElementById('lblabel').textContent);
        document.getElementById('lbnote').value = 'more purple smoke';
        document.getElementById('lbsend').click();
        setTimeout(function(){
          ok(document.getElementById('lb').hidden, 'sending the note closes the overlay', document.getElementById('lb').hidden);
          ok(document.body.style.overflow === '', 'and unfreezes the page', document.body.style.overflow);
          ok(document.querySelectorAll('#thread .nt').length === 4, 'the still note lands in the thread', document.querySelectorAll('#thread .nt').length);

          // an idea from the box
          document.getElementById('ideabox').value = 'protection jar for travel';
          document.getElementById('ideasend').click();
          setTimeout(function(){
            ok(document.getElementById('ideabox').value === '', 'sending an idea clears the box', document.getElementById('ideabox').value);
            send('/result?r=' + encodeURIComponent(L.join(' | ')));
          }, 250);
        }, 250);
      }, 250);
    }, 250);
  }, 600);
})();
</script>`;

const page = PAGE + DRIVE;
const posts = [];
let finish = null;
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish && finish(decodeURIComponent(new URLSearchParams(qs).get('r') || ''));
  }
  if (route === '/api/witchvideo/feed') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(FEED));
  }
  if (route.startsWith('/api/witchvideo/')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { posts.push({ route, body: JSON.parse(body || '{}') }); } catch (_) { posts.push({ route, body: {} }); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, state: 'changes' }));
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

console.log('\ndriving the page');
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/?who=tok1`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'witchvideo-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--window-size=390,844', '--user-data-dir=' + profile, url], { stdio: 'ignore' });

  const done = (verdict, err) => {
    try { kid.kill('SIGKILL'); } catch (_) {}
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (err) { console.error(err); process.exit(1); }
    const lines = verdict.split(' | ').filter(Boolean);
    lines.forEach((l) => console.log('  ' + l));
    if (!lines.length) { console.error('no verdict — the page script never ran'); process.exit(1); }
    let bad = lines.some((l) => l.startsWith('FAIL'));

    // What the page actually sent while being driven:
    const check = (c, m) => { console.log('  ' + (c ? 'ok  ' : 'FAIL ') + m); if (!c) bad = true; };
    check(posts.some((p) => p.route === '/api/witchvideo/seen' && p.body.id === 'candle-magic-ab12'),
      'opening a NEW video posts /seen');
    const vnotes = posts.filter((p) => p.route === '/api/witchvideo/note' && p.body.text === 'tighten the ending');
    check(vnotes.length === 1, `a double-tapped Send posts the note ONCE (got ${vnotes.length})`);
    check(vnotes[0] && vnotes[0].body.id === 'candle-magic-ab12' && vnotes[0].body.t === 0,
      'the video note carries its video id and the paused second');
    const note = posts.find((p) => p.route === '/api/witchvideo/note' && p.body.still);
    check(note && note.body.still === 'https://example.invalid/s1.png' && note.body.text === 'more purple smoke',
      'the still note carries its image url and her words');
    const idea = posts.find((p) => p.route === '/api/witchvideo/idea');
    check(idea && /protection jar/.test(idea.body.pitch), 'the idea box posts /idea');

    if (bad) process.exit(1);
    console.log(`\n${lines.length + 3} page checks passed`);
    process.exit(0);
  };
  const timer = setTimeout(() => done('', 'timed out waiting for the page'), 40000);
  finish = (v) => { clearTimeout(timer); done(v); };
});
