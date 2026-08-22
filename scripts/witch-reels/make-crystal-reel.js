#!/usr/bin/env node
/**
 * make-crystal-reel.js — the crystal reel, end to end: five stills drawn solo
 * at reel size, a gpt-4o-mini-tts voiceover, and one 1080x1920 film.
 *
 * WHY THIS REEL AND NOT ONE OF THE OTHER SEVEN: it is the only one of the eight
 * whose script is carried by VOICE. The other seven are text overlays, and
 * nothing in this repo burns timed text onto video yet.
 *
 * THE STORY SLOT IS LEFT EMPTY, ON PURPOSE. Their script reserves 4s-24s for
 * the stone's true story in Sophie's mom's words and says in capitals that the
 * slot is real or the reel doesn't run. Searched for it: the repo, all 9,600
 * feed messages, and the 1,254-source transcript library — it is written down
 * nowhere. So the film holds the pictures over silence for exactly those 20
 * seconds rather than having a model invent a memory about a real person. Drop
 * the recording in with --story <file.mp3> and the same command rebuilds it.
 *
 * THE OTHER TWO BLANKS in the script are handled the same way, not guessed:
 * `[stone]` becomes "a garnet" (the doc's own named alternate episode, and what
 * the stills already draw), and `[neighbor stones]` is CUT rather than filled —
 * trimming a clause is honest, naming two stones that may not be on that shelf
 * is not.
 *
 *   node scripts/witch-reels/make-crystal-reel.js [--draw] [--voice] [--render]
 *                                                 [--story cut.mp3] [--dry-run]
 *   (no step flags = all three)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const admin = require('firebase-admin');

const HERE = __dirname;
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'witchcraft-reels-panels';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const DRY = argv.includes('--dry-run');
const WORK = flag('out', '/tmp/crystal-reel');
const STORY = flag('story', null);
const steps = ['draw', 'voice', 'render'].filter(s => argv.includes('--' + s));
const DO = s => !steps.length || steps.includes(s);

const MODEL = 'gpt-image-2';
const QUALITY = flag('quality', 'medium');
const SIZE = '1024x1536';
const W = 1080, H = 1920, FPS = 30;

// ─── Their style block, verbatim — including the full-bleed suffix that a
// sheet run had to replace. A solo still is what it was written for. ────
const PREFIX =
  'Hand-drawn dark storybook illustration in ink and gouache, deep plum and ' +
  'ink palette warmed by generous golden candlelight and a soft ambient fill ' +
  'so every detail stays readable in the shadows, gentle chiaroscuro. ' +
  'Vertical composition with breathing room at the top and bottom of the frame.';
const SUFFIX =
  'Render as a single full-bleed illustration, no borders, no panels, no text ' +
  'or lettering anywhere in the image.';

// ONE CONTENT OVERRIDE, and it restores their own wording rather than
// replacing it. The doc writes this still as "[WRITTEN FROM THE STORY — …
// e.g. FOR THE GARNET: the stone sitting on a car dashboard at dusk…]";
// stills.json copied the example clause and dropped "for the garnet", so the
// prompt says only "the stone" — and the model drew a labradorite, blue-green,
// while the voiceover was saying garnet. Naming it is the fix.
const CONTENT = {
  'crystal-story-04':
    'The deep red multi-faceted garnet sitting on a car dashboard at dusk, '
    + 'road lights streaking past outside the windshield.',
};

const STILLS = require(path.join(HERE, 'stills.json'))
  .filter(s => s.reel === 'crystal-story')
  .map(s => (CONTENT[s.id] ? { ...s, content: CONTENT[s.id] } : s));

// ─── The cut ────────────────────────────────────────────────────────
// Their beat sheet, with the two halves of the story slot given a picture each
// so the twenty seconds is not one frozen frame. `secs` fixed = a slot that
// must be its scripted length; null = the line's own voiceover decides.
const BEATS = [
  { still: 'crystal-story-01', vo: 'My mom has collected crystals for thirty years. This one is a garnet.', pad: 0.7, motion: 'in' },
  { still: 'crystal-story-02', secs: 10, motion: 'in', slot: 'story' },
  { still: 'crystal-story-04', secs: 10, motion: 'in', slot: 'story' },
  { still: 'crystal-story-03', vo: 'It lives on the third shelf.', pad: 0.8, motion: 'pan' },
  { still: 'crystal-story-05', vo: 'Next week: the one she almost threw away.', pad: 1.4, motion: 'in' },
];

const VOICE = flag('voice-name', 'sage');
const VOICE_STEER =
  'Quiet and unhurried, close to the microphone, fond rather than reverent. ' +
  'Plain speech, no announcer warmth, no upward lilt at the ends of sentences.';

const sh = (bin, args) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
const dur = f => Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nw=1:nk=1', f]).toString().trim());

// ─── Drawing ────────────────────────────────────────────────────────
async function draw(content) {
  const prompt = `${PREFIX} ${content} ${SUFFIX}`;
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, output_format: 'webp', n: 1 }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return { buf: Buffer.from(d.data[0].b64_json, 'base64'), prompt };
}

// ─── Voice ──────────────────────────────────────────────────────────
async function say(text, dest) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: VOICE, input: text,
      instructions: VOICE_STEER, response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

// ─── Storage ────────────────────────────────────────────────────────
let bucket = null;
function initFirebase() {
  if (admin.apps.length) return;
  const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(creds), storageBucket: `${creds.project_id}.firebasestorage.app` });
  bucket = admin.storage().bucket();
}
async function upload(file, name, type) {
  const dest = bucket.file(`witch-reels/${name}`);
  await dest.save(fs.readFileSync(file), { metadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  await dest.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/witch-reels/${name}`;
}
async function post(route, body) {
  const r = await fetch(`${BASE}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({}));
}

/**
 * One still → one silent 1080x1920 segment with a slow move.
 *
 * The art is 2:3 and a reel is 9:16 — NARROWER — so the frame is filled by
 * cropping the SIDES, never the top and bottom, which is where their style
 * prompt puts the breathing room a caption would use.
 *
 * TWO MOVES, TWO MECHANISMS, and the split is forced rather than stylistic:
 * `crop` evaluates its WIDTH and HEIGHT once and only its x/y per frame (which are
 * per-frame by default — this build has no `eval` option to ask for it, and
 * passing one is a hard error), so a push-in — where the window itself has to
 * shrink — cannot be a crop at all and goes through zoompan. A pan can, and does, because zoompan's own x/y are
 * integers and a slow lateral drift visibly stutters on them.
 *
 * zoompan is fed a 2x-supersampled frame for the same reason: its window is
 * computed in whole pixels of the INPUT, so a push that creeps a fraction of a
 * pixel per frame lands on the same integer several frames running and the
 * picture jerks. Twice the pixels, half the jerk, and the downscale to 1080
 * hides what is left.
 */
