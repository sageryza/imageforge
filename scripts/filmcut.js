#!/usr/bin/env node
// filmcut.js — THE CHAT'S HANDS ON A FILM EDITOR CUT (2026-09-02).
//
// Sophie: "while they edit, also have it in the film editor that was made,
// clips laid out exactly the same so we can both edit in parallel … they
// give me a draft, i edit in film editor, i send a message, they edit, i
// edit, etc." The cut DOC is the film (docs/film-editor-parallel-editing-
// plan.md); this is how a chat writes it, renders it, reads what she moved,
// and hands the render over — one command each, so no chat ever hand-rolls
// the doc or keeps a cut list in its head.
//
//   node scripts/filmcut.js create --title "The Ant Farm" --chat <slug> [--session <sid>]
//   node scripts/filmcut.js get <id>                 → the doc, laid out (EDL + sounds + renders)
//   node scripts/filmcut.js set <id> cut.json        → save {clips, sounds} (reads base first; a
//                                                      409 prints HER current doc — re-read, re-apply)
//   node scripts/filmcut.js render <id>              → bake IN THIS CONTAINER (the default when
//                                                      FIREBASE_SERVICE_ACCOUNT is set) and publish
//                                                      onto the doc; prints the newest render url
//   node scripts/filmcut.js render <id> --box [--no-wait]
//                                                    → bake on the live box instead (her button)
//   node scripts/filmcut.js diff <id> [--from <at>]  → what moved since the newest render, in words
//   node scripts/filmcut.js pin <id> --chat <slug> --session <sid> --title "v8 — …"
//                                                    → pins the newest render WITH the cut id (the
//                                                      editor door) — the checklist's 3a + 3c in one
//
// cut.json is the two lanes exactly as cut-model.js reads them:
//   { "clips":[{key,kind?,url,title,seconds?,in,out}…],
//     "sounds":[{key,url,name,at?,in?,out?,gain?,fadeIn?,fadeOut?,mute?,anchor?:{piece,offset}}…] }
// Every write carries by:'chat'. FORGE_BASE overrides the server; STUDIO_TOKEN
// rides as x-studio-token when set. Costs nothing — renders are ffmpeg, here or
// on the box.
//
// A CHAT RENDERS HERE, NOT ON THE BOX (2026-09-05, Sophie: "why didn't u just
// make it in ur container to begin with? … if not, write that in notes as the
// default"). Measured that night: the 512MB box OOM-killed a 16-piece render
// twice (Render's own `oomKilled` events) while this container rendered the
// same cut in 61s; the box's 0.5 vCPU took 102s on a smaller one, and a merge
// by any chat restarts it mid-render. The render is the SAME code either way —
// filmeditor.js's renderCut + publishRender, the same segment cache in Storage
// (a piece banked here is a hit on the box, and the other way round), the same
// record on the same doc. `--box` is for a deliberate reason only.
const fs = require('fs');
const M = require('../cut-model');

const BASE = (process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com').replace(/\/$/, '');
const API = BASE + '/api/filmeditor';
const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
const has = (n) => argv.includes('--' + n);
const pos = argv.filter((a, i) => i > 0 && !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));

async function call(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.STUDIO_TOKEN) headers['x-studio-token'] = process.env.STUDIO_TOKEN;
  const r = await fetch(path.startsWith('http') ? path : API + path, {
    method: opts.method || 'GET', headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { error: text.slice(0, 300) }; }
  return { status: r.status, json };
}
function die(msg) { console.error(msg); process.exit(1); }
const secs = (x) => (Math.round(x * 10) / 10).toFixed(1) + 's';

