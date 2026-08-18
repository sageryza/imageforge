// brief.js — THE UPDATE BUTTON (Aug 2026, Sophie: "an update button to the home
// screen of the Deck Factory iOS app that I can just click and then it does an
// API call that gives me the top five things that I might want to be updated
// on, and then maybe some lower priority things, and ideally would also include
// images that chats made or links to compare pages").
//
// One tap → one JSON: five cards at the top, the quieter ones under them, and
// each card carries the pictures that chat made and the Compare pages it posted
// since she last checked it off. It is the answer to "what happened while I was
// away" without opening ~276 threads to find out.
//
// WHY IT IS ITS OWN MODULE and not another route on chatfeed.js: chatfeed is
// 3,200 lines of the Chats APP — the feed, the piles, the registry writes. This
// reads that data and writes NOTHING. Keeping it separate means the ranking can
// be driven by a pure function with fixtures (scripts/test-brief.js) and that a
// mistake here can never touch her chats.
//
// IT COSTS NOTHING AND IT SPENDS NOTHING. No model call — the lines it shows
// were already written by the chats themselves (their Update card's `did`, their
// status card's `need`, their TLDR), so a summary here would be a paraphrase of
// a summary, and a wrong one is worse than none. Four Firestore reads, three of
// them capped, one of them the registry's own 5-minute cache. The response is
// held for 60s so tapping the button twice is free.
//
// THE RANKING, and why each part of it is there:
//   • A `need` is the loudest thing on the list — the chat is BLOCKED on her,
//     and a need she has not seen outranks everything else.
//   • Unseen replies come off `notifSeenAt`, the ✓ in the Chats app, exactly
//     like the Update tab and the widget. So checking a chat off there takes it
//     off this list too, and anything newer brings it back by itself — nothing
//     new to keep in step, and no second "read" state to get out of sync.
//   • Her own filing wins: `pinTop` and `starred` lift, `newsQueue:'later'`
//     sinks, `newsQueue:'never'` drops out. She has already told the app how
//     much she cares; a ranking that ignores that is arguing with her.
//   • Recency is a small bonus (a decaying half-day), never the sort — the
//     point of the button is the important thing, not the latest thing.
//
// WHAT IT DELIBERATELY DOES NOT DO: it never marks anything seen. Reading the
// brief is not checking a chat off — the ✓ is hers, and a button that silently
// cleared her Update tab would lose news she never read.
//
// Mounted at /api/brief by server.js, page at /brief, iOS home button →
// BriefView. STUDIO_TOKEN-gated (only /status is open).
//
// Routes:
//   GET /status            → { ok, firebase }
//   GET /?top=&more=&fresh=1 → { top:[card], more:[card], counts, generatedAt }

const express = require('express');
const admin = require('firebase-admin');
const chatfeed = require('./chatfeed');
const pushGate = require('./push-gate');

const MSGS = 'forge-chat-feed';
const PAGES = 'forge-chat-pages';
const ASSETS = 'forge-chat-assets';

// The reserved registry doc holding feed-wide settings — not a chat.
const SETTINGS_DOC = '__settings';

// How far back each capped read looks. The messages read is the expensive one
// and it only has to reach far enough to find each chat's NEWEST reply; at
// ~125 posts a day, 500 is about four days, and a chat quieter than that has
// nothing new to be updated on by definition.
const SCAN_MSGS = 500;
const SCAN_PAGES = 40;
// 300, measured: at 160 only 5 of 33 cards had a picture to show, because a
// busy day files that many asset records on its own. Small docs, one query.
const SCAN_ASSETS = 300;

// Per card. Three pictures is what fits in a row on her phone without the card
// turning into a gallery; two pages is more than any chat posts in a sitting.
const IMAGES_PER_CARD = 3;
const PAGES_PER_CARD = 3;

const IMG_URL_RE = /\.(?:png|jpe?g|webp|gif)(?:[?#]|$)/i;

function db() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.firestore();
}

function fail(res, err) {
  console.error('[brief]', err && err.message ? err.message : err);
  res.status(String(err && err.message).includes('not configured') ? 503 : 500)
    .json({ error: String(err && err.message || err) });
}

function clean(v, n) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
}

/** ISO string → ms, tolerant of junk. */
function ms(iso) {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : 0;
}

// ---------------------------------------------------------------------------
// THE PURE HALF — everything above this line is plumbing, everything below is
// the decision, and it takes plain objects so scripts/test-brief.js can drive
// the whole ranking with fixtures and no network.
// ---------------------------------------------------------------------------

