// page-templates.js — the STOCK Compare-page templates (Aug 2026, Sophie:
// "ready-made templates that they can use when it is appropriate and basically
// they will be forced into the structure of a page that's already built").
//
// The Assets tab is fixed and the Compare tab is freeform; this is the middle:
// a chat POSTs /api/chatfeed/page with { template: 'deck'|'grid', data } —
// a JSON list, no HTML — and the SERVER renders the page around it at serve
// time. Two templates:
//
//   deck — the Tinder-style card pager (judge.js underneath): one thing at a
//          time, browse by tapping the card's left/right edges, every action
//          optional. A stock deck wears HER footer — ✕ · ? · ♥ (yes / maybe /
//          no, each with a pile) — and the words can be swapped for her own
//          ('done' / 'in progress') via `states`. A hand-built judge page
//          that never comes through this renderer keeps the four house
//          verdicts (♥/✕/maybe/later).
//   grid — the classic one-variable comparison: each GROUP is one row, 2–6
//          side by side (7+ wraps), labels on top, ♥/✕ + note per item, and
//          the Assets-style PROMPT overlay (content/style split, opens on
//          content, MODEL · QUALITY at the top).
//
// WHY SERVER-RENDERED AT SERVE TIME, not baked at post time: the stock
// renderer is shared code, so a fix or an improvement reaches every template
// page ever posted — the exact opposite of the 15-drafts-of-one-artifact
// churn the survey measured. The DATA is what's frozen per page (new version
// = new page, same as always); the CHROME is always current.
//
// The same items list fits either template — "the feed style and the card
// style can basically take the same input" (Sophie). An item:
//
//   { id?, label, img?, full?, text?, url?, link?, model?, quality?,
//     promptStyle?, promptContent? }
//
//   img  = the picture (text-only items — a to-do line — use `text` instead)
//   chat = the chat this card is about, on an `applyArchive` page (below)
//   link = a way OUT of the card: { url, label } (or a bare url string),
//          rendered as a real anchor in both views. See cleanLink below.
//   url  = the item's ASSETS-TAB identity. When set (it defaults to `img`
//          when img lives in Firebase/GCS Storage), the page MIRRORS ♥/✕ and
//          notes to the asset votes, so the Assets tab and the page agree —
//          her call, Aug 2026 ("they should agree").
//
// NO HTML ANYWHERE IN `data` — everything renders escaped. That is the
// "forced into the structure" half of the ask, and it is also what makes a
// template page safe to build from a list a chat computed rather than wrote.
//
// groupAssetVariants() is the auto-feed half (Aug 2026 v2 — Sophie: "the
// automatic thing doesn't work… if an image is exactly the same except one or
// two variables have been changed, for example the quality, then this should
// automatically file into a compare page"). Three outputs, three confidences:
//   ladders     — exact-same prompt CONTENT, differing MODEL · QUALITY caption
//                 or style half. Objective; the server auto-files these.
//   contentSets — exact-same prompt STYLE, differing content (her dream case:
//                 "a compare page for only images that have the same style
//                 prompt but different dreams"). Also objective; auto-filed.
//   reruns      — the SAME prompt at the same model/quality, drawn more than
//                 once (her grainy-vs-clean pairs, Aug 2026: what differed was
//                 a generation setting nothing ever filed). Objective too —
//                 it claims only "this was drawn twice", never why.
//   variants    — NEAR-identical prompts (a line added or changed). Only ever
//                 FLAGGED, because where a variation set starts and stops is
//                 the chat's judgement call, not string math (her instinct,
//                 Aug 2026, made the rule).
// planAutoPages() turns the objective groups into the per-chat AUTO pages
// the server maintains by itself — see runAutoCompare in chatfeed.js.
//
// Pure on purpose: no Firestore, no fetch — scripts/test-page-templates.js
// drives all of it with fixtures.

