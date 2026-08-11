// The INFO BACK of a monster card: cream parchment, semi-decorative double
// border with corner flourishes, the monster's name, where/when, and the lore.
// Composed as SVG -> PNG on purpose: an image model cannot spell a paragraph
// reliably, and this way the text stays crisp and editable without re-rolling.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const W = 329, H = 500;                 // matches the cut card fronts exactly
const CREAM = '#efe3cc', INK = '#2f2820', FADE = '#6b5f4c';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// crude but reliable wrap: measure by character width at the given size
function wrap(text, size, width, tracking) {
  // measured against the rendered card: 0.485 overran the frame. 0.56 (plus any
  // letter-spacing) keeps every line inside the inner border.
  const per = size * 0.56 + (tracking || 0);
  const max = Math.floor(width / per);
  const words = text.split(/\s+/); const lines = []; let line = '';
  for (const w of words) {
    if (!line) { line = w; continue; }
    if ((line + ' ' + w).length <= max) line += ' ' + w; else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

// one vine flourish, mirrored into all four corners
const corner = (c) => `<path d="M8 26 C8 14 14 8 26 8 M13 26 C13 18 18 13 26 13
  M15 15 C19 11 24 12 25 16 C26 20 22 23 19 21" fill="none" stroke="${c}"
  stroke-width="1.4" stroke-linecap="round"/>
  <circle cx="10.5" cy="10.5" r="1.6" fill="${c}"/>`;

function backSVG(m) {
  const accent = m.accent || '#4a5a6b';
  const pad = 20, iw = W - pad * 2;
  const nameLines = wrap(m.name.toUpperCase(), 19, iw - 14, 1.6);
  let y = 74;
  const nameSvg = nameLines.map(l => {
    const t = `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="DejaVu Serif" font-size="19" letter-spacing="1.6" fill="${INK}">${esc(l)}</text>`;
    y += 24; return t;
  }).join('');
  y += 2;
  const rule = `<line x1="${pad + 26}" y1="${y}" x2="${W - pad - 26}" y2="${y}" stroke="${accent}" stroke-width="1"/>
    <circle cx="${W / 2}" cy="${y}" r="2.6" fill="${accent}"/>`;
  y += 22;
  const whereSvg = wrap(m.where, 11.5, iw - 14).map(l => {
    const t = `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="DejaVu Serif" font-size="11.5" font-style="italic" fill="${FADE}">${esc(l)}</text>`;
    y += 15; return t;
  }).join('');
  y += 12;
  const loreSvg = wrap(m.lore, 13, iw - 14).map(l => {
    const t = `<text x="${pad + 7}" y="${y}" font-family="DejaVu Serif" font-size="13" fill="${INK}">${esc(l)}</text>`;
    y += 18.4; return t;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <rect x="9.5" y="9.5" width="${W - 19}" height="${H - 19}" fill="none" stroke="${accent}" stroke-width="1.6"/>
  <rect x="14.5" y="14.5" width="${W - 29}" height="${H - 29}" fill="none" stroke="${accent}" stroke-width="0.7"/>
  <g>${corner(accent)}</g>
  <g transform="translate(${W},0) scale(-1,1)">${corner(accent)}</g>
  <g transform="translate(0,${H}) scale(1,-1)">${corner(accent)}</g>
  <g transform="translate(${W},${H}) scale(-1,-1)">${corner(accent)}</g>
  ${nameSvg}${rule}${whereSvg}${loreSvg}
  <text x="${W / 2}" y="${H - 30}" text-anchor="middle" font-family="DejaVu Serif" font-size="15" fill="${accent}">✦</text>
  <text x="${W / 2}" y="${H - 15}" text-anchor="middle" font-family="DejaVu Serif" font-size="7.6" letter-spacing="2.4" fill="${FADE}">MONSTERS OF AMERICA</text>
</svg>`;
}

async function render(m, out) {
  await sharp(Buffer.from(backSVG(m))).png().toFile(out);
  return out;
}

module.exports = { render, backSVG, W, H };

if (require.main === module) {
  const monsters = JSON.parse(fs.readFileSync(path.join(__dirname, process.argv[2] || 'lore-sample.json'), 'utf8'));
  const dir = path.join(__dirname, 'backs-info');
  fs.mkdirSync(dir, { recursive: true });
  (async () => {
    for (const m of monsters) {
      await render(m, path.join(dir, `${m.id}.png`));
      console.log('back', m.id);
    }
  })();
}
