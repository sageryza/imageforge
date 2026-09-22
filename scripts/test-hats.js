#!/usr/bin/env node
'use strict';
// test-hats.js — the hat store (hats.js + public/hats.html).
//
// 1. shapeProduct on a Storefront fixture, pure: the synthetic Default Title
//    option never becomes a chip row, the price is the cheapest variant, a
//    product with no sellable variant is not available.
// 2. The real router over a stubbed Storefront (fetch replaced): collection
//    first, tag fallback, the 10-minute cache, the variant id checked before
//    a cart is created.
// 3. The real page in headless Chromium (skipped cleanly without playwright)
//    against a stubbed /api/hats: the grid, the sheet, the option chips
//    (a sold-out combination struck through, Buy off until every option is
//    picked), and Buy POSTing the right variant then following checkoutUrl —
//    every assertion a MEASUREMENT off the rendered page.
const path = require('path');
const fs = require('fs');
const http = require('http');
const assert = require('assert');
const ROOT = path.join(__dirname, '..');

let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ✓ ' + m); } else { failed++; console.log('  ✗ ' + m); } };

const FIXTURE = {
  id: 'gid://shopify/Product/1', handle: 'bucket-hat', title: 'Bucket hat', descriptionHtml: '<p>Cotton twill.</p>',
  tags: ['hats'], availableForSale: true,
  images: { edges: [{ node: { url: 'https://cdn/a.jpg' } }, { node: { url: 'https://cdn/b.jpg' } }] },
  options: [{ name: 'Size', values: ['S', 'M'] }, { name: 'Color', values: ['Cream', 'Black'] }],
  variants: { edges: [
    { node: { id: 'gid://shopify/ProductVariant/11', title: 'S / Cream', availableForSale: true, price: { amount: '28.0', currencyCode: 'USD' }, compareAtPrice: null, image: { url: 'https://cdn/a.jpg' }, selectedOptions: [{ name: 'Size', value: 'S' }, { name: 'Color', value: 'Cream' }] } },
    { node: { id: 'gid://shopify/ProductVariant/12', title: 'S / Black', availableForSale: false, price: { amount: '28.0', currencyCode: 'USD' }, compareAtPrice: null, image: { url: 'https://cdn/b.jpg' }, selectedOptions: [{ name: 'Size', value: 'S' }, { name: 'Color', value: 'Black' }] } },
    { node: { id: 'gid://shopify/ProductVariant/13', title: 'M / Cream', availableForSale: true, price: { amount: '30.0', currencyCode: 'USD' }, compareAtPrice: { amount: '36.0' }, image: null, selectedOptions: [{ name: 'Size', value: 'M' }, { name: 'Color', value: 'Cream' }] } },
    { node: { id: 'gid://shopify/ProductVariant/14', title: 'M / Black', availableForSale: true, price: { amount: '30.0', currencyCode: 'USD' }, compareAtPrice: null, image: { url: 'https://cdn/b.jpg' }, selectedOptions: [{ name: 'Size', value: 'M' }, { name: 'Color', value: 'Black' }] } },
  ] },
};
const PLAIN = {
  id: 'gid://shopify/Product/2', handle: 'beanie', title: 'Beanie', descriptionHtml: '', tags: ['hats'], availableForSale: true,
  images: { edges: [{ node: { url: 'https://cdn/c.jpg' } }] },
  options: [{ name: 'Title', values: ['Default Title'] }],
  variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/21', title: 'Default Title', availableForSale: true, price: { amount: '22.0', currencyCode: 'USD' }, compareAtPrice: null, image: null, selectedOptions: [{ name: 'Title', value: 'Default Title' }] } }] },
};
const GONE = {
  id: 'gid://shopify/Product/3', handle: 'visor', title: 'Visor', descriptionHtml: '', tags: ['hats'], availableForSale: false,
  images: { edges: [] }, options: [{ name: 'Title', values: ['Default Title'] }],
  variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/31', title: 'Default Title', availableForSale: false, price: { amount: '18.0', currencyCode: 'USD' }, compareAtPrice: null, image: null, selectedOptions: [{ name: 'Title', value: 'Default Title' }] } }] },
};

