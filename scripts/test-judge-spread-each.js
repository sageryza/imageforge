#!/usr/bin/env node
// EACH PICTURE ON A SPREAD IS ITS OWN DECISION, AND THE FOOTER WEARS HER WORDS
// (2026-09-03, Sophie, on the triangle review deck: "new buttons — add to deck
// · maybe add to deck · no · choose icons for buttons" · "compare similar
// prompts to each other … both are the same card" · "when i x one, it
// disappears from the compare (into the no pile) but gone from that
// particular card decision, so i can compare the leftovers in peace" · "note
// section can be smaller" · "make sure lightbox … includes all 5 buttons and
// left right tap").
//
// What this pins, driving the REAL page files in headless Chromium at her
// 390pt viewport — every assertion a MEASUREMENT or a reading of what the
// stub server really received, because a renamed button, a picture that left
// a spread and a lightbox with no zones all look fine in markup:
//   • the footer's three wear the page's labels and the triangle mark, and the
//     piles are named by them
//   • a spread's pictures each carry the three; no "this one"
//   • a NO under one picture posts THAT card's id, mirrors its Assets vote,
//     takes it off the spread, and does NOT move the deck
//   • once every picture still on the spread is decided, a quick deck moves on
//   • the No pile holds the picture as its own tile, opening its spread
//   • a verdict doc keyed by CARD ids comes back lit (the transfer)
//   • the note box is the small one
//   • the lightbox on a picture has ♥ ✕ + three doors and left/right zones,
//     and its ♥ marks the picture under it
//   • page-templates keeps buttons / note / spreadEach and drops an unknown icon
//
//   node scripts/test-judge-spread-each.js

const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(`${name}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`);
}
function ok(name, cond) { is(name, Boolean(cond), true); }

