// Stitch the wan clips to the precisely-cut narration beats into a 1080x1620
// PORTRAIT 2:3 short (this story's ask — not 9:16, so the panels fill the
// frame with no padding). Each beat's clip is slowed (≤1.9x) toward its
// narration length, last frame held for any remainder; whites lifted so the
// style's white background stays pure; concat + loudnorm.
const fs = require('fs');
const { execFileSync } = require('child_process');
const FFMPEG = require('ffmpeg-static');
const FFPROBE = require('ffprobe-static').path;
const { OUT } = require('./beats');
const timing = require(OUT + '/timing.json');

const PAUSE = 0.35, MAX_SLOW = 1.9;
const FINAL = `${OUT}/the-meteorite-short.mp4`;
const probe = (f, args) => execFileSync(FFPROBE, ['-v', 'error', ...args, f]).toString().trim();

const parts = [];
for (const t of timing) {
  const clip = `${OUT}/clip-${t.beat}.mp4`;
  const dur = parseFloat(probe(clip, ['-show_entries', 'format=duration', '-of', 'csv=p=0']));
  const target = t.duration + PAUSE;
  const slow = Math.min(target / dur, MAX_SLOW);
  const part = `${OUT}/part-${t.beat}.mp4`;
  execFileSync(FFMPEG, ['-y',
    '-i', clip, '-i', `${OUT}/beat-${t.beat}.wav`,
    '-filter_complex',
    `[0:v]setpts=${slow.toFixed(4)}*PTS,fps=30,tpad=stop_mode=clone:stop_duration=${Math.max(0, target - dur * slow + 0.5).toFixed(3)},trim=duration=${target.toFixed(3)},` +
    `colorlevels=rimax=0.94:gimax=0.94:bimax=0.94,` + // wan whites are ~F0 off-white; lift to pure
    `scale=1080:1620:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1620,setsar=1[v];` +
    `[1:a]apad=whole_dur=${target.toFixed(3)},atrim=duration=${target.toFixed(3)},aformat=sample_rates=44100:channel_layouts=stereo[a]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    part,
  ], { stdio: 'pipe' });
  const pd = probe(part, ['-show_entries', 'format=duration', '-of', 'csv=p=0']);
  console.log(`beat ${t.beat}: clip ${dur.toFixed(2)}s → slow x${slow.toFixed(2)} → part ${pd}s (target ${target.toFixed(2)}s)`);
  parts.push(part);
}

fs.writeFileSync(`${OUT}/concat.txt`, parts.map(p => `file '${p}'`).join('\n'));
execFileSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', `${OUT}/concat.txt`,
  '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k',
  FINAL], { stdio: 'pipe' });
const fd = probe(FINAL, ['-show_entries', 'format=duration', '-of', 'csv=p=0']);
console.log('FINAL:', FINAL, fd + 's');
