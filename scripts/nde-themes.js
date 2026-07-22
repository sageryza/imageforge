#!/usr/bin/env node
/**
 * nde-themes.js — mine the extracted NDE transcripts for RECURRING beats
 * (the elements that show up across many experiencers) so they can be cut into
 * a supercut. For each video it finds every passage matching a shared NDE
 * element, with the verbatim quote and an approximate timestamp, then clusters
 * them by theme across all videos.
 *
 *   node scripts/nde-themes.js [--server URL] [--model gpt-5.6-sol]
 *                              [--effort medium] [--out themes.json]
 *
 * Pulls the extracted videos + transcripts from the live server's /api/nde,
 * runs one LLM pass per transcript (timestamped so it can cite mm:ss), and
 * writes a clustered JSON: { themes: { key: { label, hits:[{experiencer,
 * videoId, videoUrl, timeSec, quote, paraphrase}] } } }.
 *
 * Env: OPENAI_API_KEY.
 */
const fs = require('fs');
const fetch = require('node-fetch');

function arg(n, d) { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; }
const SERVER = arg('server', 'https://imageforge-q125.onrender.com');
const MODEL = arg('model', 'gpt-5.6-sol');
const EFFORT = arg('effort', 'medium');
const OUT = arg('out', '/home/user/nde-themes.json');
const LOCAL = arg('local', null); // optional local full-records JSON instead of the API
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY required'); process.exit(1); }

// Canonical recurring NDE elements. The model may also add {theme:"other"}.
const THEMES = {
  colors: 'unusually vivid, indescribable, or never-before-seen colors',
  telepathy: 'communication mind-to-mind, without spoken words',
  'out-of-body': 'watching one\'s own body or the scene from outside/above',
  'love-peace': 'overwhelming unconditional love, peace, or wellbeing',
  light: 'a bright, warm, living, or golden light',
  tunnel: 'a tunnel, passage, corridor, or being pulled through something',
  deceased: 'meeting deceased relatives, friends, or pets',
  'being-presence': 'meeting a being, guide, presence, or "beings of light"',
  'life-review': 'reviewing one\'s life, sometimes feeling what others felt',
  border: 'a border, barrier, edge, river, or point of no return',
  'sent-back': 'being told or deciding to return; "you have to go back"',
  'realer-than-real': 'everything more real, vivid, or solid than earthly life',
  timelessness: 'no time, or time not existing / not applying',
  'universal-knowledge': 'knowing everything, total understanding, "downloads"',
  'music-sound': 'hearing music, tones, harmonics, or specific sounds',
  reluctance: 'not wanting to come back; wanting to stay',
  'heightened-senses': 'enhanced perception (360° vision, seeing through things)',
  oneness: 'unity, connectedness, being part of everything',
  'travel-by-thought': 'moving instantly by thinking of a place',
  'purpose-mission': 'being given a purpose, mission, or unfinished task',
  'welcomed-home': 'a feeling of returning home, or deep familiarity',
};

const SYS = `You are indexing near-death-experience interviews to build a SUPERCUT — a montage where many different people describe the SAME element back to back. Your job: scan ONE interview transcript and find every passage where the experiencer describes one of these RECURRING NDE elements (or another element likely to recur across many accounts).

RECURRING ELEMENTS (use these theme keys; add {"theme":"other","label":"..."} only for a clearly recurring beat none of these cover):
${Object.entries(THEMES).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

RULES:
- Only include things the experiencer ACTUALLY says in this transcript. Never invent.
- One entry per distinct mention. A theme can appear more than once if they return to it.
- Prefer the moment they describe the element most vividly/quotably.
- quote = a SHORT verbatim span from the transcript (as close to word-for-word as the transcript allows), good enough to find the audio.
- timeSec = the integer seconds where that quote begins (read it from the mm:ss marker on that line).
- paraphrase = one short plain-English line of what they say.

Return STRICT JSON:
{ "experiencerName": string,
  "beats": [ { "theme": key, "label": short human label, "quote": verbatim, "timeSec": integer, "paraphrase": one line } ] }
If the transcript has none of these, return { "experiencerName": "...", "beats": [] }.`;

