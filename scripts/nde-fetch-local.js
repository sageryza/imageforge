#!/usr/bin/env node
/**
 * nde-fetch-local.js — run this on your OWN computer (residential IP).
 *
 * WHY: YouTube blocks caption requests from datacenter IPs (the cloud sandbox
 * AND Render both get bot-flagged), so the pipeline can't fetch transcripts
 * from the server. Your home internet is NOT flagged. This script fetches the
 * 25 Anthony Chene NDE-interview transcripts from your machine and POSTs each
 * straight to the live ImageForge server, which extracts the moments and saves
 * them to the database. Nothing to send back — it flows straight in.
 *
 * NO API KEYS NEEDED. NO npm install. Pure Node built-ins.
 *
 * RUN:
 *   node nde-fetch-local.js
 *
 * Optional: point at a different server —  NDE_SERVER=https://… node nde-fetch-local.js
 */

const https = require('https');

const SERVER = process.env.NDE_SERVER || 'https://imageforge-q125.onrender.com';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || ''; // only if the server is gated
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

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

// ── tiny https helpers (follow redirects, browser UA) ──
function get(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), redirects - 1));
      }
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('timeout')); });
  });
}

function postJSON(path, obj) {
  const body = JSON.stringify(obj);
  return new Promise((resolve, reject) => {
    const u = new URL(SERVER + path);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (STUDIO_TOKEN) headers['x-studio-token'] = STUDIO_TOKEN;
    const req = https.request(u, { method: 'POST', headers }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, json: { raw: data } }); } });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ── caption extraction (watch page → captionTracks → json3/xml) ──
function pickTrack(tracks) {
  const score = t => {
    const lang = (t.languageCode || '').toLowerCase();
    let s = 0;
    if (lang === 'en') s += 100; else if (lang.startsWith('en')) s += 60;
    if (!t.kind) s += 20; // manual over auto
    return s;
  };
  return [...tracks].sort((a, b) => score(b) - score(a))[0];
}

function parseXML(xml) {
  const out = [];
  const re = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  const dec = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim();
  let m;
  while ((m = re.exec(xml)) !== null) { const t = dec(m[3]); if (t) out.push({ start: +m[1], dur: m[2] ? +m[2] : 0, text: t }); }
  return out;
}

async function fetchTranscript(videoId) {
  const page = await get(`https://www.youtube.com/watch?v=${videoId}&hl=en`);
  if (page.status !== 200 || !page.body.includes('ytInitialPlayerResponse')) {
    throw new Error(`watch page HTTP ${page.status} (no player response)`);
  }
  const m = page.body.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s)
        || page.body.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
  if (!m) throw new Error('could not extract player response');
  const payload = JSON.parse(m[1]);
  const tracks = payload?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const track = pickTrack(tracks);
  if (!track) throw new Error('no captions on this video');
  let segments = [];
  const j = await get(track.baseUrl + '&fmt=json3');
  if (j.status === 200 && j.body.trim()) {
    try {
      const data = JSON.parse(j.body);
      for (const ev of data.events || []) {
        if (!ev.segs) continue;
        const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
        if (text) segments.push({ start: (ev.tStartMs || 0) / 1000, dur: (ev.dDurationMs || 0) / 1000, text });
      }
    } catch { /* fall through */ }
  }
  if (!segments.length) {
    const x = await get(track.baseUrl);
    segments = parseXML(x.body);
  }
  if (!segments.length) throw new Error('caption track empty');
  const full = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
  return { source: 'youtube_timedtext_local', language: track.languageCode || 'en', autoGenerated: track.kind === 'asr', segments, full, fetchedAt: new Date().toISOString() };
}

(async () => {
  console.log(`Fetching ${VIDEOS.length} transcripts and posting to ${SERVER}\n`);
  let ok = 0, fail = 0, moments = 0;
  for (let i = 0; i < VIDEOS.length; i++) {
    const { id, title } = VIDEOS[i];
    const tag = `[${i + 1}/${VIDEOS.length}] ${id} ${title}`;
    try {
      const transcript = await fetchTranscript(id);
      const r = await postJSON('/api/nde/videos', { videoIdOrUrl: id, title, transcript });
      const rec = r.json || {};
      if (rec.status === 'extracted') { ok++; moments += (rec.moments || []).length; console.log(`${tag} → ${(rec.moments || []).length} moments ✓`); }
      else { fail++; console.log(`${tag} → ${rec.status || r.status}: ${rec.error || 'unknown'}`); }
    } catch (e) {
      fail++;
      console.log(`${tag} → FETCH FAILED: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500)); // be polite to YouTube
  }
  console.log(`\nDone. ${ok} extracted, ${fail} failed, ${moments} total moments. View: ${SERVER}/api/nde/moments`);
})();
