#!/usr/bin/env node
// Post a TRIAGE page for one account's still-open chats (Aug 2026, Sophie:
// "I have a bunch of chats that I need to archive or do something with, but
// generally, I have to read the first message of the chat and then my last
// message of the chat and then the last message Claude sent").
//
// One card per open chat: a link back to the chat at the top, then three
// collapsed folds — her first message, her last message, Claude's last. All
// shut by default, because the page is a LIST to scan, not a thing to read.
//
// A MESSAGE IS A BLOCK, NOT A DOCUMENT (her rule: "when I say message that
// includes for me if I sent multiple messages at one time"). Consecutive
// messages from the same side are joined into one block, so a burst of three
// things she fired off in a row is one "last message".
//
// GROUPED BY WHEN *SHE* LAST WROTE, never by the chat's own lastSeen: a chat
// that posted a reply, filed an asset or answered a wake stamps lastSeen
// without her having touched it, so that field answers a different question
// from the one she asked. Three buckets — before yesterday / yesterday /
// today — and all three ship, because the literal filter ("didn't work on
// yesterday") can be a two-row page while the real backlog is the yesterday
// pile. Showing both costs one section and guesses at nothing.
//
// A context-compaction summary is NOT her message — the harness hands it over
// as a user turn and the hook lifts it exactly like something she typed, so it
// would file thousands of characters of recited rules as her first message.
// Same detector questions.js uses, kept here as one regex rather than a
// dependency on that module's private list.
//
//   node scripts/chat-triage-page.js --chat <your slug> --session <sid> \
//        [--account 3] [--base https://imageforge-q125.onrender.com] [--dry]
//
// Costs nothing: two read routes and one page post, no model call.

const fs = require('fs');

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = arg('base', 'https://imageforge-q125.onrender.com');
const ACCOUNT = String(arg('account', '3'));
const CHAT = arg('chat', '');
const SESSION = arg('session', '');
const DRY = process.argv.includes('--dry');
const OUT = arg('out', '');

// Pacific is UTC-7 in summer. The buckets are HER days, not UTC days — an
// 11pm message is the same working day as the morning it followed.
const PT = -7 * 3600 * 1000;
const ptDate = (iso) => new Date(new Date(iso).getTime() + PT).toISOString().slice(0, 10);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ptStamp = (iso) => {
  const d = new Date(new Date(iso).getTime() + PT);
  let h = d.getUTCHours(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()} · ${h}:${String(d.getUTCMinutes()).padStart(2, '0')} ${ap}`;
};
const COMPACTED = /^\s*\[?\s*this session is being continued from a previous conversation/i;

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (h) => h.replace(/(https?:\/\/[^\s<)"']+)/g,
  (m) => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`);
const bodyOf = (b) => linkify(esc(b.parts.join('\n\n').trim()));
const fold = (label, b) => (b
  ? `<details><summary>${esc(label)}</summary><div class="mtext">${bodyOf(b)}</div></details>` : '');

async function getJSON(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(path + ' → ' + r.status);
  return r.json();
}