const TEMPLATES = ['deck', 'grid'];
// The card-face shapes a page (or one item) can pick between (Aug 2026,
// Sophie: "something should be square, some should be rectangle like story
// fragments, so these should be options they can pick between"). A fixed
// menu, not a free ratio — the same reason the states are a list: options
// keep every deck reading as one system.
//   square    1:1  — a card deck's face (the XI cards)
//   portrait  5:7  — the playing-card / story-fragment rectangle
//   landscape 7:5  — a scene card on its side
const ASPECTS = { square: '1/1', portrait: '5/7', landscape: '7/5' };
const MAX_ITEMS = 500;
const MAX_STATES = 6;
const STR = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const STORAGE_URL = /^https:\/\/(storage\.googleapis\.com|firebasestorage\.googleapis\.com)\//i;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// A stable id beats an index: verdicts key on it, and an id that survives the
// list being re-generated keeps her answers pointed at the same picture (the
// blocks-s96 lesson). Prefer the storage filename; fall back to the label.
function deriveId(item, taken, fallback) {
  let base = '';
  const src = item.url || item.img || '';
  const m = /\/([^/?#]+?)(?:\.[a-z0-9]+)?(?:[?#]|$)/i.exec(src);
  if (m) base = m[1].toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 40);
  if (!base && item.label) base = STR(item.label, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  if (!base) base = fallback;
  let id = base; let n = 2;
  while (taken.has(id)) { id = `${base}-${n}`; n += 1; }
  taken.add(id);
  return id;
}

// `link` accepts a bare url string or { url, label }. The label defaults to
// "Open" rather than showing the url itself — a claude.ai session link is 70
// characters of hex and reads as noise on a card.
const LINK_URL = /^https?:\/\//i;
function cleanLink(raw) {
  if (!raw) return null;
  const bare = typeof raw === 'string';
  if (!bare && typeof raw !== 'object') return null;
  const url = STR(bare ? raw : raw.url, 500);
  if (!LINK_URL.test(url)) return null;
  return { url, label: STR(bare ? '' : raw.label, 60) || 'Open' };
}

function cleanItem(raw, taken, fallback) {
  if (!raw || typeof raw !== 'object') return null;
  const it = {};
  const img = STR(raw.img, 500);
  const text = STR(raw.text, 1500);
  // an item is a picture, words, or the moment card's PARTS (a date card may
  // carry only an eyebrow and its sections — no single `text` at all)
  const parts = ['who', 'eyebrow', 'caption'].some((k) => STR(raw[k], 200))
    || (Array.isArray(raw.sections) && raw.sections.length);
  if (!img && !text && !parts) return null;
  if (img) it.img = img;
  if (text) it.text = text;   // a moment card may carry BOTH words and a picture
  const full = STR(raw.full, 500);
  if (full) it.full = full;
  it.label = STR(raw.label, 200);
  // the Assets-tab identity: explicit url wins; a storage img is its own
  const url = STR(raw.url, 500) || (STORAGE_URL.test(img) ? img : '');
  if (url) it.url = url;
  for (const k of ['model', 'quality']) { const v = STR(raw[k], 60); if (v) it[k] = v; }
  for (const k of ['promptStyle', 'promptContent']) { const v = STR(raw[k], 1500); if (v) it[k] = v; }
  // This picture's only copy was encoded lossily before it reached us. Carried
  // so a freshly built page marks it without waiting for grid.js's live fill;
  // an already-posted page still learns it from the Assets tab at render time.
  if (raw.compressedAtBirth === true) it.compressedAtBirth = true;
  if (ASPECTS[raw.aspect]) it.aspect = raw.aspect;   // one card may differ from its page
  // THE MOMENT CARD — the date card (Aug 2026, Sophie's own design, wired in
  // from her "Decision Deck v2" canvas). Every part is OPTIONAL and a card
  // renders only what it carries: "not all the cards will be used every
  // time… some might have just one text or they might have like a text and
  // an image".
  //   who      the date's name — centred, its own line (lower than the
  //            mockup's header row, her ask)
  //   eyebrow  the small rust line inside the first white box
  //   text     the moment itself, in the serif, same box
  //   sections [{label, text}] — any number of labelled white boxes
  //   caption  an italic quote, under `captionLabel` (default "Caption")
  //   img      a picture, which may sit with any of the above
  for (const k of ['who', 'eyebrow', 'caption', 'captionLabel']) {
    const v = STR(raw[k], 200); if (v) it[k] = v;
  }
  if (Array.isArray(raw.sections)) {
    const secs = [];
    for (const sec of raw.sections.slice(0, 8)) {
      if (!sec || typeof sec !== 'object') continue;
      const label = STR(sec.label, 60), body = STR(sec.text, 1500);
      if (!body) continue;
      secs.push(label ? { label, text: body } : { text: body });
    }
    if (secs.length) it.sections = secs;
  }
  // HER OWN WORDS ABOUT THIS CARD, BEHIND THE "?" (Aug 2026, Sophie, on the
  // commercial survey: "everything I personally said about them behind a
  // question button"). What she dictated about a concept is the reason the
  // concept is on the card at all — but printed on the face it buries the
  // idea it is about, and a second button in the chrome next to the existing
  // "?" is two question marks meaning different things. So it rides the ONE
  // "?" the deck already has: judge.js leads the help card with it whenever
  // the card in front of her carries one. Shape: [{when?, text}] or bare
  // strings, words only — no HTML, escaped at render like everything else.
  if (Array.isArray(raw.said)) {
    const said = [];
    for (const s of raw.said.slice(0, 12)) {
      const body = STR(typeof s === 'string' ? s : (s && s.text), 1500);
      if (!body) continue;
      const when = STR(s && s.when, 40);
      said.push(when ? { when, text: body } : { text: body });
    }
    if (said.length) it.said = said;
  }
  // A WAY OUT OF THE CARD — one link per item (Aug 2026, Sophie: "put them in
  // the compare tab with a link back to the chat"). Template data carries NO
  // HTML by design, so a url written into `text` reaches her as a string she
  // cannot tap — on a phone that is the same as not being there. So the link
  // is a FIELD and the renderer decides what it becomes, which keeps the "no
  // HTML anywhere in data" rule intact.
  //
  // http(s) ONLY, and a bad scheme is DROPPED rather than escaped into an
  // anchor: escaping makes `javascript:…` render harmlessly as text but still
  // leaves it as the href of a real, tappable element. There is no case where
  // a template page needs a non-http link, so the narrow rule is the safe one.
  const link = cleanLink(raw.link);
  if (link) it.link = link;
  // WHICH CHAT THIS CARD IS ABOUT (Aug 2026) — set only on a page that also
  // declares `applyArchive`, where her verdict on the card archives the chat
  // itself. See applyArchive in validateTemplate below for why this is a slug
  // rather than a free-form action.
  const chatSlug = STR(raw.chat, 60).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  if (chatSlug) it.chat = chatSlug;
  it.id = STR(raw.id, 60) || null;
  if (it.id) { if (taken.has(it.id)) return { dup: it.id }; taken.add(it.id); }
  else it.id = deriveId(it, taken, fallback);
  return it;
}

function cleanStates(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out = [];
  for (const s of raw.slice(0, MAX_STATES)) {
    if (!s || typeof s !== 'object') continue;
    // true/false stay booleans (they are what older vote readers understand);
    // anything else is a short string verdict, same as the route stores.
    const key = s.key === true || s.key === false ? s.key : STR(s.key, 24);
    const label = STR(s.label, 24);
    if (key === '' || !label) continue;
    const st = { key, label };
    const glyph = STR(s.glyph, 16);
    if (glyph) st.glyph = glyph;
    out.push(st);
  }
  return out.length >= 2 ? out : null;
}

// validateTemplate('deck'|'grid', data) → { ok:true, data } | { ok:false, error }
function validateTemplate(template, data) {
  if (!TEMPLATES.includes(template)) {
    return { ok: false, error: `unknown template "${template}" — one of: ${TEMPLATES.join(', ')}` };
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'data required' };
  const out = {};
  const taken = new Set();
  const help = STR(data.help, 4000);   // the auto pages list their prompts here
  if (help) out.help = help;
  const states = cleanStates(data.states);
  if (states) out.states = states;
  // the page's card-face shape — see ASPECTS above. Items may override one
  // by one; anything not on the menu keeps the item's natural shape.
  if (ASPECTS[data.aspect]) out.aspect = data.aspect;
  // style:'moment' puts PLAIN text cards into the same serif look; a card
  // carrying who/eyebrow/sections/caption gets it automatically, so most
  // decks never need this flag.
  if (data.style === 'moment') out.style = 'moment';
  // A VERDICT THAT ACTUALLY DOES THE THING (Aug 2026, Sophie — she marked
  // eleven cards "Archive", said "I archived all of them", and NOTHING was
  // archived: the chip recorded an opinion while wearing the name of an
  // action). A page may opt in, and then a card's `archive` verdict archives
  // the chat named by that card's `chat` field, and any other verdict takes
  // it back out. Deliberately ONE action rather than a general "run this on
  // tap" hook: archiving is reversible in a tap and visible on her own list,
  // which is what makes it safe to fire from a card.
  if (data.applyArchive) out.applyArchive = true;
  // WHICH VIEW IT OPENS ON (2026-08-31, Sophie asking for the "tinder
  // version" of a comparison already posted as groups). A page has carried
  // BOTH views since the two were joined, so the template only ever decided
  // the OPENING one — and a groups page could never open on the swipe half,
  // which is exactly a spread deck: one card per subject, its versions side
  // by side. `start` is the only way to say so; anything else falls through
  // to the template's own default, so nothing already posted moves.
  if (data.start === 'swipe' || data.start === 'compare') out.start = data.start;

  if (template === 'deck') {
    if (!Array.isArray(data.items) || !data.items.length) {
      return { ok: false, error: 'deck data needs items: [{ label, img|text, … }]' };
    }
    if (data.items.length > MAX_ITEMS) return { ok: false, error: `too many items (max ${MAX_ITEMS})` };
    out.items = [];
    for (let i = 0; i < data.items.length; i += 1) {
      const it = cleanItem(data.items[i], taken, `card-${i + 1}`);
      if (it && it.dup) return { ok: false, error: `duplicate item id "${it.dup}"` };
      if (!it) return { ok: false, error: `item ${i + 1} has neither img nor text` };
      out.items.push(it);
    }
    if (data.voice) out.voice = true;
    // browse is the deck's whole point — on unless a page turns it off
    out.browse = data.browse === false ? false : true;
    return { ok: true, data: out };
  }

  // grid
  if (!Array.isArray(data.groups) || !data.groups.length) {
    return { ok: false, error: 'grid data needs groups: [{ label?, items: […] }]' };
  }
  let count = 0;
  out.groups = [];
  for (let g = 0; g < data.groups.length; g += 1) {
    const grp = data.groups[g];
    if (!grp || !Array.isArray(grp.items) || !grp.items.length) {
      return { ok: false, error: `group ${g + 1} has no items` };
    }
    const cg = { items: [] };
    const label = STR(grp.label, 200);
    if (label) cg.label = label;
    for (let i = 0; i < grp.items.length; i += 1) {
      count += 1;
      if (count > MAX_ITEMS) return { ok: false, error: `too many items (max ${MAX_ITEMS})` };
      const it = cleanItem(grp.items[i], taken, `g${g + 1}-${i + 1}`);
      if (it && it.dup) return { ok: false, error: `duplicate item id "${it.dup}"` };
      if (!it) return { ok: false, error: `group ${g + 1} item ${i + 1} has neither img nor text` };
      cg.items.push(it);
    }
    out.groups.push(cg);
  }
  return { ok: true, data: out };
}

// The stock page. Everything a Compare page must carry is here BY
// CONSTRUCTION — compare.css (the tokens the pill styles itself from),
// compare.js (tap-pauses-scroll, lightbox, notes), the h1-and-nothing-else
// top, scripts in an IIFE-free single call (grid.js/judge.js are IIFEs
// themselves and __pageData is a var, so nothing collides with the pill's
// globals). kitWarnings never fires on one of these.
// EVERY DECK IS HER DECK NOW (Aug 2026 v3, Sophie: "I think we should just
// make the single image review surface the same general template as the text
// one"). The date cards' chrome — her cream, one screen, the progress line
// with Piles and the "?", her ✕/♥ footer — was the moment deck's alone, and a
// deck of pictures wore the house look instead: a count, three unlabelled
// gold circles, four verdict buttons. Two review surfaces, one of them the one
// she asked for. So the test is simply "is it a deck": judge.js is told
// `look:'mom'` and this says the page carries no <h1> of its own, because her
// design has none and the body is a fixed one-screen box that an h1 would
// push out of.
// (Kept as a named function, and still false for `grid` — that template
// scrolls and keeps the house chrome and its pill.)
function isMomentDeck(template) {
  return template === 'deck';
}

function renderTemplatePage({ template, title, heading, chat, sheet, data, clean }) {
  // tour:'auto' — a SERVED template page plays its coach-mark tour once per
  // device (compare.js __compareTour); hand-built pages opt in themselves
  // look:'mom' — her deck chrome for EVERY deck (see isMomentDeck above). A
  // hand-built judge page (judge-shell.html) never comes through here, so
  // those keep the house look and nothing already posted restyles itself
  // except the template decks, which is the point.
  const look = template === 'deck' ? { look: 'mom' } : {};
  const payload = JSON.stringify({ chat, sheet, tour: 'auto', ...look, ...data })
    .replace(/</g, '\\u003c');
  // NO AUTOSCROLL PILL ON A DECK (Aug 2026, Sophie, on her own date deck:
  // "the auto scroll pill is still there, but it doesn't need to be because
  // the page doesn't scroll at all"). Still true — but a page holds BOTH views
  // now, so it can no longer be said in the head: the deck half must hide the
  // pill and the grid half must have it. page-views.js hides it with the body
  // class instead, per view. The `meta forge-pill` opt-out stays available for
  // any page that really is one screen end to end.
  // A MOMENT DECK CARRIES NO TITLE OF ITS OWN (same report: "you added an
  // extra header at the top and very big font"). Her design has no title —
  // the app's own header above the page already shows the page's name, so an
  // <h1> here is the name twice, the second time in 26px serif eating the
  // top third of the screen. The <title> tag still names it everywhere else.
  // `clean` drops the h1 on ANY template page — the Review Queue's door (Aug
  // 2026, Sophie: "not a compare page because that has a header at the top,
  // but instead just a clean Tinder style page … with all the content
  // preloaded"): a queue tile opens ?clean=1, straight onto the cards.
  // THE PAGE'S OWN HEADING, WHICH THE LISTING'S TITLE IS ALLOWED TO EXCEED
  // (Aug 2026, Sophie, on the auto pages: "the 'auto compare' only needs to
  // appear in the compare tab, not the actual page"). The prefix tells her a
  // page filed itself rather than being made for her — that is a fact about
  // the ROW in the tab, and on the page itself it is a word she is reading
  // for the hundredth time in the biggest type on screen. `<title>` keeps the
  // full name, so the browser tab and any share sheet still carry it.
  const head = String(heading || title || '');
  const h1 = clean || isMomentDeck(template) ? '' : `<h1>${esc(head)}</h1>\n`;
  return '<!doctype html>\n<meta charset="utf-8">\n'
    // maximum-scale=1 — NOT a passing detail (Aug 2026, Sophie's call): iOS
    // auto-zooms the page whenever it focuses a field under 16px, and on a
    // one-screen deck that zoom has nowhere to go. The two ways out are
    // inflating every field to 16px or pinning the scale; she picked the
    // scale, twice, in her own words ("I would prefer not to have pinch
    // [zoom] and for it not to be 16 PX… I don't need pinch zoom"). So the
    // type stays HER size and the page stops zooming itself.
    + '<meta name="viewport" content="width=device-width, initial-scale=1, '
    + 'maximum-scale=1, user-scalable=no, viewport-fit=cover">\n'
    + `<title>${esc(title)}</title>\n`
    + '<link rel="stylesheet" href="/compare.css">\n'
    // ONE PAGE, TWO VIEWS (Aug 2026, Sophie: "the compare page, and tinder
    // swipe shud be TWO views of the the same page, since they have the same
    // content. that way I can swipe back and forth, and see them at full
    // size, rather than opening and closing"). The page carries both mounts
    // and the switch; `template` now only decides which one it OPENS on. The
    // pill is left injected and hidden per view by page-views.js — a deck is
    // one screen and a grid scrolls, and that is a per-view decision the
    // page-level `meta forge-pill off` could not make.
    + `<div class="wrap">\n${h1}<div id="pageviews"></div>\n</div>\n`
    + '<script src="/compare.js"></script>\n'
    // both views open THE Assets-tab lightbox on a picture (heart, note
    // thread, prompt) through the shared adapter
    + '<script src="/asset-lightbox.js"></script>\n'
    + '<script src="/asset-view.js"></script>\n'
    + '<script src="/judge.js"></script>\n'
    + '<script src="/grid.js"></script>\n'
    + '<script src="/page-views.js"></script>\n'
    + `<script>var __pageData = ${payload};`
    + ` window.__pageViews({ data: window.__pageData, start: '${data.start || (template === 'grid' ? 'compare' : 'swipe')}' });`
    + '</script>\n';
}

// ─── The auto-feed half ─────────────────────────────────────────────────────
// "if we produce a high and a medium image, even if they're not produced at
// the same time during the chat, if they both exist in the assets tab then
// they should automatically also be fed into a compare page" (Sophie).
//
// Two different confidences, so two different outputs:
//   ladders  — SAME prompt content (normalized-exact), differing MODEL ·
//              QUALITY caption or prompt style. Objective; safe to auto-file.
//   variants — NEAR-identical prompt content (a line added, a line changed —
//              the dream-feed case). Only ever FLAGGED: the server cannot
//              know where her variation set starts and stops, so the chat
//              reads these and files the page itself.

function normContent(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.\s]+$/g, '').trim();
}

