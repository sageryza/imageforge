#!/usr/bin/env node
// test-assembly.js — Assembly's pure functions. No network, no Firebase, no
// ffmpeg run: the place-indicator arithmetic (the tool's whole interaction),
// the arrangement whitelist, the render canvas, and the normalize chain.
//
// Then, when a headless Chromium is available, the real page: the timeline's
// gaps appearing only while something is in hand, a drop landing between the
// two clips already there, and a pick-up move. Skips cleanly without one.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  cleanClips, placeAt, movePlace, targetFrom, segmentFilters, trimmed,
  itemSeconds, itemsFromDrops, mergeIntoTray,
  MAX_CLIPS, FPS, MAX_EDGE, HOLD_DEFAULT, HOLD_MIN, HOLD_MAX,
} = require('../assembly');

let n = 0;
function t(name, fn) { fn(); n++; console.log(`  ok — ${name}`); }

const clip = (id, over = {}) => ({
  id: String(id), url: `https://storage.googleapis.com/b/clips/${id}.mp4`,
  title: `clip ${id}`, poster: null, seconds: 5, ...over,
});

console.log('the place-indicator arithmetic (gap g = before the clip at index g):');

t('placeAt drops into the gap between two existing clips', () => {
  const out = placeAt([clip(1), clip(2)], clip(9), 1);
  assert.deepStrictEqual(out.map((c) => c.id), ['1', '9', '2']);
});

t('placeAt at the ends: gap 0 leads, gap length trails', () => {
  assert.deepStrictEqual(placeAt([clip(1)], clip(9), 0).map((c) => c.id), ['9', '1']);
  assert.deepStrictEqual(placeAt([clip(1)], clip(9), 1).map((c) => c.id), ['1', '9']);
});

t('placeAt clamps a wild gap instead of dropping the clip', () => {
  assert.deepStrictEqual(placeAt([clip(1)], clip(9), 99).map((c) => c.id), ['1', '9']);
  assert.deepStrictEqual(placeAt([clip(1)], clip(9), -3).map((c) => c.id), ['9', '1']);
});

t('placeAt on an empty timeline: the one gap', () => {
  assert.deepStrictEqual(placeAt([], clip(9), 0).map((c) => c.id), ['9']);
});

t('movePlace forward accounts for the lift-out (gap counts the list SHE sees)', () => {
  // [1 2 3 4], pick up 2 (index 1), tap the gap after 3 (gap 3) → [1 3 2 4]
  const out = movePlace([clip(1), clip(2), clip(3), clip(4)], 1, 3);
  assert.deepStrictEqual(out.map((c) => c.id), ['1', '3', '2', '4']);
});

t('movePlace backward is direct', () => {
  // [1 2 3 4], pick up 4 (index 3), tap gap 1 → [1 4 2 3]
  const out = movePlace([clip(1), clip(2), clip(3), clip(4)], 3, 1);
  assert.deepStrictEqual(out.map((c) => c.id), ['1', '4', '2', '3']);
});

t('the two gaps hugging the lifted clip are both staying put', () => {
  const list = [clip(1), clip(2), clip(3)];
  assert.deepStrictEqual(movePlace(list, 1, 1).map((c) => c.id), ['1', '2', '3']);
  assert.deepStrictEqual(movePlace(list, 1, 2).map((c) => c.id), ['1', '2', '3']);
});

t('movePlace with a bad index changes nothing (and never mutates)', () => {
  const list = [clip(1), clip(2)];
  assert.deepStrictEqual(movePlace(list, 7, 0).map((c) => c.id), ['1', '2']);
  assert.deepStrictEqual(list.map((c) => c.id), ['1', '2']);
});

console.log('\nthe arrangement whitelist:');

t('cleanClips keeps the snapshot fields and drops everything else', () => {
  const [c] = cleanClips([{ ...clip(1), evil: 'x', renders: [1] }]);
  assert.deepStrictEqual(Object.keys(c).sort(), ['id', 'kind', 'poster', 'seconds', 'title', 'url']);
});

t('cleanClips refuses items missing an id or a real url', () => {
  assert.strictEqual(cleanClips([{ id: '', url: 'https://x/y.mp4' }]).length, 0);
  assert.strictEqual(cleanClips([{ id: 'a', url: 'ftp://nope' }]).length, 0);
  assert.strictEqual(cleanClips('not a list').length, 0);
});

t(`cleanClips caps the timeline at ${MAX_CLIPS}`, () => {
  const many = Array.from({ length: MAX_CLIPS + 10 }, (_, i) => clip(i));
  assert.strictEqual(cleanClips(many).length, MAX_CLIPS);
});

