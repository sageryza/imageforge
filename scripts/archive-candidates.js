#!/usr/bin/env node
// Which live chats look finished? READ-ONLY sweep of the live registry,
// optionally posted as an archive-review deck (Sophie, 2026-09-02: "find
// potential archive candidates").
//
// It measures, it never judges: `archiveHint` is the server's own per-chat
// verdict (chat-sort.js archiveHint — done / dead end / needs you / keep),
// and a chat is HELD off the list by anything that says she is still on it
// (pinTop, starred, tray, an open `need`, a waiting tag, a pending ask).
//
//   node scripts/archive-candidates.js            # print the tiers
//   node scripts/archive-candidates.js --post <chat-slug>
//        posts a deck into that chat's Compare tab with `applyArchive` — her
//        Archive mark on a card archives the chat itself (page-templates.js).
//
// Nothing here archives anything by itself; archiving is hers.
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const QUIET_DAYS = 21;
const DAY = 864e5;

const lastAt = (c) => Math.max(...['repliedAt', 'lastHerAt', 'lastSeen', 'statusAt', 'updAt'].map((k) => Date.parse(c[k] || '') || 0));
const isBug = (c) => (c.labels || []).some((s) => /^bug/.test(String(s).toLowerCase()));
function held(c) {
  const r = [];
  if (c.pinTop) r.push('pinned');
  if (c.starred) r.push('starred');
  if (c.tray) r.push('tray');
  if (c.statusNeed) r.push('need');
  if (c.waitingFor) r.push('waiting');
  if (c.pendingAsk) r.push('open ask');
  if ((c.labels || []).some((s) => /waiting/i.test(s))) r.push('waiting tag');
  return r;
}

function tiers(chats, now = Date.now()) {
  const live = Object.entries(chats).filter(([n, c]) => !c.archived && !c.deletedAt && !c.movedTo && !n.startsWith('__'));
  const rows = live.map(([n, c]) => ({
    slug: n, name: c.displayName || n, hint: c.archiveHint || '', why: c.archiveWhy || '',
    bug: isBug(c), held: held(c), days: lastAt(c) ? Math.round((now - lastAt(c)) / DAY) : null,
    line: c.wrapLine || c.updDid || '', next: c.updNext || '', acct: c.account || '',
  }));
  const free = (r) => !r.held.length && r.hint !== 'needs you';
  return {
    live: rows.length,
    done: rows.filter((r) => r.hint === 'archive' && free(r)),
    bugfix: rows.filter((r) => r.bug && free(r) && r.hint !== 'archive'),
    quiet: rows.filter((r) => free(r) && r.days !== null && r.days >= QUIET_DAYS && r.hint !== 'archive' && !r.bug),
    deadEnd: rows.filter((r) => r.hint === 'dead end' && free(r)),
    empty: rows.filter((r) => r.days === null),
    heldDone: rows.filter((r) => r.hint === 'archive' && r.held.length),
  };
}

function deckItems(t) {
  const card = (r, why) => ({
    id: r.slug, chat: r.slug, who: r.name,
    eyebrow: `${why} · quiet ${r.days}d · account ${r.acct}`,
    text: r.line || '(no wrap-up on file)',
    sections: r.next ? [{ label: 'Where it ended', text: r.next }] : [],
    link: `${BASE}/chats?chat=${encodeURIComponent(r.slug)}`,
  });
  const byOld = (a, b) => b.days - a.days;
  return [
    ...t.done.slice().sort(byOld).map((r) => card(r, 'judged done')),
    ...t.quiet.slice().sort(byOld).map((r) => card(r, 'gone quiet, never judged')),
  ];
}

async function main() {
  const args = process.argv.slice(2);
  const postTo = args.includes('--post') ? args[args.indexOf('--post') + 1] : null;
  const feed = await (await fetch(`${BASE}/api/chatfeed?scan=5000&tail=1&deep=1&deepchats=1`)).json();
  const t = tiers(feed.chats);
  const show = (title, xs) => {
    console.log(`\n== ${title} (${xs.length})`);
    xs.slice().sort((a, b) => (b.days || 0) - (a.days || 0)).forEach((r) => console.log(`${String(r.days ?? '-').padStart(4)}d a${r.acct} ${r.slug} | ${r.name} | ${r.line.slice(0, 80)}`));
  };
  console.log(`live chats: ${t.live}`);
  show('judged done, nothing holding', t.done);
  show('bug-fix tagged, nothing holding (should self-archive when clean)', t.bugfix);
  show(`quiet ${QUIET_DAYS}+ days, never judged`, t.quiet);
  show('dead end (blocked)', t.deadEnd);
  show('empty registry docs (no messages at all)', t.empty);
  console.log(`\njudged done but held (need/pin/star/tray/waiting): ${t.heldDone.length}`);
  if (!postTo) return;
  const items = deckItems(t);
  const data = {
    applyArchive: true, pace: 'quick', stamp: false, start: 'swipe',
    states: [{ key: 'archive', label: 'Archive' }, { key: 'keep', label: 'Keep' }],
    help: 'Each card is a live chat that looks finished. Archive puts it away for real (the chat lands in your archive); Keep leaves it on your list and is the undo. Judged done = the server read the thread and called it finished; gone quiet = nothing has happened there in three weeks.',
    items,
  };
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: postTo, title: `Archive these? — ${items.length} chats`, template: 'deck', data }),
  });
  console.log('posted:', await r.text());
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { tiers, deckItems, held };