// MODEL · QUALITY out of the curated tile caption ("gpt-image-2 · medium").
// The curated caption a chat files: "gpt-image-2 · medium" until Aug 2026,
// "gpt-image-2 · medium · 2K" since the size became a required third slot.
// BOTH SHAPES PARSE — thousands of two-slot captions are already on file, and
// a caption that stopped parsing does not fail loudly: it falls through to the
// picture's long description, which is exactly the "the caption says
// everything" Sophie reported on the auto-compare sheets.
// THE SIZE SLOT IS NOT ALWAYS A BARE WORD — a panel cut out of a sheet reads
// "1/4 (4K)" (Sophie: "1/4 panel could say 1/4 (4k)"), so the slot has to
// allow a slash, a space and parentheses. It shipped as [a-z0-9x×] and the
// whole caption then failed to parse on exactly the pictures this rule was
// built for: the four quarters lost their size off the row and fell through
// to their style line, which is the silent-fallthrough failure the comment
// above already warns about. Measured on her live ladders page.
function parseCaption(prompt) {
  const m = /^([^·]{1,60}?)\s*·\s*([a-z0-9-]{1,20})(?:\s*·\s*([a-z0-9x×/() ]{1,20}))?$/i
    .exec(String(prompt || '').trim());
  if (!m) return null;
  return {
    model: m[1].trim(),
    quality: m[2].trim().toLowerCase(),
    size: m[3] ? m[3].trim().toUpperCase() : '',
  };
}

