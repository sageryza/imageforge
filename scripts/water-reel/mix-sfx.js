#!/usr/bin/env node
/* mix-sfx.js — lay the water reel's sound effects UNDER a vo-film narration.
 *
 * vo-film owns the voice and hands back per-shot audio; this only adds the
 * effects bed on top of its finished film, so nothing here can move a word.
 *   node scripts/water-reel/mix-sfx.js --film <dir> --sfx <dir> --out <mp4>
 *
 * EVERY EFFECT IS LEVELLED BY MEASUREMENT, NEVER BY A MULTIPLIER (v9, Sophie
 * 2026-08-25: "the sound effects are quite loud… if you measure the decibel
 * level, maybe you can tone the volume down for just the ones that are really
 * loud, especially towards the end"). She was pointing at a real fault: the
 * source files span 26 dB of mean level (plinks -37.2, zapbig -11.2) and v8
 * applied near-uniform gains of 0.18-0.30, i.e. 4 dB of spread — so one clip
 * sat 9 dB under her voice and another 35 dB under, and which one you got
 * depended entirely on how hot the file happened to be. And the hottest
 * files — zapbig, spooky, surf, zap — are exactly the ones clustered in the
 * last third, which is why the end was the worst of it.
 *
 * So the table carries an INTENT in dB and the gain is derived:
 *   gain = TARGET + lift - measured mean,  clamped so the peak stays under
 *   PEAK_CEIL (a spiky source like plinks has a 28 dB crest and would spike
 *   even at a polite mean).
 * TAPER pulls the bed further down across the reel, ending 4 dB quieter than
 * it starts — her "especially towards the end", applied continuously rather
 * than as a cliff at some shot.
 *
 * Her earlier rules, still in force (v6 notes):
 *  - "have her keep talking continuously don't wait for the sound effect to
 *    finish" — every effect starts INSIDE its shot (0.1-0.7s in) and plays
 *    over her, rather than being given a silent slot of its own.
 * Shot starts are the cumulative per-shot audio lengths vo-film cut, read
 * back off its own shots/ directory — never re-derived from the script.
 */
'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const ffprobe = require('ffprobe-static').path;

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const FILM = args.film, SFX = args.sfx, OUT = args.out, SPEC = args.spec;
if (!FILM || !SFX || !OUT || !SPEC) {
  console.error('need --film <dir> --sfx <dir> --spec <spec.json> --out <mp4>'); process.exit(1);
}

// Her narration measures about -13 dB mean, so the bed sits 17 dB under it.
const TARGET = Number(args.target || -30);   // dB mean, every effect, after gain
const TAPER = Number(args.taper || 4);       // dB quieter by the end of the reel
const PEAK_CEIL = -6;                        // dBFS, no effect may spike past this

