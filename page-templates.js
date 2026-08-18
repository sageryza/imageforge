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
//          optional. Verdict states default to ♥/✕/maybe/later and can be
//          swapped for her own words ('done' / 'in progress') via `states`.
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
//   { id?, label, img?, full?, text?, url?, model?, quality?,
//     promptStyle?, promptContent? }
//
//   img  = the picture (text-only items — a to-do line — use `text` instead)
//   url  = the item's ASSETS-TAB identity. When set (it defaults to `img`
//          when img lives in Firebase/GCS Storage), the page MIRRORS ♥/✕ and
//          notes to the asset votes, so the Assets tab and the page agree —
//          her call, Aug 2026 ("they should agree").
//
// NO HTML ANYWHERE IN `data` — everything renders escaped. That is the
// "forced into the structure" half of the ask, and it is also what makes a
// template page safe to build from a list a chat computed rather than wrote.
//
// groupAssetVariants() is the auto-feed half: exact-same prompt content with
// a differing MODEL · QUALITY caption groups itself (a ladder — objective,
// safe to auto-file); NEAR-identical prompts (the dream-feed case: one or two
// lines changed) are only FLAGGED as candidates, because where a variation
// set starts and stops is the chat's judgement call, not string math
// (Sophie's instinct, Aug 2026, made the rule).
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
  const help = STR(data.help, 600);
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
// Is this deck built from her date cards? The same test judge.js makes on the
// client, needed here because the page's CHROME differs for one (no title of
// its own, one screen, no pill).
function isMomentDeck(template, data) {
  if (template !== 'deck' || !data) return false;
  if (data.style === 'moment') return true;
  return (data.items || []).some((it) => it && !it.pair && !it.card
    && (it.who || it.eyebrow || it.caption || (it.sections && it.sections.length)));
}

function renderTemplatePage({ template, title, chat, sheet, data }) {
  // tour:'auto' — a SERVED template page plays its coach-mark tour once per
  // device (compare.js __compareTour); hand-built pages opt in themselves
  const payload = JSON.stringify({ chat, sheet, tour: 'auto', ...data }).replace(/</g, '\\u003c');
  const mountId = template === 'grid' ? 'grid' : 'judge';
  const tplScript = template === 'grid' ? '/grid.js' : '/judge.js';
  const call = template === 'grid' ? 'window.__grid(window.__pageData)'
    : 'window.__judge(window.__pageData)';
  // NO AUTOSCROLL PILL ON A DECK (Aug 2026, Sophie, on her own date deck:
  // "the auto scroll pill is still there, but it doesn't need to be because
  // the page doesn't scroll at all"). A deck is one card at a time and never
  // scrolls — that is judge.js's whole premise — so the pill was chrome with
  // nothing to drive, sitting over the top-right corner. The grid DOES scroll
  // and keeps its pill. `meta forge-pill` is the pill's own head-safe opt-out.
  const noPill = template === 'deck'
    ? '<meta name="forge-pill" content="off">\n' : '';
  // A MOMENT DECK CARRIES NO TITLE OF ITS OWN (same report: "you added an
  // extra header at the top and very big font"). Her design has no title —
  // the app's own header above the page already shows the page's name, so an
  // <h1> here is the name twice, the second time in 26px serif eating the
  // top third of the screen. The <title> tag still names it everywhere else.
  const h1 = isMomentDeck(template, data) ? '' : `<h1>${esc(title)}</h1>\n`;
  return '<!doctype html>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + noPill
    + `<title>${esc(title)}</title>\n`
    + '<link rel="stylesheet" href="/compare.css">\n'
    + `<div class="wrap">\n${h1}<div id="${mountId}"></div>\n</div>\n`
    + '<script src="/compare.js"></script>\n'
    + `<script src="${tplScript}"></script>\n`
    + `<script>var __pageData = ${payload}; ${call};</script>\n`;
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
function parseCaption(prompt) {
  const m = /^([^·]{1,60}?)\s*·\s*([a-z0-9-]{1,20})$/i.exec(String(prompt || '').trim());
  return m ? { model: m[1].trim(), quality: m[2].trim().toLowerCase() } : null;
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
// caption, promptStyle, promptContent). → { ladders, variants }
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
    const variantOf = (a) => `${(parseCaption(a.prompt) || {}).model || ''}|`
      + `${(parseCaption(a.prompt) || {}).quality || ''}|${normContent(a.promptStyle)}`;
    const distinct = new Map();
    for (const a of group) {
      const v = variantOf(a);
      if (!distinct.has(v)) distinct.set(v, a);   // first of each variant
    }
    if (distinct.size < 2) continue;
    const items = Array.from(distinct.values()).map((a) => {
      const cap = parseCaption(a.prompt) || {};
      return {
        img: a.url,
        url: a.url,
        label: cap.quality || cap.model || a.description || '',
        model: cap.model || '', quality: cap.quality || '',
        promptStyle: a.promptStyle || '', promptContent: a.promptContent || '',
      };
    }).sort((x, y) => {
      const qx = QUALITY_ORDER[x.quality]; const qy = QUALITY_ORDER[y.quality];
      if (qx !== undefined && qy !== undefined) return qx - qy;   // low → high
      return String(x.label).localeCompare(String(y.label));
    });
    ladders.push({ label: key.slice(0, 90), items });
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
  return { ladders, variants };
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

module.exports = {
  TEMPLATES, ASPECTS, validateTemplate, renderTemplatePage, groupAssetVariants,
  parseCaption, normContent, assignVoiceSegments, isMomentDeck,
};
