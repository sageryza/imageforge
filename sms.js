// sms.js — one text message, through Twilio, with no SDK.
//
// Sophie (2026-09-04): "twilio is wired elsewhere" — the account exists in a
// sibling repo; here it is three keys (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_FROM), read like every other key through config-loader (Render env
// wins, the Firestore config doc fills gaps). Without them sendSms() answers
// { ok:false, reason:'not configured' } and nothing else happens — a missing
// key must never fail the thing that wanted to send the text.
'use strict';

function configured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

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
  if (!configured()) return { ok: false, reason: 'not configured' };
  const num = normalizePhone(to);
  if (!num) return { ok: false, reason: 'bad number' };
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const form = new URLSearchParams({ To: num, From: process.env.TWILIO_FROM, Body: String(body || '').slice(0, 640) });
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  try {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: (j && j.message) || ('http ' + r.status) };
    return { ok: true, sid: j.sid };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

module.exports = { configured, normalizePhone, sendSms };
