#!/usr/bin/env node
/**
 * + NEW STORY IN THE VOICE STUDIO'S BLOCKS PICKER — the real page, headless.
 *
 * Sending a take to Cutting Blocks used to offer only the stories that already
 * exist, so a line belonging to no cut had to go and make one in the other room
 * first — and with no ready project at all the picker was a dead end that said
 * so. The + makes a BLANK story (no recording) and lands the line in it.
 *
 * What is worth measuring rather than reading off the markup: the row LEADS the
 * list, it is offered when there are no projects at all, both roads end in the
 * same one POST of the line, and the new story is named after the line rather
 * than "New story" — a shelf of identically-named stories is how her uploads
 * once disappeared into the wrong project.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
let pass = 0; let failed = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass += 1; console.log('  ok  ' + name); }
  else { failed += 1; console.log('  FAIL ' + name + (extra === undefined ? '' : ` — ${extra}`)); }
};

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); }
}

const VOICES = [{ voiceId: 'UTkHGl2ImiT6gwtAFCql', name: 'Sophie — morning', category: 'professional', color: '#e0a8c0' }];
const RENDERS = [
  { id: 'vlaaaaaaaaaa01', kind: 'tts', voiceName: 'Sophie — morning',
    text: 'we call THIS retroactive pattern manipulation.',
    status: 'done', url: 'https://x/voice-lab/vlaaaaaaaaaa01.mp3', createdAt: new Date().toISOString() },
];
// flipped to [] for the no-projects half of the test
let PROJECTS = [{ id: 'p1', title: 'Spellcasting VO', status: 'ready', blockCount: 96 }];

const blanks = []; const lines = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const body = () => new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => r(JSON.parse(b || '{}'))); });
  if (url.pathname === '/api/voicelab/status') return json({ ok: true });
  if (url.pathname === '/api/voicelab/voices') return json({ voices: VOICES });
  if (url.pathname === '/api/voicelab/history') {
    return json({ renders: url.searchParams.get('kind') === 'sts' ? [] : RENDERS.slice().reverse() });
  }
  if (url.pathname === '/api/blocks/') return json({ projects: PROJECTS });
  if (url.pathname === '/api/blocks/blank' && req.method === 'POST') {
    return body().then((b) => { blanks.push(b); json({ id: 'newstory1', blank: true }); });
  }
  const m = url.pathname.match(/^\/api\/blocks\/([^/]+)\/line$/);
  if (m && req.method === 'POST') {
    return body().then((b) => { lines.push({ project: m[1], ...b }); json({ ok: true, lineId: 'n0' }); });
  }
  if (url.pathname === '/voice') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'voice.html'), 'utf8')
      + '<script src="/pagehead.js" defer></script>'
      + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8'));
  }
  if (url.pathname === '/pagehead.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, 'pagehead.js'), 'utf8'));
  }
  res.writeHead(404); res.end('no');
});

const openPicker = async (page) => {
  await page.click('#renders .render[data-id="vlaaaaaaaaaa01"] .toblocks');
  await page.waitForSelector('.bpick .bp');
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(base + '/voice', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#renders .render');

  console.log('\nTHE ROW');
  await openPicker(page);
  const row = await page.evaluate(() => {
    const rows = [].slice.call(document.querySelectorAll('.bpick .bp'));
    const n = document.querySelector('.bpick .bp.bnew');
    return {
      first: rows[0] === n, count: rows.length,
      text: n && n.textContent.trim(),
      svg: !!(n && n.querySelector('svg')),
      // the tap has to land on the ROW, not fall through the glyph
      hits: (() => {
        if (!n) return null;
        const r = n.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return n.contains(el);
      })(),
    };
  });
  ok(row.first, 'the + new story row leads the picker');
  ok(row.text === 'New story', 'it says what it makes', row.text);
  ok(row.svg, 'and wears the plus glyph');
  ok(row.hits, 'a tap at its centre reaches the row');
  ok(row.count === 2, 'the existing story is still listed under it', `${row.count} rows`);

  console.log('\nTAPPING IT MAKES ONE AND LANDS THE LINE');
  await page.click('.bpick .bp.bnew');
  await page.waitForFunction(() => !!document.querySelector('#renders .render .bsent'));
  ok(blanks.length === 1, 'exactly one blank story is made', `${blanks.length}`);
  ok(blanks[0] && blanks[0].title === 'we call THIS retroactive pattern manipulation.',
    'named after the line, not "New story"', blanks[0] && blanks[0].title);
  ok(lines.length === 1 && lines[0].project === 'newstory1', 'the line lands in the story just made');
  ok(lines[0] && lines[0].url === 'https://x/voice-lab/vlaaaaaaaaaa01.mp3'
    && lines[0].text === 'we call THIS retroactive pattern manipulation.',
    'carrying its own audio and its own words');
  ok((await page.textContent('#renders .render .bsent')).indexOf('retroactive') >= 0,
    'and the card says where it went');

  console.log('\nWITH NO STORIES AT ALL IT IS STILL OFFERED');
  PROJECTS = [];
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#renders .render');
  await openPicker(page);
  const alone = await page.evaluate(() => {
    const rows = [].slice.call(document.querySelectorAll('.bpick .bp'));
    return { n: rows.length, isNew: rows.length === 1 && rows[0].classList.contains('bnew') };
  });
  ok(alone.isNew, 'the picker is no longer a dead end', `${alone.n} rows`);
  await page.click('.bpick .bp.bnew');
  await page.waitForFunction(() => !!document.querySelector('#renders .render .bsent'));
  ok(blanks.length === 2 && lines.length === 2, 'and it still makes one and lands the line');

  await browser.close();
  server.close();
  console.log(`\n${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
