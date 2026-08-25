#!/usr/bin/env node
/* SURVEY — what is waiting on Sophie, by CATEGORY (Aug 2026, her ask: "can
 * you do a survey if I need deliverables? I never commented on or messaged
 * the chat about videos or things that were gonna become videos like such of
 * images specifically, and note if there's anything else in a different
 * category").
 *
 * READ-ONLY, free, no model call. It reads the live collections and answers
 * one question per category: a chat HANDED her something — did she ever
 * answer it?
 *
 * The two signals a video deliverable can carry, and both are measured:
 *   - a NOTE on the film itself (filmnote.js → /api/gallery/assets/note →
 *     `forge-asset-votes`, keyed chat+url, exactly where an image's ♥/note
 *     lives — so images and films are counted on ONE scale)
 *   - a MESSAGE of hers in that chat after the film landed (`forge-chat-feed`,
 *     from:'sophie')
 * Neither = nobody has heard back about that film.
 *
 * "Things that were gonna become videos" are the storyboard / stills / shot
 * decks in the Review Queue — counted by their own decided/total.
 *
 *   node scripts/survey-deliverables.js              # the report
 *   node scripts/survey-deliverables.js --html out.html
 * Needs FIREBASE_SERVICE_ACCOUNT (deckfactory).
 */
const admin = require('firebase-admin');   // the house import; v13 also exposes the modular entries
const fs = require('fs');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const VID = /\.(mp4|mov|webm|m4v)(\?|$)/i;
const AUD = /\.(m4a|mp3|wav|aac)(\?|$)/i;
const URLRX = /https?:\/\/[^\s)\]"'<>]+/g;
// A page whose ITEMS are the raw material of a film — the "gonna become
// videos" half of her question.
const PRECURSOR = /storyboard|still|shot|reel|spot|commercial|scenario|carousel|panel/i;

const clean = u => u.replace(/[).,;]+$/, '').split('?')[0];
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const days = (a, b) => Math.max(0, Math.round((b - new Date(a)) / 864e5));

