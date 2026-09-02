#!/usr/bin/env node
// scripts/test-alibaba-quotes.js — the pure half of the quote sorter, with no
// network: the tier pick, the landed price, unknowns last, the tie-break, and
// the deck driven through the REAL page-templates validator so the shape a
// chat posts is the shape the server accepts.
//
//   node scripts/test-alibaba-quotes.js          # pure, free
//   node scripts/test-alibaba-quotes.js --live   # + one real extraction off
//                                                #   the fixture screenshot (~3¢)

const assert = require('assert');
const aq = require('../alibaba-quotes');
const { validateTemplate } = require('../page-templates');

let n = 0;
const ok = (cond, msg) => { n += 1; assert.ok(cond, msg); };

const mk = (over = {}) => aq.normQuote({ vendor: 'V', currency: 'USD', tiers: [], shipping: {}, sample: {}, ...over });

// tier pick
const a = mk({ vendor: 'A', tiers: [{ qty: 500, unit: 0.85 }, { qty: 1000, unit: 0.72 }, { qty: 2000, unit: 0.65 }], moq: 300 });
ok(aq.unitAt(a, 500).unit === 0.85, 'exactly on a tier takes it');
ok(aq.unitAt(a, 1500).unit === 0.72, 'between tiers takes the one at or under');
ok(aq.unitAt(a, 5000).unit === 0.65, 'above every tier takes the largest');
ok(aq.unitAt(a, 100).unit === 0.85 && aq.unitAt(a, 100).belowMoq === true, 'under every tier pays the smallest and is flagged under MOQ');
ok(aq.unitAt(a, null).unit === 0.85, 'no quantity → the smallest tier');
ok(aq.unitAt(mk({ tiers: [] }), 500).unit === null, 'no tiers → null, never a guess');

// normalisation cannot let a string reach the maths
const messy = aq.normQuote({ tiers: [{ qty: '1,000', unit: '$0.72' }, { qty: 500, unit: 0.85 }], moq: '300 pcs', shipping: { cost: '58' } });
ok(messy.tiers[0].qty === 500 && messy.tiers[1].qty === 1000 && messy.tiers[1].unit === 0.72, 'strings become numbers and tiers sort ascending');
ok(messy.moq === 300 && messy.shipping.cost === 58, 'moq and shipping read through their units');

// landed price
const b = mk({ vendor: 'B', tiers: [{ qty: 500, unit: 0.80 }], shipping: { method: 'DHL', cost: 58 } });
const lb = aq.landedAt(b, 500);
ok(lb.hasShipping && Math.abs(lb.landed - (0.80 + 58 / 500)) < 1e-9, 'shipping is spread over the quantity');
ok(aq.landedAt(a, 500).hasShipping === false && aq.landedAt(a, 500).landed === 0.85, 'no shipping price → the unit price alone, and it says so');

// ranking
const c = mk({ vendor: 'C', tiers: [] });
const d = mk({ vendor: 'D', tiers: [{ qty: 500, unit: 0.85 }], moq: 100 });
const ranked = aq.rankQuotes([c, a, b, d], 500);
ok(ranked.map((r) => r.q.vendor).join('') === 'DABC', `cheapest first, a tie broken by the lower MOQ, no price last (got ${ranked.map((r) => r.q.vendor).join('')})`);
ok(ranked[0].rank === 1 && ranked[3].rank === 4, 'ranks are numbered');

