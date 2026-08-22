// A hand-drawn-looking ink line, rendered to a transparent PNG for overlaying
// on a clip that has already been padded in the app's beige.
//
//   node border.js out.png [canvasW canvasH picX picY picW picH]
//
// Defaults to the film's canvas (1170x2532 with a 1170x1755 picture centred).
// Pass the six numbers to frame a picture anywhere else — the standalone
// exports keep their clips at native size and grow the canvas instead, so the
// window is not the same shape there.
//
// The path is JITTERED rather than a rectangle: Sophie's own clips carry a
// drawn border, and a geometric one reads as printed next to them. The seed is
// fixed, so re-rendering gives the same line instead of a new wobble.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const a = process.argv.slice(3).map(Number);
const W = a[0] || 1170, H = a[1] || 2532;
const PX = a.length > 2 ? a[2] : 0;
const PY = a.length > 3 ? a[3] : (H - 1755) / 2;
const PW = a.length > 4 ? a[4] : 1170;
const PH = a.length > 5 ? a[5] : 1755;
const OUT = 3;                        // the line hugs the picture, just outside it

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
const L = Math.max(2, PX - OUT), R = Math.min(W - 2, PX + PW + OUT);
const T = Math.max(2, PY - OUT), B = Math.min(H - 2, PY + PH + OUT);
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
  console.log('wrote', process.argv[2], `${W}x${H}, window ${PW}x${PH} at ${PX},${PY}`);
})();
