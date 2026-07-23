#!/usr/bin/env node
/**
 * build-nde-puller.js — turn the theme clusters + transcripts into a single
 * self-contained audio-puller script the user runs on their own computer.
 *
 *   node scripts/build-nde-puller.js <themes.json> <full-records.json> <out.js>
 *
 * The emitted script (default nde-pull-clips.js) embeds a manifest of every
 * clip (videoId, theme, in/out seconds, quote) and, using only yt-dlp + ffmpeg,
 * downloads each source audio ONCE and slices every clip into clips/<theme>/.
 * No API keys, no npm installs.
 */
const fs = require('fs');

const [themesPath, recsPath, outPath = '/home/user/nde-pull-clips.js'] = process.argv.slice(2);
if (!themesPath || !recsPath) { console.error('usage: build-nde-puller.js <themes.json> <records.json> [out.js]'); process.exit(1); }

const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8')).themes;
const recs = JSON.parse(fs.readFileSync(recsPath, 'utf8'));
const recById = Object.fromEntries(recs.map(r => [r.videoId, r]));

const sanitize = s => String(s || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
const wordCount = s => (String(s || '').trim().match(/\S+/g) || []).length;

// Clip window: 1.5s pre-roll, duration scaled to the quote length (a supercut
// clip should hold the whole line), clamped to a sane range.
function windowFor(hit) {
  const start = Number.isFinite(+hit.timeSec) ? +hit.timeSec : 0;
  const dur = Math.max(7, Math.min(20, wordCount(hit.quote) / 2.4 + 4.5));
  const inSec = Math.max(0, start - 1.5);
  return { in: +inSec.toFixed(1), out: +(start + dur).toFixed(1) };
}

const manifest = [];
for (const t of themes) {
  let n = 0;
  for (const h of t.hits) {
    n++;
    const rec = recById[h.videoId] || {};
    const { in: inSec, out: outSec } = windowFor(h);
    const mmss = h.timeSec != null ? `${String(Math.floor(h.timeSec / 60)).padStart(2, '0')}${String(h.timeSec % 60).padStart(2, '0')}` : '0000';
    manifest.push({
      theme: t.key,
      videoId: h.videoId,
      url: h.videoUrl || rec.url || `https://www.youtube.com/watch?v=${h.videoId}`,
      experiencer: h.experiencer || rec.experiencerName || '',
      in: inSec,
      out: outSec,
      quote: h.quote || '',
      file: `${t.key}/${String(n).padStart(2, '0')}_${sanitize(h.experiencer)}_${mmss}.mp3`,
    });
  }
}

const SCRIPT = `#!/usr/bin/env node
/**
 * nde-pull-clips.js — pull every NDE supercut clip. Run on your OWN computer.
 *
 * Downloads each source interview's audio ONCE (yt-dlp, residential IP so
 * YouTube doesn't block it), then slices every clip with ffmpeg into
 * clips/<theme>/. No API keys, no npm installs.
 *
 * REQUIRES: yt-dlp and ffmpeg (both: \`brew install yt-dlp ffmpeg\`).
 * RUN:      node ~/Downloads/nde-pull-clips.js
 * Re-running is safe: cached audio is reused, existing clips are skipped.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MANIFEST = ${JSON.stringify(manifest)};

// Resolve a binary: an absolute-path candidate just has to exist; a bare name
// is probed with its version flag (ffmpeg wants a SINGLE dash: -version).
function resolveBin(cands, flags) {
  for (const c of cands) {
    if (c.includes('/')) { try { if (fs.existsSync(c)) return c; } catch {} continue; }
    for (const f of flags) { try { execFileSync(c, [f], { stdio: 'ignore' }); return c; } catch {} }
  }
  return null;
}
const YTDLP = resolveBin(['yt-dlp', '/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp'], ['--version']);
const FFMPEG = resolveBin(['ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'], ['-version', '--version']);
if (!YTDLP || !FFMPEG) {
  console.error('Missing: ' + [!YTDLP && 'yt-dlp', !FFMPEG && 'ffmpeg'].filter(Boolean).join(' + ') + '.  Install:  brew install yt-dlp ffmpeg');
  process.exit(1);
}

const OUT = path.join(process.cwd(), 'clips');
const CACHE = path.join(OUT, '_audio_cache');
fs.mkdirSync(CACHE, { recursive: true });

// 1) download each unique source audio once
const ids = [...new Set(MANIFEST.map(m => m.videoId))];
const cachePath = {};
console.log('Downloading ' + ids.length + ' source audios…');
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const existing = fs.readdirSync(CACHE).find(f => f.startsWith(id + '.'));
  if (existing) { cachePath[id] = path.join(CACHE, existing); console.log('  [' + (i+1) + '/' + ids.length + '] ' + id + ' (cached)'); continue; }
  try {
    execFileSync(YTDLP, ['-f', 'bestaudio', '--no-playlist', '--sleep-requests', '1',
      '-o', path.join(CACHE, id + '.%(ext)s'), 'https://www.youtube.com/watch?v=' + id],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    const f = fs.readdirSync(CACHE).find(x => x.startsWith(id + '.'));
    if (f) { cachePath[id] = path.join(CACHE, f); console.log('  [' + (i+1) + '/' + ids.length + '] ' + id + ' ✓'); }
    else console.log('  [' + (i+1) + '/' + ids.length + '] ' + id + ' — no audio file');
  } catch (e) {
    console.log('  [' + (i+1) + '/' + ids.length + '] ' + id + ' FAILED: ' + (e.stderr ? e.stderr.toString().split('\\n').filter(Boolean).pop() : e.message));
  }
}

// 2) slice every clip
console.log('\\nSlicing ' + MANIFEST.length + ' clips…');
let ok = 0, skip = 0, fail = 0;
const index = [];
for (const m of MANIFEST) {
  const src = cachePath[m.videoId];
  const dest = path.join(OUT, m.file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  index.push([m.file, m.theme, m.experiencer, Math.round(m.in) + '-' + Math.round(m.out) + 's', m.url + '&t=' + Math.floor(m.in) + 's', m.quote.replace(/\\s+/g, ' ')].join('\\t'));
  if (!src) { fail++; continue; }
  if (fs.existsSync(dest)) { skip++; ok++; continue; }
  try {
    execFileSync(FFMPEG, ['-nostdin', '-y', '-ss', String(m.in), '-to', String(m.out), '-i', src,
      '-vn', '-c:a', 'libmp3lame', '-q:a', '4', dest], { stdio: 'ignore' });
    ok++;
  } catch (e) { fail++; }
}

fs.writeFileSync(path.join(OUT, 'INDEX.tsv'),
  'file\\ttheme\\texperiencer\\twindow\\tsource\\tquote\\n' + index.join('\\n') + '\\n');
console.log('\\nDone. ' + ok + ' clips ready (' + skip + ' already existed), ' + fail + ' failed.');
console.log('Clips are in ./clips/<theme>/  — see clips/INDEX.tsv for the map.');
`;

fs.writeFileSync(outPath, SCRIPT);
// quick per-theme tally for the console
const byTheme = {};
for (const m of manifest) byTheme[m.theme] = (byTheme[m.theme] || 0) + 1;
console.log(`Wrote ${outPath} with ${manifest.length} clips across ${Object.keys(byTheme).length} themes.`);
for (const [k, v] of Object.entries(byTheme).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)} ${k}`);
