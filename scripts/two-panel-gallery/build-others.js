/* "The other clips, ranked" — the second gallery page.
 *
 *   node scripts/two-panel-gallery/build-others.js [--dry]
 *
 * Sophie, after reading page one: "can you pull that more of the clips of the
 * grasshopper video if there were any other ones that were animated so I can
 * see if any of those did well? Also, is there anywhere else that motion was
 * happening more recently that worked out not the dinner party."
 *
 * So: all sixteen Exile clips ranked, then everything animated since, found by
 * sweeping the clip library (GET /api/clips, harvested 2026-08-14) rather than
 * by remembering — and measured on the same scale as page one.
 */
const fs = require('fs');
const path = require('path');
const { row, splitFiled, page, post } = require('./render');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'two-panel-animation-gallery';
const SHEET = 'other-clips-v1';
const TITLE = 'The other clips, ranked (v1)';
const DRY = process.argv.includes('--dry');
const B = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app';

// ── The Exile, all sixteen, ranked by measured picture-change ───────────────
// Each still and its VERBATIM prompts (including the wan line, which this chat
// filed onto the style half — the only project here that did) are read back
// out of its Assets tab, so nothing below is retyped.
const EXILE = [
  ['exile-v1-08-you-taught-them-too-much', 'The Exile 08/16', 24.35, 'The strongest of the sixteen — and still below every hospital pair.'],
  ['exile-v1-03-the-black-robe', 'The Exile 03/16', 21.99, null],
  ['exile-v1-10-bound', 'The Exile 10/16', 20.54, null],
  ['exile-v1-06-the-forbidden-lesson', 'The Exile 06/16', 17.91, null],
  ['exile-v1-05-they-learned-to-build', 'The Exile 05/16', 17.80, null],
  ['exile-v1-01-the-watchers', 'The Exile 01/16', 17.05, null],
  ['exile-v1-07-the-ones-in-black-come', 'The Exile 07/16', 13.71, null],
  ['exile-v1-04-teaching-them-to-farm', 'The Exile 04/16', 13.19, null],
  ['exile-v1-13-nobody-here', 'The Exile 13/16', 11.94, null],
  ['exile-v1-12-the-barren-place', 'The Exile 12/16', 9.28, null],
  ['exile-v1-02-the-coarse-people', 'The Exile 02/16', 8.85, null],
  ['exile-v1-16-i-have-no-body', 'The Exile 16/16', 6.94, null],
  ['exile-v1-15-like-an-orchestra', 'The Exile 15/16', 5.33, 'The one the chapter ends on, and it barely moves.'],
  ['exile-v1-09-the-wars', 'The Exile 09/16', 4.88, null],
  ['exile-v1-14-nothing-to-do', 'The Exile 14/16', 2.62, null],
  ['exile-v1-11-the-vehicle', 'The Exile 11/16', 2.46, 'The lowest of the sixteen.'],
];

// ── Everything animated since, that is not the dinner party ────────────────
const PIG_STILL = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1785819434951-lq2oy9.png';
const PIG_STYLE = 'Use the attached image as a style reference. Only use its style, not its content — '
  + 'do not copy anything depicted in it. You do not have to copy its colors.\n\nDraw: [content]\n\n'
  + "[style ref attached: refs/sage-sandy-mirror.png (Sophie's sketchbook scan, datescan0013) · "
  + 'gpt-image-2 edits · quality medium · 1024x1536]';
const PIG_CONTENT = 'Three men slaughtering pigs one at a time in a desert with a blue sky, wearing '
  + "the simple robes people would have worn in Moses' time. Each pig lies on its own wooden "
  + "butcher's block, one man standing behind each. Only the man at the back is butchering his pig "
  + 'right now, bringing his blade down. The other two men stand at their blocks waiting their turn '
  + 'with empty hands — no knives out. The first pig is in the back, the second on the left a little '
  + 'farther toward the front, and the third on the right, nearest the front.';
const PIG_MOTION = 'The men butcher the pigs one at a time, taking turns: first the man at the back '
  + "raises a blade and brings it down on his pig's neck, then the man on the left does the same, "
  + 'then the man on the right. Blood comes out of the pigs as their necks are cut. Each man stands '
  + 'still until his turn. The camera does not move.';
const HOLE_STILL = `${B}/gravity-lock/uncut/blackhole.webp`;

