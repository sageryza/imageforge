#!/usr/bin/env node
/**
 * test-lightbox-nostop.js — closing the Assets lightbox must never START the
 * autoscroll behind it.
 *
 * THE BUG (Sophie, 2026-08-20, on an auto Compare page in the app: "why does
 * auto scroll get triggered when I tap out of the light box"). She also said
 * she thought it had been fixed in another chat, and she was right — it had
 * been, for compare.js's OWN lightbox, which closes by setting [hidden] and
 * therefore stays in the DOM. `asset-lightbox.js` is a DIFFERENT overlay (the
 * Assets-tab one, which the grid template's tiles open) and it closed with
 * `lb.innerHTML = ''`.
 *
 * A host decides whether a tap belongs to the page by asking
 * `t.closest('[data-nostop],img,figure,.cmp-lb')` on a BUBBLING click — which
 * runs AFTER the overlay's own onclick. Detaching the tapped node first leaves
 * closest() walking a subtree with no parents, so the [data-nostop] marker on
 * the overlay is unreachable, the tap falls through to the tap-to-TOGGLE, and
 * the scroll starts behind the closing overlay. Tapping the backdrop (the
 * overlay element itself, never detached) was always fine, which is what made
 * it look intermittent.
 *
 * TWO ASSERTIONS, deliberately of different kinds:
 *   1. the REAL public/asset-lightbox.js driven in Chromium — open it, tap a
 *      non-control child, and assert the host's skip decision came out SKIP.
 *      Verified failing against the pre-fix file.
 *   2. a SOURCE pin on public/chats.html: the embedded-page handler asks the
 *      skip list at pointerdown (capture), while the target is still attached.
 *      That is the backstop for the next overlay that detaches on tap, and it
 *      cannot be exercised here without standing up the whole app shell — so
 *      it is checked as source, and this comment says which kind it is.
 *
 *   node scripts/test-lightbox-nostop.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const LB = path.join(ROOT, 'public/asset-lightbox.js');
const CHATS = path.join(ROOT, 'public/chats.html');

// The host's question, verbatim from chats.html's embedded handler.
const OWN = '[data-nostop],img,figure,.cmp-lb';

let failures = 0;
function ok(cond, what) {
  console.log(`${cond ? '  ok  ' : '  FAIL'}  ${what}`);
  if (!cond) failures++;
}

async function main() {
  // ---- 1. the real overlay, driven -------------------------------------
  const browser = await chromium.launch(
    fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}
  );
  const page = await browser.newPage();
  await page.setContent('<body style="height:4000px"></body>');
  await page.addScriptTag({ path: LB });

  // The embedded host's bubbling click handler, reduced to the one decision
  // this test is about.
  await page.evaluate((own) => {
    window.__decisions = [];
    document.addEventListener('click', function (e) {
      const t = e.target;
      if (t && t.closest && t.closest('a,button,summary,details,input,textarea,select,label,video,audio,[onclick]')) return;
      window.__decisions.push(t && t.closest && t.closest(own) ? 'skip' : 'toggle');
    });
  }, OWN);

  // A real 1px png, so the overlay lays out and the rows have a size to tap.
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const asset = { url: PNG, description: 'a picture', prompt: 'gpt-image-2 · medium' };

  // The non-control children her "anywhere that isn't a control closes it" rule
  // can land on: `.clcap` is the caption, `.cltag` the ♥/✕ row, whose empty
  // space beside a button is a close. Both are nodes innerHTML='' detached.
  for (const cls of ['clcap', 'cltag']) {
    await page.evaluate((a) => window.__assetLightbox(a.url, a), asset);
    await page.waitForTimeout(50);
    const present = await page.$(`#clightbox .${cls}`);
    if (!present) { ok(false, `.${cls} exists to tap`); continue; }
    await page.evaluate(() => { window.__decisions = []; });
    await page.click(`#clightbox .${cls}`, { force: true });
    await page.waitForTimeout(50);
    const d = await page.evaluate(() => window.__decisions);
    ok(d.length === 1 && d[0] === 'skip', `tapping .${cls} closes without starting the scroll (got ${JSON.stringify(d)})`);
    ok(await page.evaluate(() => document.getElementById('clightbox').style.display === 'none'), `tapping .${cls} actually closes it`);
  }

  // The backdrop was never broken — pin it so a fix can't trade one for the other.
  await page.evaluate((a) => window.__assetLightbox(a.url, a), asset);
  await page.waitForTimeout(50);
  await page.evaluate(() => { window.__decisions = []; });
  await page.click('#clightbox', { position: { x: 4, y: 4 }, force: true });
  await page.waitForTimeout(50);
  ok((await page.evaluate(() => window.__decisions))[0] === 'skip', 'tapping the backdrop still skips');

  // Re-opening inside the deferred wipe's frame must not blank the new content.
  await page.evaluate((a) => {
    const lb = document.getElementById('clightbox');
    lb.onclick({ target: lb });      // close…
    window.__assetLightbox(a.url, a); // …and reopen in the same frame
  }, asset);
  await page.waitForTimeout(80);
  ok(await page.evaluate(() => document.getElementById('clightbox').children.length > 0),
    'reopening inside the deferred wipe keeps the new content');

  await browser.close();

  // ---- 2. the source pin on the host ----------------------------------
  const chats = fs.readFileSync(CHATS, 'utf8');
  ok(/addEventListener\('pointerdown'[\s\S]{0,220}?closest\(OWN\)[\s\S]{0,120}?\},\s*true\)/.test(chats),
    'chats.html asks the skip list at pointerdown, in capture');
  ok(chats.includes("var OWN='[data-nostop],img,figure,.cmp-lb';"),
    'chats.html keeps ONE copy of the skip selector');
  ok(chats.includes('if(own || (t && t.closest && t.closest(OWN)))'),
    'the click handler honours the pointerdown answer as well as its own');

  console.log(failures ? `\n${failures} failed` : '\nall good');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
