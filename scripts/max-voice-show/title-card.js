// "CLEARING THINGS UP" title overlay — real type (never model-drawn text),
// transparent PNG at the clip's own size, composited by assemble.sh.
//
// v5 (Sophie: "text shud be on top of rainbow · transparent background · new
// font not wobbly just blocky and w a black outline"):
//   * ONE line of heavy blocky caps, no wobble — no ink displacement, no
//     per-letter tilt or drift (v4 had all three; she asked them off).
//   * Fattened white letters inside a BLACK OUTLINE: the glyph is drawn twice,
//     a thick black stroke underneath and a thinner white stroke + fill over
//     it, so the visible black ring is (BLACK-WHITE)/2 and the white itself
//     comes out chunkier than the font is.
//   * Placed ON the rainbow trail. MEASURED rather than eyeballed: fitting the
//     principal axis of the bright saturated pixels across the star clip, the
//     trail swings and slides as the star glides, but its line passes through
//     (W/2, ~0.368H) at every sampled moment — so that is the anchor.
// Background stays fully transparent: only glyphs are ever drawn, so the
// rainbow shows through between and around the letters.
const sharp = require('sharp');

const W = Number(process.argv[2] || 784);
const H = Number(process.argv[3] || 1168);
const OUT = process.argv[4] || 'title.png';
const ANGLE = Number(process.argv[5] || 0);
const TEXT = process.argv[6] || 'CLEARING THINGS UP';

const FONT = 'DejaVu Sans';       // the blockiest face on the box (measured)
const REF = 200;                  // measuring size; the fit scales from here
const GAP = 0.13 * REF;           // optical space between letters
const SPACE = 0.30 * REF;         // width of a word space
const PAD = 34;                   // keep the line off the frame edge
const CY = 0.368;                 // the trail's own line, measured (see above)
const OUTLINE = 5;                // black ring, FINAL pixels
const FATTEN = 1.9;               // extra white weight, final px per side

// Ink box of one character relative to its origin: render it alone and trim.
// Advance widths are not exposed to us, and ink widths are what optical
// spacing wants anyway.
const glyph = (ch, attrs) => `<text x="0" y="${REF}" font-family="${FONT}" font-weight="bold"
   font-size="${REF}" xml:space="preserve" ${attrs}>${ch === '&' ? '&amp;' : ch}</text>`;

async function measure(ch) {
  const box = REF * 2;
  const svg = `<svg width="${box}" height="${box}" xmlns="http://www.w3.org/2000/svg">${glyph(ch, 'fill="#fff"')}</svg>`;
  const { info } = await sharp(Buffer.from(svg)).trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, left: -(info.trimOffsetLeft || 0), top: -(info.trimOffsetTop || 0) };
}

(async () => {
  const chars = [...TEXT];
  const seen = new Map();
  for (const ch of chars) if (ch !== ' ' && !seen.has(ch)) seen.set(ch, await measure(ch));

  let x = 0, minY = Infinity, maxY = -Infinity;
  const placed = [];
  for (const ch of chars) {
    if (ch === ' ') { x += SPACE; continue; }
    const m = seen.get(ch);
    placed.push({ ch, x: x - m.left });
    minY = Math.min(minY, m.top - REF);
    maxY = Math.max(maxY, m.top - REF + m.h);
    x += m.w + GAP;
  }

  // fit the ROTATED line inside the frame, outline included
  const a = Math.abs(ANGLE) * Math.PI / 180;
  const inkW = x - GAP, inkH = maxY - minY;
  const grow = (OUTLINE + FATTEN) * 2;
  const scale = Math.min(
    (W - PAD * 2 - grow) / (inkW * Math.cos(a) + inkH * Math.sin(a)),
    (H - PAD * 2 - grow) / (inkW * Math.sin(a) + inkH * Math.cos(a)),
  );

  // strokes are in REF units, so convert the final-pixel widths through `scale`
  const white = (FATTEN * 2) / scale;
  const black = white + (OUTLINE * 2) / scale;
  const pen = 'stroke-linejoin="round" stroke-linecap="round"';
  const body = placed.map(p => `<g transform="translate(${p.x.toFixed(1)}, 0)">
     ${glyph(p.ch, `fill="#000" stroke="#000" stroke-width="${black.toFixed(1)}" ${pen}`)}
     ${glyph(p.ch, `fill="#fff" stroke="#fff" stroke-width="${white.toFixed(1)}" ${pen}`)}
   </g>`).join('\n');

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
 <g transform="translate(${W / 2}, ${(H * CY).toFixed(1)}) rotate(${ANGLE}) scale(${scale.toFixed(4)}) translate(${(-inkW / 2).toFixed(1)}, ${(-(minY + maxY) / 2).toFixed(1)})">
  ${body}
 </g>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(OUT);
  console.log('title ok', OUT, 'angle', ANGLE, 'font-px', Math.round(REF * scale));
})();