// ── 1. the shape ──
console.log('shape');
const H = require(path.join(ROOT, 'hats.js'));
const b = H.shapeProduct(FIXTURE);
ok(b.options.length === 2 && b.options[0].name === 'Size', 'two real options become two rows');
ok(H.shapeProduct(PLAIN).options.length === 0, 'the synthetic Default Title option is not a row');
ok(b.price === '28' || b.price === '28.0', 'the price is the cheapest variant (' + b.price + ')');
ok(b.priceMax === '30' || b.priceMax === '30.0', 'and the top of the range rides beside it');
ok(b.available === true && H.shapeProduct(GONE).available === false, 'a hat with no sellable variant is not available');
ok(b.variants[2].compareAt === '36.0' && b.variants[2].options.Color === 'Cream', 'a variant keeps its compare-at price and its option map');
ok(b.images.length === 2 && b.image === 'https://cdn/a.jpg', 'the first picture leads');
ok(H.shapeProduct(null) === null, 'nothing in, nothing out');

console.log('add');
const plan = H.productPlan({ title: 'god complex', price: '32', imageUrl: 'https://storage/x.png', tags: ['cap'] });
ok(plan.product.title === 'god complex' && plan.product.variants[0].price === '32.00', 'a hat plans as one product with one variant at the price');
ok(/\bhats\b/.test(plan.product.tags) && /\bcap\b/.test(plan.product.tags), 'it is tagged hats, plus hers');
ok(plan.product.published === true && plan.product.status === 'active', 'published to the Online Store, so the page sees it at once');
ok(plan.product.images.length === 1 && plan.product.images[0].src === 'https://storage/x.png', 'the picture rides by its public url');
let threw = ''; try { H.productPlan({ title: 'x' }); } catch (e) { threw = e.message; }
ok(/price required/.test(threw), 'no price, no product');
threw = ''; try { H.productPlan({ price: 3, imageUrl: 'http://insecure/x.png' }); } catch (e) { threw = e.message; }
ok(/title required/.test(threw), 'no title, no product');
ok(H.productPlan({ title: 'x', price: 3, imageUrl: 'http://insecure/x.png' }).product.images.length === 0, 'a non-https picture is dropped rather than sent');
ok(H.productPlan({ title: 'x', price: 27, compareAt: 976 }).product.variants[0].compare_at_price === '976.00', 'a was-price rides as compare_at_price');
ok(!('compare_at_price' in H.productPlan({ title: 'x', price: 27, compareAt: 20 }).product.variants[0]), 'a was-price below the price is dropped');