/** The one line the card shows. */
function cardLine(r, msg) {
  // A need is what she is being asked for — it always wins the line, because a
  // card that says what the chat DID while hiding what it needs is the shape
  // that leaves an ask sitting unanswered for a week.
  const need = clean(r.statusNeed, 200);
  if (need) return need;
  // Then the chat's own Update card: `did` is literally "what I did about what
  // you asked", which is the question this button asks.
  const did = clean(r.updDid, 220);
  if (did) return did;
  // Then the reply's TLDR / its first line that isn't her own question echoed
  // back in bold — the same body rule the push notification uses, for the same
  // reason (see pushBody in push-gate.js).
  const said = msg ? pushGate.pushBody(msg.text, msg.tldr) : '';
  if (said) return clean(said, 220);
  return clean(r.statusDoing, 200);
}

/** Why this card is on the list — the chip she reads first. */
function cardWhy(f) {
  if (f.need) return 'needs you';
  if (f.newPages) return f.newPages > 1 ? 'new pages' : 'new page';
  if (f.unseen) return 'new reply';
  if (f.newImages) return f.newImages > 1 ? 'new pictures' : 'new picture';
  return 'still going';
}

/**
 * The score. Ordering only — the numbers mean nothing on their own, they just
 * have to keep the four things above in the right order relative to each other.
 */
function cardScore(f, r, nowMs) {
  let s = 0;
  // Blocked on her. Unseen matters more than the raw ask: a need she has
  // already read is a reminder, not news.
  if (f.need) s += f.unseen ? 100 : 55;
  if (f.unseen) s += 45;
  // Two new replies is not twice the news, so this flattens fast.
  if (f.news > 1) s += Math.min(12, (f.news - 1) * 4);
  if (f.newPages) s += 30 + Math.min(10, (f.newPages - 1) * 10);
  if (f.newImages) s += 14;
  // Her own filing. `pinTop` is the strongest thing she can say about a chat
  // short of writing in it, so it outranks a star.
  if (r.pinTop) s += 25;
  if (r.starred) s += 15;
  if (r.bookmarked) s += 8;
  if (r.newsQueue === 'soon') s += 10;
  if (r.newsQueue === 'later') s -= 60;
  // Recency: a decaying bonus over half a day, so today floats without the
  // list turning into "newest first" (which is what the feed already is).
  const hours = Math.max(0, (nowMs - f.atMs) / 3600000);
  s += Math.max(0, 26 - hours * 2);
  return Math.round(s);
}

/**
 * Build the whole brief from plain data.
 *
 * @param {object}   input
 * @param {object}   input.chats     registry map, slug → doc
 * @param {object[]} input.messages  feed messages (any order)
 * @param {object[]} input.pages     Compare page docs {id, chat, title, created, superseded}
 * @param {object[]} input.assets    asset docs {chat, url, description, prompt, created, md5, kind}
 * @param {number}   input.now       ms
 * @param {number}   [input.top]     how many top cards (default 5)
 * @param {number}   [input.more]    how many lower-priority cards (default 12)
 */
