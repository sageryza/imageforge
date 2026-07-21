// tarot-email.js — the tap-to-reveal daily tarot email (mounted at
// /api/tarot-email): the website's Past / Present / Future pull, in an email.
//
// A "kinetic" email: the reveals are pure CSS (hidden checkboxes + :checked
// rules — email clients strip all JavaScript). Clients that keep <input>
// elements and support sibling selectors (Apple Mail on iPhone/iPad/Mac) get
// the real in-email experience: three face-down cards, tap each to turn it
// over. Everyone else (Gmail, Outlook — they strip the checkboxes) gets the
// fallback automatically: the same face-down spread linking out to the witch
// app to reveal there.
//
// Support detection is the classic pre-checked-checkbox trick: a hidden
// checkbox that ships ALREADY checked toggles the interactive block visible
// via `#sw-support:checked ~ …` rules. Clients that strip the input never
// match the selector, so the inline `display:none` on the interactive block
// wins and the fallback stays. No client sniffing, degrades safely everywhere
// (both versions are also inline-styled, so a stripped <style> tag still
// renders a sane static email).
//
// The spread is deterministic per day and MATCHES THE WEBSITE: same FNV-1a
// hash, same 78-card deck, and the same seed witch.html's dailyPull() uses
// for a logged-out visitor (`<dateISO>|anon`) — so the email turns over the
// exact three cards the site shows that day. Deck data below is a straight
// copy from witch.html; keep them in sync. Real card art comes from the
// committed Rider-Waite manifest (witch-tarot-manifest.json, permanent
// Firebase URLs); reversed cards render rotated 180°.
//
// Routes:
//   GET  /status            (open)  configured flags + today's three cards
//   GET  /preview?date=     (open)  the full email HTML, viewable in a browser
//   POST /send-test         (gated) { to, date? } → one real send via Brevo,
//                                   so the reveals can be verified in Apple Mail
//
// Sending campaigns stays in Brevo's dashboard (paste the /preview HTML into a
// custom-HTML campaign — Brevo appends the unsubscribe footer there). The
// send-test route uses Brevo's transactional endpoint purely as a "do the
// checkboxes survive their processor / how does it look in my inbox" check.

const express = require('express');
const fetch = require('node-fetch');

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || '';
const FROM_NAME = process.env.BREVO_FROM_NAME || 'Secretly a Witch';

const APP_URL = 'https://imageforge-q125.onrender.com/witch';
// The reveal links land straight on the daily three-card pull (the witch app
// scrolls to #tarot-card on this hash) instead of the top of the page.
const READ_URL = APP_URL + '#tarot';

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

