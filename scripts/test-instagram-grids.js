#!/usr/bin/env node
// THE INSTAGRAM MOCKUPS, AND THE ICON THAT OPENS THEM (Aug 2026, Sophie:
// "an icon button in the top right within the existing header space where the
// tags are, of my update tab … that leads to two tabs — two mockups of
// instagram (the dream one is already made by the dream commercials chat so
// reuse it exactly, it plays the films. port the shape for witch videos)";
// then 2026-08-24, "another hairline tab … for my People Watching Club").
//
// NOTHING HERE COUNTS THE ACCOUNTS. The page's whole claim is that a new
// account is one row in instagram-grids.json, so a test that hardcoded "two
// tabs" would make that claim false the first time it was used — the assertions
// below are all DERIVED from the data file, and the tab-count edit that adding
// PEOPLE WATCHING would have needed is exactly the thing being prevented.
//
// Three things this pins, each of which broke something real when it was wrong:
//
//   1. ONE DATA SOURCE. The dream grid exists twice — as the frozen Compare
//      page scripts/dream-commercials/grid.js posts, and as the live page at
//      /instagram — and "reuse it exactly" is only true while both read
//      public/instagram-grids.json. Compared here as objects, so a tile edited
//      in one place cannot quietly become two different mockups of one account.
//   2. THE ICON IS REACHABLE. The true top-right corner of that row (x 324-374,
//      y 14-192 on a 390pt phone) belongs to the injected autoscroll pill, and
//      a control placed under it is invisible to a tap however "visible" it
//      reports itself. Asked with elementFromPoint at the button's own centre,
//      which is the only honest way to ask.
//   3. THE TILES PLAY. A mockup of a grid whose tiles do nothing is a picture
//      of an index; a tile with a film opens the video lightbox and a tile
//      without one opens its still, so no tile is a dead control.
//
//   node scripts/test-instagram-grids.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(0); }
}

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const read = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('  ok   ' + m);
const is = (m, got, want) => (String(got) === String(want)
  ? ok(m + ' — ' + got) : fail(m + ': got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));

const exe = () => ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome']
  .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });

// ── 1. one data source, checked without a browser ────────────────────────────
const GRIDS = JSON.parse(read('instagram-grids.json'));
const ACCOUNTS = GRIDS.accounts || [];
const acct = (id) => ACCOUNTS.find((a) => a.id === id);
const dream = acct('dream'), witch = acct('witch');

// dream and witch are named because each carries a rule of its own below; every
// OTHER account is only ever checked through the generic sweeps, so a fourth one
// needs no line here.
if (!dream || !witch) fail('the data file is missing dream or witch');
else ok(ACCOUNTS.length + ' accounts on file: ' + ACCOUNTS.map((a) => a.id).join(' · '));

// Every account is a real grid: named, with a tab word, and at least one tile
// that is not an empty NEXT placeholder.
ACCOUNTS.forEach((a) => {
  const shown = (a.tiles || []).filter((t) => !t.empty);
  if (!a.tab || !a.handle) fail('account "' + a.id + '" has no tab word or no handle');
  else if (!shown.length) fail('account "' + a.id + '" is nothing but empty tiles');
  else if (shown.some((t) => !t.id || !t.cover || !t.label)) {
    fail('a tile on "' + a.id + '" is missing id/cover/label');
  } else ok(a.id + ': ' + shown.length + ' real tile(s), each named and covered');
});

const posted = require('../scripts/dream-commercials/grid.js').TILES;
if (JSON.stringify(posted) !== JSON.stringify(dream.tiles)) {
  fail('the posted dream grid and /instagram are drawing DIFFERENT tiles — '
    + 'grid.js has ' + posted.length + ', the data file has ' + dream.tiles.length);
} else ok('the posted Compare page and /instagram read the same ' + posted.length + ' dream tiles');

const real = (a) => a.tiles.filter((t) => !t.empty);
is('the witch account holds her one existing film', real(witch).length, 1);
is('…and it is moon milk', real(witch)[0].label.toLowerCase(), 'moon milk');

