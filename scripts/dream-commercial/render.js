// Render a dream-commercial chat video from a message script.
//
//   node scripts/dream-commercial/render.js video1.json /tmp/out.mp4
//
// Steps the fake iOS group chat in render.html one message at a time through
// headless Chromium (the repo's own Playwright + the preinstalled browser),
// screenshotting each pop-in frame deterministically — the animation is driven
// by progress value, never wall clock — then assembles 1080x1920 30fps H.264
// with the bundled ffmpeg-static. No model calls; rendering costs nothing.
//
// Images in the script are Storage URLs; they are downloaded up front with
// curl (which carries the sandbox proxy + CA config) and swapped to file://
// paths, so the browser itself never needs network. The Newsreader serif for
// the title/end cards is fetched from Google Fonts the same way; if that
// fails the cards fall back to Liberation Serif and the render still ships.
const fs = require('fs');
const os = require('os');
const path = require('path');

const { curl, fetchFont, encode, FPS, CHROME, ROOT } = require(path.join(__dirname, 'film-kit'));
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));

const POP_FRAMES = 8;   // ~0.27s of pop-in per message

(async () => {
  const scriptPath = process.argv[2];
  const outMp4 = process.argv[3];
  if (!scriptPath || !outMp4) {
    console.error('usage: node render.js <script.json> <out.mp4>');
    process.exit(1);
  }
  const script = JSON.parse(fs.readFileSync(
    fs.existsSync(scriptPath) ? scriptPath : path.join(__dirname, scriptPath), 'utf8'));

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamad-'));
  const framesDir = path.join(work, 'frames');
  fs.mkdirSync(framesDir);

  // localize images
  let n = 0;
  for (const s of script.steps) {
    if (s.img && /^https?:/.test(s.img)) {
      const f = path.join(work, `img${n++}.webp`);
      curl(s.img, f);
      s.img = 'file://' + f;
    }
  }

  const serif = fetchFont(
    'https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@1,400&display=swap',
    work, 'newsreader');

  const browser = await chromium.launch({ executablePath: CHROME });
  // A real iPhone 13: 390x844 points at 3x = 1170x2532, the phone's native
  // screenshot size — v1's 540x960 read as "not an iPhone" to Sophie.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await page.goto('file://' + path.join(__dirname, 'render.html'));
  if (serif) {
    await page.addStyleTag({
      content: `@font-face{font-family:'Newsreader';font-style:italic;font-weight:400;src:url('file://${serif}') format('woff2')}`,
    });
  }
  const stepCount = await page.evaluate(s => window.__load(s), script);

  // force every image (and the serif) to be decoded before frame one
  await page.evaluate(() => {
    const pre = document.createElement('div');
    pre.style.cssText = 'position:absolute;left:-9999px;top:0';
    pre.innerHTML = '<span style="font-family:Newsreader;font-style:italic">x</span>';
    document.body.appendChild(pre);
  });
  for (const s of script.steps) {
    if (s.img) await page.evaluate(src => new Promise(res => {
      const im = new Image();
      im.onload = im.onerror = res;
      im.src = src;
    }), s.img);
  }
  await page.evaluate(() => document.fonts.ready);

  // frames + concat list (durations per frame; last file repeated per the
  // concat demuxer's rule that the final entry needs no duration)
  const list = [];
  let frame = 0;
  const shot = async (dur) => {
    const f = path.join(framesDir, `f${String(frame++).padStart(5, '0')}.png`);
    await page.screenshot({ path: f });
    list.push(`file '${f}'`, `duration ${dur.toFixed(4)}`);
    return f;
  };

  let lastFile = null;
  for (let i = 0; i < stepCount; i++) {
    const step = script.steps[i];
    const anim = step.type === 'msg' ? POP_FRAMES : POP_FRAMES + 2;
    for (let f = 1; f <= anim; f++) {
      await page.evaluate(([i, p]) => window.__setStep(i, p), [i, f / anim]);
      lastFile = await shot(1 / FPS);
    }
    const hold = Math.max(0.2, (step.hold || 1.5) - anim / FPS);
    lastFile = await shot(hold);
    process.stdout.write(`step ${i + 1}/${stepCount} (${step.type})\n`);
  }
  list.push(`file '${lastFile}'`);
  const listFile = path.join(work, 'list.txt');
  fs.writeFileSync(listFile, list.join('\n') + '\n');

  await browser.close();

  encode(listFile, outMp4);

  const secs = script.steps.reduce((a, s) => a + (s.hold || 1.5), 0);
  console.log(`\nwrote ${outMp4} (~${Math.round(secs)}s, ${frame} stills)`);
  fs.rmSync(framesDir, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
