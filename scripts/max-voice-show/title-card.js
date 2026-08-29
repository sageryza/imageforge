// "CLEARING THINGS UP" title overlay — real type (never model-drawn text),
// transparent PNG at the clip's own size, composited by assemble step.
const sharp = require('sharp');
const [W, H, out] = [Number(process.argv[2] || 784), Number(process.argv[3] || 1168), process.argv[4] || 'title.png'];
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<style>
 .t { font-family: 'Liberation Serif', serif; font-weight: bold; fill: #fff; letter-spacing: 10px; }
</style>
<g text-anchor="middle">
 <text x="${W/2}" y="${H*0.44}" class="t" font-size="92" opacity="0.98" stroke="#000" stroke-width="6" stroke-opacity="0.35" paint-order="stroke">CLEARING</text>
 <text x="${W/2}" y="${H*0.44 + 108}" class="t" font-size="76" opacity="0.98" stroke="#000" stroke-width="6" stroke-opacity="0.35" paint-order="stroke">THINGS UP</text>
 <rect x="${W/2 - 170}" y="${H*0.44 - 128}" width="340" height="3" fill="#fff" opacity="0.85"/>
 <rect x="${W/2 - 170}" y="${H*0.44 + 138}" width="340" height="3" fill="#fff" opacity="0.85"/>
</g></svg>`;
sharp(Buffer.from(svg)).png().toFile(out).then(() => console.log('title ok', out));
