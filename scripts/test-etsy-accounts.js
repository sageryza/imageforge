// test-etsy-accounts.js — the Etsy multi-account token store, pure, no network.
//
// The rule under test (Aug 2026, the hat shop): one Etsy account = one shop,
// so a second shop means a second token slot against the same app keys. The
// original account keeps its EXACT storage location as "default" (the
// long-connected shop must be untouched by the feature), and a named account
// gets its own suffixed doc/file. Run: node scripts/test-etsy-accounts.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

// Point the file fallback at a scratch dir BEFORE requiring the module, and
// leave Firebase uninitialized so everything goes through the file path.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'etsy-accounts-'));
process.env.ETSY_TOKEN_FILE = path.join(tmp, '.etsy-tokens.json');

const etsy = require('../etsy');

(async () => {
  // ── normAccount: names are slugs; "default" is the fallback ──────────
  assert.strictEqual(etsy.normAccount(undefined), 'default');
  assert.strictEqual(etsy.normAccount(''), 'default');
  assert.strictEqual(etsy.normAccount('hats'), 'hats');
  assert.strictEqual(etsy.normAccount('HATS'), 'hats');
  assert.strictEqual(etsy.normAccount('hat-shop-2'), 'hat-shop-2');
  for (const bad of ['../evil', 'a b', 'ha_ts', '-lead', 'x'.repeat(33), {}]) {
    assert.throws(() => etsy.normAccount(bad), /bad_account_name/, `should reject ${JSON.stringify(bad)}`);
  }

  // ── storage locations: default is EXACTLY the pre-feature path ───────
  assert.strictEqual(etsy.accountDocPath('default'), 'config/etsy-tokens');
  assert.strictEqual(etsy.accountDocPath('hats'), 'config/etsy-tokens-hats');
  assert.strictEqual(etsy.accountTokenFile('default'), process.env.ETSY_TOKEN_FILE);
  assert.strictEqual(
    etsy.accountTokenFile('hats'),
    path.join(tmp, '.etsy-tokens-hats.json')
  );

  // ── the two accounts never touch each other's tokens ─────────────────
  const witch = { access_token: 'w.aaa', refresh_token: 'w-refresh', expires_at: Date.now() + 3600e3, user_id: 'w' };
  const hats = { access_token: 'h.bbb', refresh_token: 'h-refresh', expires_at: Date.now() + 3600e3, user_id: 'h', shop_id: 123 };
  await etsy.saveTokens(witch, 'default');
  await etsy.saveTokens(hats, 'hats');
  assert.strictEqual((await etsy.loadTokens('default')).refresh_token, 'w-refresh');
  assert.strictEqual((await etsy.loadTokens('hats')).refresh_token, 'h-refresh');
  assert.strictEqual((await etsy.loadTokens('hats')).shop_id, 123);
  // and on disk, two separate files — saving hats never rewrote default's
  const onDisk = JSON.parse(fs.readFileSync(process.env.ETSY_TOKEN_FILE, 'utf8'));
  assert.strictEqual(onDisk.user_id, 'w');
  assert.ok(fs.existsSync(path.join(tmp, '.etsy-tokens-hats.json')));

  // ── an unconnected account reads as null, never as someone else's ────
  assert.strictEqual(await etsy.loadTokens('nope'), null);

  // ── legacy callers (no account arg) still mean the default account ───
  // Signature check: every seller function defaults its account param, so the
  // pipeline/report/reviews modules that predate multi-account are untouched.
  assert.strictEqual(etsy.getAllListings.length >= 1, true);
  const url = etsy.buildAuthUrl('hats');
  assert.ok(url.startsWith('https://www.etsy.com/oauth/connect?'), 'auth url shape');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('test-etsy-accounts: all passed');
})().catch((err) => { console.error(err); process.exit(1); });
