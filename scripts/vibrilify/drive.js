// drive.js — drives the live Movies pipeline for the Vibrilify MAX spot.
// Subcommands (run in order; state.json remembers the movie id):
//   create            make the movie from spec.json's authored scenes
//   vo <file.wav>     attach the voiceover (server stores + whisper-times it)
//   timeline          compute per-beat startAts from the whisper words
//   panels|clips|stitch  kick that job on the server
//   watch [minutes]   poll until the current job finishes (for a bg task)
//   status            one-line job/movie state
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'spec.json'), 'utf8'));
const stateFile = path.join(__dirname, 'state.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');

async function api(method, p, body) {
  const r = await fetch(BASE + '/api/movies' + p, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${data.error || ''}`);
  return data;
}

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();

// Find a phrase in the whisper word list; returns {start,end} of the match.
function findPhrase(words, phrase) {
  const toks = norm(phrase).split(' ');
  const w = words.map(x => norm(x.word));
  outer: for (let i = 0; i + toks.length <= w.length; i++) {
    for (let j = 0; j < toks.length; j++) if (w[i + j] !== toks[j]) continue outer;
    return { start: words[i].start, end: words[i + toks.length - 1].end };
  }
  return null;
}

const cmds = {
  async create() {
    const scenes = spec.scenes.map(s => ({
      title: s.title,
      imagePrompt: s.imagePrompt,
      motionPrompt: s.motionPrompt,
      hasText: !!s.hasText,
      pairWithNext: !!s.pairWithNext,
      key: !!s.key,
    }));
    const movie = await api('POST', '', {
      title: spec.title,
      scenes,
      characters: spec.characters,
      aspect: spec.aspect,
      style: spec.style,
      panelQuality: spec.panelQuality,
    });
    state.movieId = movie.id;
    state.sceneIds = movie.scenes.map(s => s.id);
    save();
    console.log(JSON.stringify({ id: movie.id, scenes: movie.scenes.length }));
  },

  async vo(file) {
    if (!file) throw new Error('vo <file.wav>');
    const buf = fs.readFileSync(file);
    const dataUrl = 'data:audio/wav;base64,' + buf.toString('base64');
    const r = await api('POST', `/${state.movieId}/voiceover`, { audio: dataUrl, transcribe: true });
    console.log(JSON.stringify(r.voiceover));
  },

  async timeline() {
    const movie = await api('GET', `/${state.movieId}`);
    const words = movie.voiceover?.words || [];
    if (!words.length) throw new Error('no voiceover words on the movie');
    // Beat anchors, in scene order. null = no startAt (second half of a pair).
    const anchors = [
      () => 0,                                                        // s1 kitchen
      () => findPhrase(words, 'the dog knows')?.start,                // s2 dog
      () => { const m = findPhrase(words, 'for weeks'); return m ? m.end + 0.4 : null; }, // s3 neighbor (silent beat)
      () => findPhrase(words, 'tried candles')?.start - 0.9,          // s4 candles ("You've" leads in)
      () => findPhrase(words, 'targets bad vibes')?.start - 1.0,      // s5 pill (pair) — brand name leads in
      () => findPhrase(words, 'patients report')?.start,              // s6 sunrise still, re-read: the vibes are waiting
      () => findPhrase(words, 'not just reading')?.start - 1.6,       // s7 market ("With Vibrilify MAX, she's" leads in)
      () => findPhrase(words, 'not for everyone')?.start - 1.4,       // s8 picnic
      () => findPhrase(words, 'forgiving your father')?.start,        // s9 costco (flash cut, deliberate)
      () => findPhrase(words, 'hearing wind chimes')?.start,          // s10 chimes
      () => findPhrase(words, 'grapefruit juice')?.start - 1.5,       // s11 grapefruit ("Do not take…" leads in)
      () => { const m = findPhrase(words, 'no longer possible'); return m ? m.end + 0.5 : null; }, // s12 logo (whisper follows)
    ];
    const beats = [];
    anchors.forEach((fn, i) => {
      const t = fn();
      if (typeof t === 'number' && isFinite(t)) beats.push({ id: state.sceneIds[i], startAt: Math.max(0, +t.toFixed(2)) });
      else if (t !== null && t !== undefined) throw new Error(`anchor ${i} not found in transcript`);
      else if (t === undefined) throw new Error(`anchor ${i} phrase missing from transcript`);
    });
    const r = await api('POST', `/${state.movieId}/timeline`, { aspect: spec.aspect, beats });
    console.log(JSON.stringify({ updated: r.updated, beats }));
  },

  async panels() { console.log(JSON.stringify((await api('POST', `/${state.movieId}/panels`, { quality: spec.panelQuality })).job || { ok: true })); },
  async clips() {
    const frames = {};
    spec.scenes.forEach((s, i) => { if (s.clipFrames) frames[state.sceneIds[i]] = s.clipFrames; });
    // /clips has no per-scene frames — kick the bulk job, then upgrade long ones after.
    console.log(JSON.stringify(await api('POST', `/${state.movieId}/clips`, { tier: 'draft' })).slice(0, 120));
  },
  async stitch() { console.log(JSON.stringify(await api('POST', `/${state.movieId}/stitch`, { mode: 'timeline' })).slice(0, 200)); },

  async watch(mins) {
    const deadline = Date.now() + (Number(mins) || 25) * 60 * 1000;
    for (;;) {
      const movie = await api('GET', `/${state.movieId}`);
      const j = movie.job || {};
      process.stderr.write(`${j.kind || '-'} ${j.status || '-'} ${j.done || 0}/${j.total || 0} ${j.label || ''}\n`);
      if (j.status !== 'running') {
        console.log(JSON.stringify({ kind: j.kind, status: j.status, error: j.error || null, movieUrl: movie.movieUrl || null, spend: movie.spend }));
        process.exit(j.status === 'error' ? 2 : 0);
      }
      if (Date.now() > deadline) { console.log(JSON.stringify({ timeout: true, job: j })); process.exit(3); }
      await new Promise(r => setTimeout(r, 20000));
    }
  },

  async status() {
    const movie = await api('GET', `/${state.movieId}`);
    console.log(JSON.stringify({
      job: movie.job, spend: movie.spend, movieUrl: movie.movieUrl,
      panels: movie.scenes.map(s => s.panel?.status || null),
      clips: movie.scenes.map(s => s.clip?.status || null),
    }));
  },
};

(async () => {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmds[cmd]) throw new Error('unknown command: ' + cmd);
  await cmds[cmd](...args);
})().catch(e => { console.error(e.message); process.exit(1); });
