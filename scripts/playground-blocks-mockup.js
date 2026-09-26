#!/usr/bin/env node
// PHOTO MOCKUP — blocks in the Playground (2026-09-26, Sophie: "i want to add
// the divide and cut delete thing to playground … any elegant proposal" →
// "make the mockup"). Nothing here is built into the page: this runs the REAL
// /playground page in a headless phone against the LIVE data, then drops
// Footage's own block markup and paint (the heading row with its tick and
// chevron, the gold line, the three corner buttons, the join mark) onto the
// prompt box and photographs three states — so what she looks at is the real
// page with the proposal drawn on it, not a drawing of the page.
//   node scripts/playground-blocks-mockup.js [--out dir]
// No deploy, no model call, nothing spent, her live site untouched.
const fs = require('fs'), path = require('path'), http = require('http');
const servePublic = require('./lib/public-asset');
const ROOT = path.join(__dirname, '..');
const LIVE = 'https://imageforge-q125.onrender.com';
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(require('os').tmpdir(), 'playground-blocks-mockup');
fs.mkdirSync(OUT, { recursive: true });

// Footage's own glyphs, verbatim (footage.html ICONS)
const ICONS = {
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  divide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 16-4 4-4-4"/><path d="M3 12h18"/><path d="m8 8 4-4 4 4"/></svg>',
  join: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22v-6"/><path d="M12 8V2"/><path d="M4 12H2"/><path d="M10 12H8"/><path d="M16 12h-2"/><path d="M22 12h-2"/><path d="m15 19-3-3-3 3"/><path d="m15 5-3 3-3-3"/></svg>',
};
// Footage's block paint, lifted (footage.html .promptwrap / .fold / .joinrow rules)
const CSS = `
.promptwrap .boxbtn{position:absolute;bottom:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;padding:0;margin:0;border:1px solid #d8cfc0;border-radius:6px;background:#fdfbf7;color:#6f675e}
.promptwrap .boxbtn svg{width:14px;height:14px}
.promptwrap .bigger{right:56px}
.promptwrap .wipeb{right:88px}
.promptwrap .divide{right:120px}
.promptwrap.mock{margin-top:10px}
.promptwrap .bfold{display:none;width:100%;box-sizing:border-box;margin:0 0 4px;padding:6px 0 4px;align-items:center;gap:6px;border:0;background:none;font-family:inherit;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#9a8f7d;text-align:left}
.panel.many .promptwrap .bfold{display:flex}
.promptwrap .bfold .chev svg{width:13px;height:13px;flex:none;display:block}
.promptwrap .bfold .lw{text-transform:none;letter-spacing:0;font-size:11.5px;flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.promptwrap .bfold .bflab{flex:none;white-space:nowrap}
.promptwrap .bfold .bpick{position:relative;display:none;flex:none;align-items:center;justify-content:center;width:16px;height:16px;box-sizing:border-box;border:1px solid #c3b9a8;border-radius:6px;background:#fff;color:#a0402a}
.panel.many .promptwrap .bpick{display:inline-flex}
.promptwrap .bfold .bpick.on{border-color:#a0402a}
.promptwrap .bfold .bpick svg{width:11px;height:11px;display:none}
.promptwrap .bfold .bpick.on svg{display:block}
.joinrow{display:flex;justify-content:center;padding:4px 0 6px}
.joinrow .joinb{width:26px;height:26px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid #d8cfc0;border-radius:6px;background:#fdfbf7;color:#6f675e}
.joinrow .joinb svg{width:14px;height:14px;display:block}
.panel.many .promptwrap.active .pblock{border-color:#c9a96a;box-shadow:0 0 0 1px #c9a96a}
.promptwrap .pblock{resize:none;min-height:0;height:auto}
/* the star says how many when blocks are ticked — Footage's own tooltip, as a mark */
button.go{position:relative}
button.go .gocount{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;box-sizing:border-box;padding:0 5px;border-radius:6px;background:#a0402a;color:#fff;font-size:11px;font-weight:600;line-height:18px;text-align:center}
`;
const HEAD = 'Sophie in the blue pajamas at the ward window, morning light through the blinds, camera at eye level.';
const TAIL = 'She turns from the window and walks to the door, the hallway bright behind it.';

