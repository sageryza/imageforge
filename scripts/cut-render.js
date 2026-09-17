#!/usr/bin/env node
// cut-render — bake a cut doc ({clips, sounds}, cut-model.js's shape) into ONE
// mp4 with ffmpeg in THIS container, with no Film Editor doc anywhere
// (2026-09-16, Sophie: "don't use the film editor"). The reader
// (fcpxml-to-cut.js) turns her LumaFusion export into cut.json; this turns
// cut.json back into a film after a chat has changed a piece or a sound.
//
//   node scripts/cut-render.js cut.json out.mp4 [--size 720x1280] [--fps 24]
//
// Pieces butt against each other in order (a piece's start is the sum of the
// ones before it); a piece plays its own audio unless `mute`; a sound is laid
// at `at` seconds with its in/out, gain (dB) and fades. Everything is scaled
// and padded to one canvas. Sources are downloaded once into a cache dir.
// The mix is summed (never normalised — her voice stays at unity) and then
// held under -1 dB by a limiter, since a bed under a line can sum past 0.
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawnSync } = require('child_process');

const FF = (() => { try { return require('ffmpeg-static'); } catch { return 'ffmpeg'; } })();

function flag(name, dflt) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; }
function get(url, file) {
  return new Promise((res, rej) => {
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return res(file);
    const out = fs.createWriteStream(file);
    https.get(url, (r) => {
      if (r.statusCode !== 200) return rej(new Error(`${r.statusCode} ${url}`));
      r.pipe(out); out.on('finish', () => out.close(() => res(file)));
    }).on('error', rej);
  });
}
const R3 = (n) => Math.round(Number(n) * 1000) / 1000;

async function render(cut, outFile, { size = '720x1280', fps = 24, cacheDir } = {}) {
  const [W, H] = size.split('x').map(Number);
  cacheDir = cacheDir || path.join(os.tmpdir(), 'cut-render-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const clips = (cut.clips || []).filter((c) => c && c.url);
  const sounds = (cut.sounds || []).filter((s) => s && s.url && !s.mute);
  const urls = [...new Set([...clips, ...sounds].map((x) => x.url))];
  const files = {};
  for (const u of urls) {
    const name = require('crypto').createHash('sha1').update(u).digest('hex').slice(0, 16) + path.extname(u.split('?')[0]);
    files[u] = await get(u, path.join(cacheDir, name));
  }
  const inputs = urls.map((u) => ['-i', files[u]]).flat();
  const idx = (u) => urls.indexOf(u);
  const f = [];
  const vlabels = [], alabels = [];
  let t = 0;
  clips.forEach((c, i) => {
    const isImg = c.kind === 'image';
    const tIn = isImg ? 0 : Number(c.in) || 0;
    const tOut = Number(c.out) || 0;
    const len = R3(tOut - tIn);
    if (len <= 0) return;
    if (isImg) {
      f.push(`[${idx(c.url)}:v]loop=loop=-1:size=1:start=0,trim=duration=${len},setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p[v${i}]`);
      f.push(`aevalsrc=0:d=${len}:s=48000:c=stereo[a${i}]`);
    } else {
      f.push(`[${idx(c.url)}:v]trim=${tIn}:${tOut},setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p[v${i}]`);
      if (c.mute) f.push(`aevalsrc=0:d=${len}:s=48000:c=stereo[a${i}]`);
      else {
        const g = Number(c.gain) || 0;
        f.push(`[${idx(c.url)}:a]atrim=${tIn}:${tOut},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${g}dB,apad=whole_dur=${len},atrim=0:${len}[a${i}]`);
      }
    }
    vlabels.push(`[v${i}]`); alabels.push(`[a${i}]`);
    t = R3(t + len);
  });
  const total = t;
  f.push(`${vlabels.join('')}concat=n=${vlabels.length}:v=1:a=0[vcat]`);
  f.push(`${alabels.join('')}concat=n=${alabels.length}:v=0:a=1[acat]`);
  const mix = ['[acat]'];
  sounds.forEach((s, j) => {
    const sIn = Number(s.in) || 0;
    const sOut = s.out == null ? null : Number(s.out);
    const at = Math.max(0, Number(s.at) || 0);
    const g = Number(s.gain) || 0;
    const fi = Number(s.fadeIn) || 0, fo = Number(s.fadeOut) || 0;
    const parts = [`[${idx(s.url)}:a]`, sOut != null ? `atrim=${sIn}:${sOut}` : `atrim=start=${sIn}`, 'asetpts=PTS-STARTPTS', 'aresample=48000', 'aformat=channel_layouts=stereo', `volume=${g}dB`];
    if (fi > 0) parts.push(`afade=t=in:d=${fi}`);
    if (fo > 0 && sOut != null) parts.push(`afade=t=out:st=${R3(sOut - sIn - fo)}:d=${fo}`);
    parts.push(`adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}`);
    f.push(`${parts[0]}${parts.slice(1).join(',')}[s${j}]`);
    mix.push(`[s${j}]`);
  });
  f.push(`${mix.join('')}amix=inputs=${mix.length}:duration=first:normalize=0,alimiter=limit=0.891:level=false,atrim=0:${total}[aout]`);
  const args = ['-y', ...inputs, '-filter_complex', f.join(';'), '-map', '[vcat]', '-map', '[aout]',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(total), outFile];
  const r = spawnSync(FF, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + String(r.stderr).split('\n').slice(-12).join('\n'));
  return { file: outFile, seconds: total, pieces: clips.length, sounds: sounds.length };
}

module.exports = { render };

if (require.main === module) {
  const [cutFile, outFile] = process.argv.slice(2).filter((a) => !a.startsWith('--') && !['--size', '--fps'].includes(process.argv[process.argv.indexOf(a) - 1]));
  if (!cutFile || !outFile) { console.error('usage: node scripts/cut-render.js cut.json out.mp4 [--size 720x1280] [--fps 24]'); process.exit(2); }
  const cut = JSON.parse(fs.readFileSync(cutFile, 'utf8'));
  render(cut, outFile, { size: flag('--size', '720x1280'), fps: Number(flag('--fps', 24)) })
    .then((r) => console.log(`${r.seconds}s · ${r.pieces} pieces · ${r.sounds} sounds → ${r.file}`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