t('cleanClips rounds seconds and nulls the unknowable', () => {
  assert.strictEqual(cleanClips([clip(1, { seconds: 5.4321 })])[0].seconds, 5.4);
  assert.strictEqual(cleanClips([clip(1, { seconds: 'soon' })])[0].seconds, null);
});

console.log('\nstills on the timeline:');

t('a clip defaults to kind video and carries no hold', () => {
  const [c] = cleanClips([clip(1)]);
  assert.strictEqual(c.kind, 'video');
  assert.ok(!('hold' in c));
});

t(`an image gets hold — default ${HOLD_DEFAULT}s, clamped ${HOLD_MIN}–${HOLD_MAX}`, () => {
  assert.strictEqual(cleanClips([clip(1, { kind: 'image' })])[0].hold, HOLD_DEFAULT);
  assert.strictEqual(cleanClips([clip(1, { kind: 'image', hold: 6 })])[0].hold, 6);
  assert.strictEqual(cleanClips([clip(1, { kind: 'image', hold: 999 })])[0].hold, HOLD_MAX);
  assert.strictEqual(cleanClips([clip(1, { kind: 'image', hold: 0 })])[0].hold, HOLD_MIN);
  assert.strictEqual(cleanClips([clip(1, { kind: 'image', hold: 'long' })])[0].hold, HOLD_DEFAULT);
});

t('itemSeconds: a still sits for its hold, a clip for its length', () => {
  assert.strictEqual(itemSeconds({ kind: 'image', hold: 6 }), 6);
  assert.strictEqual(itemSeconds({ kind: 'image' }), HOLD_DEFAULT);
  assert.strictEqual(itemSeconds({ kind: 'video', seconds: 5 }), 5);
  assert.strictEqual(itemSeconds({ kind: 'video' }), 0);
});

console.log('\nthe one-button Dump import:');

const drop = (id, over = {}) => ({
  id: `d${id}`, url: `https://storage.googleapis.com/b/drops/x/${id}.jpg`,
  media: 'image', photoIndex: id, ...over,
});

t('itemsFromDrops keeps album order (photoIndex), whatever order the query returned', () => {
  const out = itemsFromDrops([drop(2), drop(0), drop(1)], 'MJ batch');
  assert.deepStrictEqual(out.map((x) => x.id), ['d0', 'd1', 'd2']);
});

t('a dumped photo becomes a still: hold default, DERIVED thumb, never the original as its tile', () => {
  const [x] = itemsFromDrops([drop(0)], 'MJ batch');
  assert.strictEqual(x.kind, 'image');
  assert.strictEqual(x.hold, HOLD_DEFAULT);
  assert.ok(x.poster.startsWith('/api/story/thumb?url='), 'thumb service, not the full-res url');
  assert.ok(x.url.endsWith('0.jpg'), 'the item itself keeps the original');
});

t('a dumped video becomes a clip and keeps its baked poster', () => {
  const [x] = itemsFromDrops([drop(0, {
    media: 'video', url: 'https://storage.googleapis.com/b/drops/x/0.mov',
    posterUrl: 'https://storage.googleapis.com/b/posters/0.webp',
  })], 'MJ batch');
  assert.strictEqual(x.kind, 'video');
  assert.ok(!('hold' in x));
  assert.strictEqual(x.poster, 'https://storage.googleapis.com/b/posters/0.webp');
});

t('itemsFromDrops names the nameless by album + place, keeps a given name', () => {
  const out = itemsFromDrops([drop(0), drop(1, { name: 'the flying one' })], 'MJ batch');
  assert.strictEqual(out[0].title, 'MJ batch · 1');
  assert.strictEqual(out[1].title, 'the flying one');
});

t('itemsFromDrops refuses items with no id or a bad url — they survive as clean records nowhere', () => {
  const out = itemsFromDrops([drop(0, { url: 'ftp://nope' }), { url: 'https://x/y.jpg' }, drop(1)], 'a');
  assert.deepStrictEqual(out.map((x) => x.id), ['d1']);
});

t('itemsFromDrops output passes cleanClips untouched', () => {
  const items = itemsFromDrops([drop(0), drop(1, { media: 'video', posterUrl: null })], 'a');
  assert.deepStrictEqual(cleanClips(items), items.map((x) => ({ seconds: null, ...x })));
});