(async () => {
  const { chromium } = require('playwright');
  const server = http.createServer(async (req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    // storage.googleapis.com is off this container's network list, so the
    // page's own Storage pictures ride through here as /gcs/<path>
    const gcs = url.pathname.startsWith('/gcs/');
    if (gcs || url.pathname.startsWith('/api/') || url.pathname.startsWith('/thumbs/')) {
      try {
        const r = await fetch(gcs ? 'https://storage.googleapis.com' + req.url.slice(4) : LIVE + req.url, { headers: { accept: req.headers.accept || '*/*' } });
        const buf = Buffer.from(await r.arrayBuffer());
        res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream' });
        return res.end(buf);
      } catch (e) { res.writeHead(502); return res.end(String(e)); }
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(base + '/playground?style=chatgpt');
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: CSS });
  await page.evaluate(() => document.querySelectorAll('img[src^="https://storage.googleapis.com/"]').forEach((i) => { i.src = '/gcs/' + i.src.slice('https://storage.googleapis.com/'.length); }));
  await page.waitForTimeout(800);

  async function paint(state) {
    await page.evaluate(({ state, ICONS, HEAD, TAIL }) => {
      const panel = document.querySelector('.promptwrap').closest('.panel') || document.querySelector('.promptwrap').parentElement;
      // put the panel back to one block
      panel.querySelectorAll('.promptwrap.mock, .joinrow').forEach((n) => n.remove());
      panel.classList.remove('many');
      const first = document.querySelector('.promptwrap');
      const big = document.getElementById('bigprompt');
      big.classList.add('boxbtn', 'bigger');
      const prompt = document.getElementById('prompt');
      prompt.classList.add('pblock');
      const go = document.getElementById('go');
      go.querySelectorAll('.gocount').forEach((n) => n.remove());
      function head(n, words, on) {
        return '<button type="button" class="fold bfold"><span class="bpick' + (on ? ' on' : '') + '">' + ICONS.check + '</span><span class="chev">' + ICONS.chev + '</span><span class="bflab">Block ' + n + '</span><span class="lw">' + words + '</span></button>';
      }
      function corner() {
        return '<button type="button" class="boxbtn divide" aria-label="Divide here">' + ICONS.divide + '</button>'
          + '<button type="button" class="boxbtn wipeb" aria-label="Take this box off">' + ICONS.x + '</button>';
      }
      if (!first.querySelector('.divide')) big.insertAdjacentHTML('beforebegin', corner());
      first.classList.remove('active');
      function fit(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
      if (state === 'one') {
        prompt.value = HEAD + ' ' + TAIL;
        fit(prompt);
        prompt.focus();
        prompt.setSelectionRange(HEAD.length + 1, HEAD.length + 1);
        return;
      }
      if (state === 'after') {
        // the first half taken off with its ✕ — the second half is the one box left
        prompt.value = TAIL; fit(prompt);
        prompt.blur();
        return;
      }
      panel.classList.add('many');
      prompt.value = HEAD; fit(prompt);
      const w2 = document.createElement('div');
      w2.className = 'promptwrap mock active';
      w2.innerHTML = '<textarea class="pblock"></textarea>' + corner()
        + '<button type="button" class="boxbtn bigger" aria-label="Bigger box">' + big.innerHTML + '</button>';
      first.insertAdjacentElement('afterend', w2);
      const t2 = w2.querySelector('.pblock');
      t2.value = TAIL; fit(t2);
      prompt.blur(); t2.focus();
    }, { state, ICONS, HEAD, TAIL });
    await page.waitForTimeout(250);
    const top = await page.evaluate(() => (document.querySelector('.promptwrap').closest('.panel') || document.body).getBoundingClientRect().top + window.scrollY);
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 12)), top);
    await page.waitForTimeout(200);
    const file = path.join(OUT, state + '.png');
    await page.screenshot({ path: file });
    console.log('wrote', file);
  }
  await paint('one');
  await paint('two');
  await paint('after');
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
