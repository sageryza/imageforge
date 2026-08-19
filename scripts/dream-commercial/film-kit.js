// The bits both dream-commercial renderers need: fetching through the
// sandbox proxy, pulling a Google font, and encoding a still list to H.264.
// One copy on purpose — render.js (the boys chat) and spot.js (the song spot)
// are different films, but they are the same camera.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const FFMPEG = require(path.join(ROOT, 'node_modules', 'ffmpeg-static'));
const FPS = 30;
const CHROME = '/opt/pw-browsers/chromium';

function curl(url, out, extra = []) {
  execFileSync('curl', ['-fsSL', ...extra, '-o', out, url], { stdio: 'pipe' });
}

// Google Fonts: ask for the css with a modern UA, pull the first woff2 url.
function fetchFont(cssUrl, dir, name) {
  try {
    const cssFile = path.join(dir, name + '.css');
    curl(cssUrl, cssFile, ['-A', 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Chrome/120.0 Safari/605.1.15']);
    const m = fs.readFileSync(cssFile, 'utf8').match(/url\((https:[^)]+\.woff2)\)/);
    if (!m) return null;
    const woff = path.join(dir, name + '.woff2');
    curl(m[1], woff);
    return woff;
  } catch (e) {
    console.warn(`font ${name} not fetched (${e.message}) — falling back`);
    return null;
  }
}

// The concat demuxer's rule: every entry carries a duration and the last file
// is repeated with none, or the final still is dropped.
function encode(listFile, outMp4) {
  execFileSync(FFMPEG, [
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', 'format=yuv420p', '-r', String(FPS),
    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart',
    outMp4,
  ], { stdio: ['pipe', 'pipe', 'inherit'] });
}

module.exports = { curl, fetchFont, encode, FFMPEG, FPS, CHROME, ROOT };
