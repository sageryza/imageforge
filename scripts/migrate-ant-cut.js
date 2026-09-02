#!/usr/bin/env node
// migrate-ant-cut.js — THE ANT FARM v7 → a Film Editor cut doc, the worked
// example of moving an existing film into the doc-is-the-film world
// (docs/film-editor-parallel-editing-plan.md, the acceptance test).
//
// The picture lane is v7's shot map (GET /api/filmshots?url=…, 16 shots). The
// sound lane is the four beds the ant chat banked under ant-story/audio/ plus
// her voice, PLACED BY MEASUREMENT (2026-09-02, scratchpad measure.py):
// cross-correlating each bed against v7's own mix, then fitting its level.
//   voice                 0.000s   0.0 dB (unity, the house rule)
//   sophie-opening-fx     0.000s  -17.7 dB flat (the fade is in her file)
//   cello-build-v4        0.000s   a RIDE: -6.4 → -11.7 dB over 20s — five
//                                  pieces, stepping (that is what a ride IS here)
//   ant-screams-v3       39.200s  -8.5 dB, tail fades — anchored to `ants`
//   cello-ending-v4      93.200s  -10.0 dB — anchored to `god-close`
// Leftover after removing those five: ~0.0003 rms everywhere → v7 is exactly
// voice + these beds; nothing else is in the mix.
//
// Dry by default: builds the doc, renders it LOCALLY with the real renderCut,
// and measures the render against v7 (frame-by-shot picture diff, audio
// correlation). `--go` writes the doc to forge-film-edits and uploads the
// render as its first version (by:'chat', cut snapshot, shot map). Costs
// nothing — ffmpeg on this box.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const admin = require('firebase-admin');
const M = require('../cut-model');

const GO = process.argv.includes('--go');
const CUT_ID = process.env.ANT_CUT_ID || 'the-ant-farm';
const CHAT = 'ant-movie-sound-redesign';
const BASE = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app';
const V7 = `${BASE}/ant-story/film/ant-film-v7.mp4`;
const SA = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!SA) { console.error('FIREBASE_SERVICE_ACCOUNT required'); process.exit(1); }
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA)), storageBucket: 'deckfactory-43176.firebasestorage.app' });
const fe = require('../filmeditor');
const FFMPEG = require('ffmpeg-static');
const FFPROBE = require('ffprobe-static').path;

