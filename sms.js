// sms.js — one text message, through Twilio, with no SDK.
//
// Sophie (2026-09-04): "twilio is wired elsewhere" — and it is: the Xi
// commercial chats on account 1 put the account into membry's own
// `config/twilio` doc ({accountSid, authToken, from}), the locked-down
// Firestore config the sibling repo's Cloud Functions read their keys from.
// So the keys are read from THERE at first use, the way `/api/story` reads
// its credential — nothing pasted into Render, nothing copied into a second
// doc to drift. Render env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_FROM — managed keys, so the Firestore pipeline doc fills them too)
// still WINS when set, like every other key here.
//
// Without either, sendSms() answers { ok:false, reason:'not configured' } and
// nothing else happens — a missing key must never fail the thing that wanted
// to send the text.
'use strict';

let _membryDb = null;          // async () => Firestore (server.js's storyDb)
let _keys = null;              // { sid, token, from } once found
let _looked = 0;               // when we last asked membry (so a miss is re-asked, not forever)
function init(o) { if (o && o.membryDb) _membryDb = o.membryDb; }

function envKeys() {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  return sid && token && from ? { sid, token, from } : null;
}
async function keys() {
  const e = envKeys(); if (e) return e;
  if (_keys) return _keys;
  if (!_membryDb || Date.now() - _looked < 60 * 1000) return null;
  _looked = Date.now();
  try {
    const db = await _membryDb();
    if (!db) return null;
    const snap = await db.collection('config').doc('twilio').get();
    const d = snap.exists ? snap.data() || {} : {};
    const sid = d.accountSid || d.TWILIO_ACCOUNT_SID, token = d.authToken || d.TWILIO_AUTH_TOKEN, from = d.from || d.TWILIO_FROM;
    if (sid && token && from) _keys = { sid: String(sid), token: String(token), from: String(from) };
  } catch (e) { console.warn('sms: membry config/twilio unreadable —', e.message); }
  return _keys;
}
// synchronous "is there any chance" — env now, or membry once it has answered
function configured() { return !!(envKeys() || _keys); }
// the honest async version, for a status read
async function ready() { return !!(await keys()); }

// A phone number as a person types it → E.164, or null when it cannot be one.
// US is the default country: ten digits get +1, eleven starting with 1 get +.
// Anything already carrying a + keeps its country. Never a guess beyond that —
// a wrong number is a text to a stranger.
function normalizePhone(s) {
  const raw = String(s || '').trim();
  if (!raw) return null;
  const plus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (plus) return digits.length >= 8 && digits.length <= 15 ? '+' + digits : null;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return null;
}

async function sendSms(to, body) {
  const k = await keys();
  if (!k) return { ok: false, reason: 'not configured' };
  const num = normalizePhone(to);
  if (!num) return { ok: false, reason: 'bad number' };
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(k.sid)}/Messages.json`;
  const form = new URLSearchParams({ To: num, From: k.from, Body: String(body || '').slice(0, 640) });
  const auth = Buffer.from(`${k.sid}:${k.token}`).toString('base64');
  try {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: (j && j.message) || ('http ' + r.status) };
    return { ok: true, sid: j.sid };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

module.exports = { init, configured, ready, normalizePhone, sendSms };
