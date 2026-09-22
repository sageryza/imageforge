#!/usr/bin/env node
'use strict';
// hats-add.js — put a hat INTO her Shopify from a chat's container.
//
//   node scripts/hats-add.js --title "god complex" --price 32 [--was 976] \
//     --image https://storage.googleapis.com/…/x.png [--image …] [--tag cap] [--dry]
//   node scripts/hats-add.js --file hats.json [--dry]      (an array of the same fields)
//
// Runs hats.js's addHat through shopify.js's stored OAuth token (the one the
// live server uses), so a hat can be added with no deploy. Needs
// FIREBASE_SERVICE_ACCOUNT in the environment (the token lives in Firestore).
// --dry prints the exact product body and creates nothing.
const fs = require('fs');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const all = (k) => args.map((a, i) => a === '--' + k ? args[i + 1] : null).filter(Boolean);
const dry = args.includes('--dry');

(async () => {
  process.env.SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'cod-god-inc.myshopify.com';
  const admin = require('firebase-admin');
  if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  await require('../config-loader').loadConfig();
  const H = require('../hats');
  const items = opt('file')
    ? JSON.parse(fs.readFileSync(opt('file'), 'utf8'))
    : [{ title: opt('title'), price: opt('price'), compareAt: opt('was'), images: all('image'), tags: all('tag'), description: opt('description') }];
  for (const it of items) {
    if (dry) { console.log(JSON.stringify(H.productPlan(it), null, 2)); continue; }
    const r = await H.addHat(it);
    console.log(`${r.title} → ${r.url}  (${r.images} picture${r.images === 1 ? '' : 's'}, ${r.status})`);
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
