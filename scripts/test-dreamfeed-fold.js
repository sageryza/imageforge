#!/usr/bin/env node
// Regression test for Sophie's ask: "the dream text should be truncated so it's
// the same amount of scrolling no matter what … but there always has to be a
// way to close it … so you don't have to wait till you get to the bottom."
//
// Drives the REAL public/dreamapp.html in a headless browser against a stub API
// and asserts the four things the fold has to get right:
//   1. every collapsed dream is the SAME height, however long its words are,
//   2. a dream short enough to fit is offered no button at all,
//   3. opened, the "see less" is ON SCREEN while you are in the MIDDLE of the
//      text — the whole point; a button pinned to the end would pass a naive
//      "it exists" check and fail her,
//   4. closing puts the dream's top back on screen instead of stranding her
//      halfway down what she just collapsed.
// The extra-panels fold gets the same treatment, since it shares wireFold.
//
//   npm install playwright --no-save && node scripts/test-dreamfeed-fold.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;
const para = (n) => Array.from({ length: n }, (_, i) => `sentence number ${i} of this dream, long enough to wrap.`).join(' ');

// One entry per person per NIGHT (Sophie) — the server hands over `nights`,
// each already holding that person's dreams for the day in order.
const night = (id, extra) => ({
  id, by: id.toUpperCase(), mine: false, feltCount: 0, felt: false, commentCount: 0,
  publicOn: '2026-08-08', panels: [], cover: null, ...extra,
});
const FEED = {
  sealed: false,
  today: '2026-08-08',
  nights: [
    night('long', { title: 'The Long One', feltCount: 3, createdAt: new Date(T0).toISOString(),
      dreams: [{ id: 'long', title: 'The Long One', words: para(60) }] }),
    // A night of TWO dreams: one entry, one heart, both sets of words inside it.
    night('alsolong', { title: 'Also Long', feltCount: 1, createdAt: new Date(T0 - 60000).toISOString(),
      dreams: [
        { id: 'alsolong', title: 'Also Long', words: para(120) },
        { id: 'alsolong2', title: 'And Then', words: para(80) },
      ] }),
    night('short', { title: 'The Short One', createdAt: new Date(T0 - 120000).toISOString(),
      dreams: [{ id: 'short', title: 'The Short One', words: 'a bus. it kept going.' }] }),
    night('pics', { title: 'Many Panels', mine: true, createdAt: new Date(T0 - 180000).toISOString(),
      dreams: [{ id: 'pics', title: 'Many Panels', words: para(3) }],
      panels: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ dreamId: 'pics', i, url: '/px.png?i=' + i, captions: [] })),
      cover: { dreamId: 'pics', i: 0, url: '/px.png?i=0', captions: [] } }),
  ],
};

// One transparent pixel, so panel images resolve without any network.
const PX = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(body); };
  if (url.pathname === '/px.png') return send(200, 'image/gif', PX);
  if (url.pathname === '/api/witch/firebase-config') return send(200, 'application/json', JSON.stringify({ apiKey: 'stub', authDomain: 'stub', projectId: 'stub' }));
  if (url.pathname === '/api/dreamapp/feed') return send(200, 'application/json', JSON.stringify(FEED));
  if (url.pathname === '/api/dreamapp/dreams') return send(200, 'application/json', JSON.stringify({ dreams: [] }));
  if (/\/api\/dreamapp\/nights\/.*\/cover$/.test(url.pathname)) return send(200, 'application/json', JSON.stringify({ ok: true }));
  if (url.pathname === '/dreamfeed') return send(200, 'text/html', fs.readFileSync(path.join(PUB, 'dreamapp.html')));
  return send(404, 'text/plain', 'no');
});

// Stands in for the two firebase-compat scripts the page loads from gstatic.
const FAKE_FIREBASE = `
window.firebase = {
  initializeApp: function(){},
  auth: function(){
    return {
      currentUser: { getIdToken: function(){ return Promise.resolve('tok'); } },
      getRedirectResult: function(){ return Promise.resolve({}); },
      onAuthStateChanged: function(cb){ setTimeout(function(){ cb({ uid: 'u1' }); }, 0); },
      signOut: function(){},
    };
  },
};
window.firebase.auth.GoogleAuthProvider = function(){};
window.firebase.auth.OAuthProvider = function(){ this.addScope = function(){}; };
`;