// ── the validator, pure ──────────────────────────────────────────────────────
{
  const pt = require('../page-templates.js');
  const v = pt.validateTemplate('grid', {
    groups: [{ label: 'a', items: [{ id: 'x', img: 'https://storage.googleapis.com/b/o.webp' }] }],
    buttons: { yes: { label: 'Add to deck', icon: 'triangle' }, maybe: { label: 'Maybe add to deck' },
      no: { icon: 'not-an-icon' } },
    note: 'small', spreadEach: true, goodWord: 'ADDED', badWord: 'NO',
  });
  ok('the validator accepts the page', v.ok);
  is('…keeps the renamed buttons', v.data.buttons,
    { yes: { label: 'Add to deck', icon: 'triangle' }, maybe: { label: 'Maybe add to deck' } });
  is('…drops an unknown icon rather than refusing', v.data.buttons.no, undefined);
  is('…keeps note:small', v.data.note, 'small');
  is('…keeps spreadEach', v.data.spreadEach, true);
  is('…keeps the stamp words', [v.data.goodWord, v.data.badWord], ['ADDED', 'NO']);
  const judgeSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'judge.js'), 'utf8');
  const m = judgeSrc.match(/var MOM_ICONS = \{([^}]+)\}/);
  const names = m ? m[1].split(',').map((s) => s.split(':')[0].trim()).sort() : [];
  is('the icon names are ONE list in two files', names, pt.BUTTON_ICONS.slice().sort());
}

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.log(`judge spread-each: ${pass} passed, ${fails.length} failed (headless skipped — no playwright)`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
}
function exe() {
  for (const r of ['/opt/pw-browsers']) {
    let kids = [];
    try { kids = fs.readdirSync(r); } catch (e) { continue; }
    for (const k of kids.filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join(r, k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const PUB = path.join(__dirname, '..', 'public');
const PIC = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">'
  + '<rect width="1024" height="1024" fill="#cbb"/></svg>').toString('base64');
const U = (n) => 'https://storage.googleapis.com/x/triangle/' + n + '.webp';
// the FACE is an http url served by the stub, so a request for it is countable
const card = (id, label) => ({ id, label, img: '/pic/' + id + '.svg', url: U(id), promptContent: label,
  promptStyle: 'triangle [content]', model: 'gpt-image-2', quality: 'medium' });

const DATA = {
  chat: 'tinder-compare-assets',
  sheet: 'page-TEST',
  aspect: 'square',
  start: 'swipe',
  pace: 'quick',
  browse: true,
  note: 'small',
  spreadEach: true,
  spreadAll: true,
  voice: true,
  buttons: { yes: { label: 'Add to deck', icon: 'triangle' },
    maybe: { label: 'Maybe add to deck', icon: 'maybe' }, no: { label: 'No', icon: 'x' } },
  groups: [
    { label: 'circus tent', items: [card('tent-1', 'animals peeking out of a circus tent'),
      card('tent-2', 'animals hiding in a circus tent'), card('tent-3', 'animals hiding in a circus tent')] },
    { label: '', items: [card('solo-1', 'a pile of seashells')] },
    { label: '', items: [card('solo-2', 'a hedge maze from above')] },
    { label: 'soap lather', items: [card('soap-1', 'soap'), card('soap-2', 'soap'), card('soap-3', 'soap'), card('soap-4', 'soap')] },
    { label: 'crows', items: [1, 2, 3, 4, 5, 6].map((n) => card('crow-' + n, 'crows ' + n)) },
  ],
};

const HTML = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="/compare.css">
<div class="wrap"><div id="pageviews"></div></div>
<script src="/compare.js"></script>
<script src="/asset-lightbox.js"></script>
<script src="/asset-actions.js"></script>
<script src="/asset-view.js"></script>
<script src="/judge.js"></script>
<script src="/grid.js"></script>
<script src="/page-views.js"></script>
<script>window.__pageViews({ data: ${JSON.stringify(DATA)}, start: 'swipe' });</script>`;

(async () => {
  const browser = await chromium.launch({ executablePath: exe() });

  async function open(verdict) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const posts = []; const gets = [];
    await page.route('**/*', async (route) => {
      const req = route.request();
      const p = new URL(req.url()).pathname;
      const json = (o) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
      if (p === '/page') return route.fulfill({ contentType: 'text/html', body: HTML });
      if (p.startsWith('/pic/')) { gets.push(p); return route.fulfill({ contentType: 'image/svg+xml', body: Buffer.from(PIC.split(',')[1], 'base64') }); }
      if (req.method() === 'POST') {
        posts.push({ path: p, body: JSON.parse(req.postData() || '{}') });
        return json({ ok: true });
      }
      if (p === '/api/chatfeed/verdict') return json(Object.assign({ ok: true, items: {}, texts: {} }, verdict || {}));
      if (p === '/api/gallery/assets/notes') return json({ notes: [] });
      if (p === '/api/gallery/assets') return json({ assets: [], total: 0 });
      const f = path.join(PUB, p);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ path: f });
      return route.fulfill({ status: 200, body: '' });
    });
    await page.goto('http://each.test/page');
    await page.waitForTimeout(500);
    for (let i = 0; i < 8; i++) {           // the tour sits over the card
      if (!(await page.$('.cmp-tour'))) break;
      await page.mouse.click(195, 780);
      await page.waitForTimeout(120);
    }
    return { page, posts, gets };
  }
  const shot = (page) => page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const figs = [...document.querySelectorAll('#judge .jg-spread figure')];
    const note = q('#judge .jg-momnote');
    return {
      figs: figs.map((f) => f.getAttribute('data-card')),
      each: document.querySelectorAll('#judge .jg-each').length,
      picks: document.querySelectorAll('#judge .jg-pick').length,
      foot: [...document.querySelectorAll('#judge .jg-mombtn')].map((b) => b.getAttribute('aria-label')),
      yesTri: !!(q('#judge .jg-mombtn.yes path') && /^M12\.3 3\.1/.test(q('#judge .jg-mombtn.yes path').getAttribute('d'))),
      noteRows: note ? note.getAttribute('rows') : null,
      noteH: note ? Math.round(note.getBoundingClientRect().height) : null,
      lit: [...document.querySelectorAll('#judge .jg-eb.on')].map((b) => b.getAttribute('data-card') + ':' + b.getAttribute('data-each')),
      allout: !!q('#judge .jg-allout'),
      piles: !!q('#judge .jg-piles'),
    };
  });

  // ── 1. the footer, the spread, the ✕ that takes one picture off ─────────
  {
    const { page, posts } = await open();
    let s = await shot(page);
    is('the footer wears her three words', s.foot, ['No', 'Maybe add to deck', 'Add to deck']);
    ok('…and the yes button is the triangle mark', s.yesTri);
    is('a spread of three near-twins is three pictures', s.figs, ['tent-1', 'tent-2', 'tent-3']);
    is('…each with its own three buttons', s.each, 3);
    is('…and no "this one" picker', s.picks, 0);
    is('the note box is the small one', s.noteRows, '2');
    ok('…measured under 70px (was 96)', s.noteH && s.noteH < 70);

    await page.click('#judge .jg-eb.no[data-card="tent-2"]');
    await page.waitForTimeout(250);
    s = await shot(page);
    is('a NO under one picture takes it off the spread', s.figs, ['tent-1', 'tent-3']);
    ok('…and the deck stays on the spread (still comparing the leftovers)', s.each === 2 && !s.piles);
    const v = posts.filter((p) => p.path === '/api/chatfeed/verdict' && p.body.item === 'tent-2');
    is('…the verdict posted is THAT card\'s own id, false', v.map((p) => p.body.ok), [false]);
    const av = posts.filter((p) => p.path === '/api/gallery/assets/vote' && p.body.url === U('tent-2'));
    is('…and its Assets-tab vote is a dislike', av.map((p) => p.body.vote), ['dislike']);
    ok('…nothing was written on the spread\'s own s: key',
      !posts.some((p) => p.path === '/api/chatfeed/verdict' && /^s:/.test(String(p.body.item))));

    // the two left: add one, maybe the other → every picture decided → moves on
    await page.click('#judge .jg-eb.yes[data-card="tent-1"]');
    await page.waitForTimeout(900);
    s = await shot(page);
    is('a yes on one of two leaves the deck where it is', s.figs, ['tent-1', 'tent-3']);
    is('…lit on that picture', s.lit, ['tent-1:yes']);
    await page.click('#judge .jg-eb.maybe[data-card="tent-3"]');
    await page.waitForTimeout(400);
    s = await shot(page);
    is('once every picture still on it is decided, the deck moves on', s.figs, []);
    const label = await page.evaluate(() => (document.querySelector('#judge .who') || {}).textContent || '');
    is('…to the next card', label, 'a pile of seashells');

    // the piles: the ✕'d picture is its own tile, opening its spread
    await page.click('#judge [data-act="piles"]');
    await page.waitForTimeout(300);
    const piles = await page.evaluate(() => [...document.querySelectorAll('#judge .jg-pilefold h2')].map((h) => h.textContent));
    is('the piles are named by her words', piles, ['Add to deck · 1', 'Maybe add to deck · 1', 'No · 1', 'Unsure · 12']);
    const opens = await page.evaluate(() => [...document.querySelectorAll('#judge .jg-grid button')].map((b) => b.getAttribute('data-open')));
    is('…every tile opens the spread its picture sits on, or the card itself',
      opens.slice(0, 5), ['s:circus-tent', 's:circus-tent', 's:circus-tent', 'solo-1', 'solo-2']);
    await page.click('#judge .jg-grid button');
    await page.waitForTimeout(300);
    s = await shot(page);
    is('opening a tile lands on the spread with the ✕\'d one still off it', s.figs, ['tent-1', 'tent-3']);
    await page.close();
  }

  // ── 1b. NO FLASH ON A STEP (2026-09-03, "why does it fucking flash every
  // time i tap right left"): the card wears no opacity animation after a
  // move, and the next card's picture was fetched BEFORE she stepped to it
  {
    const { page, gets } = await open();
    await page.waitForTimeout(300);
    ok('the next card\'s picture is fetched ahead of the step', gets.some((g) => g === '/pic/solo-1.svg'));
    await page.evaluate(() => document.querySelector('#judge .jg-navzone.next').click());
    await page.waitForTimeout(50);
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('#judge .jg-card')).animationName);
    is('…and the card wears no animation after a move', anim, 'none');
    await page.waitForTimeout(300);
    ok('…the one after that is fetched too', gets.some((g) => g === '/pic/solo-2.svg'));
    await page.close();
  }

  // ── 2. a verdict doc keyed by CARD ids comes back lit (the transfer) ─────
  {
    const { page } = await open({ items: { 'tent-1': 'maybe', 'tent-3': false, 'solo-1': true },
      texts: { 'tent-1': '— me: cbi' } });
    const s = await shot(page);
    is('a transferred maybe and a transferred no come back on the cards', s.figs, ['tent-1', 'tent-2']);
    is('…lit', s.lit, ['tent-1:maybe']);
    const note = await page.evaluate(() => (document.querySelector('#judge .jg-cnote') || {}).textContent || '');
    is('…and her transferred note rides under that picture', note, 'cbi');
    await page.close();
  }

  // ── 3. the lightbox: five buttons, left/right zones, its ♥ marks the picture
  {
    const { page, posts } = await open();
    await page.click('#judge .jg-spread figure[data-card="tent-2"] img');
    await page.waitForTimeout(600);
    const lb = await page.evaluate(() => {
      const lb = document.getElementById('clightbox');
      if (!lb) return null;
      const acts = [...lb.querySelectorAll('.lbacts button')].map((b) => b.getAttribute('aria-label') || b.getAttribute('title') || b.className);
      return {
        acts,
        zones: [...lb.querySelectorAll('.lbzone')].map((z) => z.className.replace('lbzone ', '')),
        vote: lb.querySelectorAll('.lbacts button.vote').length,
      };
    });
    ok('the lightbox opened', !!lb);
    is('…with five buttons under the picture', lb && lb.acts.length, 5);
    is('…two of them her ♥ and ✕, three of them doors', lb && lb.vote, 2);
    is('…and left/right zones', lb && lb.zones.sort(), ['next', 'prev']);
    // step right, then ♥ — the mark lands on the picture under the box
    await page.click('#clightbox .lbzone.next');
    await page.waitForTimeout(400);
    const likeBtn = await page.$('#clightbox .lbacts button.vote.heart');
    ok('the lightbox has a ♥', !!likeBtn);
    if (likeBtn) { await likeBtn.click(); await page.waitForTimeout(400); }
    const yes = posts.filter((p) => p.path === '/api/chatfeed/verdict' && p.body.ok === true).map((p) => p.body.item);
    is('…its ♥ marks the picture she stepped to, by its own id', yes, ['tent-3']);
    await page.close();
  }

  // ── 4. a twin set of any size is ONE card — four as 2x2, six as 3 across ─
  {
    const { page } = await open();
    const walk = async () => { await page.evaluate(() => document.querySelector('#judge .jg-navzone.next').click()); await page.waitForTimeout(120); };
    for (let i = 0; i < 6; i++) { if ((await shot(page)).figs.length === 4) break; await walk(); }
    const four = await page.evaluate(() => {
      const figs = [...document.querySelectorAll('#judge .jg-spread figure')];
      const r = figs.map((f) => f.getBoundingClientRect());
      const w = r.map((b) => Math.round(b.width));
      const rows = new Set(r.map((b) => Math.round(b.top))).size;
      const btn = document.querySelector('#judge .jg-each');
      const pic = document.querySelector('#judge .jg-spread figure img').getBoundingClientRect();
      return { n: figs.length, w: Math.min(...w), rows, btnFits: btn && btn.scrollWidth <= btn.clientWidth + 1, picW: Math.round(pic.width), overflow: document.querySelector('#judge .jg-card').scrollHeight > document.querySelector('#judge .jg-card').clientHeight + 1 };
    });
    is('a twin set of four is ONE card', four.n, 4);
    is('…laid two across', four.rows, 2);
    ok('…each picture at least 150px wide (' + four.picW + ')', four.picW >= 150);
    ok('…its three buttons fit their column', four.btnFits);
    ok('…and the card does not overflow the screen', !four.overflow);
    for (let i = 0; i < 6; i++) { if ((await shot(page)).figs.length === 6) break; await walk(); }
    const six = await page.evaluate(() => {
      const figs = [...document.querySelectorAll('#judge .jg-spread figure')];
      const r = figs.map((b) => b.getBoundingClientRect());
      const card = document.querySelector('#judge .jg-card');
      return { n: figs.length, rows: new Set(r.map((b) => Math.round(b.top))).size, cols: new Set(r.map((b) => Math.round(b.left))).size,
        overflow: card.scrollHeight > card.clientHeight + 1, picW: Math.round(document.querySelector('#judge .jg-spread figure img').getBoundingClientRect().width) };
    });
    is('a twin set of six is one card, three across', [six.n, six.cols, six.rows], [6, 3, 2]);
    ok('…pictures still over 100px (' + six.picW + ') and no overflow', six.picW >= 100 && !six.overflow);
    // a NO under one of the four leaves three, side by side
    for (let i = 0; i < 12; i++) { if ((await shot(page)).figs.length === 4) break; await page.evaluate(() => document.querySelector('#judge .jg-navzone.prev').click()); await page.waitForTimeout(120); }
    await page.click('#judge .jg-eb.no[data-card="soap-2"]');
    await page.waitForTimeout(300);
    const three = await page.evaluate(() => [...document.querySelectorAll('#judge .jg-spread figure')].map((f) => f.getAttribute('data-card')));
    is('a NO under one of four leaves the other three on the card', three, ['soap-1', 'soap-3', 'soap-4']);
    await page.close();
  }

  // ── 5. A CARD OPENED OFF THE PILES GOES BACK TO THE PILES, folds intact,
  // and the piles survive a reopen (2026-09-03, "the back arrow takes me all
  // the way out to the review queue, not back to piles")
  {
    const { page } = await open();
    const js = (fn, arg) => page.evaluate(fn, arg);
    // a missing control is a FAILURE with a name, never a crash
    const tap = async (sel) => { const hit = await page.evaluate((q) => { const b = document.querySelector(q); if (b) b.click(); return !!b; }, sel); ok('control present: ' + sel, hit); return hit; };
    // one yes first, so the piles hold two piles to fold and to open from
    await tap('#judge .jg-eb.yes[data-card="tent-1"]');
    await page.waitForTimeout(150);
    await tap('#judge [data-act="piles"]');
    await page.waitForTimeout(200);
    // fold the first pile, then open a tile from the second
    const firstFold = await js(() => document.querySelector('#judge .jg-pilefold').getAttribute('data-fold'));
    await tap('#judge [data-fold="' + firstFold + '"]');
    await page.waitForTimeout(150);
    await tap('#judge .jg-grid button');
    await page.waitForTimeout(250);
    const chev = await js(() => { const b = document.querySelector('#judge .jg-back'); return b ? b.getAttribute('data-act') : null; });
    is('a card opened off the piles draws a chevron back to the piles', chev, 'topiles');
    await tap('#judge .jg-back');
    await page.waitForTimeout(250);
    const back = await js((k) => ({
      piles: !!document.querySelector('#judge .jg-piles'),
      stillShut: document.querySelector('#judge [data-fold="' + k + '"]').getAttribute('aria-expanded') === 'false',
      chevron: !!document.querySelector('#judge .jg-back[data-act="topiles"]'),
    }), firstFold);
    ok('…and it lands back on the piles', back.piles);
    ok('…with the pile she folded still folded', back.stillShut);
    ok('…and no piles-chevron on the piles themselves', !back.chevron);
    // walking on from a pile-opened card ends the way back
    await tap('#judge .jg-grid button');
    await page.waitForTimeout(150);
    await tap('#judge .jg-navzone.next');
    await page.waitForTimeout(150);
    const gone = await js(() => !!document.querySelector('#judge .jg-back[data-act="topiles"]'));
    ok('stepping on from that card ends the way back to the piles', !gone);
    // the piles are remembered across a reopen
    await tap('#judge [data-act="piles"]');
    await page.waitForTimeout(150);
    await page.reload(); await page.waitForTimeout(700);
    for (let i = 0; i < 8; i++) { if (!(await page.$('.cmp-tour'))) break; await page.mouse.click(195, 780); await page.waitForTimeout(120); }
    ok('a reopen while she was on the piles comes back on the piles', await js(() => !!document.querySelector('#judge .jg-piles')));
    await page.close();
  }

  // ── 6. THE FOOTER MARKS ONLY THE UNDECIDED, AND A NO'D PICTURE CAN BE SEEN
  // AGAIN (2026-09-03, Sophie: "some of the ones i had swiped yes on … just
  // ended up on the no pile and now im not even allowed to see them")
  {
    const { page, posts } = await open();
    const js = (fn, arg) => page.evaluate(fn, arg);
    const tap = async (sel) => { const hit = await js((q) => { const b = document.querySelector(q); if (b) b.click(); return !!b; }, sel); ok('control present: ' + sel, hit); return hit; };
    // ▲ on tent-1, then the big ✕ for the rest
    await tap('#judge .jg-eb.yes[data-card="tent-1"]'); await page.waitForTimeout(150);
    await tap('#judge .jg-mombtn[data-act="no"]'); await page.waitForTimeout(900);
    const marks = {};
    posts.filter((p) => p.path === '/api/chatfeed/verdict' && p.body.ok !== undefined).forEach((p) => { marks[p.body.item] = p.body.ok; });
    is('the big ✕ after a ▲ on one picture leaves that picture a yes', marks['tent-1'], true);
    is('…and sends only the undecided ones to No', [marks['tent-2'], marks['tent-3']], [false, false]);
    // the deck moved on (every picture decided); go to the piles and open a No'd one
    await tap('#judge [data-act="piles"]'); await page.waitForTimeout(200);
    const noTile = await js(() => {
      const heads = [...document.querySelectorAll('#judge .jg-pilehd')];
      const h = heads.find((x) => /^No ·/.test(x.querySelector('h2').textContent));
      const grid = h && h.nextElementSibling;
      const b = grid && grid.querySelector('button[data-peek="tent-2"]');
      return b ? { open: b.getAttribute('data-open'), peek: b.getAttribute('data-peek') } : null;
    });
    ok('the No pile holds the picture as its own tile', !!noTile);
    await tap('#judge .jg-grid button[data-peek="tent-2"]'); await page.waitForTimeout(250);
    let s6 = await shot(page);
    is('opening it shows the card WITH that picture on it', s6.figs, ['tent-1', 'tent-2']);
    ok('…wearing its ✕ lit', s6.lit.includes('tent-2:no'));
    await tap('#judge .jg-eb.no[data-card="tent-2"]'); await page.waitForTimeout(250);
    s6 = await shot(page);
    ok('…and one tap on that ✕ brings it back (no longer lit, still on the card)', !s6.lit.includes('tent-2:no') && s6.figs.includes('tent-2'));
    // Swipe these on the No pile walks the No'd pictures, shown
    await tap('#judge .jg-back'); await page.waitForTimeout(200);
    const swipeNo = await js(() => {
      const heads = [...document.querySelectorAll('#judge .jg-pilehd')];
      const h = heads.find((x) => /^No ·/.test(x.querySelector('h2').textContent));
      const b = h && h.querySelector('.jg-again'); if (b) b.click(); return !!b;
    });
    ok('the No pile has its Swipe these', swipeNo);
    await page.waitForTimeout(250);
    s6 = await shot(page);
    ok('…which shows the No\'d picture on its card', s6.figs.includes('tent-3'));
    await page.close();
  }

  await browser.close();
  console.log(`judge spread-each: ${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
})();
