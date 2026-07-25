'use strict';
// Idempotently create the Secretly a Witch membership Product + $4/mo Price +
// the webhook endpoint on whichever Stripe account STRIPE_SECRET_KEY points at
// (test now, live at launch). Prints STRIPE_PRICE_ID and, on first webhook
// creation, STRIPE_WEBHOOK_SECRET (Stripe only reveals the signing secret once).
//
//   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-bootstrap.js
//
// Env: STRIPE_SECRET_KEY (required), WEBHOOK_URL (optional, defaults to the
// Render app's /api/stripe/webhook), PRICE_CENTS (default 400), PRODUCT_NAME.
// Self-contained (no express dep) so it runs from a bare checkout.
function encodeForm(obj, prefix, out) {
  out = out || [];
  for (const k of Object.keys(obj)) {
    const v = obj[k]; if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => {
      if (item && typeof item === 'object') encodeForm(item, `${key}[${i}]`, out);
      else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
    });
    else if (typeof v === 'object') encodeForm(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out;
}
async function stripeReq(method, path, params) {
  const opts = { method, headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY } };
  let url = 'https://api.stripe.com/v1' + path;
  if (params && method === 'GET') url += '?' + encodeForm(params).join('&');
  else if (params) { opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'; opts.body = encodeForm(params).join('&'); }
  const r = await fetch(url, opts); const j = await r.json().catch(() => ({}));
  if (j && j.error) throw new Error(j.error.message || 'stripe error');
  return j;
}

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://imageforge-q125.onrender.com/api/stripe/webhook';
const PRICE_CENTS = Number(process.env.PRICE_CENTS || 400);
const PRODUCT_NAME = process.env.PRODUCT_NAME || 'Secretly a Witch Membership';
const EVENTS = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) { console.error('STRIPE_SECRET_KEY required'); process.exit(1); }
  const mode = process.env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'test';
  console.log(`# Stripe bootstrap (${mode} mode)`);

  // 1) Product (find by name, else create)
  const products = await stripeReq('GET', '/products', { limit: 100, active: true });
  let product = (products.data || []).find((p) => p.name === PRODUCT_NAME);
  if (!product) {
    product = await stripeReq('POST', '/products', { name: PRODUCT_NAME, metadata: { app: 'secretly-a-witch', kind: 'membership' } });
    console.log('created product', product.id);
  } else console.log('found product', product.id);

  // 2) Price (find an active $X/mo price on the product, else create)
  const prices = await stripeReq('GET', '/prices', { product: product.id, active: true, limit: 100 });
  let price = (prices.data || []).find((p) => p.unit_amount === PRICE_CENTS && p.currency === 'usd' && p.recurring && p.recurring.interval === 'month');
  if (!price) {
    price = await stripeReq('POST', '/prices', { product: product.id, unit_amount: PRICE_CENTS, currency: 'usd', recurring: { interval: 'month' } });
    console.log('created price', price.id);
  } else console.log('found price', price.id);

  // 3) Webhook endpoint (find by url, else create — secret only revealed on create)
  const hooks = await stripeReq('GET', '/webhook_endpoints', { limit: 100 });
  let hook = (hooks.data || []).find((h) => h.url === WEBHOOK_URL);
  let whsec = null;
  if (!hook) {
    hook = await stripeReq('POST', '/webhook_endpoints', { url: WEBHOOK_URL, enabled_events: EVENTS });
    whsec = hook.secret;
    console.log('created webhook', hook.id);
  } else console.log('found webhook', hook.id, '(secret not retrievable — roll it if you need it again)');

  console.log('\n--- set these ---');
  console.log('STRIPE_PRICE_ID=' + price.id);
  if (whsec) console.log('STRIPE_WEBHOOK_SECRET=' + whsec);
}
main().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