// AN EFFECT IS PINNED TO HER LINE, NEVER TO A SHOT SLOT (2026-08-25, Sophie:
// "why did it move? It should not move. Nothing should move unless I say to
// move it"). The bed used to be keyed by shot id — and a shot id is a POSITION
// in the spec, so when the reel was rebuilt around her own recording the
// structure changed underneath the table and every effect silently landed on a
// different moment. The kid giggle she liked ended up somewhere she wasn't
// expecting it, and nothing in the table could have told anyone.
//
// So each entry names a FRAGMENT OF THE LINE it belongs to. The fragment is
// matched against the spec's own phrases, so an effect follows its words
// wherever they end up — and a line that is CUT takes its effect with it, with
// a named warning rather than a silent slide onto the next shot.
//
//   line  a fragment of the shot's phrase, unique across the reel
//   fx    [effect, seconds into the shot, lift in dB above the bed]
//         `at` may instead be {word: 'that'} — the effect starts on that word,
//         located by transcribing that one shot (cached by its bytes)
const BED = [
  { line: 'Scientists did a study', fx: [
    // her ask: the reel opens on the WORD, then the gurgle — not over it
    ['persongurgle', 0.95, +2]] },
  { line: 'hydrates your body', fx: [['gulp', 0.20, 0]] },
  { line: 'supports your brain', fx: [['sparkle', 0.30, 0]] },
  { line: 'keeps you feeling good', fx: [['chime', 0.25, +1]] },

  { line: 'lubricates your ideas', fx: [['cooler', 0.35, +1]] },
  { line: 'miniature fish', fx: [
    // the lullaby starts ON the word, her ask — located in the cut itself
    ['lalala', { word: 'that' }, +3]] },
  { line: 'bones are secretly plants', fx: [['sparkle', 0.50, 0]] },

  { line: 'greetings that live in your ears', fx: [['goblin', 0.35, +2]] },
  { line: 'liquid light making you visible', fx: [['sparkle', 0.30, +1]] },
  { line: 'boat inside your stomach', fx: [['surf', 0.40, 0]] },
  { line: 'Drink gallons Live legendary', fx: [['gulp', 0.25, +1]] },

  { line: 'ghosts that live in your spine', fx: [['spooky', 0.60, +1]] },
  { line: 'liquid lightning', fx: [
    // was zapbig — "I don't like the breaking glass sound effect"
    ['crackle', 0.25, +2]] },
  { line: 'third eye in your knee', fx: [['future', 0.40, 0], ['splash', 3.60, +2, 1.5]] },

  { line: 'rewires your DNA', fx: [['gurgle', 0.50, 0]] },
  { line: 'supercharges your brain', fx: [['zap', 0.35, +1]] },
  { line: 'opens portals', fx: [['sparkle', 0.40, 0]] },
  { line: 'Fill yourself up and overflow', fx: [['splash', 0.20, +2]] },

  { line: 'ghosts that live in your knees', fx: [['spooky', 0.40, +1]] },
  { line: 'thirst demons', fx: [['goblin', 0.35, +2]] },
  { line: 'auras reservoir', fx: [['chime', 0.30, 0]] },

  { line: 'lubricates your thoughts', fx: [['waterswish', 0.20, 0]] },
  { line: 'confuses your cells', fx: [['plinks', 0.45, 0]] },
  { line: 'secret tiny rafts', fx: [['surf', 0.35, 0]] },

  { line: 'washed super clean', fx: [['boing', 0.30, +1]] },
  { line: 'extra water to your water', fx: [['pour', 0.40, 0]] },
  { line: 'cells how to swim', fx: [['splash', 0.30, 0]] },

  { line: 'regrets lurking', fx: [['spooky', 0.35, 0]] },
  { line: 'rocket fuel', fx: [['zapbig', 0.30, +1]] },
  { line: 'third eye on the inside', fx: [['future', 0.30, 0]] },
  { line: 'sponge with anxiety', fx: [['drips', 0.40, 0]] },

  { line: 'drink oceans', fx: [['splash', 0.10, +2, 2.0]] },
];

// HER VOICE IS NEVER LOUDNORMED — this is a STATIC per-shot trim, capped, and
// it is not the same thing (her ask, 2026-08-25: "I think my words are a bit
// quieter here. Can you see if they're the same volume?"). Measured across
// v11's shots her read runs -14.4dB to -17.0dB, which is her delivery, not
// processing. A constant gain per shot evens that without touching the dynamics
// inside a shot; compression or loudnorm would change how she sounds, which is
// the thing that is forbidden. VOICE_CAP bounds it so nothing can be rescued
// from a genuinely bad take by turning it up.
const VOICE_TARGET = Number(args.voiceTarget || -15.5);
const VOICE_CAP = Number(args.voiceCap || 2.5);
// A SYNTHESIZED stand-in is not her voice and does not get her protection.
// Measured on v12: Laura's four shots sit at -24.6dB against Sophie's -16.4,
// so the 2.5dB cap left the borrowed section audibly quiet — and the cap is
// there to stop a bad take of HERS being rescued by volume, which is a rule
// about her performance. `synthSources` on the spec names the sources that
// are not her; those get a wide static trim so the stand-in sits with her.
const SYNTH_CAP = Number(args.synthCap || 12);

const dur = (f) => Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nk=1:nw=1', f]).toString().trim());

