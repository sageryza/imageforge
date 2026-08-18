#!/usr/bin/env node
/* A PAGE SHE CAN TYPE IN MUST PIN ITS SCALE (Aug 2026, Sophie — twice).
 *
 *   node scripts/test-no-zoom.js
 *
 * iOS zooms the whole page whenever it focuses a field under 16px. There are
 * exactly two cures: inflate every field to 16px, or pin the page scale. She
 * settled it after seeing both — "I would prefer not to have pinch [zoom] and
 * for it not to be 16 PX… now it's too big… I don't need pinch zoom" — so the
 * type stays her size and the viewport carries maximum-scale=1.
 *
 * She found it twice, on two different surfaces (a Compare deck, then the
 * dream app), which is what makes it worth a test rather than a fix: it is one
 * defect that any new page can be born with. So the rule is checked over the
 * WHOLE public folder, not the page that happened to be reported.
 *
 * The rule: a page whose markup (or whose JS, which builds markup as strings)
 * mentions an input, a textarea or contenteditable must declare maximum-scale
 * in its viewport meta. A page with no field never auto-zooms and is exempt.
 * Pure — reads files, no browser, no network.
 */
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const FIELD = /<input|<textarea|contenteditable/i;
const VIEWPORT = /<meta\s+name=["']viewport["']\s+content=["']([^"']*)["']/i;

let checked = 0; const bad = [];
for (const file of fs.readdirSync(PUB).filter((f) => f.endsWith('.html'))) {
  const s = fs.readFileSync(path.join(PUB, file), 'utf8');
  if (!FIELD.test(s)) continue;
  const m = VIEWPORT.exec(s);
  if (!m) continue;            // no viewport meta at all — not this rule's business
  checked += 1;
  if (!/maximum-scale/i.test(m[1])) bad.push(file);
}

if (bad.length) {
  console.error(`FAIL: ${bad.length} page(s) she can type in do not pin the scale, `
    + 'so iOS will zoom the page when a field is focused:');
  bad.forEach((f) => console.error(`  public/${f}`));
  console.error('\nAdd maximum-scale=1, user-scalable=no to the viewport meta.'
    + '\nDo NOT instead raise the field to 16px — that trade was made and reversed.');
  process.exit(1);
}
console.log(`all ${checked} pages with a typing field pin their scale`);