function segment(img, secs, motion, out) {
  const frames = Math.max(2, Math.round(secs * FPS));
  const chain = motion === 'pan'
    // Fill the HEIGHT and drift across the extra width — the shelf's own
    // dimension, and the reason this beat is a pan in their notes at all.
    ? `scale=-2:${H * 2}:flags=lanczos,` +
      `crop=${W * 2}:${H * 2}:x='(iw-${W * 2})*min(t/${secs.toFixed(3)},1)':y=0,` +
      `scale=${W}:${H}:flags=lanczos`
    // Cover 9:16 by cropping the sides, supersample, then creep the zoom.
    : `crop=ih*9/16:ih,scale=${W * 2}:${H * 2}:flags=lanczos,` +
      `zoompan=z='1+0.09*on/${frames - 1}':d=1:` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`;
  sh('ffmpeg', ['-y', '-loop', '1', '-i', img, '-t', String(secs),
    '-vf', `${chain},setsar=1,format=yuv420p`,
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', out]);
  return out;
}

async function main() {
  fs.mkdirSync(WORK, { recursive: true });
  const meta = fs.existsSync(path.join(WORK, 'meta.json'))
    ? JSON.parse(fs.readFileSync(path.join(WORK, 'meta.json'), 'utf8')) : { stills: {}, vo: {} };
  const save = () => fs.writeFileSync(path.join(WORK, 'meta.json'), JSON.stringify(meta, null, 2));

  if (DRY) {
    for (const b of BEATS) console.log(`${b.still}  ${b.secs ? b.secs + 's (slot)' : 'vo: ' + b.vo}`);
    return;
  }

  if (DO('draw')) {
    initFirebase();
    for (const s of STILLS) {
      const file = path.join(WORK, `${s.id}.webp`);
      if (fs.existsSync(file) && meta.stills[s.id]) { console.log(`${s.id} … cached`); continue; }
      process.stdout.write(`${s.id} … `);
      const { buf, prompt } = await draw(s.content);
      fs.writeFileSync(file, buf);
      const url = await upload(file, `${s.id}-solo-${Date.now()}.webp`, 'image/webp');
      await post('/api/gallery', { assetsOnly: true, chat: CHAT, url,
        description: `${s.reelTitle} — ${s.label} (${s.id}) — solo redraw for the reel`,
        prompt: `${MODEL} · ${QUALITY}` });
      await post('/api/gallery/assets/prompt', { chat: CHAT, url,
        style: `${PREFIX} [content] ${SUFFIX}\n\n[${MODEL} · ${SIZE} · quality ${QUALITY} · no reference images attached]`,
        content: s.content });
      meta.stills[s.id] = { url, prompt }; save();
      console.log(`OK ${Math.round(buf.length / 1024)}KB`);
    }
  }

  if (DO('voice')) {
    for (let i = 0; i < BEATS.length; i++) {
      const b = BEATS[i];
      if (!b.vo) continue;
      const file = path.join(WORK, `vo-${i}.mp3`);
      if (!fs.existsSync(file)) { process.stdout.write(`vo ${i} … `); await say(b.vo, file); console.log('OK'); }
      meta.vo[i] = { text: b.vo, file, secs: dur(file) };
    }
    save();
  }

  if (!DO('render')) return;
  initFirebase();

  // A dropped-in story recording overrides the two silent slots: it replaces
  // them whole, and the pictures split its real length between them.
  let storyFile = null, storySecs = 20;
  if (STORY) { storyFile = STORY; storySecs = dur(STORY); }

  const segs = [], audio = [];
  for (let i = 0; i < BEATS.length; i++) {
    const b = BEATS[i];
    const img = path.join(WORK, `${b.still}.webp`);
    const secs = b.secs != null
      ? (b.slot === 'story' ? storySecs / 2 : b.secs)
      : meta.vo[i].secs + b.pad;
    const seg = segment(img, secs, b.motion, path.join(WORK, `seg-${i}.mp4`));
    segs.push({ file: seg, secs, beat: i });
  }

  // Audio is built per segment as PCM at the segment's REAL encoded length and
  // AAC-encoded ONCE at the mux — per-piece aac priming walks the sound off the
  // picture (the scratch pad's measured finding, not a preference).
  for (const s of segs) {
    const wav = path.join(WORK, `a-${s.beat}.wav`);
    const real = dur(s.file);
    const src = meta.vo[s.beat]?.file;
    if (src) {
      sh('ffmpeg', ['-y', '-i', src, '-af',
        `adelay=200|200,apad,atrim=0:${real.toFixed(3)}`,
        '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', wav]);
    } else {
      sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
        '-t', real.toFixed(3), '-c:a', 'pcm_s16le', wav]);
    }
    audio.push(wav);
  }

  const listV = path.join(WORK, 'v.txt');
  fs.writeFileSync(listV, segs.map(s => `file '${s.file}'`).join('\n'));
  const listA = path.join(WORK, 'a.txt');
  fs.writeFileSync(listA, audio.map(a => `file '${a}'`).join('\n'));
  const vcat = path.join(WORK, 'v.mp4'), acat = path.join(WORK, 'a.wav');
  sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listV, '-c', 'copy', vcat]);
  sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listA, '-c', 'copy', acat]);

  // The story recording, when there is one, plays across the two slot segments.
  let finalA = acat;
  if (storyFile) {
    const at = segs.slice(0, BEATS.findIndex(b => b.slot === 'story'))
      .reduce((n, s) => n + dur(s.file), 0);
    finalA = path.join(WORK, 'a-story.wav');
    sh('ffmpeg', ['-y', '-i', acat, '-i', storyFile, '-filter_complex',
      `[1:a]adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}[s];[0:a][s]amix=inputs=2:normalize=0[o]`,
      '-map', '[o]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', finalA]);
  }

  const out = path.join(WORK, 'crystal-reel.mp4');
  sh('ffmpeg', ['-y', '-i', vcat, '-i', finalA, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);

  const total = dur(out);
  const url = await upload(out, `crystal-reel-${Date.now()}.mp4`, 'video/mp4');
  console.log(`\n${total.toFixed(1)}s · ${Math.round(fs.statSync(out).size / 1024)}KB\n${url}`);
  segs.forEach(s => console.log(`  ${BEATS[s.beat].still}  ${dur(s.file).toFixed(2)}s  ${BEATS[s.beat].vo || '(story slot — silent)'}`));
  fs.writeFileSync(path.join(WORK, 'film.json'), JSON.stringify({ url, total }, null, 2));
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
