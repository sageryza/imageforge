// alibaba-quotes.js — sort a pile of Alibaba supplier quotations with Claude.
//
// Sophie is the BUYER (2026-09-02: "buyer. i need help sorting various
// quotations from different vendors"). Nothing off the shelf reads an Alibaba
// inbox — docs/alibaba-messages-research.md is the measured state — so the
// quotes reach us as SCREENSHOTS (a Photos album sent through the Dump) or as
// pasted text, and this module does the sorting:
//
//   extract  → one Claude call per quote (vision or text) pulls the numbers off
//              it into ONE fixed shape. Only what the quote SAYS — a field the
//              quote does not state is null, never a guess, because a wrong MOQ
//              in front of her is worse than a blank one (the MODEL · QUALITY
//              caption's own rule).
//   rank     → pure. Unit price at HER quantity (the highest tier at or under
//              it), landed per unit when the quote priced shipping, unknowns
//              last, cheaper MOQ breaking a tie.
//   deck     → pure. The stock `deck` template — her own moment-card design —
//              one card per vendor with the screenshot on it so she can check
//              the numbers against the source, the draft reply as the caption,
//              and a ranking card first. Her ✕/♥ are the sort: the piles view
//              is the shortlist.
//
// WHICH MODEL: claude-opus-5, deliberately above the house writing default.
// This is reading prices, MOQs and lead times off phone screenshots of a chat,
// where a misread digit silently changes which vendor wins — the Story
// Timeline's beat-out makes the same call for the same reason. ~3¢ a quote.
//
// The CLI is scripts/alibaba-quotes.js; the pure half is tested by
// scripts/test-alibaba-quotes.js with no network.

const claude = require('./anthropic');

const MODEL = process.env.ALIBABA_QUOTES_MODEL || 'claude-opus-5';

// The one shape every quote is read into. Kept as text so the prompt and the
// normaliser can never disagree about a field's name.
const SHAPE = `{
  "vendor": "the company or contact name exactly as shown, or \\"\\" if not visible",
  "product": "what is being quoted, in the vendor's words",
  "currency": "USD unless the quote says otherwise",
  "tiers": [{"qty": 500, "unit": 1.25}],
  "moq": 500,
  "leadDays": 15,
  "shipping": {"method": "", "cost": null, "days": null, "to": ""},
  "sample": {"cost": null, "days": null, "note": ""},
  "payment": "",
  "specs": "",
  "customization": "",
  "flags": [],
  "missing": [],
  "reply": ""
}`;

const SYSTEM = `You are reading a supplier's quotation sent to a BUYER on Alibaba.com — a screenshot of the chat or the pasted text of it. Pull the quotation into exactly this JSON shape:

${SHAPE}

Rules:
- Only what the quote SAYS. A number the quote does not state is null; a text field it does not state is "". Never estimate, never fill in a typical value.
- "tiers" is every price/quantity pair in the quote, ascending by qty, unit price as a plain number in the quote's currency. A single price with no quantity is one tier at the MOQ (or qty null if there is no MOQ either).
- "moq" is the minimum order quantity as a number of units. "leadDays" is the production lead time in days — convert "2-3 weeks" to the upper bound in days (21). Shipping and sample days the same way.
- "shipping.cost" is a number only when the quote prices shipping; the method (DHL, sea, express…) and destination as written.
- "flags": anything a careful buyer would notice — a price that excludes something, vague or conditional pricing, unusual payment terms, a lead time that depends on something, a mismatch between two numbers in the quote. One short line each. Empty list if nothing.
- "missing": what a buyer needs that this quote does not state (MOQ, lead time, shipping, sample terms, material, print method, packaging…). Short labels.
- "reply": a short, friendly, plain reply to the vendor — two to five sentences — thanking them and asking ONLY for the things in "missing" (and any flag worth clarifying). No made-up quantities. Written by the buyer, first person, no sign-off name.`;

