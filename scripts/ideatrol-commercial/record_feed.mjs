// Record the REAL dreamapp page (served locally, staged data) as reel footage.
// Serves /home/user/imageforge/public on 127.0.0.1, intercepts the feed API
// with staged dreams, records a slow scroll, writes webm to reels/everydream2/.
import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import { readFileSync, readdirSync, renameSync } from 'fs';

const HOME = '/tmp/claude-0/-home-user/7d181a1b-3915-564c-b46b-810588084c3e/scratchpad/ideatrol';
const ART = {
  whale: `${HOME}/reels/everydream/stills/p02.png`,
  dancers: `${HOME}/reels/reverie3/stills/m01.png`,
  houses: `${HOME}/reels/reverie3/stills/m02.png`,
  door: `${HOME}/reels/everydream/stills/p04.png`,
  library: `${HOME}/feedart-library.png`,
  bird: `${HOME}/reels/birdcostume/stills/b07.png`,
};
const N = (id, title, words, art, felt, cmts, day) => ({
  id, title, dreams: [{ words }], panels: art ? [{ url: `https://stage.local/${art}.png` }] : [],
  cover: art ? { url: `https://stage.local/${art}.png` } : null,
  mine: false, felt: false, feltCount: felt, commentCount: cmts,
  publicOn: day, createdAt: day + 'T05:00:00Z',
});
const TODAY = '2026-08-18';
const FEED = {
  sealed: false, today: TODAY, count: 6,
  nights: [
    N('n1', 'The Whale Took the Long Way Home',
      'it came down the avenue at whale speed and everyone just waited, like weather', 'whale', 7, 2, TODAY),
    N('n2', 'We Kept Trading Faces',
      'we were waltzing and then I was leading from inside her arms', 'dancers', 4, 1, TODAY),
    N('n3', 'The House Inside the House',
      'every front door opened into a smaller house and somehow I kept fitting', 'houses', 5, 0, TODAY),
    N('n4', 'You Were There, and There Was a Door',
      'that is honestly all I have. you were there. there was a door, or something', 'door', 3, 3, TODAY),
    N('n5', 'The Library Where Every Book Was About Me',
      'the librarian said quiet please, it is all about you anyway', 'library', 6, 1, '2026-08-17'),
    N('n6', 'He Turned Into a Bird Right When It Got Good',
      'right when it got good he was feathers and gone over the rooftops', 'bird', 9, 4, '2026-08-17'),
  ],
};

const server = spawn('python3', ['-m', 'http.server', '8777'],
  { cwd: '/home/user/imageforge/public', stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
try {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 585 }, deviceScaleFactor: 2,
    recordVideo: { dir: `${HOME}/reels/everydream2`, size: { width: 780, height: 1170 } },
  });
  const page = await ctx.newPage();
  await page.route('**/api/dreamapp/**', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/dreamapp/feed*', r => r.fulfill({ json: FEED }));
  await page.route('**/api/witch/**', r => r.fulfill({ json: {} }));
  await page.route('**stage.local/**', r => {
    const key = r.request().url().split('/').pop().replace('.png', '');
    r.fulfill({ body: readFileSync(ART[key]), contentType: 'image/png' });
  });
  await page.route(/googleapis|gstatic|firebase/, r => r.fulfill({ json: {} }));
  await page.goto('http://127.0.0.1:8777/dreamapp.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  // force the feed screen visible and rendered regardless of auth state
  const state = await page.evaluate(async () => {
    window.fbAuth = {
      currentUser: { getIdToken: async () => 'stage', displayName: 'Dana', uid: 'stage' },
      onAuthStateChanged: fn => fn(window.fbAuth.currentUser),
    };
    try { if (typeof renderFeed === 'function') await renderFeed(); } catch (e) { window.__err = String(e); }
    const feed = document.querySelector('#feed, [id*=feed], .feed');
    document.querySelectorAll('.screen, [class*=screen]').forEach(s => {
      if (!s.contains(feed)) { s.style.display = 'none'; }
    });
    let el = feed;
    while (el && el !== document.body) { el.style.display = ''; el.hidden = false; el = el.parentElement; }
    window.scrollTo(0, 0);
    return { err: window.__err || null, cards: document.querySelectorAll('.dcard').length,
             text: document.body.innerText.slice(0, 120).replace(/\n+/g, ' | ') };
  });
  console.log('page state:', JSON.stringify(state));
  await page.screenshot({ path: `${HOME}/check/feedstage.png` });
  await page.waitForTimeout(800);
  // the recorded take: hold, then one slow smooth scroll through the cards
  await page.evaluate(() => new Promise(done => {
    const total = Math.min(document.body.scrollHeight - innerHeight, 1400);
    const t0 = performance.now(), DUR = 5200;
    (function step(t) {
      const k = Math.min((t - t0) / DUR, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      scrollTo(0, total * e);
      k < 1 ? requestAnimationFrame(step) : done();
    })(t0);
  }));
  await page.waitForTimeout(1200);
  await ctx.close();
  await b.close();
  const webm = readdirSync(`${HOME}/reels/everydream2`).find(f => f.endsWith('.webm'));
  renameSync(`${HOME}/reels/everydream2/${webm}`, `${HOME}/reels/everydream2/feedscroll.webm`);
  console.log('recorded feedscroll.webm');
} finally {
  server.kill();
}