function tsText(t) {
  const segs = t.segments || [];
  const buckets = []; let b = null;
  for (const s of segs) {
    const k = Math.floor(s.start / 10) * 10;
    if (!b || b.t !== k) { if (b) buckets.push(b); b = { t: k, text: '' }; }
    b.text += (b.text ? ' ' : '') + s.text;
  }
  if (b) buckets.push(b);
  let out = buckets.map(x => `[${String(Math.floor(x.t / 60)).padStart(2, '0')}:${String(x.t % 60).padStart(2, '0')}] ${x.text}`).join('\n');
  if (out.length > 120000) out = out.slice(0, 120000) + '\n[...truncated...]';
  return out;
}

async function callModel(rec) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: `Interview: ${rec.title}\nvideoId: ${rec.videoId}\n\nTRANSCRIPT (mm:ss prefixed):\n\n${tsText(rec.transcript)}` },
    ],
    response_format: { type: 'json_object' },
  };
  if (/^gpt-5/.test(MODEL) && EFFORT) body.reasoning_effort = EFFORT;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return { out: JSON.parse(data.choices?.[0]?.message?.content || '{}'), usage: data.usage };
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

async function loadRecords() {
  if (LOCAL) return JSON.parse(fs.readFileSync(LOCAL, 'utf8'));
  const list = await (await fetch(`${SERVER}/api/nde/videos?limit=100`)).json();
  const ex = (list.videos || []).filter(v => v.status === 'extracted');
  const recs = [];
  for (const v of ex) {
    const full = await (await fetch(`${SERVER}/api/nde/videos/${v.videoId}`)).json();
    if (full.transcript) recs.push(full);
  }
  return recs;
}

(async () => {
  const recs = await loadRecords();
  console.log(`Scanning ${recs.length} transcripts with ${MODEL} (effort=${EFFORT})…\n`);
  const themes = {};
  let inTok = 0, outTok = 0;
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    try {
      const { out, usage } = await callModel(rec);
      inTok += usage?.prompt_tokens || 0; outTok += usage?.completion_tokens || 0;
      const beats = Array.isArray(out.beats) ? out.beats : [];
      for (const b of beats) {
        const key = String(b.theme || 'other').trim();
        if (!themes[key]) themes[key] = { label: THEMES[key] ? key : (b.label || key), hits: [] };
        themes[key].hits.push({
          experiencer: out.experiencerName || rec.experiencerName || rec.title,
          videoId: rec.videoId,
          videoUrl: rec.url,
          timeSec: Number.isFinite(+b.timeSec) ? Math.max(0, Math.floor(+b.timeSec)) : null,
          quote: String(b.quote || '').trim(),
          paraphrase: String(b.paraphrase || '').trim(),
          label: String(b.label || '').trim(),
        });
      }
      console.log(`[${i + 1}/${recs.length}] ${out.experiencerName || rec.title} — ${beats.length} beats`);
    } catch (e) {
      console.error(`[${i + 1}/${recs.length}] ${rec.title} FAILED: ${e.message}`);
    }
  }
  // sort themes by how many DISTINCT experiencers hit them
  const ranked = Object.entries(themes)
    .map(([k, v]) => ({ key: k, label: v.label, people: new Set(v.hits.map(h => h.experiencer)).size, count: v.hits.length, hits: v.hits }))
    .sort((a, b) => b.people - a.people || b.count - a.count);
  fs.writeFileSync(OUT, JSON.stringify({ generatedFrom: recs.length, model: MODEL, themes: ranked }, null, 2));
  console.log(`\n=== THEMES (by # of people) ===`);
  for (const t of ranked) console.log(`${String(t.people).padStart(2)} people · ${t.count} clips · ${t.key}${THEMES[t.key] ? '' : ' (discovered)'}`);
  console.log(`\ntokens in=${inTok} out=${outTok}  → saved ${OUT}`);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
