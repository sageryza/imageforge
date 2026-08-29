// "CLEARING THINGS UP" title overlay — real type (never model-drawn text),
// transparent PNG at the clip's own size, composited by assemble.sh.
//
// v4 (Sophie: "a font that looks more hand drawn, but still blocky" + "one
// line, no line breaks"): heavy sans caps on ONE line, made hand-drawn two
// ways at once —
//   1. every glyph is placed INDIVIDUALLY with its own tilt and baseline
//      drift, by OPTICAL spacing (measured ink width + a fixed gap), which is
//      how a person letters a sign; a <text> run cannot do this because
//      librsvg ignores SVG's per-glyph `rotate`/`dy` lists (measured).
//   2. an feTurbulence displacement chews the edges so the strokes waver and
//      thicken like brush ink instead of reading as a font.
// The block is then rotated onto the star trail's diagonal and SCALED TO FIT
// the frame, so one line always lands inside the picture whatever the words.
const sharp = require('sharp');

const W = Number(process.argv[2] || 784);
const H = Number(process.argv[3] || 1168);
const OUT = process.argv[4] || 'title.png';
const ANGLE = Number(process.argv[5] || 0);
const TEXT = process.argv[6] || 'CLEARING THINGS UP';

const FONT = 'DejaVu Sans';       // blocky, heavy caps
const REF = 200;                  // measuring size; the fit scales from here
const GAP = 0.13 * REF;           // optical space between letters
const SPACE = 0.30 * REF;         // width of a word space
const TILT = 3.2;                 // max per-letter rotation, degrees
const DRIFT = 0.045 * REF;        // max per-letter baseline drift
const PAD = 34;                   // keep the line off the frame edge
const INK = 8;                    // displacement strength, final pixels
const INK_FREQ = 0.055;           // noise wavelength: fine enough to CHEW the
const INK_OCT = 4;                // stroke edges, not shove whole letters about
                                  // (both picked by rendering variants at the
                                  // final 77px letter size, not at a preview size)

// deterministic jitter — the same words always letter the same way, so a
// re-render is never a different title.
function rand(i, salt) {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const glyph = ch => `<text x="0" y="${REF}" font-family="${FONT}" font-weight="bold"
   font-size="${REF}" fill="#fff" xml:space="preserve">${ch === '&' ? '&amp;' : ch}</text>`;

// Measure one character's INK box relative to its origin: render it alone on a
// transparent canvas and trim. Advance widths are not exposed to us, and ink
// widths are what optical spacing wants anyway.
async function measure(ch) {
  const box = REF * 2;
  const svg = `<svg width="${box}" height="${box}" xmlns="http://www.w3.org/2000/svg">${glyph(ch)}</svg>`;
  const { info } = await sharp(Buffer.from(svg)).trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, left: -(info.trimOffsetLeft || 0), top: -(info.trimOffsetTop || 0) };
}

(async () => {
  const chars = [...TEXT];
  const seen = new Map();
  for (const ch of chars) if (ch !== ' ' && !seen.has(ch)) seen.set(ch, await measure(ch));

  // lay the one line out left to right, in reference units
  let x = 0, minY = Infinity, maxY = -Infinity;
  const placed = [];
  chars.forEach((ch, i) => {
    if (ch === ' ') { x += SPACE; return; }
    const m = seen.get(ch);
    const dy = rand(i, 1) * DRIFT;
    placed.push({ ch, x: x - m.left, dy, rot: rand(i, 2) * TILT, cx: x + m.w / 2, cy: m.top - REF + m.h / 2 + dy });
    minY = Math.min(minY, m.top - REF + dy);
    maxY = Math.max(maxY, m.top - REF + m.h + dy);
    x += m.w + GAP;
  });

  // fit the ROTATED block inside the frame
  const inkW = x - GAP, inkH = maxY - minY;
  const a = Math.abs(ANGLE) * Math.PI / 180;
  const scale = Math.min(
    (W - PAD * 2) / (inkW * Math.cos(a) + inkH * Math.sin(a)),
    (H - PAD * 2) / (inkW * Math.sin(a) + inkH * Math.cos(a)),
  );

  const body = placed.map(p =>
    `<g transform="rotate(${p.rot.toFixed(2)}, ${p.cx.toFixed(1)}, ${p.cy.toFixed(1)})">
       <g transform="translate(${p.x.toFixed(1)}, ${p.dy.toFixed(1)})">${glyph(p.ch)}</g>
     </g>`).join('\n');

  // The filter rides the OUTER group, so `scale` is in final pixels and the
  // wobble stays the same weight whatever size the words are fitted to.
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<filter id="ink" x="-15%" y="-40%" width="130%" height="180%">
  <feTurbulence type="fractalNoise" baseFrequency="${INK_FREQ}" numOctaves="${INK_OCT}" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="${INK}" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<g filter="url(#ink)">
 <g transform="translate(${W / 2}, ${H * 0.47}) rotate(${ANGLE}) scale(${scale.toFixed(4)}) translate(${(-inkW / 2).toFixed(1)}, ${(-(minY + maxY) / 2).toFixed(1)})">
  ${body}
 </g>
</g></svg>`;

  await sharp(Buffer.from(svg)).png().toFile(OUT);
  console.log('title ok', OUT, 'angle', ANGLE, 'fit', scale.toFixed(3), 'font-px', Math.round(REF * scale));
})();
