// Stitch the 8 wan clips to the 8 tightened narration beats into a 1080x1920
// vertical short. Each beat's video is slowed (≤1.9x) toward its narration
// length, last frame held for any remainder, padded on white to 9:16.
const fs = require('fs');
const { execFileSync } = require('child_process');
const FFMPEG = require('ffmpeg-static');
const FFPROBE = require('ffprobe-static').path;
const OUT = '/tmp/claude-0/-home-user/5cf8109c-feb1-5772-9302-0197d40bce90/scratchpad/destiny';
const timing = require(OUT + '/timing.json');

const PAUSE = 0.35, MAX_SLOW = 1.9;
const probe = (f, args) => execFileSync(FFPROBE, ['-v', 'error', ...args, f]).toString().trim();

const parts = [];
for (const t of timing) {
  const clip = `${OUT}/clip-${t.beat}.mp4`;
  const dur = parseFloat(probe(clip, ['-show_entries', 'format=duration', '-of', 'csv=p=0']));
  const target = t.duration + PAUSE;
  const slow = Math.min(target / dur, MAX_SLOW);
  const part = `${OUT}/part-${t.beat}.mp4`;
  // video: slow → hold last frame to target → 30fps → scale/pad to 1080x1920 white
  // audio: beat wav padded with silence to target
  execFileSync(FFMPEG, ['-y',
    '-i', clip, '-i', `${OUT}/beat-${t.beat}.wav`,
    '-filter_complex',
    `[0:v]setpts=${slow.toFixed(4)}*PTS,fps=30,tpad=stop_mode=clone:stop_duration=${Math.max(0, target - dur * slow + 0.5).toFixed(3)},trim=duration=${target.toFixed(3)},` +
    `scale=1080:1620:flags=lanczos,pad=1080:1920:0:150:white,setsar=1[v];` +
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
  `${OUT}/controlling-my-own-destiny-short.mp4`], { stdio: 'pipe' });
const fd = probe(`${OUT}/controlling-my-own-destiny-short.mp4`, ['-show_entries', 'format=duration', '-of', 'csv=p=0']);
console.log('FINAL:', `${OUT}/controlling-my-own-destiny-short.mp4`, fd + 's');
