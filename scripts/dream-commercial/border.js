// A hand-drawn-looking ink line around the picture window, on transparent —
// overlaid on a clip already padded in the app's beige. Not a rectangle: the
// path is jittered so it reads as drawn rather than printed. Deterministic
// (a fixed seed), so a re-render gives the same line.
const path = require('path');
const { chromium } = require(path.join('/home/user/imageforge', 'node_modules', 'playwright'));
const W = 1170, H = 2532, PIC_H = 1755;
const top = (H - PIC_H) / 2, bot = top + PIC_H;
const pad = 14;                       // the line sits just outside the picture
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
function side(x1, y1, x2, y2, n = 26) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = (rnd() - 0.5) * 7;      // wobble across the line
    pts.push([x1 + (x2 - x1) * t + (y1 === y2 ? 0 : j), y1 + (y2 - y1) * t + (y1 === y2 ? j : 0)]);
  }
  return pts;
}
const L = pad, R = W - pad, T = top - pad, B = bot + pad;
const loop = [...side(L, T, R, T), ...side(R, T, R, B), ...side(R, B, L, B), ...side(L, B, L, T)];
const d = 'M' + loop.map(p => p.map(v => v.toFixed(1)).join(',')).join(' L') + ' Z';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <path d="${d}" fill="none" stroke="#14131a" stroke-width="4.5"
        stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/></svg>`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await p.screenshot({ path: process.argv[2], omitBackground: true });
  await b.close();
  console.log('wrote', process.argv[2]);
})();
