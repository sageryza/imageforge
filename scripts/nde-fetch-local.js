#!/usr/bin/env node
/**
 * nde-fetch-local.js — run this on your OWN computer (residential IP).
 *
 * Fetches the 25 Anthony Chene NDE-interview transcripts with yt-dlp (which
 * handles YouTube's caption tokens correctly) and POSTs each straight to the
 * live ImageForge server, which extracts the moments and saves them. Nothing
 * to send back.
 *
 * REQUIRES yt-dlp (one-time install). If it's missing, this script prints the
 * install command and stops. No other keys or npm installs needed.
 *
 * RUN:  node ~/Downloads/nde-fetch-local.js
 */

const https = require('https');
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER = process.env.NDE_SERVER || 'https://imageforge-q125.onrender.com';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

const VIDEOS = [
  {
    "id": "eH3-WZWEMqY",
    "title": "The near death experience of Deborah King"
  },
  {
    "id": "zXB_F8EfDNA",
    "title": "The near death experience of Bruce Van Natta"
  },
  {
    "id": "DXQh28N7eis",
    "title": "The near death experience of Landon Dennis"
  },
  {
    "id": "6GsWknK5r-8",
    "title": "The near death experience of Dr. Mary Helen Hensley"
  },
  {
    "id": "RCQkIutaqgs",
    "title": "The near death experience of Penny Wittbrodt"
  },
  {
    "id": "1FD5lReqe64",
    "title": "The near-death experience of Jeff Olsen"
  },
  {
    "id": "F-rp6bqfJWQ",
    "title": "The near death experience of Nancy Rynes"
  },
  {
    "id": "iWG_rLdW4Ng",
    "title": "The near death experience of Tammy Lee Anderson"
  },
  {
    "id": "WTESmsletG4",
    "title": "The near-death experience of Jane Thompson"
  },
  {
    "id": "B7vEdwuJBEg",
    "title": "The near death experience of Scott Drummond"
  },
  {
    "id": "zg3HnkSg38s",
    "title": "The near-death experience of Barbara Bartolome"
  },
  {
    "id": "5XrA79_T_R0",
    "title": "The near-death experience of Peter Anthony"
  },
  {
    "id": "j8mGcC2jq0Q",
    "title": "The near death experience of Karen Thomas"
  },
  {
    "id": "pRRJ3u6O2QI",
    "title": "The near death experience of David Ditchfield"
  },
  {
    "id": "2GFT_89YMWE",
    "title": "The near-death experience of Tricia Barker"
  },
  {
    "id": "ePBzS8hS36k",
    "title": "The near-death experience of Chris Batts"
  },
  {
    "id": "xwAYFEkYJE4",
    "title": "The near death experience of Graeme O'Connor"
  },
  {
    "id": "p5DLmCf6WaE",
    "title": "The near death experience of Rob Gentile"
  },
  {
    "id": "peE-A-VlUtw",
    "title": "The Near death experience of Chris Kito"
  },
  {
    "id": "0m5BQWiM--o",
    "title": "The near-death experience of Nadia McCaffrey"
  },
  {
    "id": "8eJQg9zfo1w",
    "title": "The near death experience of Ray Kinman"
  },
  {
    "id": "4xrtyOqwr9E",
    "title": "The near-death experiences of Bill McDonald"
  },
  {
    "id": "Ag_5i2c95U4",
    "title": "The near-death experience of Ingrid Honkala"
  },
  {
    "id": "YSa3El8VFOo",
    "title": "The near-death experience of Heidi Craig"
  },
  {
    "id": "0q39gcW71gQ",
    "title": "The near death experience of Pegi Robinson"
  }
];

// ── require yt-dlp ──
function ytdlpPath() {
  for (const cmd of ['yt-dlp', '/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp']) {
    try { execFileSync(cmd, ['--version'], { stdio: 'ignore' }); return cmd; } catch {}
  }
  return null;
}
const YTDLP = ytdlpPath();
if (!YTDLP) {
  console.error(`
yt-dlp is not installed. Install it once with ONE of these, then re-run this script:

  brew install yt-dlp          (if you have Homebrew — most Macs)
  pip3 install -U yt-dlp       (if you have Python 3)

If neither works, download the binary:
  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp

Then run again:  node ~/Downloads/nde-fetch-local.js
`);
  process.exit(1);
}

function postJSON(p, obj) {
  const body = JSON.stringify(obj);
  return new Promise((resolve, reject) => {
    const u = new URL(SERVER + p);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (STUDIO_TOKEN) headers['x-studio-token'] = STUDIO_TOKEN;
    const req = https.request(u, { method: 'POST', headers }, res => {
      let d = ''; res.on('data', c => (d += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, json: { raw: d } }); } });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('timeout')));
    req.write(body); req.end();
  });
}

// json3 (yt-dlp writes it) → { segments, full }
function parseJson3(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const segments = [];
  for (const ev of data.events || []) {
    if (!ev.segs) continue;
    const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (text) segments.push({ start: (ev.tStartMs || 0) / 1000, dur: (ev.dDurationMs || 0) / 1000, text });
  }
  const full = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
  return { segments, full };
}

function fetchWithYtdlp(id, dir) {
  // Write English subs (manual first, else auto) as json3, skip the video.
  execFileSync(YTDLP, [
    '--skip-download', '--write-subs', '--write-auto-subs',
    '--sub-langs', 'en.*,en', '--sub-format', 'json3',
    '-o', path.join(dir, '%(id)s.%(ext)s'),
    '--quiet', '--no-warnings',
    `https://www.youtube.com/watch?v=${id}`,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  // Find the json3 file yt-dlp wrote for this id (prefer manual en over auto).
  const files = fs.readdirSync(dir).filter(f => f.startsWith(id) && f.endsWith('.json3'));
  if (!files.length) throw new Error('no English captions found');
  files.sort((a, b) => (a.includes('orig') ? 1 : 0) - (b.includes('orig') ? 1 : 0));
  const parsed = parseJson3(path.join(dir, files[0]));
  if (!parsed.segments.length) throw new Error('caption file empty');
  return { source: 'yt-dlp', language: 'en', segments: parsed.segments, full: parsed.full, fetchedAt: new Date().toISOString() };
}

(async () => {
  console.log(`Using ${YTDLP}. Fetching ${VIDEOS.length} transcripts → ${SERVER}\n`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nde-'));
  let ok = 0, fail = 0, moments = 0;
  for (let i = 0; i < VIDEOS.length; i++) {
    const { id, title } = VIDEOS[i];
    const tag = `[${i + 1}/${VIDEOS.length}] ${title}`;
    try {
      const transcript = fetchWithYtdlp(id, dir);
      const r = await postJSON('/api/nde/videos', { videoIdOrUrl: id, title, transcript });
      const rec = r.json || {};
      if (rec.status === 'extracted') { ok++; moments += (rec.moments || []).length; console.log(`${tag} → ${(rec.moments || []).length} moments ✓`); }
      else { fail++; console.log(`${tag} → ${rec.status || r.status}: ${rec.error || 'unknown'}`); }
    } catch (e) {
      fail++;
      console.log(`${tag} → ${e.message.split('\n')[0]}`);
    }
  }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  console.log(`\nDone. ${ok} extracted, ${fail} failed, ${moments} total moments.`);
  console.log(`View them: ${SERVER}/api/nde/moments`);
})();
