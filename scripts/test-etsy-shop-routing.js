// test-etsy-shop-routing.js — WHICH shop a draft lands in, and WHOSE token
// writes it. Pure, no network. Run: node scripts/test-etsy-shop-routing.js
//
// The rule under test (Aug 2026, adding a second seller's shop — Sophie's mum's
// jewellery): ETSY_SHOP_ID names ONE shop, the original. Before this, two paths
// could send another seller's listing into it:
//   1. photostudio's /draft read process.env.ETSY_SHOP_ID directly, so a
//      request naming a different account still resolved to the original shop.
//   2. pipeline.publishDraft never passed an account down, so the draft was
//      always created with the DEFAULT account's token.
// Both are one mistake with the same shape: a second seller's work silently
// filed into somebody else's storefront. These assertions are the guard.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'etsy-routing-'));
process.env.ETSY_TOKEN_FILE = path.join(tmp, '.etsy-tokens.json');
process.env.ETSY_SHOP_ID = '11111111'; // the ORIGINAL shop

const etsy = require('../etsy');
const pipeline = require('../pipeline');

(async () => {
  // ── shopIdForAccount ────────────────────────────────────────────────
  // the default account keeps its env fallback, exactly as before
  assert.strictEqual(await etsy.shopIdForAccount('default'), '11111111');
  assert.strictEqual(await etsy.shopIdForAccount(), '11111111');
  assert.strictEqual(await etsy.shopIdForAccount(''), '11111111');

  // THE RULE: a named account NEVER inherits the original shop's id
  assert.strictEqual(await etsy.shopIdForAccount('mom'), null);
  assert.strictEqual(await etsy.shopIdForAccount('hats'), null);

  // once connected, a named account resolves to ITS OWN shop
  await etsy.saveTokens(
    { access_token: 'm.aaa', refresh_token: 'm-ref', expires_at: Date.now() + 3600e3, user_id: 'm', shop_id: 22222222 },
    'mom'
  );
  assert.strictEqual(await etsy.shopIdForAccount('mom'), 22222222);
  // ...and the default account is untouched by that
  assert.strictEqual(await etsy.shopIdForAccount('default'), '11111111');

  // an explicit shop_id always wins, for either account
  assert.strictEqual(await etsy.shopIdForAccount('mom', '99'), '99');
  assert.strictEqual(await etsy.shopIdForAccount('default', '99'), '99');

  // a typo'd account name throws rather than quietly meaning "default"
  await assert.rejects(() => etsy.shopIdForAccount('../evil'), /bad_account_name/);

  // ── publishDraft threads the account to BOTH Etsy writes ────────────
  const calls = { draft: null, images: [] };
  const realDraft = etsy.createDraftListing;
  const realUpload = etsy.uploadListingImage;
  etsy.createDraftListing = async (shopId, listing, account) => {
    calls.draft = { shopId, account };
    return { ok: true, status: 201, body: { listing_id: 555 } };
  };
  etsy.uploadListingImage = async (shopId, listingId, url, opts) => {
    calls.images.push({ shopId, account: opts && opts.account });
    return { ok: true, status: 201, body: { listing_image_id: 1 } };
  };

  const res = await pipeline.publishDraft({
    account: 'mom',
    shop_id: 22222222,
    images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    title: 'Hand-forged silver leaf earrings',
    description: 'One of a kind.',
    price: 48,
    taxonomy_id: 1200,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls.draft.account, 'mom', 'draft must be created on the mom account');
  assert.strictEqual(calls.draft.shopId, 22222222);
  assert.strictEqual(calls.images.length, 2);
  for (const img of calls.images) {
    assert.strictEqual(img.account, 'mom', 'every image must upload on the mom account');
  }

  // a caller that predates multi-account still means the original account
  calls.draft = null; calls.images = [];
  await pipeline.publishDraft({
    shop_id: 11111111,
    images: ['https://example.com/a.jpg'],
    title: 'x', description: 'y', price: 5, taxonomy_id: 1,
  });
  assert.strictEqual(calls.draft.account, 'default');
  assert.strictEqual(calls.images[0].account, 'default');

  etsy.createDraftListing = realDraft;
  etsy.uploadListingImage = realUpload;

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('test-etsy-shop-routing: all passed');
})().catch((err) => { console.error(err); process.exit(1); });