// Read one quote. `src` is { url } (a public image url — a Dump file), { file,
// bytes, mime } (an image in hand), or { text } (pasted words). One call each;
// a refusal or a malformed answer throws rather than filing a half-read quote.
async function extractQuote(src, { model = MODEL } = {}) {
  const content = [];
  if (src.url) content.push({ type: 'image', source: { type: 'url', url: src.url } });
  else if (src.bytes) {
    content.push({ type: 'image', source: {
      type: 'base64', media_type: src.mime || 'image/png',
      data: Buffer.from(src.bytes).toString('base64'),
    } });
  }
  const ask = src.text
    ? `Here is the quotation as text:\n\n${src.text}\n\nRead it into the shape.`
    : 'Read the quotation in this screenshot into the shape. If the screenshot holds more than one vendor, read the one that quoted a price; if none quoted a price, fill what you can and say so in flags.';
  content.push({ type: 'text', text: ask });
  const raw = await claude.chatJSON({ system: SYSTEM, messages: [{ role: 'user', content }], model, maxTokens: 3000 });
  return normQuote(raw, src);
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v
  : (typeof v === 'string' && v.trim() && Number.isFinite(Number(v.replace(/[^0-9.\-]/g, '')))) ? Number(v.replace(/[^0-9.\-]/g, '')) : null;
const str = (v, n = 400) => (v == null ? '' : String(v)).trim().slice(0, n);
const list = (v, n = 8) => (Array.isArray(v) ? v : (v ? [v] : [])).map((s) => str(s, 200)).filter(Boolean).slice(0, n);

// The model's answer, forced into the shape — so a stray string where a number
// belongs, or a tier list out of order, cannot reach the ranking.
function normQuote(raw, src = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const tiers = (Array.isArray(r.tiers) ? r.tiers : [])
    .map((t) => ({ qty: num(t && t.qty), unit: num(t && t.unit) }))
    .filter((t) => t.unit != null && t.unit >= 0)
    .sort((a, b) => (a.qty == null) - (b.qty == null) || (a.qty || 0) - (b.qty || 0));
  const ship = r.shipping && typeof r.shipping === 'object' ? r.shipping : {};
  const samp = r.sample && typeof r.sample === 'object' ? r.sample : {};
  return {
    vendor: str(r.vendor, 120),
    product: str(r.product, 200),
    currency: str(r.currency, 8) || 'USD',
    tiers,
    moq: num(r.moq),
    leadDays: num(r.leadDays),
    shipping: { method: str(ship.method, 80), cost: num(ship.cost), days: num(ship.days), to: str(ship.to, 80) },
    sample: { cost: num(samp.cost), days: num(samp.days), note: str(samp.note, 200) },
    payment: str(r.payment, 200),
    specs: str(r.specs, 400),
    customization: str(r.customization, 300),
    flags: list(r.flags),
    missing: list(r.missing),
    reply: str(r.reply, 1200),
    img: src.url || '',
    source: src.name || src.url || (src.text ? 'text' : ''),
  };
}

// ── ranking, pure ───────────────────────────────────────────────────────────

// The unit price this vendor charges at `qty`: the highest tier at or under
// it. Below every tier the smallest tier stands (that is what she would pay),
// flagged `belowMoq` when it is also under the MOQ. No tiers → null.
function unitAt(q, qty) {
  const tiers = (q.tiers || []).filter((t) => t.unit != null);
  if (!tiers.length) return { unit: null, tier: null, belowMoq: false };
  const priced = tiers.filter((t) => t.qty != null);
  let tier;
  if (qty == null || !priced.length) tier = tiers[0];
  else tier = priced.filter((t) => t.qty <= qty).pop() || priced[0];
  const belowMoq = qty != null && q.moq != null && qty < q.moq;
  return { unit: tier.unit, tier, belowMoq };
}

// Per-unit cost with shipping folded in, when the quote priced shipping and
// there is a quantity to spread it over. Otherwise the unit price alone —
// and `landed:false` says so, so the card never claims a total it lacks.
function landedAt(q, qty) {
  const u = unitAt(q, qty);
  if (u.unit == null) return { ...u, landed: null, hasShipping: false };
  const ship = q.shipping && q.shipping.cost;
  const n = qty || (u.tier && u.tier.qty) || q.moq;
  if (ship != null && n) return { ...u, landed: u.unit + ship / n, hasShipping: true, qtyUsed: n };
  return { ...u, landed: u.unit, hasShipping: false, qtyUsed: n || null };
}

// Cheapest first. A quote with no price sorts last; equal prices break on the
// lower MOQ (easier to try), then the shorter lead time.
function rankQuotes(quotes, qty) {
  const rows = quotes.map((q, i) => ({ q, i, ...landedAt(q, qty) }));
  rows.sort((a, b) => {
    if ((a.landed == null) !== (b.landed == null)) return a.landed == null ? 1 : -1;
    if (a.landed != null && a.landed !== b.landed) return a.landed - b.landed;
    const am = a.q.moq == null ? Infinity : a.q.moq, bm = b.q.moq == null ? Infinity : b.q.moq;
    if (am !== bm) return am - bm;
    const al = a.q.leadDays == null ? Infinity : a.q.leadDays, bl = b.q.leadDays == null ? Infinity : b.q.leadDays;
    return al - bl || a.i - b.i;
  });
  return rows.map((r, k) => ({ ...r, rank: k + 1 }));
}

// ── the deck, pure ──────────────────────────────────────────────────────────

const money = (n, cur = 'USD') => n == null ? '—'
  : `${cur === 'USD' ? '$' : cur + ' '}${n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2)}`;
const days = (d) => d == null ? '' : `${d} day${d === 1 ? '' : 's'}`;
const slugOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function priceLine(row, qty) {
  const cur = row.q.currency;
  if (row.unit == null) return 'no price in the quote';
  const at = qty ? `at ${qty.toLocaleString()}` : (row.tier && row.tier.qty ? `at ${row.tier.qty.toLocaleString()}` : 'each');
  let s = `${money(row.unit, cur)}/unit ${at}`;
  if (row.hasShipping) s += ` · ${money(row.landed, cur)} landed`;
  if (row.belowMoq) s += ` · under their MOQ`;
  return s;
}

function tiersText(q) {
  if (!q.tiers.length) return '';
  return q.tiers.map((t) => `${t.qty != null ? t.qty.toLocaleString() + ' → ' : ''}${money(t.unit, q.currency)}`).join('\n');
}

function vendorCard(row, qty, taken) {
  const q = row.q;
  const who = q.vendor || `Vendor ${row.i + 1}`;
  const sections = [];
  const tiers = tiersText(q);
  if (tiers) sections.push({ label: 'Price', text: tiers });
  const ml = [q.moq != null ? `MOQ ${q.moq.toLocaleString()}` : '', q.leadDays != null ? `lead time ${days(q.leadDays)}` : ''].filter(Boolean).join(' · ');
  if (ml) sections.push({ label: 'MOQ · lead time', text: ml });
  const sh = [q.shipping.method, q.shipping.cost != null ? money(q.shipping.cost, q.currency) : '', q.shipping.days != null ? days(q.shipping.days) : '', q.shipping.to ? `to ${q.shipping.to}` : ''].filter(Boolean).join(' · ');
  if (sh) sections.push({ label: 'Shipping', text: sh });
  const sa = [q.sample.cost != null ? money(q.sample.cost, q.currency) : '', q.sample.days != null ? days(q.sample.days) : '', q.sample.note].filter(Boolean).join(' · ');
  if (sa) sections.push({ label: 'Sample', text: sa });
  if (q.payment) sections.push({ label: 'Terms', text: q.payment });
  const sp = [q.specs, q.customization].filter(Boolean).join('\n');
  if (sp) sections.push({ label: 'Specs', text: sp });
  if (q.flags.length) sections.push({ label: 'Watch out', text: q.flags.join('\n') });
  if (q.missing.length) sections.push({ label: 'Still unknown', text: q.missing.join(' · ') });
  let id = slugOf(who) || `vendor-${row.i + 1}`;
  while (taken.has(id)) id = `${id}-${row.i + 1}`;
  taken.add(id);
  const card = {
    id, who,
    label: `${who} — ${priceLine(row, qty)}`,
    eyebrow: `#${row.rank} · ${priceLine(row, qty)}${q.product ? ' · ' + q.product : ''}`,
    sections: sections.slice(0, 8),
  };
  if (q.img) card.img = q.img;
  if (q.reply) { card.caption = q.reply; card.captionLabel = 'Draft reply'; }
  return card;
}

function summaryCard(rows, qty, product) {
  const lines = rows.map((r) => `${r.rank}. ${r.q.vendor || `Vendor ${r.i + 1}`} — ${priceLine(r, qty)}`
    + (r.q.moq != null ? ` · MOQ ${r.q.moq.toLocaleString()}` : '')
    + (r.q.leadDays != null ? ` · ${days(r.q.leadDays)}` : ''));
  const withShip = rows.filter((r) => r.hasShipping).length;
  const eyebrow = `${rows.length} quote${rows.length === 1 ? '' : 's'}${qty ? ` · ranked at ${qty.toLocaleString()} units` : ' · ranked at each vendor\'s smallest quantity'}`
    + (withShip && withShip < rows.length ? ` · ${withShip} priced shipping` : '');
  return {
    id: 'all-quotes',
    who: product ? `All quotes — ${product}` : 'All quotes',
    label: 'All quotes, ranked',
    eyebrow,
    text: lines.join('\n').slice(0, 1500),
  };
}

// `deck` data for POST /api/chatfeed/page — the ranking card first, then one
// card per vendor in rank order. Validated by page-templates.js at post time
// and by the test with the same function.
function buildDeck(quotes, { qty = null, product = '' } = {}) {
  const rows = rankQuotes(quotes, qty);
  const taken = new Set(['all-quotes']);
  const items = [summaryCard(rows, qty, product), ...rows.map((r) => vendorCard(r, qty, taken))];
  return { items, stamp: false, start: 'swipe', help:
    'One card per vendor, cheapest first' + (qty ? ` at ${qty.toLocaleString()} units` : '') + '. The screenshot is the source — the numbers were read off it, check anything that decides it. ♥ the ones to pursue, ✕ the ones you are out on; the Piles view is your shortlist. "Draft reply" is a message you can copy to that vendor asking for what the quote left out.' };
}

function deckTitle(quotes, { qty, product } = {}) {
  const n = quotes.length;
  return `Alibaba quotes${product ? ' — ' + product : ''} · ${n} vendor${n === 1 ? '' : 's'}${qty ? ` at ${qty.toLocaleString()}` : ''}`;
}

module.exports = { MODEL, SHAPE, SYSTEM, extractQuote, normQuote, unitAt, landedAt, rankQuotes, buildDeck, deckTitle, priceLine };