(async () => {
  const today = ptDate(new Date().toISOString());
  const yesterday = ptDate(new Date(Date.now() - 86400000).toISOString());

  const feed = await getJSON('/api/chatfeed?scan=200&deepchats=1&deep=1&tail=1');
  const reg = feed.chats || {};
  // The chat this page is POSTED INTO is left out: it is the one she is
  // standing in, it has nothing to triage, and it would sit in the cold pile
  // (her message here reaches the feed after this runs) reading as a chat she
  // had abandoned.
  const slugs = Object.keys(reg).filter((s) => String(reg[s].account) === ACCOUNT
    && !reg[s].archived && !reg[s].deletedAt && s !== CHAT);
  process.stderr.write(`account ${ACCOUNT}: ${slugs.length} open chats\n`);

  const chats = [];
  for (const slug of slugs) {
    const msgs = ((await getJSON('/api/chatfeed/thread?chat=' + encodeURIComponent(slug))).messages || [])
      .filter((m) => String(m.text || '').trim());
    const blocks = [];
    for (const m of msgs) {
      const side = (m.from === 'sophie' && !COMPACTED.test(String(m.text || ''))) ? 'me' : 'claude';
      const last = blocks[blocks.length - 1];
      if (last && last.side === side) { last.parts.push(m.text); last.end = m.created; }
      else blocks.push({ side, parts: [m.text], end: m.created });
    }
    const mine = blocks.filter((b) => b.side === 'me');
    const theirs = blocks.filter((b) => b.side === 'claude');
    const days = new Set(mine.map((b) => ptDate(b.end)));
    const r = reg[slug] || {};
    chats.push({
      slug, name: r.displayName || slug, msgCount: msgs.length,
      lastHer: mine.length ? mine[mine.length - 1].end : '',
      bucket: days.has(today) ? 'today' : days.has(yesterday) ? 'yesterday' : 'older',
      myFirst: mine[0] || null,
      myLast: mine.length > 1 ? mine[mine.length - 1] : null,
      claudeLast: theirs.length ? theirs[theirs.length - 1] : null,
    });
  }
  chats.sort((a, b) => (a.lastHer < b.lastHer ? -1 : 1));

  const card = (c) => {
    const one = !c.myLast;
    const folds = [
      fold(one ? 'My message' : 'My first message', c.myFirst),
      one ? '' : fold('My last message', c.myLast),
      fold("Claude's last message", c.claudeLast),
    ].filter(Boolean).join('\n    ');
    const meta = (c.lastHer ? `you last wrote ${ptStamp(c.lastHer)}` : 'you never wrote here')
      + ` · ${c.msgCount} message${c.msgCount === 1 ? '' : 's'}`;
    return `  <div class="card" data-item="${esc(c.slug)}">
    <a class="go" href="/chats?chat=${encodeURIComponent(c.slug)}" data-chat="${esc(c.slug)}">${esc(c.name)} <span class="arw">&rsaquo;</span></a>
    <div class="meta">${esc(meta)}</div>
    ${folds}
  </div>`;
  };

  const sections = [
    ['older', 'Nothing from you since before yesterday'],
    ['yesterday', 'Last worked yesterday'],
    ['today', 'You worked on these today'],
  ].map(([key, label]) => {
    const rows = chats.filter((c) => c.bucket === key);
    return rows.length ? `  <h2>${esc(label)} · ${rows.length}</h2>\n` + rows.map(card).join('\n') : '';
  }).filter(Boolean).join('\n\n');

  const title = `Account ${ACCOUNT} — open chats · ${MON[new Date(new Date().getTime() + PT).getUTCMonth()]} ${new Date(new Date().getTime() + PT).getUTCDate()}`;
  const sheet = `acct${ACCOUNT}-open-${today}`;
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  h2 { padding-right: 64px; }
  .card { padding-bottom: 14px; }
  /* 64px, not 56 — the injected pill's left edge lands at x=326 on a 390pt
     phone, so a 56px reserve leaves the last 8px of this row under it. */
  .card > .go {
    display: block; font: 700 18px/1.25 Georgia, serif;
    color: var(--ink); text-decoration: none; padding-right: 64px;
  }
  .card > .go .arw { color: var(--gold); }
  .meta {
    font: 400 13px/1.4 -apple-system, 'Helvetica Neue', sans-serif;
    color: var(--ink2); margin: 3px 0 8px;
  }
  details { border-top: 1px solid var(--line); }
  summary {
    list-style: none; cursor: pointer; padding: 8px 0 8px 16px; position: relative;
    font: 600 12px/1.2 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .1em; text-transform: uppercase; color: var(--gold);
  }
  summary::-webkit-details-marker { display: none; }
  summary::before {
    content: '\\203A'; position: absolute; left: 2px; top: 6px;
    font-size: 15px; color: var(--gold); transition: transform .15s;
  }
  details[open] > summary::before { transform: rotate(90deg); }
  .mtext {
    white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word;
    font-size: 15px; line-height: 1.5; color: var(--ink);
    padding: 0 0 12px 16px; margin-top: -2px;
  }
</style>

<div class="wrap">
  <h1>${esc(title)}</h1>

${sections}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(sheet)} });
  window.__compareHelp({ html: '<b>Every open chat on account ${esc(ACCOUNT)}</b>, a snapshot. '
    + 'Archived, trashed and other accounts are left out. Grouped by the last time <b>you</b> wrote '
    + 'in the chat, not by what the chat did on its own. The + in a card&rsquo;s corner leaves a note.' });

  // Open the chat in Deck Factory. In the app this page is a same-origin
  // iframe, so following the href would load the whole Chats app inside the
  // page viewer — hand the parent the intention instead. The href is the
  // fallback for a browser, and for a chat the registry never heard of.
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a.go') : null;
    if (!a) return;
    try {
      if (window.parent && window.parent !== window
          && typeof window.parent.__openThread === 'function'
          && window.parent.__openThread(a.dataset.chat) === true) {
        e.preventDefault();
      }
    } catch (_) { /* cross-origin — let the link do its job */ }
  }, true);
})();
</script>
`;

  const counts = {};
  chats.forEach((c) => { counts[c.bucket] = (counts[c.bucket] || 0) + 1; });
  process.stderr.write(JSON.stringify(counts) + ` | ${(html.length / 1024).toFixed(0)}KB\n`);
  if (OUT) fs.writeFileSync(OUT, html);
  if (DRY) return;
  if (!CHAT) throw new Error('--chat required to post');
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, session: SESSION, title, html }),
  });
  const j = await r.json();
  console.log(JSON.stringify(j));
  if (j.warnings) console.log('WARNINGS', j.warnings);
})().catch((e) => { console.error(String(e)); process.exit(1); });
