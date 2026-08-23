#!/usr/bin/env node
/**
 * Measure what a gpt-image-2 size × quality ACTUALLY costs, from the API's own
 * token counts.
 *
 * OpenAI publishes per-image prices for exactly three sizes (1024x1024,
 * 1024x1536, 1536x1024) and then says "additional sizes available" with no
 * table — the guide has an interactive calculator instead. gpt-image-2 also
 * does NOT price by area: 1024x1024 costs MORE than the 1.5x-bigger 1024x1536
 * at every quality, and the guide says so out loud ("a larger non-square
 * resolution can sometimes produce fewer output tokens than a smaller or
 * square resolution at the same quality setting"). So a price for any other
 * size cannot be derived — it has to be measured.
 *
 * Output tokens depend only on `size` and `quality`, never on the prompt or the
 * picture (that is what the guide's calculator takes as its only two inputs),
 * and repeat runs return identical counts. So this measures with a one-word
 * prompt on the GENERATIONS endpoint — no reference image, nothing uploaded,
 * nothing filed. It still costs the real render each time; that is the price of
 * an honest number.
 *
 *   node scripts/measure-image-cost.js 1568x2352:medium 2336x3504:high ...
 *   node scripts/measure-image-cost.js --dry-run <same>   → just the estimate
 *
 * Needs OPENAI_API_KEY.
 */
const RATE_OUT = 30 / 1e6;
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const combos = args.filter(a => !a.startsWith('--'));
if (!combos.length) {
  console.error('usage: node scripts/measure-image-cost.js <WxH>:<quality> [...]');
  process.exit(1);
}
// Rough guide for the pre-flight estimate only — the point of the script is
// that these are NOT reliable for unpublished sizes.
const GUESS = { low: 0.006, medium: 0.05, high: 0.2 };

(async () => {
  const est = combos.reduce((s, c) => s + (GUESS[c.split(':')[1]] || 0.05), 0);
  console.log(`${combos.length} renders, rough estimate $${est.toFixed(2)}\n`);
  if (dry) return;

  const rows = [];
  for (const combo of combos) {
    const [size, quality = 'medium'] = combo.split(':');
    process.stdout.write(`${size.padEnd(11)} ${quality.padEnd(7)} … `);
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-image-2', prompt: 'a circle', size, quality, n: 1 }),
    });
    const data = await res.json();
    if (data.error) { console.log('FAILED: ' + data.error.message); continue; }
    const tok = data.usage?.output_tokens_details?.image_tokens ?? data.usage?.output_tokens ?? 0;
    const [w, h] = size.split('x').map(Number);
    rows.push({ size, quality, px: w * h, tok, cents: tok * RATE_OUT * 100 });
    console.log(`${tok} tokens = ${(tok * RATE_OUT * 100).toFixed(2)}c`);
  }

  console.log('\nsize        quality   megapixels   out tokens   cost');
  for (const r of rows) {
    console.log(`${r.size.padEnd(11)} ${r.quality.padEnd(9)} ${(r.px / 1e6).toFixed(2).padStart(9)}   ` +
      `${String(r.tok).padStart(10)}   ${r.cents.toFixed(2).padStart(5)}c`);
  }
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