t('mergeIntoTray dedupes against the tray AND the timeline — re-importing doubles nothing', () => {
  const tray = [clip('t1')];
  const placed = [clip('p1')];
  const incoming = [clip('t1'), clip('p1'), clip('new')];
  const m = mergeIntoTray(tray, placed, incoming);
  assert.deepStrictEqual(m.tray.map((c) => c.id), ['t1', 'new']);
  assert.strictEqual(m.added, 1);
  assert.strictEqual(m.already, 2);
  assert.strictEqual(m.skipped, 0);
});

t('mergeIntoTray honors the cap and counts what did not fit', () => {
  const tray = Array.from({ length: 3 }, (_, i) => clip(`t${i}`));
  const m = mergeIntoTray(tray, [], [clip('a'), clip('b'), clip('c')], 4);
  assert.strictEqual(m.tray.length, 4);
  assert.strictEqual(m.added, 1);
  assert.strictEqual(m.skipped, 2);
});

console.log('\nthe render canvas (the first clip decides the shape):');

t('an even frame under the cap passes through', () => {
  assert.deepStrictEqual(targetFrom(720, 1280), { width: 720, height: 1280 });
});

t('odd edges are evened — yuv420p needs even', () => {
  const { width, height } = targetFrom(721, 1279);
  assert.strictEqual(width % 2, 0);
  assert.strictEqual(height % 2, 0);
});

t(`the long edge caps at ${MAX_EDGE}, aspect kept, both orientations`, () => {
  const p = targetFrom(1080, 1920);
  assert.strictEqual(p.height, MAX_EDGE);
  assert.ok(Math.abs(p.width / p.height - 1080 / 1920) < 0.01);
  const l = targetFrom(1920, 1080);
  assert.strictEqual(l.width, MAX_EDGE);
});

t('nonsense falls back to a real portrait frame, never NaN', () => {
  const { width, height } = targetFrom(undefined, 'tall');
  assert.ok(width > 0 && height > 0);
});

t('the normalize chain carries the four legs of the concat-copy contract', () => {
  const f = segmentFilters({ width: 720, height: 1280 });
  assert.ok(f.includes('scale=720:1280:force_original_aspect_ratio=decrease'));
  assert.ok(f.includes('pad=720:1280'));
  assert.ok(f.includes(`fps=${FPS}`));
  assert.ok(f.includes('setsar=1'));
  assert.ok(f.includes('format=yuv420p'));
});

console.log('\nthe shelf row:');

t('trimmed totals the seconds and takes the first clip\'s poster', () => {
  const row = trimmed({
    id: 'a', title: 'T',
    clips: [clip(1, { poster: 'https://p/1.webp', seconds: 4.5 }), clip(2, { seconds: 5.5 })],
    renders: [{ url: 'u' }], updatedAt: 7,
  });
  assert.strictEqual(row.clips, 2);
  assert.strictEqual(row.seconds, 10);
  const withStill = trimmed({ id: 'b', title: 'S',
    clips: [clip(1, { seconds: 5 }), clip(2, { kind: 'image', hold: 6, seconds: null })] });
  assert.strictEqual(withStill.seconds, 11, 'a still counts its hold toward the total');
  assert.strictEqual(row.poster, 'https://p/1.webp');
  assert.strictEqual(row.renders, 1);
  assert.strictEqual(row.job, null);
});

t('trimmed shows a running job and hides a finished one', () => {
  const base = { id: 'a', title: 'T', clips: [], renders: [] };
  assert.ok(trimmed({ ...base, job: { kind: 'render', status: 'running', label: 'x' } }).job);
  assert.strictEqual(trimmed({ ...base, job: { kind: 'render', status: 'done' } }).job, null);
});