function layout(doc) {
  const lanes = M.readDoc(doc);
  const lines = [];
  lines.push(`${doc.title || '(untitled)'} — ${doc.id}  ·  ${secs(M.totalSeconds(lanes.clips))}  ·  edited by ${doc.lastEditBy || '?'} at ${doc.updatedAt ? new Date(doc.updatedAt).toISOString() : '?'}`);
  lines.push('PICTURE');
  M.starts(lanes.clips).forEach((s, i) => {
    const p = s.piece;
    lines.push(`  ${String(i + 1).padStart(2)}  ${secs(s.start).padStart(7)}  ${secs(s.dur).padStart(6)}  ${p.kind === 'image' ? 'still' : 'clip '}  ${p.key.padEnd(12)} ${p.title || ''}${p.kind === 'video' ? `  [${p.in}–${p.out}]` : ''}${p.mute ? '  muted' : ''}${p.gain ? `  ${p.gain > 0 ? '+' : ''}${p.gain}dB` : ''}`);
  });
  lines.push('SOUND');
  lanes.sounds.forEach((s) => {
    const len = M.soundSeconds(s);
    lines.push(`  ${secs(M.soundStart(s, lanes.clips)).padStart(7)}  ${(len == null ? '?' : secs(len)).padStart(6)}  ${s.key.padEnd(12)} ${s.name || ''}  ${s.gain > 0 ? '+' : ''}${s.gain}dB${s.fadeIn ? `  in ${s.fadeIn}s` : ''}${s.fadeOut ? `  out ${s.fadeOut}s` : ''}${s.mute ? '  muted' : ''}${s.anchor ? `  rides ${s.anchor.piece}${s.anchor.offset ? ` +${s.anchor.offset}s` : ''}` : ''}`);
  });
  const rs = doc.renders || [];
  lines.push(`RENDERS (${rs.length})`);
  rs.slice(0, 5).forEach((r, i) => lines.push(`  ${i === 0 ? 'newest' : '      '}  ${new Date(r.at).toISOString()}  by ${r.by || '?'}  ${secs(r.seconds || 0)}  ${r.url}`));
  return lines.join('\n');
}