const fails = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // The host ships a browser under PLAYWRIGHT_BROWSERS_PATH that may not match
  // the installed playwright's expected build — point at it rather than
  // downloading a second copy.
  const found = (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers') : [])
    .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).filter((p) => fs.existsSync(p));
  const browser = await chromium.launch(found.length ? { executablePath: found[0] } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // iPhone 13

  // A regex, not a glob: "**/gstatic.com/**" never matches, because there is no
  // slash immediately before the host in https://www.gstatic.com/…
  await page.route(/gstatic\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_FIREBASE }));

  await page.goto(`${base}/dreamfeed`);
  await page.waitForSelector('.dream');

  const box = (sel) => page.locator(sel).first().boundingBox();

  // "How this works" opens from the GEAR and nowhere else (Sophie) — it never
  // greets a first visit, so an untouched page must not be carrying it.
  check('the explainer does not greet a first visit', (await page.locator('#howwrap').count()) === 0);

  // 1. same amount of scrolling, whatever the dream's length
  const hLong = (await box('.dream[data-id="long"]')).height;
  const hAlso = (await box('.dream[data-id="alsolong"]')).height;
  check('two dreams of very different length collapse to the same height',
    Math.abs(hLong - hAlso) < 1, `${Math.round(hLong)}px vs ${Math.round(hAlso)}px`);

  // 2. nothing to open means no button
  const shortBtn = await page.locator('.dream[data-id="short"] [data-wmore]').isVisible();
  const longBtn = await page.locator('.dream[data-id="long"] [data-wmore]').isVisible();
  check('a dream that already fits is offered no fold', !shortBtn);
  check('a clamped dream is offered the fold', longBtn);

  // 3. the close is reachable from the MIDDLE of the opened text
  await page.locator('.dream[data-id="alsolong"] [data-wmore]').click();
  const opened = (await box('.dream[data-id="alsolong"]')).height;
  check('opening really expands it', opened > hAlso * 3, `${Math.round(hAlso)}px -> ${Math.round(opened)}px`);

  const stuck = await page.locator('.dream[data-id="alsolong"] [data-wmore]').evaluate(
    (el) => getComputedStyle(el).position);
  check('the opened button is sticky', stuck === 'sticky', stuck);

  // scroll to the middle of the expanded dream and look for the button
  const dreamTop = await page.locator('.dream[data-id="alsolong"]').evaluate(
    (el) => el.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((y) => window.scrollTo(0, y), dreamTop + opened / 2);
  await page.waitForTimeout(120);
  const mid = await page.locator('.dream[data-id="alsolong"] [data-wmore]').boundingBox();
  const vh = 844;
  check('mid-read, "see less" is on screen', mid && mid.y > 0 && mid.y + mid.height <= vh,
    mid ? `y=${Math.round(mid.y)} of ${vh}` : 'not rendered');
  const navTop = await page.locator('nav').evaluate((el) => el.getBoundingClientRect().top);
  check('and it sits clear of the bottom nav', mid && mid.y + mid.height <= navTop + 1,
    mid ? `button bottom ${Math.round(mid.y + mid.height)}, nav top ${Math.round(navTop)}` : '');

  // 4. closing brings the dream's top back
  await page.locator('.dream[data-id="alsolong"] [data-wmore]').click();
  await page.waitForTimeout(120);
  const after = await page.locator('.dream[data-id="alsolong"]').boundingBox();
  check('closing puts the dream back on screen', after && after.y >= -1 && after.y < vh,
    after ? `top at y=${Math.round(after.y)}` : 'gone');
  const reclamped = (await box('.dream[data-id="alsolong"]')).height;
  check('and it is collapsed again', Math.abs(reclamped - hAlso) < 1);

  // A night of two dreams is ONE entry (Sophie): one heart, one comment count,
  // both dreams' words inside it, parted by a rule.
  const twoNight = page.locator('.dream[data-id="alsolong"]');
  check('two dreams from one night are one entry', (await page.locator('.dream').count()) === FEED.nights.length,
    `${await page.locator('.dream').count()} entries for ${FEED.nights.length} nights`);
  check('that entry carries one heart', (await twoNight.locator('.heart').count()) === 1);
  check('and both dreams\' words are inside it', (await twoNight.locator('.wtext .part').count()) === 2);
  const ruled = await twoNight.evaluate((el) =>
    parseFloat(getComputedStyle(el.querySelectorAll('.wtext .part')[1]).borderTopWidth));
  check('with a faint rule between them', ruled === 1, `${ruled}px`);

  // Pictures: ONE cover, the rest behind the fold, so an entry costs the same
  // scroll however many pictures the night produced.
  await page.locator('.dream[data-id="pics"] .tab[data-t="pics"]').click();
  const picsNight = page.locator('.dream[data-id="pics"]');
  check('the night shows ONE cover picture', (await picsNight.locator('.pgrid.cover img').count()) === 1);
  const coverSrc = await picsNight.locator('.pgrid.cover img').getAttribute('src');
  check('and the cover is the chronologically first', /i=0$/.test(coverSrc), coverSrc);
  const shown = await picsNight.locator('.pgrid:not([hidden]) img').count();
  check('the rest are folded away', shown === 1, `${shown} visible`);
  const picsBtn = page.locator('.dream[data-id="pics"] [data-more]');
  check('the extra panels offer a fold', await picsBtn.isVisible());
  check('and the fold names how many', /7/.test(await picsBtn.innerText()), await picsBtn.innerText());
  await picsBtn.click();
  const picsStuck = await picsBtn.evaluate((el) => getComputedStyle(el).position);
  check('the opened panels button is sticky too', picsStuck === 'sticky', picsStuck);
  check('opened, every picture of the night is there',
    (await picsNight.locator('.pgrid img').count()) === 8);
  await picsBtn.click();
  const restHidden = await page.locator('.dream[data-id="pics"] [data-rest]').isHidden();
  check('and it closes the extra panels again', restHidden);

  // header: the app's name and a gear, no date
  const headerText = await page.locator('header').innerText();
  check('the header carries no date', !/\d/.test(headerText), JSON.stringify(headerText));
  check('the gear is there', await page.locator('#gearBtn').isVisible());
  await page.locator('#gearBtn').click();
  check('the gear opens a menu holding sign out', await page.locator('#gearMenu #signOut').isVisible());
  // The gear is the ONLY way to the explainer, and it opens as a plain pop-up:
  // cream card, black text, a normal font (Sophie).
  check('the gear holds the explainer', await page.locator('#gearMenu #howBtn').isVisible());
  await page.locator('#gearMenu #howBtn').click();
  check('tapping it opens the pop-up', await page.locator('#howwrap .how').isVisible());
  const howLook = await page.evaluate(() => {
    const c = getComputedStyle(document.querySelector('.how'));
    return { pos: getComputedStyle(document.querySelector('#howwrap')).position,
             bg: c.backgroundColor, fg: c.color, font: c.fontFamily,
             head: getComputedStyle(document.querySelector('.how h3')).fontFamily,
             locked: getComputedStyle(document.body).overflow };
  });
  const isDark = (c) => { const n = c.match(/\d+/g).map(Number); return n[0] + n[1] + n[2] < 160; };
  check('it lays OVER the page, not in the feed', howLook.pos === 'fixed', howLook.pos);
  check('the card is cream with black text', !isDark(howLook.bg) && isDark(howLook.fg),
    `${howLook.bg} / ${howLook.fg}`);
  check('and it is a normal font, not the serif or the app voice',
    !/Georgia|Times/i.test(howLook.font) && !/Georgia|Times/i.test(howLook.head), howLook.font);
  check('the page behind the pop-up is locked', howLook.locked === 'hidden', howLook.locked);
  await page.locator('#howwrap').click({ position: { x: 5, y: 5 } });
  check('a tap outside the card closes it', (await page.locator('#howwrap').count()) === 0);
  check('and the page is usable again',
    (await page.evaluate(() => getComputedStyle(document.body).overflow)) !== 'hidden');
  await page.locator('#gearBtn').click();
  await page.locator('#gearScrim').click({ position: { x: 5, y: 5 } });
  check('tapping away puts it back', (await page.locator('#gearMenu').count()) === 0);

  // lightbox: a tapped panel opens big, locks the page, and gives back the spot.
  // The panel has to be ON SCREEN before the position is read — a click scrolls
  // its target into view, so measuring first would compare against a scroll
  // position the tap itself moved.
  await page.locator('.dream[data-id="pics"] .pgrid img').first().scrollIntoViewIfNeeded();
  const beforeY = await page.evaluate(() => window.scrollY);
  await page.locator('.dream[data-id="pics"] .pgrid img').first().click();
  check('a tapped panel opens the lightbox', await page.locator('#lb').isVisible());
  const locked = await page.evaluate(() => getComputedStyle(document.body).overflow);
  check('the page behind it is locked', locked === 'hidden', locked);
  await page.locator('#lb').click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(120);
  check('tapping it closes', await page.locator('#lb').isHidden());
  const afterY = await page.evaluate(() => window.scrollY);
  check('and she lands back where she opened it', Math.abs(afterY - beforeY) < 2, `${beforeY} -> ${afterY}`);

  // FEATURE A PHOTO — the dreamer picks the night's face, having seen it big.
  // Offered on any picture but the one already featured, and only on your own.
  check('the cover itself is not offered as a feature', await page.locator('#lbfeat').isHidden());
  await page.locator('.dream[data-id="pics"] [data-more]').click();
  await page.locator('.dream[data-id="pics"] [data-rest] img').first().scrollIntoViewIfNeeded();
  await page.locator('.dream[data-id="pics"] [data-rest] img').first().click();
  check('another picture of your own night offers "feature this one"',
    await page.locator('#lbfeat').isVisible());
  await page.locator('#lb').click({ position: { x: 5, y: 5 } });
  // Someone ELSE's night never offers it, however many pictures it has.
  const mineOff = await page.evaluate(() => {
    const el = document.querySelector('.dream[data-id="long"]');
    return el ? !el.dataset.mine : false;
  });
  check('someone else\'s night is not yours to feature', mineOff);

  // the two surfaces: black entries sitting on cream, a black line between
  await page.evaluate(() => window.scrollTo(0, 0));
  const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const card = await page.evaluate(() => getComputedStyle(document.querySelector('.post')).backgroundColor);
  const dark = (c) => { const n = c.match(/\d+/g).map(Number); return n[0] + n[1] + n[2] < 160; };
  check('the page is cream', !dark(paper), paper);
  check('an entry is black', dark(card), card);
  check('the entry runs edge to edge, square-cornered', await page.evaluate(() => {
    const el = document.querySelector('.post');
    const b = el.getBoundingClientRect();
    const r = getComputedStyle(el).borderTopLeftRadius;
    return b.left <= 0.5 && b.right >= window.innerWidth - 0.5 && parseFloat(r) === 0;
  }));
  check('the line between entries runs edge to edge too', await page.evaluate(() => {
    const posts = [...document.querySelectorAll('.post')];
    const second = posts.find((p, i) => i && p.previousElementSibling === posts[i - 1]);
    if (!second) return false;
    const s = getComputedStyle(second, '::before');
    return parseFloat(s.left) === 0 && parseFloat(s.right) === 0;
  }));
  check('no rule sits between a date and its dreams', await page.evaluate(() => {
    const w = getComputedStyle(document.querySelector('.dayhead')).borderBottomWidth;
    return parseFloat(w) === 0;
  }));
  // between two entries: cream, a black line, cream — and the line touches neither
  const gap = await page.evaluate(() => {
    const posts = [...document.querySelectorAll('.post')];
    let a = null;
    for (let i = 1; i < posts.length; i++) {
      if (posts[i].previousElementSibling === posts[i - 1]) { a = [posts[i - 1], posts[i]]; break; }
    }
    if (!a) return null;
    const top = a[0].getBoundingClientRect().bottom;
    const bot = a[1].getBoundingClientRect().top;
    const rule = getComputedStyle(a[1], '::before');
    return { gap: bot - top, ruleTop: parseFloat(rule.top), height: parseFloat(rule.height), bg: rule.backgroundColor };
  });
  check('two adjacent entries are parted by a real gap', gap && gap.gap > 20, gap && `${Math.round(gap.gap)}px`);
  check('with a black hairline floating in the middle of it',
    gap && gap.height === 1 && dark(gap.bg) && Math.abs(Math.abs(gap.ruleTop) - gap.gap / 2) < 2,
    gap && `line ${gap.height}px at ${gap.ruleTop}px of a ${Math.round(gap.gap)}px gap`);

  // words / pictures in small caps
  const caps = await page.evaluate(() => getComputedStyle(document.querySelector('.tab')).fontVariantCaps);
  check('the words/pictures labels are small caps', caps === 'small-caps', caps);

  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