async function main() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!sa.project_id) { console.error('FIREBASE_SERVICE_ACCOUNT missing'); process.exit(1); }
  const cred = admin.credential ? admin.credential.cert(sa) : require('firebase-admin/app').cert(sa);
  const app = admin.initializeApp({ credential: cred, projectId: sa.project_id });
  const db = admin.firestore ? admin.firestore() : require('firebase-admin/firestore').getFirestore(app);
  const now = new Date();

  const [feedSnap, voteSnap, regSnap] = await Promise.all([
    db.collection('forge-chat-feed').select('chat', 'from', 'created', 'text', 'tldr').get(),
    db.collection('forge-asset-votes').select('chat', 'url', 'vote', 'note').get(),
    db.collection('forge-chat-registry').get(),
  ]);
  const reg = {}; regSnap.forEach(d => reg[d.id] = d.data());
  const votes = voteSnap.docs.map(d => d.data());
  const filmNotes = new Set(votes.filter(v => VID.test(v.url || '')).map(v => clean(v.url)));

  // Every media url a chat has ever handed her, oldest-first per chat.
  const her = {}, media = { video: {}, audio: {} };
  feedSnap.forEach(d => {
    const m = d.data(), at = m.created || '';
    if (m.from === 'sophie') { (her[m.chat] = her[m.chat] || []).push(at); return; }
    for (const raw of (`${m.text || ''} ${m.tldr || ''}`.match(URLRX) || [])) {
      const u = clean(raw);
      const kind = VID.test(u + '?') ? 'video' : AUD.test(u + '?') ? 'audio' : null;
      if (!kind) continue;
      if (kind === 'audio' && /memo-audio|forge-audio|drops\//.test(u)) continue; // her own library, not a delivery
      const byChat = media[kind][m.chat] = media[kind][m.chat] || {};
      if (!byChat[u] || at < byChat[u]) byChat[u] = at;
    }
  });

  const pinOf = chat => {                       // a pin may sit on a forked slug
    const p = (reg[chat] || {}).pinned;
    if (p && p.url) return p;
    const alt = Object.keys(reg).find(k => k !== chat && k.startsWith(chat) && (reg[k] || {}).pinned);
    return alt ? reg[alt].pinned : null;
  };

  const rowsFor = kind => Object.entries(media[kind]).map(([chat, urls]) => {
    const list = Object.entries(urls).sort((a, b) => a[1] < b[1] ? -1 : 1);
    const [url, at] = list[list.length - 1];
    const r = reg[chat] || {}, pin = pinOf(chat) || {};
    return {
      chat, url: (pin.kind === kind && pin.url) || url, at, n: list.length,
      title: pin.title || '', need: r.statusNeed || '', archived: !!r.archived,
      noted: list.some(([u]) => filmNotes.has(u)),
      msgsAfter: (her[chat] || []).filter(t => t > at).length,
      days: days(at, now),
    };
  }).sort((a, b) => a.at < b.at ? 1 : -1);

  const films = rowsFor('video'), audio = rowsFor('audio');
  const silent = r => !r.archived && !r.noted && !r.msgsAfter;

  const review = await (await fetch(`${BASE}/api/review`)).json();
  const pages = [...(review.waiting || []), ...(review.auto || [])];
  const pre = pages.filter(p => PRECURSOR.test(p.title || ''));
  const rest = pages.filter(p => !PRECURSOR.test(p.title || ''));

  const imgMarks = votes.filter(v => !VID.test(v.url || ''));
  const asks = Object.entries(reg)
    .filter(([, v]) => v.statusNeed && !v.archived && !v.deletedAt)
    .map(([chat, v]) => ({ chat, need: v.statusNeed, at: (v.statusAt || '').slice(0, 10), pin: (v.pinned || {}).kind || '' }))
    .sort((a, b) => a.at < b.at ? 1 : -1);
  const bucket = a => {
    const s = a.need.toLowerCase();
    if (a.pin === 'video' || /\bwatch|reel|film|clip|footage|storyboard|animat|commercial|shot list\b/.test(s)) return 'video';
    if (a.pin === 'audio' || /listen|voice|record|announcer|memo|audio|track|song/.test(s)) return 'audio / voice';
    if (/swipe|review \d|drawings|assets tab|deck|tiles|posters/.test(s)) return 'images / decks';
    if (/env|render|hover|domain|setup script|testflight|spend limit|log ?in|account|build/.test(s)) return 'admin / settings';
    if (/\?|say if|yes\/no|pick|decide|which|choose|go\/no|ok to/.test(s)) return 'a decision';
    if (/try |open |read |look at|check /.test(s)) return 'try or read a page';
    return 'other';
  };
  const buckets = {}; for (const a of asks) (buckets[bucket(a)] = buckets[bucket(a)] || []).push(a);

  const sum = (a, k) => a.reduce((s, p) => s + (p[k] || 0), 0);
  const report = {
    films, audio, pre, rest, asks, buckets,
    stats: {
      filmsHanded: sum(films.map(f => ({ n: f.n })), 'n'), filmChats: films.length,
      filmsSilent: films.filter(silent).length,
      filmNotes: votes.length - imgMarks.length, imageMarks: imgMarks.length,
      imageChats: new Set(imgMarks.map(v => v.chat)).size,
      preTouched: pre.filter(p => p.decided > 0).length, prePages: pre.length,
      preItems: sum(pre, 'total'), preDecided: sum(pre, 'decided'),
      restPages: rest.length, restItems: sum(rest, 'total'), restDecided: sum(rest, 'decided'),
    },
  };

  const s = report.stats;
  console.log(`films handed over: ${s.filmsHanded} across ${s.filmChats} chats · never answered (newest cut): ${s.filmsSilent}`);
  console.log(`marks she has left: ${s.imageMarks} on images (${s.imageChats} chats) vs ${s.filmNotes} on films`);
  console.log(`becoming-video pages: ${s.prePages}, ${s.preDecided}/${s.preItems} decided · other pages: ${s.restPages}, ${s.restDecided}/${s.restItems}`);
  console.log(`open asks: ${asks.length} — ` + Object.entries(buckets).map(([k, v]) => `${k} ${v.length}`).join(', '));
  console.log('\nFILMS WITH NO ANSWER OF ANY KIND');
  for (const r of films.filter(silent)) console.log(`  ${r.at.slice(0, 10)} (${r.days}d) ${r.chat}${r.title ? ' | ' + r.title : ''}${r.need ? ' | need: ' + r.need : ''}`);
  console.log('\nAUDIO WITH NO ANSWER OF ANY KIND');
  for (const r of audio.filter(silent)) console.log(`  ${r.at.slice(0, 10)} (${r.days}d) ${r.chat}${r.title ? ' | ' + r.title : ''}${r.need ? ' | need: ' + r.need : ''}`);

  const htmlArg = process.argv.indexOf('--html');
  if (htmlArg > -1) { fs.writeFileSync(process.argv[htmlArg + 1], page(report)); console.log('\nwrote', process.argv[htmlArg + 1]); }
}

