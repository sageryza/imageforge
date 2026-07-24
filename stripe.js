'use strict';
// Secretly a Witch — membership via Stripe (web/Checkout model, no Apple IAP).
// Sell the $4/mo subscription on the website with Stripe Checkout → the webhook
// flips the signed-in account to "member" in Firestore (membry-df528, the same
// project the witch app's accounts live in) → the app reads that and unlocks.
//
// No `stripe` npm dep: raw HTTPS (form-encoded) + crypto for webhook signature
// verification. Keys come from the environment / config-loader:
//   STRIPE_SECRET_KEY   (sk_test_… now, sk_live_… at launch)
//   STRIPE_PRICE_ID     (the recurring $4/mo price)
//   STRIPE_WEBHOOK_SECRET (whsec_… for signature checks)
const crypto = require('crypto');
const express = require('express');

const API = 'https://api.stripe.com/v1';

const secretKey = () => process.env.STRIPE_SECRET_KEY || '';
const priceId = () => process.env.STRIPE_PRICE_ID || '';
const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET || '';
const configured = () => !!secretKey();
const liveMode = () => secretKey().startsWith('sk_live');

// Stripe wants bracketed form-encoding for nested params.
function encodeForm(obj, prefix, out) {
  out = out || [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') encodeForm(item, `${key}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof v === 'object') {
      encodeForm(v, key, out);
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return out;
}

async function stripeReq(method, path, params) {
  const opts = { method, headers: { Authorization: 'Bearer ' + secretKey() } };
  let url = API + path;
  if (params && method === 'GET') url += '?' + encodeForm(params).join('&');
  else if (params) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = encodeForm(params).join('&');
  }
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (j && j.error) { const e = new Error(j.error.message || 'stripe error'); e.stripe = j.error; e.status = r.status; throw e; }
  return j;
}

// Verify a Stripe webhook signature (t=…,v1=…) against the raw request body.
// Returns the parsed event on success, null on any failure.
function verifyWebhook(rawBody, sigHeader, secret) {
  if (!rawBody || !sigHeader || !secret) return null;
  const parts = { v1: [] };
  sigHeader.split(',').forEach((kv) => {
    const idx = kv.indexOf('=');
    const k = kv.slice(0, idx), val = kv.slice(idx + 1);
    if (k === 't') parts.t = val;
    else if (k === 'v1') parts.v1.push(val);
  });
  if (!parts.t || !parts.v1.length) return null;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(parts.t + '.' + body, 'utf8').digest('hex');
  const ok = parts.v1.some((sig) => {
    try { return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8')); } catch { return false; }
  });
  if (!ok) return null;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t)) > 600) return null; // 10-min tolerance
  try { return JSON.parse(body); } catch { return null; }
}

// membryDb: async () => Firestore (membry-df528). membryAuth: async () => admin auth
// for the same project (to verify the app's Firebase ID tokens). appUrl: () => base URL.
function createRouter({ membryDb, membryAuth, appUrl }) {
  const router = express.Router();

  async function identify(req) {
    const hdr = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const tok = hdr || (req.body && req.body.idToken) || req.query.idToken || '';
    if (!tok) return null;
    try { const auth = await membryAuth(); const dec = await auth.verifyIdToken(String(tok)); return { uid: dec.uid, email: dec.email || null }; }
    catch { return null; }
  }
  async function setMembership(uid, m) {
    const db = await membryDb();
    await db.collection('users').doc(uid).set({ membership: m }, { merge: true });
  }
  async function getMembership(uid) {
    const db = await membryDb();
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? (snap.data().membership || null) : null;
  }

  router.get('/status', (req, res) => {
    res.json({ configured: configured(), price: !!priceId(), webhook: !!webhookSecret(), mode: liveMode() ? 'live' : 'test' });
  });

  // The app calls this on sign-in to learn if the account is a paying member.
  router.get('/entitlement', async (req, res) => {
    try {
      const who = await identify(req);
      if (!who) return res.json({ active: false, signedIn: false });
      const m = await getMembership(who.uid);
      res.json({ active: !!(m && m.active), signedIn: true, status: m && m.status });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Start a subscription: returns a Stripe Checkout URL to redirect to.
  router.post('/checkout', express.json(), async (req, res) => {
    try {
      if (!configured() || !priceId()) return res.status(503).json({ error: 'stripe not configured' });
      const who = await identify(req);
      if (!who) return res.status(401).json({ error: 'sign in first' });
      // appUrl may inspect the request (checkout started on secretlyawitch.com
      // should return there, not to the onrender host).
      const base = appUrl(req);
      const trialDays = Number(process.env.STRIPE_TRIAL_DAYS || 0);
      const session = await stripeReq('POST', '/checkout/sessions', {
        mode: 'subscription',
        line_items: [{ price: priceId(), quantity: 1 }],
        client_reference_id: who.uid,
        customer_email: who.email || undefined,
        metadata: { uid: who.uid },
        subscription_data: Object.assign({ metadata: { uid: who.uid } }, trialDays ? { trial_period_days: trialDays } : {}),
        allow_promotion_codes: true,
        success_url: base + '/witch?sub=success',
        cancel_url: base + '/witch?sub=cancel',
      });
      res.json({ url: session.url, id: session.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Stripe → us. Uses req.rawBody captured by the global express.json verify hook.
  router.post('/webhook', async (req, res) => {
    const event = verifyWebhook(req.rawBody, req.get('stripe-signature'), webhookSecret());
    if (!event) return res.status(400).send('bad signature');
    try {
      const obj = event.data && event.data.object || {};
      if (event.type === 'checkout.session.completed') {
        const uid = obj.client_reference_id || (obj.metadata && obj.metadata.uid);
        if (uid) await setMembership(uid, { active: obj.status === 'complete' || obj.payment_status === 'paid', status: 'active', customer: obj.customer, subscription: obj.subscription, updatedAt: Date.now() });
      } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
        const uid = obj.metadata && obj.metadata.uid;
        if (uid) await setMembership(uid, { active: ['active', 'trialing', 'past_due'].includes(obj.status), status: obj.status, customer: obj.customer, subscription: obj.id, current_period_end: obj.current_period_end, updatedAt: Date.now() });
      } else if (event.type === 'customer.subscription.deleted') {
        const uid = obj.metadata && obj.metadata.uid;
        if (uid) await setMembership(uid, { active: false, status: 'canceled', updatedAt: Date.now() });
      }
      res.json({ received: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}

module.exports = { createRouter, stripeReq, encodeForm, verifyWebhook, configured };