function buildBrief({ chats, messages, pages, assets, now, top = 5, more = 12 }) {
  const nowMs = now || 0;

  // ---- newest reply per chat, and how many since she last checked it off ----
  // Her OWN messages and live drafts are not news: a draft is a reply still
  // being written (it is re-posted finished moments later), and her message is
  // the thing the news answers.
  const newest = new Map();
  const counted = new Map();
  const sorted = (messages || []).slice().sort((a, b) => ms(b.created) - ms(a.created));
  sorted.forEach((m) => {
    if (!m || !m.chat) return;
    if (m.from === 'sophie' || m.working) return;
    if (!newest.has(m.chat)) newest.set(m.chat, m);
    const seenAt = clean((chats[m.chat] || {}).notifSeenAt, 40);
    if (!seenAt || String(m.created || '') > seenAt) {
      counted.set(m.chat, (counted.get(m.chat) || 0) + 1);
    }
  });

  // ---- Compare pages per chat, newest first ----
  const pagesBy = new Map();
  (pages || []).slice().sort((a, b) => ms(b.created) - ms(a.created)).forEach((p) => {
    if (!p || !p.chat || p.superseded) return;
    const arr = pagesBy.get(p.chat) || [];
    if (arr.length < PAGES_PER_CARD) arr.push(p);
    pagesBy.set(p.chat, arr);
  });

  // ---- pictures per chat, newest first, de-duped ----
  // The join key is the one the Assets tab reaches for first — the Storage
  // object's md5 — so a picture filed twice (once by the chat, once as the
  // hook's copy of the same bytes under a random `claude-deliveries` name)
  // shows once here too. No union-find: this is a three-picture strip, not the
  // tab.
  //
  // MERGING PICKS THE LABELED RECORD, not the newest one. The two copies land
  // seconds apart in whichever order, and the unlabeled twin is always the
  // hook's — so "first one wins" silently strips the label off half the strip,
  // and the label is the whole reason the strip reads as anything.
  const groups = new Map();                     // chat → (key → record)
  (assets || []).forEach((a) => {
    if (!a || !a.chat || !a.url) return;
    if (a.kind === 'audio' || !IMG_URL_RE.test(String(a.url))) return;
    const per = groups.get(a.chat) || new Map();
    const key = a.md5 || a.urlKey || a.url;
    const label = clean(a.description, 120);
    // "from <chat>" is the hook's generic filler, not a MODEL · QUALITY caption
    const caption = /^from /i.test(String(a.prompt || '')) ? '' : clean(a.prompt, 60);
    const at = clean(a.created, 40);
    const prev = per.get(key);
    if (!prev) {
      per.set(key, { url: String(a.url), label, caption, at });
    } else {
      // the copy that carries the words wins the url; the group keeps the
      // newest time, so a re-file still floats the picture up the strip
      if (label && !prev.label) { prev.url = String(a.url); prev.label = label; }
      if (caption && !prev.caption) prev.caption = caption;
      if (ms(at) > ms(prev.at)) prev.at = at;
    }
    groups.set(a.chat, per);
  });
  const imgsBy = new Map();
  groups.forEach((per, chat) => {
    imgsBy.set(chat, Array.from(per.values())
      .sort((a, b) => ms(b.at) - ms(a.at))
      .slice(0, IMAGES_PER_CARD));
  });

  // ---- one card per chat that has anything to say ----
  const cards = [];
  Object.keys(chats || {}).forEach((slug) => {
    if (slug === SETTINGS_DOC) return;
    const r = chats[slug] || {};
    if (r.deletedAt || r.archived || r.movedTo) return;
    if (r.newsQueue === 'never') return;          // "maybe never" — she said so

    const msg = newest.get(slug) || null;
    const chatPages = pagesBy.get(slug) || [];
    const chatImages = imgsBy.get(slug) || [];
    const seenAt = clean(r.notifSeenAt, 40);

    // Everything is measured against the SAME floor as the Update tab's ✓, so
    // checking a chat off there empties its card here.
    const newPages = chatPages.filter((p) => !seenAt || String(p.created || '') > seenAt);
    const newImages = chatImages.filter((i) => !seenAt || String(i.at || '') > seenAt);
    const msgAt = clean(msg && msg.created, 40);
    const unseen = Boolean(msgAt && (!seenAt || msgAt > seenAt));
    const need = clean(r.statusNeed, 200);

    // The newest thing this chat did, whatever kind of thing it was.
    const atMs = Math.max(
      ms(msgAt),
      ms(chatPages[0] && chatPages[0].created),
      ms(chatImages[0] && chatImages[0].at),
      ms(r.statusAt), ms(r.updAt));
    if (!atMs) return;                            // nothing ever happened here

    // A chat she hid stays hidden while nothing newer has landed — the stamp
    // pattern, so hiding is "not now" and never "gone".
    const hiddenAt = clean(r.hiddenAt, 40);
    if ((r.hidden || hiddenAt) && (!hiddenAt || ms(hiddenAt) >= atMs)) return;

    // Nothing new AND nothing being asked for → not an update. A chat with a
    // live `need` stays on the list even when she has seen it: the ask is
    // still open, and that is the whole point of the field.
    if (!unseen && !newPages.length && !newImages.length && !need) return;

    const f = {
      need: Boolean(need),
      unseen,
      news: counted.get(slug) || 0,
      newPages: newPages.length,
      newImages: newImages.length,
      atMs,
    };
    const pinned = r.pinned && r.pinned.url ? {
      url: String(r.pinned.url),
      title: clean(r.pinned.title, 120),
      kind: clean(r.pinned.kind, 20) || 'link',
      // the *current* tag: what's behind it moved in the last thing this chat
      // did (chatfeed's PIN_CURRENT_TURNS rule)
      current: Number(r.pinned.turns || 0) <= 1,
    } : null;

    cards.push({
      chat: slug,
      name: clean(r.displayName, 80) || slug,
      icon: clean(r.icon, 400) || '',
      why: cardWhy(f),
      line: cardLine(r, msg),
      // Her own note is hers — shown, never used as the line, and never
      // written to. It is the where-things-stand line she left herself.
      note: clean(r.sophieNote, 200),
      // The Update card, behind the ⌄ on the page: what she asked for, what
      // the chat did, what's next. The three lines she otherwise reconstructs
      // by reading a whole thread.
      update: (r.updAsked || r.updDid || r.updNext) ? {
        asked: clean(r.updAsked, 300),
        did: clean(r.updDid, 300),
        next: clean(r.updNext, 300),
      } : null,
      doing: clean(r.statusDoing, 200),
      need,
      unseen,
      news: f.news,
      at: new Date(atMs).toISOString(),
      images: newImages.length ? newImages : chatImages.slice(0, IMAGES_PER_CARD),
      newImages: newImages.length,
      pages: (newPages.length ? newPages : chatPages).map((p) => ({
        id: p.id,
        title: clean(p.title, 120) || 'Compare page',
        at: clean(p.created, 40),
        url: `/api/chatfeed/page/${p.id}`,
        isNew: !seenAt || String(p.created || '') > seenAt,
      })),
      pinned,
      score: cardScore(f, r, nowMs),
    });
  });

  cards.sort((a, b) => (b.score - a.score) || (ms(b.at) - ms(a.at)));

  // ONE OF THE FIVE IS HELD FOR SOMETHING TO LOOK AT (measured against her real
  // data 2026-08-17: 24 of 33 cards carried an open `need`, so a pure score sort
  // filled all five with asks and the pictures and Compare pages — half of what
  // she asked this button for — never reached the top of the page at all).
  //
  // It is a RESERVATION, not a re-score: the four highest cards are whatever
  // they are, and only the fifth slot is given to the best card carrying a new
  // page or new pictures. With nothing to look at, the fifth goes back to the
  // next card by score, so a quiet week reads exactly as it did before.
  const hasLook = (c) => c.newImages > 0 || c.pages.some((p) => p.isNew);
  const chosen = cards.slice(0, top);
  if (top >= 3 && !chosen.some(hasLook)) {
    const look = cards.slice(top).find(hasLook);
    if (look) chosen.splice(top - 1, 1, look);
  }
  const rest = cards.filter((c) => chosen.indexOf(c) < 0);
  return {
    generatedAt: new Date(nowMs).toISOString(),
    counts: {
      chats: cards.length,
      needs: cards.filter((c) => c.need).length,
      unseen: cards.filter((c) => c.unseen).length,
      pages: cards.reduce((n, c) => n + c.pages.filter((p) => p.isNew).length, 0),
      images: cards.reduce((n, c) => n + c.newImages, 0),
    },
    top: chosen,
    more: rest.slice(0, more),
  };
}

