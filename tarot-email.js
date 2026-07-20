// tarot-email.js — the tap-to-reveal Card of the Day email (mounted at
// /api/tarot-email).
//
// A "kinetic" email: the reveal is pure CSS (a hidden checkbox + :checked
// rules — email clients strip all JavaScript). Clients that keep <input>
// elements and support sibling selectors (Apple Mail on iPhone/iPad/Mac) get
// the real in-email flip: tap the card back, the face appears. Everyone else
// (Gmail, Outlook — they strip the checkbox) automatically gets the fallback:
// the same card back as a link out to the witch app's tarot page.
//
// Support detection is the classic pre-checked-checkbox trick: a hidden
// checkbox that ships ALREADY checked toggles the interactive block visible
// via `#sw-support:checked ~ …` rules. Clients that strip the input never
// match the selector, so the inline `display:none` on the interactive block
// wins and the fallback stays. No client sniffing, degrades safely everywhere
// (both versions are also inline-styled, so a stripped <style> tag still
// renders a sane static email).
//
// The card is deterministic per day — same FNV-1a hash + 78-card deck as
// witch.html (the deck data below is a straight copy; keep them in sync) —
// and is baked into the HTML at build time, so the email always reveals the
// card for the day it was generated. Real card art comes from the committed
// Rider-Waite manifest (witch-tarot-manifest.json, permanent Firebase URLs).
//
// Routes:
//   GET  /status            (open)  configured flags + today's card name
//   GET  /preview?date=     (open)  the full email HTML, viewable in a browser
//   POST /send-test         (gated) { to, date? } → one real send via Brevo,
//                                   so the reveal can be verified in Apple Mail
//
// Sending campaigns stays in Brevo's dashboard (paste the /preview HTML into a
// custom-HTML campaign — Brevo appends the unsubscribe footer there). The
// send-test route uses Brevo's transactional endpoint purely as a "does the
// checkbox survive their processor / how does it look in my inbox" check.

const express = require('express');
const fetch = require('node-fetch');

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || '';
const FROM_NAME = process.env.BREVO_FROM_NAME || 'Secretly a Witch';

const APP_URL = 'https://imageforge-q125.onrender.com/witch';

// Rider-Waite art (card name → permanent Firebase URL), same manifest the app
// serves at /api/witch/tarot-deck.
let DECK_IMG = {};
try { DECK_IMG = require('./witch-tarot-manifest.json'); } catch (e) { /* optional */ }

/* ── The 78-card deck — copied verbatim from witch.html; keep in sync ── */
const MAJORS = [
  ['0','The Fool','new beginnings, spontaneity, a leap of faith','recklessness, holding back, fear of the unknown'],
  ['I','The Magician','manifestation, willpower, resourcefulness','untapped talent, scattered energy, self-doubt'],
  ['II','The High Priestess','intuition, mystery, the inner voice','secrets kept, disconnection from instinct'],
  ['III','The Empress','abundance, nurturing, creativity','creative block, over-giving, neglecting yourself'],
  ['IV','The Emperor','structure, stability, steady authority','rigidity, control, needing to loosen the grip'],
  ['V','The Hierophant','tradition, guidance, shared belief','breaking convention, finding your own way'],
  ['VI','The Lovers','union, alignment, a meaningful choice','disharmony, values out of sync'],
  ['VII','The Chariot','drive, focus, forward momentum','scattered effort, loss of direction'],
  ['VIII','Strength','quiet courage, patience, gentle power','self-doubt, forcing what needs softness'],
  ['IX','The Hermit','reflection, solitude, inner wisdom','isolation, avoiding needed answers'],
  ['X','Wheel of Fortune','cycles, turning points, good fortune','resistance to change, a passing delay'],
  ['XI','Justice','fairness, truth, cause and effect','avoidance, imbalance, owning a choice'],
  ['XII','The Hanged Man','surrender, a new perspective, a pause','stalling, resisting the useful pause'],
  ['XIII','Death','endings, transformation, release','clinging to what is already over'],
  ['XIV','Temperance','balance, patience, gentle blending','excess, impatience, seeking the middle'],
  ['XV','The Devil','attachment, temptation, the shadow','releasing a chain, reclaiming your power'],
  ['XVI','The Tower','sudden change, revelation, a clearing','fear of change, disaster narrowly avoided'],
  ['XVII','The Star','hope, renewal, gentle faith','doubt, disconnection, tending your spark'],
  ['XVIII','The Moon','intuition, dreams, the unknown','clarity returning, releasing a fear'],
  ['XIX','The Sun','joy, vitality, warmth, success','a passing cloud, delayed brightness'],
  ['XX','Judgement','awakening, reckoning, a fresh call','self-doubt, avoiding an inner calling'],
  ['XXI','The World','completion, wholeness, fulfillment','loose ends, one more step to close'],
];
const SUITS = [
  { name: 'Wands', glyph: '✦', domain: 'passion, energy & creativity' },
  { name: 'Cups', glyph: '✦', domain: 'emotion, love & intuition' },
  { name: 'Swords', glyph: '✦', domain: 'thought, truth & clarity' },
  { name: 'Pentacles', glyph: '✦', domain: 'work, home & the material' },
];
const RANKS = [
  ['Ace','pure potential'], ['Two','a balance or choice'], ['Three','growth and coming together'],
  ['Four','stability and rest'], ['Five','a challenge or loss'], ['Six','harmony and progress'],
  ['Seven','assessment and perseverance'], ['Eight','momentum and mastery'], ['Nine','near fulfillment'],
  ['Ten','culmination and completion'], ['Page','curiosity and a message'], ['Knight','action and pursuit'],
  ['Queen','nurturing mastery'], ['King','grounded authority'],
];
function buildDeck() {
  const deck = [];
  MAJORS.forEach(([num, name, up, rev]) => deck.push({ name, num, glyph: '✦', suit: null, up, rev, arcana: 'major' }));
  SUITS.forEach(s => RANKS.forEach(([rank, theme]) => {
    deck.push({
      name: `${rank} of ${s.name}`, num: '', glyph: s.glyph, suit: s.name,
      up: `${theme} — in ${s.domain}`,
      rev: `blocked or delayed ${theme.replace(/^(a |an )/, '')} — in ${s.domain}`,
      arcana: 'minor',
    });
  }));
  return deck;
}
const DECK = buildDeck();