// the deck passes the real validator, ranking card first, one card per vendor
const deck = aq.buildDeck([c, a, b, d], { qty: 500, product: 'enamel pins' });
const v = validateTemplate('deck', deck);
ok(v.ok, `the deck validates: ${v.error || ''}`);
ok(v.data.items.length === 5, 'a ranking card plus one per vendor');
ok(v.data.items[0].id === 'all-quotes' && /4 quotes/.test(v.data.items[0].eyebrow), 'the ranking card leads');
ok(v.data.items[1].who === 'D' && /^#1 /.test(v.data.items[1].eyebrow), 'vendor cards follow in rank order with the rank on the eyebrow');
ok(v.data.stamp === false && v.data.start === 'swipe', 'no GOOD IDEA stamp over a vendor; opens on the swipe half');
const ids = v.data.items.map((i) => i.id);
ok(new Set(ids).size === ids.length, 'ids are unique');
// two vendors with the same name still get two cards
const twins = aq.buildDeck([mk({ vendor: 'Same Co', tiers: [{ qty: 1, unit: 1 }] }), mk({ vendor: 'Same Co', tiers: [{ qty: 1, unit: 2 }] })], {});
ok(validateTemplate('deck', twins).ok && new Set(twins.items.map((i) => i.id)).size === 3, 'same-named vendors do not collide');
// the reply is the caption, the screenshot is the picture, the flags are a section
const e = mk({ vendor: 'E', tiers: [{ qty: 500, unit: 1 }], flags: ['price excludes mold'], missing: ['lead time'], reply: 'Thanks — what is the lead time?', img: 'https://storage.googleapis.com/x/y.png' });
e.img = 'https://storage.googleapis.com/x/y.png';
const ce = validateTemplate('deck', aq.buildDeck([e], {})).data.items[1];
ok(ce.caption === 'Thanks — what is the lead time?' && ce.captionLabel === 'Draft reply', 'the draft reply rides as the caption');
ok(ce.img === 'https://storage.googleapis.com/x/y.png', 'the screenshot is on the card');
ok(ce.sections.some((s) => s.label === 'Watch out' && /mold/.test(s.text)) && ce.sections.some((s) => s.label === 'Still unknown'), 'flags and gaps are their own boxes');
ok(ce.sections.length <= 8, 'never more sections than the card takes');
// no quantity → ranked at each vendor's smallest tier, and the eyebrow says so
const nq = aq.buildDeck([a], {});
ok(/smallest quantity/.test(nq.items[0].eyebrow) && /at 500/.test(nq.items[1].eyebrow), 'without --qty the rank is at the smallest tier and says so');
ok(/2 vendors at 1,000/.test(aq.deckTitle([a, b], { qty: 1000 })), 'the title carries the count and the quantity');

console.log(`ok — ${n} checks`);

if (process.argv.includes('--live')) {
  (async () => {
    const admin = require('firebase-admin');
    if (!process.env.ANTHROPIC_API_KEY) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
      await require('../config-loader').loadConfig();
    }
    const { chromium } = require('playwright');
    const path = require('path');
    // The container pre-installs Chromium under /opt/pw-browsers; a playwright
    // pinned to another build refuses to launch without it (the same fallback
    // scripts/test-assembly.js carries).
    const fs = require('fs');
    const exe = ['/opt/pw-browsers/chromium', process.env.PW_CHROMIUM].find((x) => x && fs.existsSync(x));
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
    await page.goto('file://' + path.resolve(__dirname, 'fixtures/alibaba-quote.html'));
    const bytes = await page.screenshot({ fullPage: true });
    await browser.close();
    const q = await aq.extractQuote({ bytes, mime: 'image/png', name: 'fixture' });
    console.log(JSON.stringify(q, null, 2));
    ok(q.vendor.toLowerCase().includes('brightway'), 'vendor read');
    ok(q.tiers.length === 3 && q.tiers[0].qty === 500 && q.tiers[0].unit === 0.85 && q.tiers[2].unit === 0.65, 'three tiers read exactly');
    ok(q.moq === 300 && q.leadDays === 15, 'MOQ and the lead time upper bound');
    ok(q.shipping.cost === 58 && /DHL/i.test(q.shipping.method), 'shipping priced');
    ok(q.sample.cost === 45, 'sample cost');
    ok(q.flags.length >= 1 && q.reply.length > 40, 'flags found and a reply drafted');
    console.log(`ok — live extraction, ${n} checks`);
  })().catch((e) => { console.error('live failed:', e.message); process.exit(1); });
}