// ── the real page, when a headless Chromium is around ──────────────────────
async function pageTests() {
  let pw;
  try { pw = require('playwright'); } catch { /* not installed here */ }
  if (!pw) { console.log('\npage tests skipped — playwright not installed'); return; }
  // the sandbox's pre-installed chromium (the test-pagehead.js pattern)
  const exe = (() => {
    const root = '/opt/pw-browsers';
    if (!fs.existsSync(root)) return null;
    for (const d of fs.readdirSync(root).filter((x) => /^chromium-\d/.test(x))) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
    return null;
  })();

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'assembly.html'), 'utf8');
  const LIB = [
    { id: 'c1', url: 'https://storage.googleapis.com/b/clips/1.mp4', title: 'the door', poster: null, seconds: 4, kind: 'scene', tags: [], from: 'f', hidden: false, status: 'ready' },
    { id: 'c2', url: 'https://storage.googleapis.com/b/clips/2.mp4', title: 'the crumbs', poster: null, seconds: 5, kind: 'chunk', tags: [], from: 'f', hidden: false, status: 'ready' },
    { id: 'c3', url: 'https://storage.googleapis.com/b/clips/3.mp4', title: 'the jar', poster: null, seconds: 6, kind: 'scene', tags: [], from: 'f', hidden: false, status: 'ready' },
  ];
  const DOC = { id: 'a1', title: 'Test assembly', clips: [
    { id: 'c1', url: LIB[0].url, title: 'the door', poster: null, seconds: 4, kind: 'video' },
    { id: 'c3', url: LIB[2].url, title: 'the jar', poster: null, seconds: 6, kind: 'video' },
  ], tray: [], renders: [], job: null };
  const ALBUM_ITEMS = itemsFromDrops([
    { id: 'p1', url: 'https://storage.googleapis.com/b/drops/mj/1.jpg', media: 'image', photoIndex: 0 },
    { id: 'p2', url: 'https://storage.googleapis.com/b/drops/mj/2.mov', media: 'video', photoIndex: 1,
      posterUrl: 'https://storage.googleapis.com/b/posters/2.webp' },
  ], 'MJ batch');

  const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const saves = [];
  let imported = false;
  await page.route('**/*', (route) => {
    const u = route.request().url();
    const m = route.request().method();
    if (u.includes('/api/clips')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ count: LIB.length, clips: LIB }) });
    }
    if (u.includes('/api/assembly/sources')) {
      return route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ albums: [{ album: 'mj-batch', name: 'MJ batch', images: 1, videos: 1, cover: null, newest: 1 }] }) });
    }
    if (u.includes('/api/assembly/a1/import') && m === 'POST') {
      imported = true;
      DOC.tray = (DOC.tray || []).concat(ALBUM_ITEMS);
      return route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ ok: true, added: ALBUM_ITEMS.length, already: 0, skipped: 0, tray: DOC.tray.length }) });
    }
    if (u.includes('/api/drop/upload-file') && m === 'POST') {
      const fn = decodeURIComponent((u.match(/filename=([^&]*)/) || [])[1] || '');
      const video = /\.(mp4|mov)$/i.test(fn);
      return route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ ok: true, session: 's1', duplicate: false, item: {
          id: 'up-' + fn.replace(/\W/g, ''), url: 'https://storage.googleapis.com/b/drops/u/' + fn,
          media: video ? 'video' : 'image',
          posterUrl: video ? 'https://storage.googleapis.com/b/posters/u.webp' : null,
          photoIndex: 0, name: null,
        } }) });
    }
    if (u.includes('/api/assembly/a1/clips') && m === 'POST') {
      saves.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    }
    if (u.match(/\/api\/assembly\/a1$/)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(DOC) });
    }
    if (u.includes('/api/assembly') && m === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: '{"assemblies":[]}' });
    }
    if (u.startsWith('http://page.test/assembly')) {
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto('http://page.test/assembly?a=a1');
  await page.waitForSelector('#strip .tclip');

  console.log('\nthe real page (headless):');

  assert.strictEqual(await page.locator('#strip .tclip').count(), 2);
  assert.strictEqual(await page.locator('#tl.placing').count(), 0);
  n++; console.log('  ok — the timeline shows the arrangement, gaps quiet while nothing is in hand');

  // arm a shelf clip → indicators appear in every gap (2 clips → 3 gaps)
  await page.locator('#shelf .clip', { hasText: 'the crumbs' }).click();
  assert.strictEqual(await page.locator('#tl.placing').count(), 1);
  assert.strictEqual(await page.locator('#strip .gap i').count(), 3);
  n++; console.log('  ok — arming a shelf clip lights a place indicator in every gap');

  // tap the middle gap → it drops between the two existing clips and saves
  await page.locator('#strip .gap').nth(1).click();
  await page.waitForTimeout(800);
  const order = saves.length ? saves[saves.length - 1].clips.map((c) => c.id) : [];
  assert.deepStrictEqual(order, ['c1', 'c2', 'c3']);
  assert.strictEqual(await page.locator('#tl.placing').count(), 0);
  n++; console.log('  ok — tapping the middle indicator drops the clip between the two');

  // pick up a timeline clip and move it to the front
  await page.locator('#strip .tclip').nth(2).click();
  assert.strictEqual(await page.locator('#hand:not([hidden])').count(), 1);
  await page.locator('#strip .gap').nth(0).click();
  await page.waitForTimeout(800);
  const moved = saves[saves.length - 1].clips.map((c) => c.id);
  assert.deepStrictEqual(moved, ['c3', 'c1', 'c2']);
  n++; console.log('  ok — picking up a timeline clip and tapping a gap moves it');

  // take one off — the clip stays on the shelf
  await page.locator('#strip .tclip').nth(0).click();
  await page.locator('#handRemove').click();
  await page.waitForTimeout(800);
  const removed = saves[saves.length - 1].clips.map((c) => c.id);
  assert.deepStrictEqual(removed, ['c1', 'c2']);
  assert.strictEqual(await page.locator('#shelf .clip').count(), 3);
  n++; console.log('  ok — Take off removes from the timeline, never from the shelf');

  // the one button: a whole dumped album lands in the TRAY, never the timeline
  await page.locator('#dumpBtn').click();
  await page.waitForSelector('#dumpList .arow');
  await page.locator('#dumpList .arow').first().click();
  await page.waitForSelector('#dumpSheet[hidden]', { state: 'attached' });
  assert.ok(imported, 'the import POST fired');
  assert.strictEqual(await page.locator('#tray .tclip').count(), 2);
  assert.strictEqual(await page.locator('#strip .tclip').count(), 2, 'the timeline is untouched');
  assert.ok(!(await page.locator('#trayLabel').first().isHidden()), 'the READY TO DROP IN label shows');
  n++; console.log('  ok — Add from the Dump lands in the tray, the timeline untouched');

  // a tray piece arms like a shelf clip and drops in where tapped
  await page.locator('#tray .tclip').nth(0).click();   // the album's still
  assert.ok(await page.locator('#tl.placing').count(), 'tray arm lights the indicators');
  await page.locator('#strip .gap').nth(2).click();    // the end gap
  await page.waitForTimeout(800);
  assert.strictEqual(await page.locator('#strip .tclip').count(), 3);
  assert.strictEqual(await page.locator('#tray .tclip').count(), 1);
  let s = saves[saves.length - 1];
  assert.strictEqual(s.clips[2].id, ALBUM_ITEMS[0].id);
  assert.strictEqual(s.tray.length, 1);
  n++; console.log('  ok — a tray piece drops into the timeline and leaves the tray');

  // the placed still wears its hold and offers the length chips when held
  assert.strictEqual(await page.locator('#strip .tclip').nth(2).locator('.dur').textContent(), '4s');
  await page.locator('#strip .tclip').nth(2).click();
  assert.strictEqual(await page.locator('#handHold:not([hidden]) button').count(), 4);
  await page.locator('#handHold button', { hasText: '6s' }).click();
  await page.waitForTimeout(800);
  assert.strictEqual(saves[saves.length - 1].clips[2].hold, 6);
  n++; console.log('  ok — a still shows its hold and the chips change it');

  // a video waiting in the tray: Remove (not Take off), and no hold chips
  await page.locator('#tray .tclip').nth(0).click();
  assert.strictEqual(await page.locator('#handRemove').textContent(), 'Remove');
  assert.strictEqual(await page.locator('#handHold:not([hidden])').count(), 0);
  n++; console.log('  ok — a clip in hand shows Remove and no hold chips');
  await page.locator('#handX').click();   // put it down before the upload flow

  // the Upload button: picked files join the tray as each lands
  await page.locator('#upFile').setInputFiles([
    { name: 'sunrise.png', mimeType: 'image/png', buffer: Buffer.from('fakepng') },
    { name: 'flight.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fakemp4') },
  ]);
  await page.waitForTimeout(900);
  assert.strictEqual(await page.locator('#tray .tclip').count(), 3);
  s = saves[saves.length - 1];
  const ids = s.tray.map((x) => x.id);
  assert.ok(ids.includes('up-sunrisepng') && ids.includes('up-flightmp4'));
  const sun = s.tray.find((x) => x.id === 'up-sunrisepng');
  assert.strictEqual(sun.kind, 'image');
  assert.strictEqual(sun.hold, 4);
  assert.strictEqual(s.tray.find((x) => x.id === 'up-flightmp4').kind, 'video');
  n++; console.log('  ok — Upload stages picked files in the tray, saved with the doc');

  // Remove discards a tray piece without touching the timeline
  const stripBefore = await page.locator('#strip .tclip').count();
  await page.locator('#tray .tclip').nth(1).click();   // sunrise
  await page.locator('#handRemove').click();
  await page.waitForTimeout(800);
  assert.strictEqual(await page.locator('#tray .tclip').count(), 2);
  assert.strictEqual(await page.locator('#strip .tclip').count(), stripBefore);
  n++; console.log('  ok — Remove discards from the tray, the timeline untouched');

  await browser.close();
}

pageTests().then(() => {
  console.log(`\nall ${n} passing`);
}).catch((e) => {
  console.error('\nFAILED:', e);
  process.exit(1);
});