const SHOTS = [ // v7's shot map, read live 2026-09-02
  [0, 5.2, 'ant-story/clips/boy.mp4', 'boy with the ant farm'],
  [5.2, 8.4, 'promptlab/1788144764381-4jwzxs.webp', 'the ant farm'],
  [8.4, 13.6, 'ant-story/clips/colony-mj.mp4', 'your colony cross-section'],
  [13.6, 32.1, 'promptlab/1788148285584-p804fw.webp', 'little colonies, little buildings'],
  [32.1, 37.16, 'ant-story/clips/kid-horrified.mp4', 'kid horrified'],
  [37.16, 39.2, 'promptlab/1788144888902-yzvybk.webp', 'THE GLASS marquee'],
  [39.2, 44.4, 'ant-story/clips/ants.mp4', 'the ants watching the horror movie'],
  [44.4, 49.46, 'ant-story/clips/ants-glass.mp4', 'ants recoiling at the glass'],
  [49.46, 59.2, 'promptlab/1788144885439-essze9.webp', 'ants in the theater'],
  [59.2, 64.26, 'ant-story/clips/god-zoom.mp4', 'God zooming in on the world'],
  [64.26, 69.32, 'ant-story/clips/truman-mj.mp4', 'Truman tapping the sky'],
  [69.32, 74.6, 'ant-story/clips/god.mp4', 'God'],
  [74.6, 83.9, 'ant-story/stills/spoons-kitchen-wide.png', 'spoon bender, kitchen'],
  [83.9, 93.2, 'ant-story/stills/spoons-close.png', 'spoon bender, close'],
  [93.2, 98.26, 'ant-story/clips/god-close.mp4', 'God watching us come out of the theater'],
  // The Playground original of the last still is GONE from Storage (measured
  // 2026-09-02: 403 public, 404 via the Admin SDK), so the still is the frame
  // v7 itself holds at 103s, banked as a PNG — a derived copy, the best that
  // exists; the render caps the long edge at 1280 so nothing is lost by it.
  [98.26, 108, 'ant-story/stills/theater-punchline.png', 'the theater, the punchline'],
];
const keyOf = (p) => path.basename(p).replace(/\.[^.]+$/, '').replace(/^\d+-/, '').slice(0, 24);
const clips = SHOTS.map(([at, end, p, title]) => {
  const image = /\.(webp|png|jpe?g)$/i.test(p);
  return image
    ? { key: keyOf(p), kind: 'image', url: `${BASE}/${p}`, title, out: M.pieceSeconds({ in: at, out: end }) }
    : { key: keyOf(p), url: `${BASE}/${p}`, title, in: 0, out: M.pieceSeconds({ in: at, out: end }), seconds: null };
});
const A = (p) => `${BASE}/ant-story/audio/${p}`;
const cello = [[0, 4.2, -6.6], [4.2, 8.4, -7.6], [8.4, 12.6, -8.8], [12.6, 16.8, -10.2], [16.8, 21.08, -11.5]]
  .map(([i, o, g], n) => ({ key: `cello-build-${n + 1}`, url: A('cello-build-v4.mp3'), name: 'cello build', in: i, out: o, at: i, gain: g, seconds: 21.08 }));
const sounds = [
  { key: 'voice', url: `${BASE}/audio/ant-story/02-ant-story-pauses-cut-v2-longer-beats-1-48.m4a`, name: 'your voice', seconds: 108.1, gain: 0 },
  { key: 'imagine', url: A('sophie-opening-fx.wav'), name: 'your sound on "imagine"', seconds: 7.68, at: 0, gain: -17.7 },
  ...cello,
  { key: 'screams', url: A('ant-screams-v3.mp3'), name: 'ant screams', seconds: 12, gain: -8.5, fadeOut: 2.5, anchor: { piece: 'ants', offset: 0 } },
  { key: 'cello-end', url: A('cello-ending-v4.mp3'), name: 'cello ending', seconds: 18.05, gain: -10, anchor: { piece: 'god-close', offset: 0 } },
];