// WHAT ACTUALLY CHANGED, AND NOTHING ELSE (Aug 2026, Sophie: "the auto compare
// sheets shud say the diff (e.g. the resolution) and nothing else, in their
// pre-lightbox caption"). Across one group, only the caption fields that VARY
// are worth printing: three tiles all drawn at medium learn nothing from three
// rows reading "medium", and the row that differs only in size must say the
// size rather than the quality it shares with its siblings. Returns '' when no
// caption field varies, so the caller falls through to the style diff — the
// order the sheet already used.
// In the caption's own order (model · quality · size), so a diff row reads as
// a shortened caption rather than a re-ordered one. When only the size varies
// it is the whole row, which is her example.
const CAPTION_PARTS = ['model', 'quality', 'size'];
function varyingCaptionParts(items) {
  return CAPTION_PARTS.filter((k) =>
    new Set(items.map((i) => i[k] || '')).size > 1);
}
function captionDiff(item, parts) {
  return parts.map((k) => item[k]).filter(Boolean).join(' · ');
}

// The two lines under a tile say WHAT CHANGED — not everything the filing
// chat packed into the description ("Monkeys, Money, and Bananas (343 chars
// verbatim) — same prompt as the monkey run, only the dream changed — dream
// mystery" is a real one; Sophie, 2026-08-19: "the titles are way too long").
// Keep the name: the part before the first " — ", trailing parenthetical off.
// The full description still reads in the lightbox, which shows the item as
// the Assets tab filed it.
function shortLabel(s) {
  return String(s || '').split(' — ')[0].replace(/\s*\([^)]*\)\s*$/, '').trim().slice(0, 80);
}

