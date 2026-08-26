// test-drop-download.js — the Dump's download route names its files properly.
//
// Pure: `downloadName` is exported precisely so this needs no Firestore, no
// Storage and no bytes. What it pins is one rule with real history behind it —
// Sophie could not save a video out of the Dump at all (a bare Storage url
// plays inline with no way out), and the first cut of this route handed her
// "EB9BB164-5300-4014-8874-29609030FC83-091441A3-…-copy_4.mov", which is what
// iOS calls a Photos export.
const { downloadName } = require('../dropbox.js');

let pass = 0; const fails = [];
const is = (label, got, want) => {
  if (got === want) { pass++; return; }
  fails.push(`${label}\n    got  ${got}\n    want ${want}`);
};

// 1. Her album name beats the phone's UUID filename.
is('album over UUID filename',
  downloadName({ bundleName: 'too many men', photoIndex: 0,
    filename: 'EB9BB164-5300-4014-8874-29609030FC83-copy_4.mov' }, 'drops/_/abc.mov'),
  'too many men.mov');

// 2. A name SHE typed wins over everything.
is('her own name wins',
  downloadName({ name: 'final cut', bundleName: 'too many men', photoIndex: 3 }, 'drops/_/abc.mp4'),
  'final cut.mp4');

// 3. An album of many gets its index back, one-based — twelve files must not
//    all land called the same thing.
is('index on a batch',
  downloadName({ bundleName: 'dinner party', photoIndex: 5 }, 'drops/_/abc.jpg'),
  'dinner party 6.jpg');
is('first of a batch carries no index',
  downloadName({ bundleName: 'dinner party', photoIndex: 0 }, 'drops/_/abc.jpg'),
  'dinner party.jpg');

// 4. A real filename is still used when there is no album.
is('real filename survives',
  downloadName({ filename: 'moon milk v3.mp4' }, 'drops/_/abc.mp4'),
  'moon milk v3.mp4');

// 5. The extension comes off the STORED path, never off her name. A doc whose
//    filename says .mp4 over a .mov object must download as .mov or her phone
//    opens it wrong.
is('extension follows the object, not the name',
  downloadName({ name: 'clip.mp4' }, 'drops/_/abc.mov'),
  'clip mp4.mov');

// 6. Nothing to go on at all still yields a usable name.
is('bare fallback', downloadName({}, 'drops/_/abc.png'), 'dump.png');
is('unknown extension', downloadName({ name: 'thing' }, 'drops/_/abc'), 'thing.bin');

// 7. Quotes and slashes are stripped — the value goes inside a quoted
//    Content-Disposition header, so a stray " would truncate the filename.
const tricky = downloadName({ name: 'her "best" cut / v2' }, 'drops/_/abc.mp4');
is('header-safe', tricky, 'her best cut v2.mp4');
if (/["\\/]/.test(tricky)) fails.push('header-safe: quotes or slashes survived');

// 8. A name longer than the cap is trimmed, extension intact.
const long = downloadName({ name: 'x'.repeat(200) }, 'drops/_/abc.mp4');
is('long name capped', long.length, 84);
is('long name keeps its extension', long.endsWith('.mp4'), true);

// ── The button, on the real page ────────────────────────────────────────────
// The naming rule above can be perfect while the control is unreachable, so
// this asks the only honest question: does a tap at the button's own centre
// land on the button? (`isVisible()` says yes even when something is over it —
// the lesson the Questions pill and the Meta Assets lightbox both taught.)
async function page() {
  let chromium, express;
  try { ({ chromium } = require('playwright')); express = require('express'); }
  catch { console.log('  (headless half skipped — playwright not installed)'); return; }

  const app = express();
  app.get('/api/drop/tracks', (q, r) => r.json({ tracks: [] }));
  app.get('/api/drop/sessions', (q, r) => r.json({ sessions: [] }));
  app.get('/api/drop/status', (q, r) => r.json({ ok: true }));
  app.get('/api/drop/bundles', (q, r) => r.json({ bundles: [{
    bundle: 'too-many-men', bundleName: 'too many men', track: null,
    files: [{ id: 'ITEM1', url: '/x.mp4', media: 'video', posterUrl: '/p.jpg', photoIndex: 0 }],
  }] }));
  app.get(['/x.mp4', '/p.jpg'], (q, r) => r.status(204).end());
  app.use(express.static(require('path').join(__dirname, '..', 'public')));

  const srv = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const port = srv.address().port;
  let browser;
  try {
    // The same resolver the other page tests use — the bundled path can be a
    // version behind whatever is actually on the box.
    const fs = require('fs'); const pth = require('path');
    let exe = null;
    const root = '/opt/pw-browsers';
    if (fs.existsSync(root)) {
      for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
        const c = pth.join(root, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(c)) { exe = c; break; }
      }
    }
    browser = await chromium.launch(exe ? { executablePath: exe } : {});
  } catch {
    console.log('  (headless half skipped — no browser binary)');
    srv.close(); return;
  }
  try {
    const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(`http://127.0.0.1:${port}/dump.html`);
    await pg.waitForTimeout(800);
    await pg.evaluate(() => openLB({ id: 'ITEM1', m: 'video', url: '/x.mp4' }));
    await pg.waitForTimeout(150);

    is('save button visible', await pg.locator('#lbsave').isVisible(), true);
    is('save points at the download route',
      await pg.locator('#lbsave').getAttribute('href'), '/api/drop/file/ITEM1');

    // A link, not a button: iOS honours Content-Disposition on a navigation.
    is('save is an anchor',
      await pg.locator('#lbsave').evaluate((el) => el.tagName), 'A');

    const hit = await pg.evaluate(() => {
      const r = document.getElementById('lbsave').getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el && (el.id || el.tagName);
    });
    is('a tap at its centre reaches it', hit, 'lbsave');

    const box = await pg.locator('#lbsave').boundingBox();
    if (!box || box.height < 30) fails.push(`save tap target too small: ${JSON.stringify(box)}`);
    else pass++;

    if (errs.length) fails.push('page errors: ' + errs.join(' | '));
    else pass++;
  } finally {
    await browser.close(); srv.close();
  }
}

page().then(() => {
  if (fails.length) {
    console.error(`\n${fails.length} FAILED:\n  ` + fails.join('\n  ') + '\n');
    process.exit(1);
  }
  console.log(`test-drop-download: ${pass} passed`);
});
