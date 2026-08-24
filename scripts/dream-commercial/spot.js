// Render the SONG SPOT — the second dream-app commercial (docs/dream-commercial.md).
//
//   node scripts/dream-commercial/spot.js spot.json /tmp/out.mp4 [--audio venus.m4a]
//
// Same camera as render.js (film-kit.js): headless Chromium stepped one beat
// at a time by a progress NUMBER, never wall clock, then the stills concat to
// 1080x1920-class H.264. No model calls; rendering costs nothing.
//
// THE SOUND IS THE POINT OF THIS ONE. The spot is cut so the hook — "you were
// in my dreams last night", 1:04 into Afro Comb's "Venus" — lands exactly on
// the end card, because the end card IS that line. The script carries the
// hook's timestamp, not an offset, so the mux is derived: the song starts at
// hook − (when the end card appears). Without --audio the film renders silent
// and the exact ffmpeg line is printed. A cloud session CAN get the audio now:
// POST /api/ytdl/grab {url, kind:'audio', to:'none'} (measured live 2026-08-23).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { curl, fetchFont, encode, FFMPEG, FPS, CHROME, ROOT } = require(path.join(__dirname, 'film-kit'));
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));

const FADE = 10;  // frames of fade on a card

(async () => {
  const args = process.argv.slice(2);
  const audio = (() => { const i = args.indexOf('--audio'); return i < 0 ? null : args.splice(i, 2)[1]; })();
  const [scriptPath, outMp4] = args;
  if (!scriptPath || !outMp4) {
    console.error('usage: node spot.js <script.json> <out.mp4> [--audio <song>]');
    process.exit(1);
  }
  const script = JSON.parse(fs.readFileSync(
    fs.existsSync(scriptPath) ? scriptPath : path.join(__dirname, scriptPath), 'utf8'));

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamspot-'));
  const framesDir = path.join(work, 'frames');
  fs.mkdirSync(framesDir);

  if (script.dream.img && /^https?:/.test(script.dream.img)) {
    const f = path.join(work, 'dream.webp');
    curl(script.dream.img, f);
    script.dream.img = 'file://' + f;
  }

  // The app's own two faces plus the cards' serif. Baveuse (the wordmark) is
  // in the repo — it must not hang on a font CDN here either.
  const fonts = [
    ['https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@1,400&display=swap', 'newsreader', 'Newsreader', 'italic', 400],
    ['https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600&display=swap', 'garamond', 'EB Garamond', 'normal', 400],
    ['https://fonts.googleapis.com/css2?family=EB+Garamond:wght@600&display=swap', 'garamond6', 'EB Garamond', 'normal', 600],
    ['https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap', 'courier', 'Courier Prime', 'normal', 400],
  ].map(([url, name, family, style, weight]) => ({ file: fetchFont(url, work, name), family, style, weight }));
  const baveuse = path.join(ROOT, 'public', 'fonts', 'baveuse.woff');

  const browser = await chromium.launch({ executablePath: CHROME });
  // The same real iPhone 13 the boys video is shot on: 390x844 at 3x.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await page.goto('file://' + path.join(__dirname, 'spot.html'));
  const faces = fonts.filter(f => f.file).map(f =>
    `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};src:url('file://${f.file}') format('woff2')}`);
  if (fs.existsSync(baveuse)) {
    faces.push(`@font-face{font-family:'Baveuse';font-style:normal;font-weight:400;src:url('file://${baveuse}') format('woff')}`);
  }
  if (faces.length) await page.addStyleTag({ content: faces.join('\n') });

  const beatCount = await page.evaluate(s => window.__load(s), script);
  if (script.dream.img) {
    await page.evaluate(src => new Promise(res => {
      const im = new Image(); im.onload = im.onerror = res; im.src = src;
    }), script.dream.img);
  }
  await page.evaluate(() => document.fonts.ready);

  const list = [];
  let frame = 0;
  const shot = async (dur) => {
    const f = path.join(framesDir, `f${String(frame++).padStart(5, '0')}.png`);
    await page.screenshot({ path: f });
    list.push(`file '${f}'`, `duration ${dur.toFixed(4)}`);
    return f;
  };

  // when each beat starts, so the song can be aligned to one of them
  const starts = [];
  let t = 0;
  for (const b of script.beats) { starts.push(t); t += b.hold; }

  let lastFile = null;
  for (let i = 0; i < beatCount; i++) {
    const beat = script.beats[i];
    const anim = beat.type === 'app' ? Math.round((beat.move || 0.6) * FPS) : FADE;
    for (let f = 1; f <= anim; f++) {
      await page.evaluate(([i, p]) => window.__setStep(i, p), [i, f / anim]);
      lastFile = await shot(1 / FPS);
    }
    const hold = Math.max(0.2, beat.hold - anim / FPS);
    lastFile = await shot(hold);
    process.stdout.write(`beat ${i + 1}/${beatCount} (${beat.type}${beat.state ? ' ' + beat.state : ''})\n`);
  }
  list.push(`file '${lastFile}'`);
  const listFile = path.join(work, 'list.txt');
  fs.writeFileSync(listFile, list.join('\n') + '\n');
  await browser.close();

  const silent = audio ? path.join(work, 'silent.mp4') : outMp4;
  encode(listFile, silent);

  // the song: start it so the hook lands on the beat that is meant to carry it
  const song = script.song || {};
  const landsAt = starts[script.beats.findIndex(b => b.id === song.landsOn)] ?? 0;
  const from = Math.max(0, (song.hook || 0) - landsAt);
  // `until` stops the track at a timestamp rather than at the end of the film,
  // so the picture can outlive the music — the closing card plays in the quiet
  // after the hook, instead of dragging in whatever the next verse is about.
  const runs = song.until ? Math.max(0.5, song.until - from) : t;
  const fade = Math.min(1.2, runs / 3);
  if (audio) {
    execFileSync(FFMPEG, [
      '-y', '-i', silent, '-ss', from.toFixed(2), '-t', runs.toFixed(2), '-i', audio,
      '-map', '0:v', '-map', '1:a', '-t', t.toFixed(2),
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-af', `afade=t=out:st=${(runs - fade).toFixed(2)}:d=${fade.toFixed(2)},apad`,
      '-movflags', '+faststart', outMp4,
    ], { stdio: ['pipe', 'pipe', 'inherit'] });
  }

  console.log(`\nwrote ${outMp4} (${t.toFixed(1)}s, ${frame} stills)${audio ? ' with the song' : ' — SILENT'}`);
  if (!audio && song.hook) {
    console.log(`\nthe song goes on with:\n  node ${path.relative(ROOT, __filename)} ${scriptPath} ${outMp4} --audio <venus.m4a>`);
    console.log(`  (it starts the track at ${from.toFixed(2)}s so the ${song.hook}s hook lands on the ${song.landsOn} at ${landsAt.toFixed(1)}s)`);
  }
  fs.rmSync(framesDir, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