// The half of a filed description that comes AFTER the picture's name — what
// the chat wrote to tell this one from its siblings ("drawn again with no webp
// compression"). The trailing style tag ("— dream mystery") is dropped: it is
// the same on every image in a set, so it can never be the differing half.
function labelTail(s) {
  const parts = String(s || '').split(' — ').map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts[1].slice(0, 80) : '';
}

// The first style segment this variant does NOT share with the row's others —
// the honest "what changed" for a style-differing ladder. Segments split on
// newlines, else on sentence marks (the same rule grid.js highlights by).
function styleSegs(s) {
  s = String(s || '');
  const parts = /\n/.test(s) ? s.split(/\n+/) : (s.match(/[^.;]+[.;]*\s*/g) || [s]);
  return parts.map((x) => x.trim()).filter(Boolean);
}
// For a LABEL in a group of many, "differs from someone" is too weak a test —
// in a five-way set nearly every line differs from someone, so three variants
// all get handed the same shared first paragraph (found 2026-08-19: five tiles
// reading the same words). The label wants the line that is this variant's
// ALONE.
function uniqueStyleLine(own, others) {
  const otherSets = others.map((o) => new Set(styleSegs(o).map(normContent)));
  for (const seg of styleSegs(own)) {
    const n = normContent(seg);
    if (n && !otherSets.some((set) => set.has(n))) {
      return seg.replace(/[.;\s]+$/, '').slice(0, 80);
    }
  }
  return '';
}

function diffStyleLine(own, others) {
  const otherSets = others.map((o) => new Set(styleSegs(o).map(normContent)));
  for (const seg of styleSegs(own)) {
    const n = normContent(seg);
    if (n && !otherSets.every((set) => set.has(n))) {
      return seg.replace(/[.;\s]+$/, '').slice(0, 80);
    }
  }
  return '';
}