// volumedetect prints to STDERR at info level, so it needs spawnSync — an
// execFileSync only hands back stderr when the process FAILS, and this one
// succeeds.
const levels = {};
function level(file) {
  if (levels[file]) return levels[file];
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 22 });
  const txt = `${r.stderr || ''}${r.stdout || ''}`;
  const mean = Number((txt.match(/mean_volume:\s*(-?[\d.]+) dB/) || [])[1]);
  const max = Number((txt.match(/max_volume:\s*(-?[\d.]+) dB/) || [])[1]);
  if (!Number.isFinite(mean) || !Number.isFinite(max)) throw new Error(`could not measure ${file}`);
  return (levels[file] = { mean, max });
}

// THE SPEC DECIDES WHICH SHOTS ARE IN THE REEL, never a glob of shots/.
// vo-film numbers its per-shot wavs by position, so a re-cut that adds a
// section leaves the previous run's files sitting in the same folder under
// numbers that now belong to different shots. Globbing picked up both sets:
// 58 effects laid across 249s of "narration" for a 147s film. Reading the
// spec's own order makes a stale wav unreachable instead of additive.
const shotDir = path.join(FILM, 'shots');
const onDisk = fs.readdirSync(shotDir).filter((f) => /^shot-\d+-.+\.wav$/.test(f));
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const shots = spec.shots.map((sh, i) => {
  // exact index+id: the folder keeps stale wavs from earlier numberings, and
  // an id-only match can land on one of those
  const f = `shot-${String(i).padStart(2, '0')}-${sh.id}.wav`;
  if (!onDisk.includes(f)) throw new Error(`no cut wav for shot ${sh.id} (${f})`);
  return f;
});
// THE FILM IS NAMED BY THE SPEC, never found by scanning the folder. The same
// dir accumulates every cut ever rendered there (`water-reel-v8.mp4` beside
// `water-reel-v9.mp4`, plus `_video.mp4` and the seg-* pieces), and picking
// the first plausible name laid a v9 sound bed over the v8 picture — a mix
// that plays perfectly and is silently the wrong film.
const film = path.join(FILM, `${spec.out}.mp4`);
if (!fs.existsSync(film)) throw new Error(`no film at ${film}`);

const lens = shots.map((f) => dur(path.join(shotDir, f)));
const total = lens.reduce((a, b) => a + b, 0);

// line fragment -> shot index, matched against the spec's own phrases
const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const hay = spec.shots.map((sh) => norm([...(sh.phrases || []), ...((sh.extra || []).map((e) => e.phrase))].join(' ')));
const bedFor = spec.shots.map(() => []);
for (const entry of BED) {
  const want = norm(entry.line);
  const hits = hay.map((h, i) => (h.includes(want) ? i : -1)).filter((i) => i >= 0);
  if (!hits.length) { console.warn(`SFX DROPPED — no shot says "${entry.line}" (the line was cut; its effect went with it)`); continue; }
  if (hits.length > 1) console.warn(`SFX AMBIGUOUS — "${entry.line}" matches ${hits.length} shots; using the first`);
  bedFor[hits[0]].push(...entry.fx);
}

// an effect asked to start ON a word transcribes that ONE shot, cached by bytes
const wordCache = path.join(FILM, '_sfx-words.json');
const wordMem = fs.existsSync(wordCache) ? JSON.parse(fs.readFileSync(wordCache, 'utf8')) : {};
async function wordAt(file, word) {
  const key = require('crypto').createHash('md5').update(fs.readFileSync(file)).digest('hex') + '|' + word;
  if (wordMem[key] != null) return wordMem[key];
  const mp3 = path.join(FILM, '_sfxw.mp3');
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', file, '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3]);
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(mp3)], { type: 'audio/mpeg' }), 'c.mp3');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions',
    { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
  const d = await r.json();
  const w = (d.words || []).find((x) => norm(x.word) === norm(word));
  const at = w ? Math.max(0, w.start) : null;
  if (at == null) console.warn(`SFX word "${word}" not heard in ${path.basename(file)} — falling back to 0.3s in`);
  wordMem[key] = at == null ? 0.3 : at;
  fs.writeFileSync(wordCache, JSON.stringify(wordMem));
  return wordMem[key];
}

