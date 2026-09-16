#!/usr/bin/env node
/**
 * susanryza-pull.js — pull Susan Ryza Jewelry's own product photos down off
 * her store so they can be used as the RAW image for a restage.
 *
 * WHY: susanryza.com is a Shopify store, so the whole catalogue is readable as
 * JSON with no key and no scraping — `/products.json` paginated. Her finished
 * pieces are shot two ways: necklaces on a beige dress form in a white t-shirt,
 * earrings and bracelets flat on craft paper. Both are the RAW material for
 * `jewelry-restage.js`, which lifts the real piece out of that setting.
 *
 * It pulls the MASTER image (the cdn url with the size suffix and ?v= query
 * stripped), which is the biggest copy Shopify holds — 1400-2500px square.
 *
 * USAGE
 *   node scripts/susanryza-pull.js --out <dir>            # catalogue only (free, fast)
 *   node scripts/susanryza-pull.js --out <dir> --photos   # + download every photo
 *   node scripts/susanryza-pull.js --out <dir> --photos --type Necklace --first
 *
 * Writes <dir>/catalog.json (every finished piece + its photo urls) and, with
 * --photos, <dir>/raw/<productId>_<n>.jpg plus <dir>/raw-index.json.
 * Nothing here spends money — it is her own store's public feed.
 */
const fs = require('fs');
const path = require('path');

const SHOP = 'https://www.susanryza.com';
// Her finished jewelry. Everything else in the store is tools, beads, findings
// and PDF tutorials, which are supplies rather than pieces.
const PIECE_TYPES = ['Necklace', 'Earrings', 'Bracelet', 'Rings'];
const UA = { 'User-Agent': 'Mozilla/5.0 (susanryza-pull)' };

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const has = (name) => process.argv.includes(`--${name}`);

// Shopify serves the master file when the size suffix and cache query are gone.
const master = (src) => src.split('?')[0].replace(/_(\d+x\d*|\d*x\d+|small|medium|large|grande|master)(?=\.[a-z]+$)/i, '');

async function catalogue() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${SHOP}/products.json?limit=250&page=${page}`, { headers: UA });
    if (!res.ok) throw new Error(`products.json page ${page}: ${res.status}`);
    const { products = [] } = await res.json();
    if (!products.length) break;
    out.push(...products);
  }
  return out;
}

function pieces(products, only) {
  const want = only ? [only] : PIECE_TYPES;
  return products
    .filter(p => want.includes(p.product_type) && (p.images || []).length)
    .map(p => ({
      id: p.id,
      handle: p.handle,
      title: p.title,
      type: p.product_type,
      price: (p.variants || [{}])[0].price,
      // the store's own words about the piece, tags stripped
      body: (p.body_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600),
      images: p.images.map(i => master(i.src)),
    }));
}

(async () => {
  const out = arg('out', path.join(process.cwd(), 'susanryza'));
  fs.mkdirSync(out, { recursive: true });

  const products = await catalogue();
  const list = pieces(products, arg('type'));
  fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(list, null, 1));
  const photos = list.reduce((n, m) => n + m.images.length, 0);
  console.log(`catalogue: ${products.length} products → ${list.length} finished pieces, ${photos} photos`);
  for (const t of PIECE_TYPES) {
    const n = list.filter(m => m.type === t).length;
    if (n) console.log(`  ${String(n).padStart(4)}  ${t}`);
  }
  if (!has('photos')) { console.log(`\ncatalog.json written to ${out} (no --photos, nothing downloaded)`); return; }

  const rawDir = path.join(out, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const index = [];
  let got = 0, bytes = 0, failed = 0;
  for (const m of list) {
    // --first keeps it to the one photo that leads the listing
    const urls = has('first') ? m.images.slice(0, 1) : m.images;
    for (const [n, url] of urls.entries()) {
      const ext = path.extname(url.split('?')[0]) || '.jpg';
      const file = path.join(rawDir, `${m.id}_${n}${ext}`);
      const rel = path.relative(out, file);
      if (fs.existsSync(file)) { index.push({ ...m, images: undefined, file: rel, src: url, n }); continue; }
      try {
        const res = await fetch(url, { headers: UA });
        if (!res.ok) throw new Error(String(res.status));
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(file, buf);
        got++; bytes += buf.length;
        index.push({ ...m, images: undefined, file: rel, src: url, n });
      } catch (err) { failed++; console.log(`  FAIL ${url} — ${err.message}`); }
    }
  }
  fs.writeFileSync(path.join(out, 'raw-index.json'), JSON.stringify(index, null, 1));
  console.log(`photos: ${got} downloaded (${(bytes / 1e6).toFixed(1)} MB)${failed ? `, ${failed} failed` : ''} → ${rawDir}`);
})().catch(err => { console.error(err.message); process.exit(1); });