// The container render: filmeditor.js's own renderCut + publishRender against
// the live doc, with the Deck Factory service account. Same segment cache,
// same record shape, same shot map — only the machine differs.
async function renderHere(id) {
  const os = require('os');
  const path = require('path');
  const admin = require('firebase-admin');
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
  }
  const fe = require('../filmeditor');
  const doc = await fe.loadDoc(id);
  if (!doc) die('no such cut');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmcut-'));
  const t0 = Date.now();
  try {
    const r = await fe.renderCut(doc, {
      dir, progress: async (d, t, l) => process.stderr.write(`  ${l} ${d}/${t}\n`),
    });
    const render = await fe.publishRender(id, doc, r, 'chat', 'container');
    // A job the box left behind — killed mid-render by a deploy or an OOM —
    // sits on "running" in her editor forever. Clear it ONLY when the box
    // itself says the process that started it is gone (jobIsDead against the
    // box's boot time); a render she really has going is left alone.
    if (doc.job && doc.job.status === 'running') {
      try {
        const { json } = await call(BASE + '/api/promptlab/inflight');
        const bootAt = Date.now() - Number(json.uptime || 0) * 1000;
        if (json.uptime && fe.jobIsDead(doc.job, Date.now(), bootAt)) {
          await fe.patchDoc(id, { job: { ...doc.job, status: 'done', label: 'done' } });
        }
      } catch { /* a job we cannot judge is left as it is */ }
    }
    console.log(`${render.url}\n${secs(render.seconds || 0)} · ${Math.round((Date.now() - t0) / 1000)}s · ${r.banked} of ${r.clips.length} pieces banked · rendered in this container`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function loadDoc(id) {
  const { status, json } = await call('/' + id);
  if (status !== 200) die(`GET ${id} → ${status} ${json.error || ''}`);
  return json;
}

(async () => {
  if (cmd === 'create') {
    const body = { title: flag('title') || '', chat: flag('chat') || process.env.FORGE_CHAT || '', session: flag('session') || (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '') };
    if (!body.chat) die('--chat <slug> required (the chat that owns this cut)');
    const { status, json } = await call('', { method: 'POST', body });
    if (status !== 200) die(`create → ${status} ${json.error || ''}`);
    console.log(json.id);
    console.log(`${BASE}/filmeditor?c=${json.id}`);
    return;
  }
  const id = pos[0];
  if (!id) die('cut id required');
  if (cmd === 'get') { console.log(layout(await loadDoc(id))); return; }
  if (cmd === 'set') {
    const file = pos[1]; if (!file) die('set <id> cut.json');
    const cut = JSON.parse(fs.readFileSync(file, 'utf8'));
    const doc = await loadDoc(id);
    const body = { by: 'chat', base: doc.updatedAt };
    if (Array.isArray(cut.clips)) body.clips = M.cleanPieces(cut.clips);
    if (Array.isArray(cut.sounds)) body.sounds = M.cleanSounds(cut.sounds);
    let { status, json } = await call(`/${id}/pieces`, { method: 'POST', body });
    if (status === 409) {
      // A 409 whose lanes are the ones we read is a timestamp that moved under
      // us (a render finishing, a mirror write) — not her edit. Re-read the base
      // and save once more. Lanes that differ ARE her edit: print them, stop.
      const hers = json.doc || {};
      const same = JSON.stringify(M.readDoc(hers)) === JSON.stringify(M.readDoc(doc));
      if (same) {
        body.base = hers.updatedAt || (await loadDoc(id)).updatedAt;
        ({ status, json } = await call(`/${id}/pieces`, { method: 'POST', body }));
      }
      if (status === 409) {
        let shown = '';
        try { shown = layout(json.doc || {}); } catch (e) { shown = `(could not lay her cut out: ${e.message})`; }
        console.error('STALE — she changed the cut since you read it. Her current cut:\n' + shown);
        process.exit(2);
      }
    }
    if (status !== 200) die(`set → ${status} ${json.error || ''}`);
    console.log(`saved · ${json.pieces} pieces · updatedAt ${json.updatedAt}`);
    return;
  }
  if (cmd === 'render') {
    if (!has('box') && process.env.FIREBASE_SERVICE_ACCOUNT) return renderHere(id);
    if (!has('box')) console.error('no FIREBASE_SERVICE_ACCOUNT in this container — rendering on the box');
    const { status, json } = await call(`/${id}/render`, { method: 'POST', body: { by: 'chat' } });
    if (status !== 200) die(`render → ${status} ${json.error || ''}`);
    if (has('no-wait')) { console.log('rendering'); return; }
    const t0 = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, 4000));
      const j = await call(`/${id}/job`);
      const job = j.json.job || {};
      if (job.status === 'running') { process.stderr.write(`  ${job.label || ''} ${job.done || 0}/${job.total || '?'}\r`); continue; }
      if (job.status === 'failed') die(`\nrender failed: ${job.error}`);
      const newest = (j.json.renders || [])[0];
      if (newest) { console.log(`\n${newest.url}\n${secs(newest.seconds || 0)} · ${Math.round((Date.now() - t0) / 1000)}s`); return; }
      if (Date.now() - t0 > 20 * 60 * 1000) die('gave up waiting after 20 minutes');
    }
  }
  if (cmd === 'diff') {
    const from = flag('from');
    const { status, json } = await call(`/${id}/diff${from ? '?from=' + encodeURIComponent(from) : ''}`);
    if (status !== 200) die(`diff → ${status} ${json.error || ''}`);
    console.log(json.text || M.describeDiff(json.changes));
    return;
  }
  if (cmd === 'pin') {
    const doc = await loadDoc(id);
    const newest = (doc.renders || [])[0];
    if (!newest) die('nothing rendered yet');
    const chat = flag('chat') || doc.chat; const session = flag('session') || (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');
    if (!chat) die('--chat <slug> required');
    const title = flag('title') || `${doc.title || 'Cut'} (${Math.floor(newest.seconds / 60)}:${String(Math.round(newest.seconds % 60)).padStart(2, '0')})`;
    const { status, json } = await call(BASE + '/api/chatfeed/pin', { method: 'POST', body: { chat, session, url: newest.url, title, kind: 'video', cut: id } });
    if (status !== 200) die(`pin → ${status} ${json.error || ''}`);
    console.log(`pinned on ${json.chat}: ${title}\n${newest.url}`);
    return;
  }
  die('commands: create · get · set · render · diff · pin');
})().catch((e) => die(e.message));