(async () => {
const inputs = ['-i', film]; const chains = [];
const log = [];
let t = 0, placed = 0;
for (let si = 0; si < shots.length; si++) {
  const f = shots[si];
  const id = f.replace(/^shot-\d+-/, '').replace(/\.wav$/, '');
  for (let [name, at, lift, spill] of bedFor[si]) {
    if (at && typeof at === 'object' && at.word) at = await wordAt(path.join(shotDir, f), at.word);
    const file = path.join(SFX, `${name}.mp3`);
    if (!fs.existsSync(file)) { console.warn(`missing sfx ${name}`); continue; }
    const { mean, max } = level(file);
    const taper = -TAPER * ((t + at) / total);           // 0 dB at the head, -TAPER at the tail
    let gain = TARGET + (lift || 0) + taper - mean;
    const ceil = PEAK_CEIL - max;                        // keep the peak polite
    if (gain > ceil) gain = ceil;
    // AN EFFECT MAY NOT OUTLIVE ITS LINE (2026-08-25, Sophie on the lullaby:
    // "the singing should stop before it gets to the next reason"). It is
    // pinned to her words, so it ends with them: trimmed to what is left of
    // this shot, with a 0.25s fade so the stop is not a cliff. `spill` buys
    // an effect extra seconds when it is meant to ring on (a finale splash).
    const room = Math.max(0.4, lens[si] - at + (spill || 0));
    const fade = Math.min(0.25, room / 3);
    const ms = Math.round((t + at) * 1000);
    const idx = inputs.length / 2; // 0 is the film; the voice chain is unshifted to [a0]
    inputs.push('-i', file);
    chains.push(`[${idx}:a]volume=${gain.toFixed(2)}dB,atrim=end=${room.toFixed(3)},asetpts=PTS-STARTPTS,`
      + `afade=t=out:st=${(room - fade).toFixed(3)}:d=${fade.toFixed(3)},adelay=${ms}|${ms}[a${idx}]`);
    log.push(`${id.padEnd(3)} ${name.padEnd(11)} src ${mean.toFixed(1)}dB -> ${gain.toFixed(1)}dB (peak ${(max + gain).toFixed(1)})`);
    placed++;
  }
  t += lens[si];
}

// her voice, evened by a static per-shot trim (see VOICE_TARGET above)
const vChains = [];
let vt = 0;
const SYNTH = new Set(spec.synthSources || []);
for (let si = 0; si < shots.length; si++) {
  const { mean } = level(path.join(shotDir, shots[si]));
  const cap = SYNTH.has(spec.shots[si].source) ? SYNTH_CAP : VOICE_CAP;
  let g = VOICE_TARGET - mean;
  g = Math.max(-cap, Math.min(cap, g));
  const a = vt, b = vt + lens[si];
  vChains.push(`[0:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS,volume=${g.toFixed(2)}dB[v${si}]`);
  if (Math.abs(g) >= 0.4) log.push(`${shots[si].replace(/^shot-\d+-/, '').replace(/\.wav$/, '').padEnd(3)} VOICE       ${mean.toFixed(1)}dB -> ${g >= 0 ? '+' : ''}${g.toFixed(1)}dB`);
  vt = b;
}
chains.unshift(`${vChains.join(';')};${shots.map((_, i) => `[v${i}]`).join('')}concat=n=${shots.length}:v=0:a=1[a0]`);
const nMix = chains.length;
const mix = chains.map((_, i) => `[a${i}]`).join('');
const filter = `${chains.join(';')};${mix}amix=inputs=${nMix}:normalize=0,alimiter=limit=0.95[aout]`;
execFileSync(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', filter,
  '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart', OUT], { stdio: ['ignore', 'ignore', 'pipe'] });
if ('verbose' in args) console.log(log.join('\n'));
console.log(`${OUT} — ${placed} effects under ${t.toFixed(1)}s, bed ${TARGET}dB tapering ${TAPER}dB, voice evened to ${VOICE_TARGET}dB (max ${VOICE_CAP}dB)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