// ---------------------------------------------------------------------------
// The router
// ---------------------------------------------------------------------------

const router = express.Router();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '1mb' }));

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: Boolean(admin.apps.length) });
});

// A tap on the button must feel instant, and a double tap must cost nothing —
// so the whole answer is held for a minute. `?fresh=1` is the pull-to-refresh.
let cache = null;
let cacheAt = 0;
const CACHE_MS = 60 * 1000;

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const top = Math.min(12, Math.max(1, parseInt(req.query.top, 10) || 5));
    const more = Math.min(40, Math.max(0, parseInt(req.query.more, 10) || 12));
    const key = `${top}:${more}`;
    if (!req.query.fresh && cache && cache.key === key && Date.now() - cacheAt < CACHE_MS) {
      return res.json({ ...cache.body, cached: true });
    }
    const [reg, msnap, psnap, asnap] = await Promise.all([
      chatfeed.registry(),
      db().collection(MSGS).orderBy('created', 'desc').limit(SCAN_MSGS).get(),
      db().collection(PAGES).orderBy('created', 'desc').limit(SCAN_PAGES).get(),
      // Records written before `created` existed are simply absent from an
      // orderBy — fine for a "what's new" strip, which is all this is.
      db().collection(ASSETS).orderBy('created', 'desc').limit(SCAN_ASSETS).get(),
    ]);
    const body = buildBrief({
      chats: reg.chats || {},
      messages: msnap.docs.map((d) => d.data()),
      pages: psnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      assets: asnap.docs.map((d) => d.data()),
      now: Date.now(),
      top,
      more,
    });
    cache = { key, body };
    cacheAt = Date.now();
    res.json(body);
  } catch (err) { fail(res, err); }
});

module.exports = { router, buildBrief, _cardScore: cardScore, _cardWhy: cardWhy, _cardLine: cardLine };