// ── 2 & 3. the real pages, driven ────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch(exe() ? { executablePath: exe() } : {});

  // ---- the page ------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => fail('the Instagram page threw: ' + e.message));
    const html = read('instagram.html');
    // exactly what serveGated({pill:true}) sends: the real page plus the real
    // injected pill — the combination that has broken pages before.
    const pill = read('pill-inject.html');
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (/instagram-grids\.json/.test(url)) {
        return route.fulfill({ contentType: 'application/json', body: read('instagram-grids.json') });
      }
      if (/\/api\/chatfeed\/newest/.test(url)) {
        return route.fulfill({ contentType: 'application/json', body: '{"films":{}}' });
      }
      if (/\/instagram(\?|$)/.test(url)) {
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html + pill });
      }
      const m = url.match(/\/([\w.-]+\.(?:js|css))(\?|$)/);
      if (m && fs.existsSync(path.join(PUB, m[1]))) {
        return route.fulfill({ contentType: m[1].endsWith('.css') ? 'text/css' : 'text/javascript',
          body: read(m[1]) });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    await page.goto('https://forge.test/instagram', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.acctab', { timeout: 5000 });

    // COUNTED OFF THE DATA, never typed: this is the assertion that would have
    // had to be edited when PEOPLE WATCHING landed, and the page's promise is
    // that nothing did.
    is('one hairline tab per account on file',
      await page.locator('#tabs .acctab').count(), ACCOUNTS.length);
    is('…named for her accounts',
      (await page.locator('#tabs .acctab').allTextContents()).join(' · '),
      ACCOUNTS.map((a) => a.tab || a.id).join(' · '));

    // the underline is MEASURED off the lit tab — no tab count lives anywhere
    const line = await page.evaluate(() => {
      const t = document.getElementById('tabs');
      const on = t.querySelector('.acctab.on').getBoundingClientRect();
      const st = getComputedStyle(t, '::after');
      return { w: Math.round(on.width), tw: Math.round(parseFloat(st.width)) };
    });
    if (Math.abs(line.w - line.tw) > 1) fail('the tab line is ' + line.tw + 'px under a ' + line.w + 'px tab');
    else ok('the line sits under the lit tab (' + line.tw + 'px), measured not counted');

    // NO TAB WRAPS. The row divides 390pt minus the pill's reserved 64 between
    // however many accounts there are, so every account added makes every tab
    // narrower — and a tab word too long for its share silently goes to two
    // lines, which pushes the WHOLE row taller and leaves that one label
    // reading over two lines beside its neighbours' one. Measured with a Range
    // over the label's own text: "People watching" wrapped at three accounts
    // and "PWC" — her own shorthand for it — does not. A `textContent` or a
    // width assertion cannot see this; only the line boxes can.
    const wrapped = await page.evaluate(() => [].slice.call(
      document.querySelectorAll('.acctab')).map((t) => {
        const rg = document.createRange(); rg.selectNodeContents(t);
        return { word: t.textContent, lines: rg.getClientRects().length };
      }).filter((t) => t.lines > 1));
    if (wrapped.length) {
      fail('a tab word is too long for its share of the row and wrapped: '
        + wrapped.map((t) => '"' + t.word + '"').join(', '));
    } else ok('every tab word sits on one line at 390pt');

    // EVERY tab drew its own account's grid — swept, so a new account is
    // covered the day its row lands in the JSON and never needs a line here.
    for (let i = 0; i < ACCOUNTS.length; i++) {
      const a = ACCOUNTS[i];
      if (i) await page.locator('#tabs .acctab').nth(i).click();
      const pane = '.igpane:not([hidden]) ';
      is(a.id + ': drew every tile', await page.locator(pane + '.gtile').count(), a.tiles.length);
      is('…the ones with something behind them are buttons',
        await page.locator(pane + 'button.gtile').count(), real(a).length);
      is('…post count derived from them',
        (await page.locator(pane + '.pnums b').first().textContent()).trim(),
        String(real(a).length));
      // the handle is a bare TEXT NODE with the bio in a <span> under it, so
      // textContent runs the two together — read the node itself
      is('…her handle', await page.evaluate((sel) => {
        const el = document.querySelector(sel + '.phandle');
        return el && el.firstChild ? String(el.firstChild.nodeValue || '').trim() : '';
      }, pane), a.handle);
    }
    await page.locator('#tabs .acctab').first().click();

    // A TILE PLAYS. The film tile opens compare.js's video lightbox…
    await page.locator('.igpane:not([hidden]) button.gtile[data-film]').first().click();
    await page.waitForSelector('.cmp-vlb:not([hidden]) video', { timeout: 4000 })
      .then(() => ok('a tile with a film opens the video lightbox'))
      .catch(() => fail('tapping a film tile opened no video'));
    const src = await page.locator('.cmp-vlb video').getAttribute('src');
    if (!/\.mp4/.test(src || '')) fail('the lightbox is playing "' + src + '"');
    else ok('…playing the film itself');
    // …and the page is locked behind it, which is the overlay contract.
    is('…with the page frozen behind it',
      await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.cmp-vlb[hidden]', { timeout: 3000 }).catch(() => {});

    // the witch tab, found by POSITION IN THE DATA rather than by a typed index
    await page.locator('#tabs .acctab').nth(ACCOUNTS.indexOf(witch)).click();
    is('the witch grid drew', await page.locator('.igpane:not([hidden]) .gtile').count(),
      witch.tiles.length);
    is('…with one real tile', await page.locator('.igpane:not([hidden]) button.gtile').count(), 1);
    const cap = await page.locator('.igpane:not([hidden]) .glegend i').first().textContent();
    if (!/moon milk/i.test(cap)) fail('the witch tile is not named for moon milk: "' + cap + '"');
    else ok('…named on the legend, not written over the picture');

    // no film on file for it, so it must open its still rather than do nothing
    await page.locator('.igpane:not([hidden]) button.gtile').first().click();
    await page.waitForSelector('.cmp-lb:not([hidden]) img', { timeout: 4000 })
      .then(() => ok('a tile with no film yet opens its still — no tile is a dead control'))
      .catch(() => fail('the moon milk tile did nothing'));

    // …and out of it again, or the open overlay is what the pill check below
    // finds sitting in the corner (it is fixed over the whole page). Back to
    // DREAM too: the pill is conditional, and the witch grid is two rows on a
    // 844pt screen — nothing to scroll, so it correctly puts itself away there.
    await page.keyboard.press('Escape');
    await page.waitForSelector('.cmp-lb[hidden]', { timeout: 3000 }).catch(() => {});
    await page.locator('#tabs .acctab').first().click();
    await page.waitForFunction(() => {
      const f = document.querySelector('.float');
      return f && getComputedStyle(f).display !== 'none';
    }, null, { timeout: 4000 }).catch(() => {});

    // THE PILL. It reads the page's tokens, so it must not come out near-black,
    // and nothing tappable may sit inside its fixed corner.
    const pillGeo = await page.evaluate(() => {
      const f = document.querySelector('.float');
      if (!f) return null;
      const b = f.getBoundingClientRect();
      const btn = f.querySelector('button');
      return { x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.right),
        bottom: Math.round(b.bottom), display: getComputedStyle(f).display,
        border: getComputedStyle(btn ? f.querySelector('.vseg') : f).borderTopColor };
    });
    if (!pillGeo) fail('the injected pill is not on the page');
    else if (pillGeo.display === 'none') fail('the pill put itself away on a page that scrolls');
    else if (/rgb\(0, 0, 0\)|rgba\(0, 0, 0/.test(pillGeo.border)) {
      fail('the pill came out black — the page is not defining the five tokens');
    } else ok('the pill reads the page palette (' + pillGeo.border + ')');
    if (pillGeo) {
      const clash = await page.evaluate((g) => {
        const cx = (g.x + g.right) / 2, cy = (g.y + g.bottom) / 2;
        const hit = document.elementFromPoint(cx, cy);
        return hit ? (hit.closest('.float') ? '' : hit.className || hit.tagName) : 'nothing';
      }, pillGeo);
      if (clash) fail('something else is under the pill\'s corner: ' + clash);
      else ok('…and its corner is its own');
    }
    await page.close();
  }

  // ---- the icon on the Update tab ------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => fail('the Chats page threw: ' + e.message));
    const chats = read('chats.html');
    const CH = {}; const MSGS = [];
    for (let i = 0; i < 12; i++) {
      CH['chat' + i] = {};
      MSGS.push({ id: 'm' + i, chat: 'chat' + i, from: 'claude', text: 'said something ' + i,
        tldr: 'tldr ' + i, created: new Date(Date.now() - 3600e3 - i * 1000).toISOString(),
        postedAt: new Date(Date.now() - 3600e3 - i * 1000).toISOString() });
    }
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (/\/api\/chatfeed(\?|$)/.test(url)) {
        return route.fulfill({ contentType: 'application/json',
          body: JSON.stringify({ build: 't', chats: CH, settings: {}, truncated: [], messages: MSGS }) });
      }
      if (/\/instagram(\?|$)/.test(url)) {
        return route.fulfill({ contentType: 'text/html; charset=utf-8',
          body: '<!doctype html><title>Instagram</title><body id="igpage">grids' });
      }
      if (/\/chats(\?|$)|forge\.test\/$/.test(url)) {
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: chats });
      }
      const m = url.match(/\/([\w.-]+\.(?:js|css))(\?|$)/);
      if (m && fs.existsSync(path.join(PUB, m[1]))) {
        return route.fulfill({ contentType: m[1].endsWith('.css') ? 'text/css' : 'text/javascript',
          body: read(m[1]) });
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.goto('https://forge.test/chats?view=news', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#catrow .catchip', { timeout: 6000 });
    await page.waitForFunction(() => {
      const b = document.getElementById('iglink');
      return b && !b.hidden;
    }, null, { timeout: 6000 }).catch(() => {});

    const geo = await page.evaluate(() => {
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.right),
          bottom: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
      const btn = document.getElementById('iglink');
      const chips = [].slice.call(document.querySelectorAll('#catrow .catchip'));
      const b = btn && btn.getBoundingClientRect();
      return {
        shown: !!btn && !btn.hidden,
        btn: r(btn), row: r(document.getElementById('toolrow')),
        chipRight: chips.length ? Math.max.apply(null, chips.map((c) => Math.round(c.getBoundingClientRect().right))) : 0,
        // the honest question: what does a tap at the button's own centre reach?
        hit: b ? (function () {
          const el = document.elementFromPoint((b.x + b.right) / 2, (b.y + b.bottom) / 2);
          return el ? (el.closest('#iglink') ? 'iglink' : (el.className || el.tagName)) : 'nothing';
        }()) : 'no button',
      };
    });

    if (!geo.shown) fail('the Instagram icon is not on the Update tab');
    else ok('the icon is on the Update tab');
    if (geo.btn && geo.row) {
      // TOP RIGHT, as far as the row actually has one: right of every chip, on
      // the row's first line, and clear of the pill's reserved corner.
      if (geo.btn.x <= geo.chipRight) {
        fail('the icon is not to the right of the tags (icon x ' + geo.btn.x
          + ', last chip ends ' + geo.chipRight + ')');
      } else ok('…to the right of the tags (x ' + geo.btn.x + ' vs ' + geo.chipRight + ')');
      if (geo.btn.y - geo.row.y > 4) {
        fail('the icon dropped to a second line (row starts ' + geo.row.y + ', icon at ' + geo.btn.y + ')');
      } else ok('…on the row\'s top line');
    }
    is('…and a tap on it reaches IT, not the pill over the corner', geo.hit, 'iglink');

    await Promise.all([page.waitForNavigation(), page.click('#iglink')]);
    if (!(await page.$('#igpage'))) fail('the icon did not open /instagram');
    else ok('…and it opens /instagram');

    // it belongs to the UPDATE tab and nowhere else
    await page.goto('https://forge.test/chats', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid .crow, #grid .state', { timeout: 6000 });
    const onList = await page.evaluate(() => {
      const b = document.getElementById('iglink');
      return !!b && !b.hidden;
    });
    if (onList) fail('the icon is still on the chat list');
    else ok('…and it is put away on every other view');
    await page.close();
  }

  await browser.close();
  if (!failed) {
    console.log('PASS: the ' + ACCOUNTS.length
      + ' Instagram grids and the icon that opens them');
  }
})();
