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
 * WIDENED (her second ask, same day: "can you do a survey of any deliverables
 * I never commented on or messaged the chat about"). The same two signals are
 * asked of every kind of thing a chat hands over — images, Compare/deck pages,
 * note threads a chat answered and she never came back to, and blog drafts
 * that were written and never published. A chat's images count as unseen when
 * they were filed AFTER her last message in that chat: `lastHerAt` on the
 * registry is only stamped since Aug 2026, so the honest clock is her last
 * message in `forge-chat-feed`, not the registry field.
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

  // IMAGES — filed per chat, marked per chat, and how many landed after her
  // last message there (the honest "she has not been back since" clock).
  const assetSnap = await db.collection('forge-chat-assets').select('chat', 'url', 'createdAt', 'created').get();
  const iso = v => !v ? '' : typeof v === 'number' ? new Date(v).toISOString()
    : (v && v._seconds) ? new Date(v._seconds * 1000).toISOString() : String(v);
  const herLast = {};
  for (const c of Object.keys(her)) herLast[c] = her[c].sort().pop();
  const markedUrls = new Set(votes.map(v => clean(v.url || '')));
  const imgs = {};
  assetSnap.forEach(dd => {
    const a = dd.data(), at = iso(a.createdAt || a.created);
    const x = imgs[a.chat] = imgs[a.chat] || { n: 0, marked: 0, unseen: 0, last: '' };
    x.n++;
    if (markedUrls.has(clean(a.url || ''))) x.marked++;
    if (at > (herLast[a.chat] || '')) x.unseen++;
    if (at > x.last) x.last = at;
  });
  const imageRows = Object.entries(imgs)
    .map(([chat, x]) => ({ chat, ...x, everMessaged: !!herLast[chat], name: (reg[chat] || {}).displayName || chat }))
    .filter(r => !(reg[r.chat] || {}).archived && !(reg[r.chat] || {}).deletedAt && r.unseen > 0)
    .sort((a, b) => b.unseen - a.unseen);

  // NOTE THREADS a chat answered and she never came back to.
  const threadSnap = await db.collection('forge-asset-votes').select('chat', 'thread').get();
  const owed = [];
  threadSnap.forEach(dd => {
    const t = (dd.data().thread || []);
    if (t.length && t[t.length - 1].from === 'chat') owed.push(dd.data().chat);
  });
  const owedByChat = {};
  for (const c of owed) owedByChat[c] = (owedByChat[c] || 0) + 1;

  // BLOG posts written and never published anywhere.
  const blogSnap = await db.collection('forge-blog').select('title', 'published', 'sitePublishedAt').get();
  const blogDrafts = blogSnap.docs.map(dd => dd.data())
    .filter(b => b.published !== true && !b.sitePublishedAt)
    .map(b => b.title || '(untitled)');

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
  const pageSnap = await db.collection('forge-chat-pages').select('chat', 'supersededBy').get();
  const markedChats = new Set([...votes.map(v => v.chat),
    ...Object.keys(reg).filter(c => false)]);
  for (const v of (await db.collection('forge-chat-verdicts').get()).docs) markedChats.add(v.id.split('__')[0]);
  const livePages = pageSnap.docs.map(dd => dd.data())
    .filter(p => !p.supersededBy && !(reg[p.chat] || {}).archived);
  const untouchedPages = livePages.filter(p => !markedChats.has(p.chat)).length;

  const report = {
    films, audio, pre, rest, asks, buckets, imageRows, owedByChat, blogDrafts,
    stats: {
      filmsHanded: sum(films.map(f => ({ n: f.n })), 'n'), filmChats: films.length,
      filmsSilent: films.filter(silent).length,
      filmNotes: votes.length - imgMarks.length, imageMarks: imgMarks.length,
      imageChats: new Set(imgMarks.map(v => v.chat)).size,
      preTouched: pre.filter(p => p.decided > 0).length, prePages: pre.length,
      preItems: sum(pre, 'total'), preDecided: sum(pre, 'decided'),
      restPages: rest.length, restItems: sum(rest, 'total'), restDecided: sum(rest, 'decided'),
      imgFiled: sum(Object.values(imgs), 'n'), imgMarked: sum(Object.values(imgs), 'marked'),
      imgUnseen: imageRows.reduce((s2, r) => s2 + r.unseen, 0),
      imgNeverMessaged: imageRows.filter(r => !r.everMessaged).reduce((s2, r) => s2 + r.unseen, 0),
      livePages: livePages.length, untouchedPages,
      threadsOwed: owed.length, blogDrafts: blogDrafts.length,
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
  console.log(`\nIMAGES: ${s.imgUnseen} filed after your last message in that chat (${s.imgNeverMessaged} in chats you have never messaged); ${s.imgFiled - s.imgMarked} of ${s.imgFiled} carry no mark`);
  for (const r of imageRows.slice(0, 12)) console.log(`  ${String(r.unseen).padStart(4)} unseen of ${String(r.n).padStart(4)} · marked ${r.marked} · ${r.last.slice(0, 10)} · ${r.name}${r.everMessaged ? '' : ' (never messaged)'}`);
  console.log(`\nPAGES: ${s.livePages} live Compare/deck pages, ${s.untouchedPages} in chats with no mark of any kind`);
  console.log(`NOTE THREADS: ${s.threadsOwed} where a chat answered you and you never came back`);
  console.log(`BLOG: ${s.blogDrafts} posts written, never published`);

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
  <h1>Deliverables waiting — the survey (v2)</h1>
  <h3>Films nobody has heard back about — ${f.length}</h3>
${f.map(filmRow).join('\n')}
  <h3>Going to become videos — ${s.preDecided} of ${s.preItems} marked</h3>
${pre.map(pageRow).join('\n')}
  <h3>Audio waiting — ${a.length}</h3>
${a.map((x, i) => filmRow(x, 100 + i)).join('\n')}
  <h3>Images nobody has heard back about — ${s.imgUnseen}</h3>
${r.imageRows.slice(0, 12).map(x => `  <div class="card" data-item="img-${esc(x.chat)}">
    <h2>${esc(x.name)}</h2>
    <p class="meta">${x.unseen} filed since you last wrote there · ${x.marked} of ${x.n} marked · ${esc(x.last.slice(0, 10))}${x.everMessaged ? '' : ' · never messaged'}</p>
  </div>`).join('\n')}
  <h3>Read but never answered — ${s.threadsOwed} note threads</h3>
  <div class="card" data-item="threads">
    <h2>A chat wrote back on the picture and you never came back</h2>
    <p class="meta">${Object.entries(r.owedByChat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => n + ' · ' + esc(c)).join('<br>')}</p>
  </div>
  <h3>Written, never published — ${s.blogDrafts} blog posts</h3>
  <div class="card" data-item="blog">
    <h2>Drafts sitting in Blog Studio</h2>
    <p class="meta">${r.blogDrafts.slice(0, 8).map(esc).join('<br>')}</p>
  </div>
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
  window.__compareNotes({ chat: 'deliverables-survey', sheet: 'deliverables-v2' });
  window.__compareHelp({ html: '<b>What this is.</b> Everything a chat handed you that nobody has heard back about. '
    + 'A film counts as answered if you left a note on it or messaged that chat after it landed — '
    + '${s.imageMarks} of your marks are on images, ${s.filmNotes} on films.' });
})();
</script>`;
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