// ── 2. the router over a stubbed store ──
(async () => {
  console.log('router');
  const express = require('express');
  const realFetch = global.fetch;
  const sent = [];
  let haveCollection = false;
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    sent.push(body);
    const q = body.query;
    let data;
    if (/collection\(handle/.test(q)) data = { collection: haveCollection ? { title: 'Hats', products: { edges: [{ node: FIXTURE }] } } : null };
    else if (/products\(first/.test(q)) data = { products: { edges: [{ node: FIXTURE }, { node: PLAIN }, { node: GONE }] } };
    else if (/cartCreate/.test(q)) data = { cartCreate: { cart: { id: 'gid://shopify/Cart/1', checkoutUrl: 'https://cod-god-inc.myshopify.com/checkouts/abc' }, userErrors: [] } };
    else data = {};
    return { json: async () => ({ data }) };
  };
  const app = express();
  app.use('/api/hats', H.router);
  const srv = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const get = p => realFetch(base + p).then(r => r.json());
  const post = (p, body) => realFetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, j: await r.json() }));

  let j = await get('/api/hats/products?fresh=1');
  ok(j.source === 'tag:hats' && j.hats.length === 3, 'no collection → the hats are the tagged products (' + j.source + ')');
  ok(sent.length === 2, 'that took two store reads (collection, then tag)');
  j = await get('/api/hats/products');
  ok(j.cached === true && sent.length === 2, 'the second read is the cache — no store call');
  haveCollection = true;
  j = await get('/api/hats/products?fresh=1');
  ok(j.source === 'collection:hats' && j.hats.length === 1, 'a collection wins once it exists (' + j.source + ')');
  ok(sent.length === 3, 'and costs one read');
  let c = await post('/api/hats/checkout', { variantId: 'gid://shopify/ProductVariant/13', quantity: 1 });
  ok(c.status === 200 && /checkouts\/abc$/.test(c.j.checkoutUrl), 'checkout answers Shopify\'s checkout url');
  ok(sent[sent.length - 1].variables.lines[0].merchandiseId === 'gid://shopify/ProductVariant/13', 'with the variant she picked in the cart');
  c = await post('/api/hats/checkout', { variantId: 'nope' });
  ok(c.status === 400, 'a variant id that is not a Shopify gid is refused before any cart is made');
  c = await post('/api/hats/checkout', { variantId: 'gid://shopify/ProductVariant/13', quantity: 999 });
  ok(sent[sent.length - 1].variables.lines[0].quantity === 20, 'quantity is capped');
  const before = sent.length;
  const dry = await post('/api/hats/add', { title: 'insecure', price: 30, imageUrl: 'https://storage/i.png', dry: true });
  ok(dry.status === 200 && dry.j.dry === true && dry.j.plan.product.title === 'insecure' && sent.length === before, 'a dry add answers the plan and touches no store');
  const bad = await post('/api/hats/add', { title: 'insecure' });
  ok(bad.status === 400, 'an add with no price is a 400');
  const st = await get('/api/hats/status');
  ok(st.ok && st.collection === 'hats' && !('token' in st), 'status says the collection and never the token');
  srv.close();
  global.fetch = realFetch;

  // ── 3. the page ──
  console.log('page');
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) {
    try { ({ chromium } = require('playwright-core')); } catch (__) {
      console.log('  hats page: playwright not installed — skipped');
      return done();
    }
  }
  const exe = () => {
    const root = '/opt/pw-browsers';
    try { for (const d of fs.readdirSync(root)) { const p = path.join(root, d, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p; } } catch (e) { /* playwright's own lookup */ }
    return undefined;
  };
  const hats = [FIXTURE, PLAIN, GONE].map(H.shapeProduct);
  const calls = [];
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let chunks = [];
    req.on('data', ch => chunks.push(ch));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      calls.push({ m: req.method, p: u.pathname, body: body ? JSON.parse(body) : null });
      if (u.pathname === '/hats') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(path.join(ROOT, 'public', 'hats.html'))); }
      if (u.pathname === '/api/hats/products') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ hats, source: 'tag:hats' })); }
      if (u.pathname === '/api/hats/checkout') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ checkoutUrl: `http://127.0.0.1:${server.address().port}/checkout-landed` })); }
      if (/^\/fonts\/.+\.ttf$/.test(u.pathname)) { const f = path.join(ROOT, 'public', u.pathname); if (fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'font/ttf' }); return res.end(fs.readFileSync(f)); } }
      if (u.pathname === '/checkout-landed') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<title>checkout</title>landed'); }
      res.writeHead(404); res.end();
    });
  });
  await new Promise(r => server.listen(0, r));
  const base2 = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: exe() });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.route(/https:\/\/cdn\//, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  page.on('pageerror', e => { failed++; console.log('  ✗ page error: ' + e.message); });
  await page.goto(base2 + '/hats');
  await page.waitForFunction(() => document.querySelectorAll('#grid .hat').length === 3, null, { timeout: 5000 });

  ok((await page.$$eval('h1', els => els.length)) === 1 && (await page.$eval('h1', el => el.textContent)) === 'mister psychology', 'the title, once');
  ok(await page.$eval('#helpcard', el => el.hidden), 'the how-to is behind the ?');
  const cols = await page.$$eval('#grid .hat', els => new Set(els.map(e => Math.round(e.getBoundingClientRect().left))).size);
  ok(cols === 2, 'two across on a phone (measured ' + cols + ' columns)');
  ok((await page.$eval('#grid .hat:nth-child(1) .price', el => el.textContent)) === '$28–30', 'a range reads as one line ($28–30)');
  ok((await page.$eval('#grid .hat:nth-child(1) .price s', el => !el).catch(() => true)), 'no was-price on the tile when only one variant carries one');
  ok(await page.$eval('#grid .hat:nth-child(3)', el => el.classList.contains('out')), 'a sold-out hat is marked');
  const r1 = await page.$eval('#grid .hat:nth-child(1) .pic', el => { const r = el.getBoundingClientRect(); return Math.abs(r.width - r.height) < 1; });
  ok(r1, 'the picture is square');
  const rad = await page.$eval('#grid .hat:nth-child(1) .pic', el => getComputedStyle(el).borderRadius);
  ok(rad === '0px', 'the grid photos are plain squares (an instagram grid, no frames)');
  const ff = await page.$eval('h1', el => getComputedStyle(el).fontFamily);
  ok(/Alte Haas Grotesk/.test(ff), 'the type is Alte Haas Grotesk (' + ff.split(',')[0] + ')');
  const fontsOk = await page.evaluate(() => document.fonts.check('700 28px "Alte Haas Grotesk"'));
  ok(fontsOk, 'and the font file really loaded');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  ok(bg === 'none', 'no gradients');

  // the sheet
  await page.click('#grid .hat:nth-child(1)');
  await page.waitForFunction(() => !document.querySelector('#sheet').hidden);
  ok((await page.$eval('#title', el => el.textContent)) === 'Bucket hat', 'tapping a hat opens its sheet');
  ok(await page.evaluate(() => document.body.classList.contains('locked')), 'the page behind it is frozen');
  ok((await page.$$eval('#pics img', els => els.length)) === 2 && (await page.$$eval('#dots i', els => els.length)) === 2, 'both pictures, two dots');
  ok((await page.$$eval('#opts .opt', els => els.length)) === 2, 'Size and Color are chip rows');
  ok(await page.$eval('#buy', el => el.disabled) && (await page.$eval('#buymsg', el => el.textContent)) === 'pick a size', 'Buy waits for a size');
  await page.click('.chip[data-opt="Size"][data-val="S"]');
  ok(await page.$eval('.chip[data-opt="Color"][data-val="Black"]', el => el.classList.contains('gone')), 'S / Black is sold out, so Black is struck through once S is picked');
  ok(await page.$eval('#buy', el => el.disabled) && (await page.$eval('#buymsg', el => el.textContent)) === 'pick a color', 'and Buy still waits for a colour');
  await page.click('.chip[data-opt="Color"][data-val="Black"]');
  ok(await page.$eval('#buy', el => el.disabled) && (await page.$eval('#buymsg', el => el.textContent)) === 'sold out', 'picking the struck one says sold out');
  await page.click('.chip[data-opt="Size"][data-val="M"]');
  ok(!(await page.$eval('#buy', el => el.disabled)) && (await page.$eval('#buy', el => el.textContent)) === 'buy · $30', 'M / Black is for sale at its own price');
  const bw = await page.$eval('#buy', el => el.getBoundingClientRect().width);
  ok(bw < 160, 'the Buy button hugs its words (' + Math.round(bw) + 'px)');
  await page.click('.chip[data-opt="Color"][data-val="Cream"]');
  ok((await page.$eval('#sprice s', el => el.textContent)) === '$36', 'a compare-at price is struck beside the real one');
  const chipRad = await page.$eval('.chip', el => getComputedStyle(el).borderRadius);
  ok(chipRad === '6px', 'chips are rounded squares, not pills');

  // close and reopen from the hash
  await page.click('#close');
  ok(await page.$eval('#sheet', el => el.hidden) && !(await page.evaluate(() => document.body.classList.contains('locked'))), 'the chevron closes the sheet and unfreezes the page');
  await page.goto(base2 + '/hats#beanie');
  await page.waitForFunction(() => !document.querySelector('#sheet').hidden, null, { timeout: 5000 });
  ok((await page.$eval('#title', el => el.textContent)) === 'Beanie', 'a link with the hat in the hash opens on that hat');
  ok((await page.$$eval('#opts .opt', els => els.length)) === 0 && !(await page.$eval('#buy', el => el.disabled)), 'a hat with no options is ready to buy');

  // buying
  await page.click('#buy');
  await page.waitForFunction(() => document.title === 'checkout', null, { timeout: 5000 });
  const co = calls.find(c => c.p === '/api/hats/checkout');
  ok(co && co.body.variantId === 'gid://shopify/ProductVariant/21' && co.body.quantity === 1, 'Buy POSTs the picked variant');
  ok(/checkout-landed$/.test(page.url()), 'and the page follows the checkout url');

  if (process.env.HATS_SHOTS) {
    fs.mkdirSync(process.env.HATS_SHOTS, { recursive: true });
    await page.goto(base2 + '/hats'); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(process.env.HATS_SHOTS, 'grid.png') });
    await page.click('#grid .hat:nth-child(1)'); await page.waitForTimeout(300);
    await page.click('.chip[data-opt="Size"][data-val="S"]'); await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(process.env.HATS_SHOTS, 'sheet.png') });
    await page.click('#close'); await page.click('#help'); await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(process.env.HATS_SHOTS, 'help.png') });
  }
  await browser.close();
  server.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });

function done() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
