// "CLEARING THINGS UP" title overlay — real type (never model-drawn text),
// transparent PNG at the clip's own size, composited by assemble.sh.
// v3 (Sophie): block letters (DejaVu Sans Bold caps), NO rule lines, and the
// whole block rotated onto the trail's own diagonal (~43° up to the right)
// so the words slide along their own line as they shoot in.
const sharp = require('sharp');
const [W, H, out] = [Number(process.argv[2] || 784), Number(process.argv[3] || 1168), process.argv[4] || 'title.png'];
const ANGLE = Number(process.argv[5] || 0);
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<style>
 .t { font-family: 'DejaVu Sans', sans-serif; font-weight: bold; fill: #fff; letter-spacing: 8px; }
</style>
<g text-anchor="middle" transform="rotate(${ANGLE}, ${W / 2}, ${H * 0.44 + 10})">
 <text x="${W / 2}" y="${H * 0.44}" class="t" font-size="86" stroke="#000" stroke-width="6" stroke-opacity="0.35" paint-order="stroke">CLEARING</text>
 <text x="${W / 2}" y="${H * 0.44 + 104}" class="t" font-size="72" stroke="#000" stroke-width="6" stroke-opacity="0.35" paint-order="stroke">THINGS UP</text>
</g></svg>`;
sharp(Buffer.from(svg)).png().toFile(out).then(() => console.log('title ok', out, 'angle', ANGLE));