const RECENT = [
  {
    id: 'hole-v2', media: 'gl-blackhole-suckedin-v2', still: HOLE_STILL,
    title: 'The black hole, sucking everything in — 11 Aug',
    move: 36.92, chips: ['gpt-image-2 · medium', 'wan 720p, 121 frames', '24¢'],
    her: 'Your re-roll ask is what made it: "I was kind of hoping that the things could be getting like sucked into the black hole not just rotating around it."',
    style: 'gpt-image-2 · medium. This is the uncut card sheet cell, the frame the animation was made from.',
    content: 'not available — the Gravity Lock chat filed this frame without its drawing prompt.',
    motion: 'not available — the re-roll prompt is quoted in that chat but was never filed on the image, so it is not reproduced here.',
    alsoPlay: [{ media: 'gl-blackhole-rotating-v1', label: 'v1, the one that only rotated', move: 29.84 }],
  },
  {
    id: 'pigs-wan', media: 'pig-wan720-r2', still: PIG_STILL,
    title: 'The pigs, one chop at a time — 4 Aug',
    move: 5.35, verdict: 'good',
    chips: ['gpt-image-2 · medium', 'wan 720p, 121 frames', '24¢', 'the number is wrong here'],
    her: 'You picked this one over Seedance. It scores 5 because the men end where they started — the metric measures net change, and this action returns to rest.',
    style: PIG_STYLE, content: PIG_CONTENT, motion: PIG_MOTION,
    motionMeta: 'wan-2.2-i2v-fast, 720p, 121 frames. The route appends: "The subject, style and composition of the image are preserved exactly."',
    alsoPlay: [{ media: 'pig-wan480-r1', label: 'round 1, 480p, before the blood line', move: 7.85 }],
  },
  {
    id: 'pigs-seedance', media: 'pig-seedance-r1', still: PIG_STILL,
    title: 'The same picture through Seedance — the trap in the number',
    move: 66.33, verdict: 'warn',
    chips: ['gpt-image-2 · medium', 'seedance-1-lite · 480p', 'APIFRAME'],
    her: 'The highest score of anything made since the hospital round — and it is the worst clip on this page. It scores that high because the picture stops being your drawing: halfway through it re-renders into a flat blue sky and realistic skin. A style collapse IS a picture-change, so the number cannot tell them apart. You rejected this by eye at the time.',
    style: PIG_STYLE, content: PIG_CONTENT, motion: PIG_MOTION,
    motionMeta: 'seedance-1-lite via APIFRAME, 480p. The same motion text went to both animators.',
    alsoPlay: [{ media: 'pig-seedance-r2', label: 'round 2, same problem', move: 36.26 }],
  },
];

(async () => {
  const r = await fetch(`${BASE}/api/gallery/assets?chat=dolores-cannon-memo-illustrations&limit=300`);
  if (!r.ok) throw new Error(`assets → ${r.status}`);
  const assets = (await r.json()).assets || [];

  const exileRows = EXILE.map(([mediaKey, label, move, her]) => {
    const a = assets.find((x) => (x.description || '').includes(label));
    if (!a) throw new Error(`no asset for ${label}`);
    const sp = splitFiled(a.promptStyle);
    return row({
      id: mediaKey, media: mediaKey, still: a.url, move, her,
      title: (a.description || label).replace(/^The Exile /, ''),
      chips: [a.prompt || 'gpt-image-2 · medium', 'wan 480p draft', 'motion prompt on file'],
      style: sp.style, content: a.promptContent, motion: sp.motion, motionMeta: sp.motionMeta,
    });
  });

  const html = page({
    title: TITLE, chat: CHAT, sheet: SHEET,
    help: '<b>What this is.</b> All sixteen grasshopper clips, ranked, so you can see whether any of '
      + 'them did well — and everything animated since, found by sweeping the clip library rather than '
      + 'by remembering. The dinner party is left out, as you said.'
      + '<br><br><b>"picture moved"</b> is the same measurement as the first page: how different a '
      + "clip's last frame is from its first, one scale across every project. <b>It is not the "
      + 'judge.</b> A clip whose action returns to rest scores low but reads fine (the pigs), and a '
      + 'clip whose STYLE collapses scores high for the wrong reason (Seedance). Read the number '
      + 'with the picture, never instead of it.'
      + '<br><br>Tap a drawing to see it big, tap a clip to play it. The + under each row is a note.',
    body: '  <div class="sect">The grasshopper — all sixteen, best first</div>\n'
      + exileRows.join('\n')
      + '\n  <div class="sect">Animated since, and not the dinner party</div>\n'
      + RECENT.map(row).join('\n'),
  });

  const out = path.join(__dirname, 'page-others.html');
  fs.writeFileSync(out, html);
  console.log(`page → ${out} (${(html.length / 1024).toFixed(0)}kb)`);
  if (DRY) return;

  const d = await post({ base: BASE, chat: CHAT, title: TITLE, html });
  console.log('posted →', d.url || d.id);
  console.log(d.warnings && d.warnings.length ? `KIT WARNINGS:\n - ${d.warnings.join('\n - ')}` : 'no kit warnings');
})().catch((e) => { console.error(e); process.exit(1); });