function tokens(s) {
  return new Set(normContent(s).split(/[^a-z0-9']+/).filter((w) => w.length > 2));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

const QUALITY_ORDER = { low: 0, medium: 1, high: 2 };

// assets: the rows GET /api/gallery/assets returns (url, description, prompt
// caption, promptStyle, promptContent). → { ladders, contentSets, variants }
function itemOf(a) {
  const cap = parseCaption(a.prompt) || {};
  return {
    img: a.url,
    url: a.url,
    label: cap.quality || cap.model || a.description || '',
    model: cap.model || '', quality: cap.quality || '', size: cap.size || '',
    promptStyle: a.promptStyle || '', promptContent: a.promptContent || '',
    compressedAtBirth: a.compressedAtBirth === true,
    ms: Number(a.ms) || 0,   // used by planAutoPages' newest-first cap;
                             // validateTemplate's cleanItem drops it
  };
}

function groupAssetVariants(assets) {
  const usable = (assets || []).filter((a) => a && a.url && a.kind !== 'audio'
    && normContent(a.promptContent));
  const byContent = new Map();
  for (const a of usable) {
    const key = normContent(a.promptContent);
    if (!byContent.has(key)) byContent.set(key, []);
    byContent.get(key).push(a);
  }

  const ladders = [];
  for (const [key, group] of byContent) {
    if (group.length < 2) continue;
    // the one differing variable is what earns a row: a caption that differs
    // (quality/model) or a style half that differs. Identical everything is
    // a re-roll, not a comparison.
    const variantOf = (a) => {
      const c = parseCaption(a.prompt) || {};
      // SIZE is part of the variant key (Aug 2026): without it the same prompt
      // drawn at 2K and at 4K reads as one variant, the group drops below two
      // and the comparison she asked for never appears at all.
      return `${c.model || ''}|${c.quality || ''}|${c.size || ''}|${normContent(a.promptStyle)}`;
    };
    const distinct = new Map();
    for (const a of group) {
      const v = variantOf(a);
      if (!distinct.has(v)) distinct.set(v, a);   // first of each variant
    }
    if (distinct.size < 2) continue;
    const items = Array.from(distinct.values()).map(itemOf).sort((x, y) => {
      const qx = QUALITY_ORDER[x.quality]; const qy = QUALITY_ORDER[y.quality];
      if (qx !== undefined && qy !== undefined) return qx - qy;   // low → high
      return String(x.label).localeCompare(String(y.label));
    });
    // THE ROW SAYS THE DIFF AND NOTHING ELSE (Aug 2026, her ask). Only the
    // caption fields that actually vary across this group are printed — size
    // first, because that is the one she named and the one a shared "medium"
    // was hiding. `itemOf` seeded `label` with the quality, which is wrong the
    // moment quality is the thing they share.
    const capParts = varyingCaptionParts(items);
    if (capParts.length) {
      items.forEach((it) => { it.label = captionDiff(it, capParts) || it.label; });
    }
    // size first when it is the only thing that changed is automatic — the
    // filter keeps only what varies, so a size-only group's row IS the size.
    // when the differing variable is the STYLE, the caption words repeat
    // ("medium" · "medium") and say nothing — the line under the tile is the
    // style segment this variant does not share, i.e. what actually changed
    // WHEN THE CAPTION ALREADY SAYS IT, THAT IS THE WHOLE ROW (Sophie,
    // 2026-08-23, looking at the cut panels: "make it shorter"). The four
    // quarters read "1/4 (4K) · (this picture is the top-left quarter of the
    // 2336x3504 sheet above, cut locally" — the tail after the dot is the same
    // fact again in longhand, and it is the part that runs off the tile.
    // A style line is only appended where the caption diff would leave two
    // rows in this group reading the SAME thing, which is the one case it is
    // actually carrying information ("medium · watercolour" vs
    // "medium · gouache"). Everywhere else the diff stands alone.
    const capLabel = new Map(items.map((it) => [it, captionDiff(it, capParts)]));
    const capCount = {};
    items.forEach((it) => { const c = capLabel.get(it); if (c) capCount[c] = (capCount[c] || 0) + 1; });
    const capTellsApart = (it) => {
      const c = capLabel.get(it);
      return Boolean(c) && capCount[c] === 1;
    };
    const styleSet = new Set(items.map((i) => normContent(i.promptStyle)));
    if (styleSet.size > 1) {
      const capsVary = capParts.length > 0;
      const allStyles = items.map((i) => i.promptStyle);
      items.forEach((it, idx) => {
        // the caption already tells this row apart from every sibling — done
        if (capsVary && capTellsApart(it)) return;
        const d = uniqueStyleLine(it.promptStyle, allStyles.filter((_, j) => j !== idx));
        if (d) {
          const pre = capsVary ? captionDiff(it, capParts) : '';
          it.label = pre ? `${pre} · ${d}` : d;
          return;
        }
        // no line of its own (every line shared with SOME sibling): the chat's
        // own words beat a bare "medium" sitting among four style lines
        const a = Array.from(distinct.values()).find((x) => x.url === it.url);
        const tail = a && labelTail(a.description);
        if (tail) it.label = tail;
      });
    }
    // STILL-DUPLICATE LABELS (found 2026-08-19 on her live ladders page: five
    // tiles all reading "Last-Minute Halloween Party", which says nothing
    // about what changed). Fall through the sources in order of how well each
    // distinguishes: the chat's own tail first — that is the half it wrote to
    // tell the siblings apart — then the picture's short name, and only then
    // the draw order. Each step is tried only while the labels still collide.
    const src = Array.from(distinct.values());
    const rowOf = (it) => src.find((a) => a.url === it.url);
    const collide = () => new Set(items.map((i) => i.label)).size < items.length;
    if (collide()) {
      items.forEach((it) => {
        const a = rowOf(it);
        const tail = a && labelTail(a.description);
        if (tail) it.label = tail;
      });
    }
    if (collide()) {
      // two takes of one prompt through DIFFERENT style references read alike
      // until you reach the ref's name, which her labels carry last
      items.forEach((it) => {
        const a = rowOf(it);
        const parts = String((a && a.description) || '').split(' — ').map((x) => x.trim());
        if (parts.length > 2) it.label = `${it.label.slice(0, 58)} · ${parts[parts.length - 1]}`;
      });
    }
    if (collide()) {
      items.forEach((it) => {
        const a = rowOf(it);
        if (a && a.description) it.label = shortLabel(a.description) || it.label;
      });
    }
    if (collide()) items.forEach((it, i) => { it.label = `Draw ${i + 1}`; });
    ladders.push({ label: key.slice(0, 90), items });
  }

  // SAME STYLE, DIFFERENT SUBJECTS (Aug 2026, Sophie's dream-illustration
  // case): images whose STYLE half matches exactly while the content differs
  // — one style walked across many dreams. One distinct content per item
  // (a re-roll or a quality rung of the same content is already a ladder row,
  // not a second subject), newest kept, displayed short → long content so a
  // length-ladder test reads in order.
  const byStyle = new Map();
  for (const a of usable) {
    const sk = normContent(a.promptStyle);
    if (!sk) continue;   // "same style" is only provable when a style is filed
    if (!byStyle.has(sk)) byStyle.set(sk, []);
    byStyle.get(sk).push(a);
  }
  const contentSets = [];
  for (const [sk, group] of byStyle) {
    const distinct = new Map();
    for (const a of group) {
      const ck = normContent(a.promptContent);
      if (!distinct.has(ck)) distinct.set(ck, a);   // rows arrive newest-first
    }
    if (distinct.size < 2) continue;
    const items = Array.from(distinct.values()).map((a) => {
      const it = itemOf(a);
      // what changed inside a same-style row is the SUBJECT — its name, short
      it.label = shortLabel(a.description)
        || String(a.promptContent || '').slice(0, 60);
      return it;
    });
    const firstLine = String(group[0].promptStyle || '').split(/\n/)[0].trim();
    contentSets.push({ label: firstLine.slice(0, 90) || sk.slice(0, 90), items });
  }

  // SAME PROMPT, DRAWN AGAIN (Aug 2026, Sophie: "the dream feed chat now has
  // grainy and non-grainy images, can we make this auto trigger compare
  // page"). Those pairs are identical on every FILED field — same content,
  // same style, same MODEL · QUALITY — because what differed was
  // `output_compression`, a generation setting nothing ever recorded. The
  // ladder rule above deliberately drops them ("identical everything is a
  // re-roll, not a comparison"), and that rule is right about what it can
  // SEE; it was wrong that she never wants to see them side by side. So the
  // repeats get their own page rather than a guess about why they differ:
  // no inference, just "this prompt was drawn more than once, here they are".
  // Order is the order they were drawn, so the set reads as its own history.
  const reruns = [];
  for (const [key, group] of byContent) {
    if (group.length < 2) continue;
    const sameEverything = new Map();
    for (const a of group) {
      const k = `${(parseCaption(a.prompt) || {}).model || ''}|`
        + `${(parseCaption(a.prompt) || {}).quality || ''}|${normContent(a.promptStyle)}`;
      if (!sameEverything.has(k)) sameEverything.set(k, []);
      sameEverything.get(k).push(a);
    }
    for (const takes of sameEverything.values()) {
      if (takes.length < 2) continue;
      const items = takes.slice().sort((x, y) => (Number(x.ms) || 0) - (Number(y.ms) || 0))
        .map((a, i) => {
          const it = itemOf(a);
          // the NAMES are identical here by construction, so the half that
          // tells them apart is whatever the filing chat wrote after it
          it.label = labelTail(a.description) || `Draw ${i + 1}`;
          return it;
        });
      // a tail that says nothing different is no label at all — number them
      if (new Set(items.map((i) => i.label)).size < items.length) {
        items.forEach((it, i) => { it.label = `Draw ${i + 1}`; });
      }
      reruns.push({ label: key.slice(0, 90), items });
    }
  }

  // near-duplicates across DIFFERENT content keys → flagged candidates
  const keys = Array.from(byContent.keys());
  const toks = keys.map((k) => tokens(k));
  const parent = keys.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      if (jaccard(toks[i], toks[j]) >= 0.55) parent[find(i)] = find(j);
    }
  }
  const clusters = new Map();
  keys.forEach((k, i) => {
    const r = find(i);
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r).push(k);
  });
  const variants = [];
  for (const cluster of clusters.values()) {
    if (cluster.length < 2) continue;
    variants.push({
      reason: `${cluster.length} near-identical prompts — likely one variation set`,
      prompts: cluster.map((k) => k.slice(0, 200)),
      items: cluster.flatMap((k) => byContent.get(k).map((a) => ({
        img: a.url, url: a.url, label: a.description || '',
        promptStyle: a.promptStyle || '', promptContent: a.promptContent || '',
      }))),
    });
  }
  return { ladders, contentSets, reruns, variants };
}

// ─── The AUTO pages the server keeps by itself ──────────────────────────────
// Two standing grid pages per chat, one per objective grouping, updated in
// place as prompts and captions get filed (runAutoCompare in chatfeed.js).
// Item ids derive from storage filenames, so a new image joining a group can
// never re-point her saved answers — that is what makes updating in place
// safe here where "a new version is a new page" protects every other page.
// Caps are NAMED, never silent: a trimmed group says so on its row, and the
// group count cap rides in the page's "?" help.
//
// NOTHING LONG ABOVE THE FIRST PICTURE (Aug 2026, Sophie, on the live page:
// "the title is way too long… the text that is currently [bold] should be
// hidden behind the (?)"). A group's real header here IS a prompt — a style
// block or a whole dictated dream — and it sat between her title and the
// pictures in gold caps, which is exactly the shape the house rule forbids.
// So a row wears a SHORT tag ("Style 1"), the prompts are listed behind the
// "?" against those tags, and a page with a single group wears no tag at all.
const AUTO_GROUPS_MAX = 12;
const AUTO_LADDER_ITEMS = 12;
const AUTO_SET_ITEMS = 24;
const AUTO_HELP_PROMPT = 150;   // per prompt line in the "?" card

// The newest `itemCap` of an over-long group, with what was dropped kept as a
// `note` rather than glued onto the label — the tag is composed below.
function capGroups(groups, itemCap) {
  return groups.slice(0, AUTO_GROUPS_MAX).map((g) => {
    if (g.items.length <= itemCap) return { text: g.label, items: g.items };
    const items = g.items.slice().sort((x, y) => (y.ms || 0) - (x.ms || 0)).slice(0, itemCap);
    return { text: g.label, items, note: `newest ${itemCap} of ${g.items.length}` };
  });
}

// Short tags on the rows, the real text behind the "?". `word` is what one
// group IS on this page ("Style" / "Prompt").
function tagGroups(capped, word) {
  const single = capped.length === 1;
  const groups = capped.map((g, i) => {
    const tag = single ? '' : `${word} ${i + 1}`;
    const label = [tag, g.note].filter(Boolean).join(' · ');
    return label ? { label, items: g.items } : { items: g.items };
  });
  const lines = capped.map((g, i) => {
    const text = String(g.text || '').replace(/\s+/g, ' ').trim().slice(0, AUTO_HELP_PROMPT);
    if (!text) return '';
    // escaped: `help` is rendered as HTML by the "?" card, and this text is a
    // model prompt nobody vetted for angle brackets
    return `<b>${esc(single ? word : `${word} ${i + 1}`)}</b> — ${esc(text)}`;
  }).filter(Boolean);
  return { groups, lines };
}

// planAutoPages(assets) → [{ kind, title, heading, data }] — pure; empty when
// nothing groups. `title` is the name the Compare TAB lists (it carries the
// "Auto-compare" prefix, which is how she tells a page that filed itself from
// one a chat made for her); `heading` is the page's own <h1>, which does not
// (her call, Aug 2026). Display order inside a content set is short → long
// content (her threshold-ladder tests read in order); the cap keeps the
// NEWEST first.
function planAutoPages(assets) {
  const { ladders, contentSets, reruns } = groupAssetVariants(assets);
  const plans = [];
  const capNote = (n) => (n > AUTO_GROUPS_MAX
    ? ` Showing the first ${AUTO_GROUPS_MAX} of ${n} groups.` : '');
  if (ladders.length) {
    const { groups, lines } = tagGroups(capGroups(ladders, AUTO_LADDER_ITEMS), 'Prompt');
    plans.push({
      kind: 'ladders',
      title: 'Auto-compare — same prompt, settings changed',
      heading: 'Same prompt, settings changed',
      data: {
        help: 'Filed automatically: images whose content prompt matches exactly '
          + 'while a setting differs — quality, model, or the style half. New '
          + 'variants join by themselves, and hearts, passes and notes land on '
          + 'the Assets tab too.' + capNote(ladders.length)
          + (lines.length ? `<br><br>${lines.join('<br><br>')}` : ''),
        groups,
      },
    });
  }
  if (contentSets.length) {
    const capped = capGroups(contentSets, AUTO_SET_ITEMS).map((g) => ({
      text: g.text, note: g.note,
      items: g.items.slice().sort((x, y) => {
        const lx = String(x.promptContent || '').length;
        const ly = String(y.promptContent || '').length;
        return lx !== ly ? lx - ly : String(x.label).localeCompare(String(y.label));
      }),
    }));
    const { groups, lines } = tagGroups(capped, 'Style');
    plans.push({
      kind: 'subjects',
      title: 'Auto-compare — same style, different subjects',
      heading: 'Same style, different subjects',
      data: {
        help: 'Filed automatically: images that share the exact same style '
          + 'prompt with different subjects, shortest content first. New images '
          + 'join by themselves; PROMPT on any picture shows its exact text.'
          + capNote(contentSets.length)
          + (lines.length ? `<br><br>${lines.join('<br><br>')}` : ''),
        groups,
      },
    });
  }
  if (reruns.length) {
    const { groups, lines } = tagGroups(capGroups(reruns, AUTO_LADDER_ITEMS), 'Prompt');
    plans.push({
      kind: 'reruns',
      title: 'Auto-compare — same prompt, drawn again',
      heading: 'Same prompt, drawn again',
      data: {
        help: 'Filed automatically: one prompt drawn more than once at the same '
          + 'model and quality, in the order they were drawn. Nothing on record '
          + 'says why two takes differ — only that they are the same prompt — so '
          + 'the line under each is whatever the chat wrote to tell them apart.'
          + capNote(reruns.length)
          + (lines.length ? `<br><br>${lines.join('<br><br>')}` : ''),
        groups,
      },
    });
  }
  return plans;
}

// ─── Hands-free voice: who was she talking about? ───────────────────────────
// The deck's hands-free mode (Aug 2026, gated on her live mic probe — passed
// 2026-08-17 on her iPhone, in-app): ONE recording runs while she swipes; the
// page logs when each card came up ({item, at} ms offsets); whisper returns
// SENTENCE-ish segments with start times; and each segment belongs to the
// card that was showing WHEN THE SENTENCE STARTED — she starts talking about
// a card while looking at it, so a sentence finished over the next card
// still lands on the one she meant. Pure, so the attribution rule — the part
// that would be annoying to get wrong — is pinned by tests.
//   segments: [{ start (sec), text }], timeline: [{ item, at (ms) }]
//   → { <item>: 'joined text' } (cards she said nothing on are absent)
function assignVoiceSegments(segments, timeline) {
  const tl = (timeline || [])
    .filter((e) => e && e.item !== undefined && Number.isFinite(Number(e.at)))
    .map((e) => ({ item: String(e.item), at: Number(e.at) }))
    .sort((a, b) => a.at - b.at);
  if (!tl.length) return {};
  const out = {};
  for (const s of segments || []) {
    const text = String((s && s.text) || '').trim();
    if (!text) continue;
    const t = Number(s.start || 0) * 1000;
    let card = tl[0].item;
    for (const e of tl) { if (e.at <= t) card = e.item; else break; }
    out[card] = out[card] ? `${out[card]} ${text}` : text;
  }
  return out;
}

/**
 * The page's item→chat map, for the server to apply verdicts against.
 * Kept on the PAGE DOC rather than read out of the Storage payload on every
 * tap: the payload is a download, the doc is a small cached read, and a tap
 * must not cost her a round trip to a bucket.
 * Empty unless the page opted in — an item's `chat` alone never acts.
 */
function archiveMapOf(data) {
  const out = {};
  if (!data || !data.applyArchive) return out;
  const all = (data.items || []).concat(
    ...(data.groups || []).map((g) => g.items || []),
  );
  all.forEach((it) => { if (it && it.chat) out[it.id] = it.chat; });
  return out;
}

module.exports = {
  TEMPLATES, ASPECTS, validateTemplate, archiveMapOf, renderTemplatePage, groupAssetVariants,
  planAutoPages, parseCaption, normContent, assignVoiceSegments, isMomentDeck,
};