// The survey as a Compare page: a film is a LINE WITH A PLAY BUTTON, never an
// embedded <video>; every row carries data-item so it gets a note box.
function page(r) {
  const s = r.stats;
  const filmRow = (x, i) => `  <div class="card" data-item="film-${esc(x.chat)}">
    <h2>${esc(x.title || x.chat)}</h2>
    <div id="f${i}"></div>
    <p class="meta">${esc(x.chat)} · ${x.days} days ${x.need ? '· ' + esc(x.need) : ''}</p>
  </div>`;
  const pageRow = p => `  <div class="card" data-item="page-${esc(p.id)}">
    <h2>${esc(p.title)}</h2>
    <p class="meta">${esc(p.chat)} · ${p.decided}/${p.total} marked · <a href="/api/chatfeed/page/${esc(p.id)}?clean=1">open</a></p>
  </div>`;
  const silent = x => !x.archived && !x.noted && !x.msgsAfter;
  const f = r.films.filter(silent), a = r.audio.filter(silent);
  const pre = r.pre.slice().sort((x, y) => (x.decided / (x.total || 1)) - (y.decided / (y.total || 1)));
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Deliverables waiting — the survey (v1)</title>
<link rel="stylesheet" href="/compare.css">
<style>.meta{color:var(--ink2);font-size:13px;margin:6px 0 0}h3{margin:26px 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}</style>
<div class="wrap">
  <h1>Deliverables waiting — the survey (v1)</h1>
  <h3>Films nobody has heard back about — ${f.length}</h3>
${f.map(filmRow).join('\n')}
  <h3>Going to become videos — ${s.preDecided} of ${s.preItems} marked</h3>
${pre.map(pageRow).join('\n')}
  <h3>Audio waiting — ${a.length}</h3>
${a.map((x, i) => filmRow(x, 100 + i)).join('\n')}
  <h3>Everything else — ${r.asks.length} open asks</h3>
${Object.entries(r.buckets).sort((x, y) => y[1].length - x[1].length).map(([k, v]) => `  <div class="card" data-item="ask-${esc(k.replace(/\\W+/g, '-'))}">
    <h2>${esc(k)} — ${v.length}</h2>
    <p class="meta">${v.slice(0, 8).map(x => esc(x.chat) + ': ' + esc(x.need)).join('<br>')}</p>
  </div>`).join('\n')}
</div>
<script src="/compare.js"></script>
<script>
(function () {
  var films = ${JSON.stringify(f.map((x, i) => ({ url: x.url, label: x.title || x.chat, mount: '#f' + i })))};
  var auds = ${JSON.stringify(a.map((x, i) => ({ url: x.url, label: x.title || x.chat, mount: '#f' + (100 + i) })))};
  films.concat(auds).forEach(function (x) { window.__filmRow(x); });
  window.__compareNotes({ chat: 'deliverables-survey', sheet: 'deliverables-v1' });
  window.__compareHelp({ html: '<b>What this is.</b> Everything a chat handed you that nobody has heard back about. '
    + 'A film counts as answered if you left a note on it or messaged that chat after it landed — '
    + '${s.imageMarks} of your marks are on images, ${s.filmNotes} on films.' });
})();
</script>`;
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
