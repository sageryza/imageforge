// Front name plate, v2 (Sophie): a cream ROUNDED RECTANGLE with a black
// outline, tiny flourishes either side of the name, and it must NOT touch the
// bottom edge — it sits a little above it.
// Composited in code, never prompted — the model cannot spell 54 names.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CREAM = '#efe3cc', INK = '#1f1a14';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// width is MEASURED off a real render — a character-width factor overflowed on
// "HONEY ISLAND SWAMP MONSTER" because caps are far wider than body text.
async function inkWidth(text, size, track) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="${Math.ceil(size * 3)}">
    <text x="10" y="${size * 1.6}" font-family="DejaVu Serif" font-size="${size}"
      letter-spacing="${track}" fill="#000">${esc(text)}</text></svg>`;
  try {
    const { info } = await sharp(Buffer.from(svg)).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    return info.width;
  } catch { return 0; }
}
async function fit(name, width, max = 16, min = 8) {
  for (let s = max; s >= min; s -= 0.5) {
    const track = s > 12.5 ? 1.4 : 0.9;
    if (await inkWidth(name, s, track) <= width) return { size: s, track };
  }
  return { size: min, track: 0.6 };
}

// a small four-point fleuron — the "tiny fancy stuff" either side of the name
const fleuron = (x, y, c) => `<g stroke="${c}" stroke-width="1" fill="none">
  <path d="M${x} ${y - 5} L${x + 1.9} ${y} L${x} ${y + 5} L${x - 1.9} ${y} Z" fill="${c}"/>
  <path d="M${x - 7} ${y} h3.4 M${x + 3.6} ${y} h3.4"/></g>`;

async function plateSVG(name, W, H) {
  const up = name.toUpperCase();
  const bottomGap = 20;                 // "it shouldn't touch the bottom"
  const ph = 40, px = 20;
  const pw = W - px * 2, py = H - bottomGap - ph;
  const r = 7;                          // rounded rectangle, NOT a pill

  // flourishes get their space only if the name still reads at a decent size
  let { size, track } = await fit(up, pw - 78);
  let orn = true;
  if (size < 11) { ({ size, track } = await fit(up, pw - 26)); orn = false; }

  const cy = py + ph / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${r}" ry="${r}"
        fill="${CREAM}" stroke="${INK}" stroke-width="1.7"/>
  <rect x="${px + 4}" y="${py + 4}" width="${pw - 8}" height="${ph - 8}" rx="${r - 3}" ry="${r - 3}"
        fill="none" stroke="${INK}" stroke-width="0.6" opacity="0.45"/>
  ${orn ? fleuron(px + 21, cy, INK) + fleuron(px + pw - 21, cy, INK) : ''}
  <text x="${W / 2}" y="${cy + size * 0.35}" text-anchor="middle"
        font-family="DejaVu Serif" font-size="${size}" letter-spacing="${track}"
        fill="${INK}">${esc(up)}</text>
  <rect x="4.5" y="4.5" width="${W - 9}" height="${H - 9}" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.75"/>
  <rect x="8.5" y="8.5" width="${W - 17}" height="${H - 17}" fill="none" stroke="${INK}" stroke-width="0.6" opacity="0.5"/>
</svg>`;
}

async function label(src, name, out) {
  const img = sharp(src);
  const { width: W, height: H } = await img.metadata();
  const buf = await img.composite([{ input: Buffer.from(await plateSVG(name, W, H)), top: 0, left: 0 }]).png().toBuffer();
  fs.writeFileSync(out, buf);
  return buf;
}
module.exports = { label, plateSVG };

if (require.main === module) {
  const cards = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards.json'), 'utf8'));
  const dir = path.join(__dirname, 'cards-labeled2');
  fs.mkdirSync(dir, { recursive: true });
  (async () => {
    for (const c of cards) await label(c.local, c.name, path.join(dir, `${c.id}.png`));
    console.log('labeled v2:', cards.length);
  })();
}