// The website's daily Past/Present/Future pull for a logged-out visitor —
// a verbatim port of witch.html's dailyPull() with uid 'anon', so the email
// shows the exact same three cards as the site that day.
function pullForDay(dateISO) {
  const seed = dateISO + '|anon';
  const positions = ['Past', 'Present', 'Future'];
  const picks = [], used = new Set();
  for (let i = 0; i < 3; i++) {
    let idx = hashStr(seed + '#' + i) % DECK.length;
    while (used.has(idx)) idx = (idx + 1) % DECK.length;
    used.add(idx);
    const orientation = (hashStr(seed + '~o' + i) % 100) < 28 ? 'reversed' : 'upright';
    picks.push({ card: DECK[idx], orientation, position: positions[i] });
  }
  return picks;
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
  const picks = pullForDay(dateISO);
  const dateLine = prettyDate(dateISO);
  const subject = `✦ Past, present, future — your cards for ${dateLine}`;

  const cardW = 118, cardH = 198;

  // One face-down card back (flat plum, gold border — flat colors only).
  const backTable = `
    <table role="presentation" width="${cardW}" cellpadding="0" cellspacing="0" style="width:${cardW}px;height:${cardH}px;background-color:#6b4f86;border:2px solid #9c6f33;border-radius:10px;">
      <tr><td align="center" valign="middle" style="height:${cardH}px;text-align:center;">
        <div style="font-size:26px;line-height:1.3;color:#f5efe2;">🌙</div>
        <div style="font-size:14px;line-height:1.5;color:#e8c987;">✦ ✦ ✦</div>
        <div style="font-family:Georgia,serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#f5efe2;padding-top:10px;">tap</div>
      </td></tr>
    </table>`;

  // One revealed face: framed art (fixed-height so an images-blocked client
  // still shows a card shape + alt text) + name, orientation, meaning.
  function faceColumn(pick) {
    const { card, orientation } = pick;
    const rev = orientation === 'reversed';
    const img = DECK_IMG[card.name] || '';
    const meaning = rev ? card.rev : card.up;
    return `
      <table role="presentation" width="${cardW}" cellpadding="0" cellspacing="0" style="width:${cardW}px;background-color:#fffbf3;border:2px solid #9c6f33;border-radius:10px;">
        <tr><td align="center" valign="middle" height="${cardH}" style="height:${cardH}px;font-family:Georgia,serif;color:#9c6f33;">
          ${img
            ? `<img src="${esc(img)}" width="${cardW}" alt="${esc(card.name)}" style="display:block;width:${cardW}px;height:auto;border-radius:8px;${rev ? 'transform:rotate(180deg);' : ''}">`
            : '<span style="font-size:34px;">✦</span>'}
        </td></tr>
      </table>
      <div style="font-family:Georgia,serif;font-size:15px;line-height:1.3;color:#302b34;padding-top:10px;">${esc(card.name)}</div>
      <div style="font-family:Georgia,serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${rev ? '#b0524f' : '#9c6f33'};padding-top:3px;">${rev ? 'Reversed' : 'Upright'}</div>
      <div style="font-family:Georgia,serif;font-size:12px;font-style:italic;line-height:1.5;color:#6d6472;padding-top:6px;">${esc(meaning)}</div>`;
  }

  // The three-column spread. `kinetic` columns hold a label (tap target) per
  // card + the hidden face; fallback columns link the backs out to the app.
  function spreadRow(kinetic) {
    const cols = picks.map((pick, i) => `
      <td align="center" valign="top" width="33%" style="padding:0 5px;">
        <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#9c6f33;padding-bottom:10px;">${esc(pick.position)}</div>
        ${kinetic
          ? `<div class="sw-back-${i}"><label for="sw-r${i}" style="cursor:pointer;">${backTable}</label></div>
             <div class="sw-face-${i}" style="display:none;">${faceColumn(pick)}</div>`
          : `<a href="${READ_URL}" style="text-decoration:none;">${backTable}</a>`}
      </td>`).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cols}</tr></table>`;
  }

  const revealRules = picks.map((_, i) => `
  #sw-r${i}:checked ~ .sw-body .sw-back-${i} { display:none !important; }
  #sw-r${i}:checked ~ .sw-body .sw-face-${i} { display:block !important; animation: sw-in 0.6s ease; }`).join('');

  const revealInputs = picks.map((_, i) =>
    `<input type="checkbox" id="sw-r${i}" style="display:none;max-height:0;visibility:hidden;">`).join('\n');

  return { subject, dateISO, cards: picks.map(p => ({ position: p.position, card: p.card.name, orientation: p.orientation })), html: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(subject)}</title>
<style>
  /* Reveal rules only — everything structural is inline. Clients that strip
     this block (or the checkboxes) fall back to the static version. */
  #sw-support:checked ~ .sw-body .sw-kinetic { display:block !important; }
  #sw-support:checked ~ .sw-body .sw-fallback { display:none !important; }${revealRules}
  #sw-r0:checked ~ #sw-r1:checked ~ #sw-r2:checked ~ .sw-body .sw-hint { display:none !important; }
  @keyframes sw-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f5efe2;">
<div style="display:none;max-height:0;overflow:hidden;">Three cards, pulled for today — past, present, future. Tap each to turn it over. ✦</div>
<input type="checkbox" id="sw-support" checked style="display:none;max-height:0;visibility:hidden;">
${revealInputs}
<div class="sw-body">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5efe2;">
    <tr><td align="center" style="padding:36px 12px 44px;">
      <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;width:100%;">
        <tr><td align="center" style="text-align:center;">
          <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#9c6f33;">Secretly a Witch</div>
          <div style="font-family:Georgia,serif;font-size:26px;color:#302b34;padding-top:10px;">Your cards for today</div>
          <div style="font-family:Georgia,serif;font-size:14px;font-style:italic;color:#6d6472;padding-top:4px;">${esc(dateLine)}</div>
        </td></tr>
        <tr><td align="center" style="padding-top:28px;">

          <!-- Interactive version: hidden unless the support checkbox survives. -->
          <div class="sw-kinetic" style="display:none;">
            ${spreadRow(true)}
            <div class="sw-hint" style="font-family:Georgia,serif;font-size:13px;font-style:italic;color:#a1968b;padding-top:16px;">The spread is face down. Tap each card.</div>
          </div>

          <!-- Fallback: same face-down spread, links out to the app to reveal. -->
          <div class="sw-fallback">
            ${spreadRow(false)}
            <div style="font-family:Georgia,serif;font-size:13px;font-style:italic;color:#a1968b;padding-top:16px;">Tap a card to reveal your spread.</div>
          </div>

        </td></tr>
        <tr><td align="center" style="padding-top:26px;">
          <table role="presentation" cellpadding="0" cellspacing="0" align="center">
            <tr><td style="background-color:#9c6f33;border-radius:6px;">
              <a href="${READ_URL}" style="display:inline-block;padding:12px 26px;font-family:Georgia,serif;font-size:15px;color:#fffbf3;text-decoration:none;">Read the full spread ✦</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding-top:32px;text-align:center;">
          <div style="border-top:1px solid #e3d8c2;font-family:Georgia,serif;font-size:12px;color:#a1968b;line-height:1.7;padding-top:16px;">
            The same three cards the site pulls today — past, present, future.<br>
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
  const picks = pullForDay(todayISO());
  res.json({
    deck: DECK.length,
    art: Object.keys(DECK_IMG).length,
    brevo: Boolean(BREVO_API_KEY),
    sender: FROM_EMAIL ? true : false,
    today: picks.map(p => ({ position: p.position, card: p.card.name, orientation: p.orientation })),
  });
});

// The email HTML itself — open it in a browser, or copy the source into a
// Brevo custom-HTML campaign. ?date=YYYY-MM-DD previews another day's spread.
router.get('/preview', (req, res) => {
  try {
    const { html } = buildTarotEmail({ date: req.query.date });
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// One real send (Brevo transactional endpoint) to verify the reveals in a real
// inbox — Apple Mail should flip in place, Gmail should show the fallback.
router.post('/send-test', async (req, res) => {
  try {
    const { to, date } = req.body || {};
    if (!to || !/@/.test(to)) return res.status(400).json({ error: 'to (email address) required' });
    const { subject, html, cards, dateISO } = buildTarotEmail({ date });
    const sent = await sendViaBrevo({ to, subject, html });
    res.json({ ok: true, to, subject, cards, date: dateISO, messageId: sent.messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, buildTarotEmail, pullForDay };