function ff(args) { return execFileSync(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64e6 }); }
function probeSeconds(file) {
  const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
  return Number(out) || null;
}
// mean grey of a downscaled frame at t — a shot's fingerprint
function frameSig(file, t) {
  const raw = ff(['-v', 'error', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', 'scale=16:9', '-pix_fmt', 'gray', '-f', 'rawvideo', '-']);
  return Array.from(raw);
}
const sigDiff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
function wav(file, out) { ff(['-v', 'error', '-y', '-i', file, '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', out]); }

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ant-cut-'));
  console.log('work dir', dir);
  const v7 = path.join(dir, 'v7.mp4');
  await fe.downloadSource(V7, v7);
  // fill each clip's real length so the doc says what the editor will show
  const lens = new Map();
  for (const c of clips) {
    if (c.kind === 'image') continue;
    const f = path.join(dir, 'src-' + c.key);
    await fe.downloadSource(c.url, f);
    c.seconds = probeSeconds(f); lens.set(c.url, f);
    if (c.seconds && c.out > c.seconds) c.out = Math.round(c.seconds * 1000) / 1000;
    console.log(`  ${c.key.padEnd(14)} ${c.seconds}s source, cut 0–${c.out}`);
  }
  const doc = {
    id: CUT_ID, title: 'The Ant Farm', chat: CHAT, session: '',
    clips: M.cleanPieces(clips), sounds: [], audio: null, renders: [], job: null,
    lastEditBy: 'chat', createdAt: Date.now(), updatedAt: Date.now(),
  };
  doc.sounds = M.normalize(doc.clips, M.cleanSounds(sounds));
  doc.audio = M.audioMirror(doc.sounds);
  console.log(`doc: ${doc.clips.length} pieces (${doc.clips.filter((c) => c.kind === 'image').length} stills), ${doc.sounds.length} sounds, ${M.totalSeconds(doc.clips)}s`);
  fs.writeFileSync(path.join(dir, 'cut.json'), JSON.stringify({ clips: doc.clips, sounds: doc.sounds }, null, 1));

  const t0 = Date.now();
  const rdir = path.join(dir, 'render'); fs.mkdirSync(rdir, { recursive: true });   // renderCut wants an existing dir
  const r = await fe.renderCut(doc, { dir: rdir, progress: async (d, t, l) => process.stderr.write(`  ${d}/${t} ${l}\r`) });
  const out = r.file;
  console.log(`\nrendered in ${Math.round((Date.now() - t0) / 1000)}s → ${out}`);

  // ── picture: every shot's middle frame against v7's ──
  let worst = 0;
  M.starts(doc.clips).forEach((s) => {
    const mid = s.start + s.dur / 2;
    const d = sigDiff(frameSig(out, mid), frameSig(v7, mid));
    worst = Math.max(worst, d);
    console.log(`  shot ${s.key.padEnd(14)} @${mid.toFixed(1).padStart(6)}s  frame diff ${d.toFixed(1)}`);
  });
  // ── sound: correlation of the two mixes ──
  const a = path.join(dir, 'a.wav'), b = path.join(dir, 'b.wav');
  wav(out, a); wav(v7, b);
  const py = `
import numpy as np, wave
def rd(p):
    w=wave.open(p); return np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float64)/32768
x=rd('${a}'); y=rd('${b}'); n=min(len(x),len(y)); x=x[:n]; y=y[:n]
print('len', n/22050)
print('corr', float(np.dot(x,y)/np.sqrt(np.dot(x,x)*np.dot(y,y))))
for i in range(0,n,22050*10):
    xs=x[i:i+22050*10]; ys=y[i:i+22050*10]
    c=float(np.dot(xs,ys)/max(1e-9,np.sqrt(np.dot(xs,xs)*np.dot(ys,ys))))
    print(f'  {i//22050:3d}s corr {c:.3f}  rms {np.sqrt(np.mean(xs**2)):.4f} vs {np.sqrt(np.mean(ys**2)):.4f}')
`;
  console.log(execFileSync('python3', ['-c', py]).toString());
  console.log(`worst shot frame diff ${worst.toFixed(1)} (0 = identical picture)`);

  if (!GO) { console.log('dry run — pass --go to write the doc and file the render'); return; }
  const editor = require('../editor');
  const seconds = probeSeconds(out);
  const url = await editor.uploadPublic(out, `filmeditor/${CUT_ID}/film-1.mp4`, 'video/mp4');
  const render = { url, at: Date.now(), by: 'chat', seconds: r.seconds || Math.round(seconds * 10) / 10, pieces: r.clips.length, sounds: r.mixed, audio: r.mixed > 0, width: r.width, height: r.height, cut: { clips: r.clips, sounds: r.sounds } };
  doc.renders = [render];
  await admin.firestore().collection(fe.COL || 'forge-film-edits').doc(CUT_ID).set(doc);
  try { await require('../filmshots').record({ chat: CHAT, url, seconds: render.seconds, shots: fe.shotsFromCut(r.clips), source: 'filmeditor' }); } catch (e) { console.warn('shot map:', e.message); }
  console.log(`written: ${CUT_ID}\n${url}\nhttps://imageforge-q125.onrender.com/filmeditor?c=${CUT_ID}`);
})().catch((e) => { console.error(e); process.exit(1); });
