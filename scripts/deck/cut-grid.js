// Cut each 3x3 grid into its nine individual cards.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const bucket = getStorage().bucket();

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const short = (p) => p.replace(/^the /, '').replace(/^a /, '').split(',')[0];
// the panels sit inside a thin double-line frame; INSET drops that frame line
// off each cut so a card doesn't carry half of its neighbour's border.
const INSET = Number(process.env.INSET || 6);

(async () => {
  const { results } = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest3.json'), 'utf8'));
  const grids = results.filter(r => r.url);
  fs.mkdirSync(path.join(__dirname, 'cards'), { recursive: true });
  const out = [];
  for (const g of grids) {
    const meta = await sharp(g.local).metadata();
    const cw = Math.floor(meta.width / 3), ch = Math.floor(meta.height / 3);
    for (let i = 0; i < 9; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const buf = await sharp(g.local).extract({
        left: col * cw + INSET, top: row * ch + INSET,
        width: cw - INSET * 2, height: ch - INSET * 2,
      }).png().toBuffer();
      const name = short(g.panels[i]);
      const id = slug(name);
      const local = path.join(__dirname, 'cards', `${id}.png`);
      fs.writeFileSync(local, buf);
      const p = `deck-samples/monsters/cards/${id}.png`;
      const f = bucket.file(p);
      await f.save(buf, { metadata: { contentType: 'image/png' } });
      await f.makePublic();
      const webp = await sharp(buf).webp({ quality: 84 }).toBuffer();
      const wp = `deck-samples/monsters/cards/webp/${id}.webp`;
      const wf = bucket.file(wp);
      await wf.save(webp, { metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
      await wf.makePublic();
      out.push({ id, name, grid: g.id, gridTitle: g.title, panel: i + 1,
        panelPrompt: g.panels[i], gridContent: g.content, local,
        url: `https://storage.googleapis.com/${bucket.name}/${p}`,
        webpUrl: `https://storage.googleapis.com/${bucket.name}/${wp}`,
        w: cw - INSET * 2, h: ch - INSET * 2, created: Date.now() });
    }
    console.log('cut', g.id);
  }
  fs.writeFileSync(path.join(__dirname, 'cards.json'), JSON.stringify(out, null, 2));
  console.log('cards:', out.length, `${out[0].w}x${out[0].h} each`);
})().catch(e => { console.error(e); process.exit(1); });