// Same FNV-1a hash as witch.html.
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// One shared card per day for the whole list (the app's daily pull is
// per-account, so there is no single per-user card to mirror; this is the
// email's own deterministic draw over the same deck).
function cardForDay(dateISO) {
  const seed = dateISO + '|email-cotd';
  const card = DECK[hashStr(seed) % DECK.length];
  const orientation = (hashStr(seed + '~o') % 100) < 28 ? 'reversed' : 'upright';
  return { card, orientation };
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function prettyDate(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/* ── The email itself ─────────────────────────────────────────────── */
// Palette = the witch app's current warm-cream theme (witch.html :root).
// Layout is tables + inline styles (the only reliable email substrate); the
// <style> block carries ONLY the checkbox-reveal rules and a fade-in, so a
// client stripping it still renders a complete static email.
function buildTarotEmail({ date } = {}) {
  const dateISO = date || todayISO();
  const { card, orientation } = cardForDay(dateISO);
  const rev = orientation === 'reversed';
  const meaning = rev ? card.rev : card.up;
  const img = DECK_IMG[card.name] || '';
  const dateLine = prettyDate(dateISO);
  const subject = `✦ Your card for ${dateLine} — tap to reveal`;

  const cardW = 240, cardH = 400;

  // The card BACK (shared by the kinetic label and the fallback link): flat
  // plum, gold border, star + moon — flat colors only, no gradients.
  const backInner = `
    <table role="presentation" width="${cardW}" cellpadding="0" cellspacing="0" style="width:${cardW}px;height:${cardH}px;background-color:#6b4f86;border:3px solid #9c6f33;border-radius:14px;">
      <tr><td align="center" valign="middle" style="height:${cardH}px;text-align:center;">
        <div style="font-size:44px;line-height:1.2;color:#f5efe2;">🌙</div>
        <div style="font-size:30px;line-height:1.4;color:#e8c987;">✦ ✦ ✦</div>
        <div style="font-family:Georgia,serif;font-size:15px;letter-spacing:3px;text-transform:uppercase;color:#f5efe2;padding-top:14px;">Tap to reveal</div>
        <div style="font-family:Georgia,serif;font-size:13px;font-style:italic;color:#cbb9dd;padding-top:6px;">your card for today</div>
      </td></tr>
    </table>`;

  // The revealed FACE: real Rider-Waite art (rotated when reversed) + meaning.
  // The art sits inside a fixed-height framed card so the layout still reads
  // as a card when a client blocks remote images (the img collapses, the
  // frame + alt text remain).
  const faceArt = `
    <table role="presentation" width="${cardW}" cellpadding="0" cellspacing="0" style="width:${cardW}px;background-color:#fffbf3;border:3px solid #9c6f33;border-radius:14px;">
      <tr><td align="center" valign="middle" height="${cardH}" style="height:${cardH}px;font-family:Georgia,serif;color:#9c6f33;">
        ${img
          ? `<img src="${esc(img)}" width="${cardW}" alt="${esc(card.name)}" style="display:block;width:${cardW}px;height:auto;border-radius:11px;${rev ? 'transform:rotate(180deg);' : ''}">`
          : '<span style="font-size:56px;">✦</span>'}
      </td></tr>
    </table>`;

  const face = `
    ${faceArt}
    <div style="font-family:Georgia,serif;font-size:24px;color:#302b34;padding-top:18px;">${esc(card.name)}</div>
    <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${rev ? '#b0524f' : '#9c6f33'};padding-top:4px;">${rev ? 'Reversed' : 'Upright'}</div>
    <div style="font-family:Georgia,serif;font-size:16px;font-style:italic;line-height:1.6;color:#6d6472;padding:12px 24px 0;">${esc(meaning)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto 0;">
      <tr><td style="background-color:#9c6f33;border-radius:6px;">
        <a href="${APP_URL}" style="display:inline-block;padding:12px 26px;font-family:Georgia,serif;font-size:15px;color:#fffbf3;text-decoration:none;">Pull a full reading ✦</a>
      </td></tr>
    </table>`;

  return { subject, dateISO, card: card.name, orientation, html: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(subject)}</title>
<style>
  /* Reveal rules only — everything structural is inline. Clients that strip
     this block (or the checkboxes) fall back to the static version. */
  #sw-support:checked ~ .sw-body .sw-kinetic { display:block !important; }
  #sw-support:checked ~ .sw-body .sw-fallback { display:none !important; }
  #sw-reveal:checked ~ .sw-body .sw-back { display:none !important; }
  #sw-reveal:checked ~ .sw-body .sw-face { display:block !important; animation: sw-in 0.6s ease; }
  @keyframes sw-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  .sw-back label { cursor:pointer; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f5efe2;">
<div style="display:none;max-height:0;overflow:hidden;">One card, pulled for today. Tap the card back to turn it over. ✦</div>
<input type="checkbox" id="sw-support" checked style="display:none;max-height:0;visibility:hidden;">
<input type="checkbox" id="sw-reveal" style="display:none;max-height:0;visibility:hidden;">
<div class="sw-body">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5efe2;">
    <tr><td align="center" style="padding:36px 16px 44px;">
      <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;width:100%;">
        <tr><td align="center" style="text-align:center;">
          <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#9c6f33;">Secretly a Witch</div>
          <div style="font-family:Georgia,serif;font-size:26px;color:#302b34;padding-top:10px;">Your card for today</div>
          <div style="font-family:Georgia,serif;font-size:14px;font-style:italic;color:#6d6472;padding-top:4px;">${esc(dateLine)}</div>
        </td></tr>
        <tr><td align="center" style="padding-top:28px;">

          <!-- Interactive version: hidden unless the support checkbox survives. -->
          <div class="sw-kinetic" style="display:none;">
            <div class="sw-back">
              <label for="sw-reveal">${backInner}</label>
              <div style="font-family:Georgia,serif;font-size:13px;font-style:italic;color:#a1968b;padding-top:14px;">The deck is face down. Tap the card.</div>
            </div>
            <div class="sw-face" style="display:none;">${face}</div>
          </div>

          <!-- Fallback: same card back, links out to the app to reveal. -->
          <div class="sw-fallback">
            <a href="${APP_URL}" style="text-decoration:none;">${backInner}</a>
            <div style="font-family:Georgia,serif;font-size:13px;font-style:italic;color:#a1968b;padding-top:14px;">Tap the card to reveal it.</div>
          </div>

        </td></tr>
        <tr><td align="center" style="padding-top:40px;border-top:1px solid #e3d8c2;text-align:center;">
          <div style="font-family:Georgia,serif;font-size:12px;color:#a1968b;line-height:1.7;padding-top:16px;">
            Drawn from the full 78-card deck, one card each day.<br>
            <a href="${APP_URL}" style="color:#9c6f33;">Secretly a Witch</a> · moon phases, tarot &amp; small spells
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>
</body>
</html>` };
}

/* ── Brevo (test sends) ───────────────────────────────────────────── */
async function sendViaBrevo({ to, subject, html }) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');
  if (!FROM_EMAIL) throw new Error('BREVO_FROM_EMAIL not set (must be a sender verified in Brevo)');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Brevo error ${res.status}`);
  return data; // { messageId }
}

/* ── Router ───────────────────────────────────────────────────────── */
const router = express.Router();

// Same gate pattern as the rest of the studio. /status and /preview stay open —
// the email is public marketing content with nothing sensitive in it.
const OPEN_PATHS = new Set(['/status', '/preview']);
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && OPEN_PATHS.has(req.path)) return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  const { card, orientation } = cardForDay(todayISO());
  res.json({
    deck: DECK.length,
    art: Object.keys(DECK_IMG).length,
    brevo: Boolean(BREVO_API_KEY),
    sender: FROM_EMAIL ? true : false,
    today: { card: card.name, orientation },
  });
});

// The email HTML itself — open it in a browser, or copy the source into a
// Brevo custom-HTML campaign. ?date=YYYY-MM-DD previews another day's card.
router.get('/preview', (req, res) => {
  try {
    const { html } = buildTarotEmail({ date: req.query.date });
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// One real send (Brevo transactional endpoint) to verify the reveal in a real
// inbox — Apple Mail should flip in place, Gmail should show the fallback.
router.post('/send-test', async (req, res) => {
  try {
    const { to, date } = req.body || {};
    if (!to || !/@/.test(to)) return res.status(400).json({ error: 'to (email address) required' });
    const { subject, html, card, orientation, dateISO } = buildTarotEmail({ date });
    const sent = await sendViaBrevo({ to, subject, html });
    res.json({ ok: true, to, subject, card, orientation, date: dateISO, messageId: sent.messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, buildTarotEmail, cardForDay };
