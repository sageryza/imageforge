#!/usr/bin/env node
/**
 * Batch 3 — style v2 (content-stripped) + the scene-direction paragraph.
 * Same three synchronicity moments as batch 2 so it's a clean A/B.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out3');
fs.mkdirSync(OUT, { recursive: true });

// Style v2, stripped of content references ("feminine mystical", "witchy") so
// it steers rendering only and can carry any subject.
const STYLE = `ILLUSTRATION STYLE:
Delicate hand-drawn ink illustration with thin, slightly irregular black outlines and flat opaque pastel color fills. Whimsical modern folk art. Simplified shapes, charming imperfections, restrained detail, minimal or no shading, and generous negative space. Use dusty blush, muted coral, pale aqua, mustard gold, lavender-gray, cream, and soft taupe. The result should resemble a thoughtfully designed independent sticker sheet or boutique stationery print — not polished vector clip art, not watercolor, not realistic, and not cartoonish.

Turn the described moment into one clear, simple visual scene. Focus only on the most emotionally meaningful action or object. Keep the composition uncluttered and easy to understand at a glance. No text or lettering anywhere in the image.

THE MOMENT:
`;

const MOMENTS = [
  {
    slug: 'purple-flower',
    label: 'Two little girls holding hands, and the flower was purple',
    moment: 'I saw two little girls holding hands, and then one of them picked a flower, but it was purple. The two small girls walking hand in hand, one bending to pick a single purple flower.',
  },
  {
    slug: 'same-yellow-coat',
    label: 'Two strangers in the same yellow coat, passing',
    moment: 'Two strangers passed each other on the sidewalk wearing the exact same yellow coat, and neither of them noticed. Two figures walking in opposite directions, both in identical mustard yellow coats, about to cross paths.',
  },
  {
    slug: 'three-birds',
    label: 'Three birds, one to each wire',
    moment: 'There were three telephone wires and exactly one small bird sitting on each of them, evenly spaced. Three thin horizontal wires against an open sky, a single small bird perched on each wire.',
  },
];

async function generate({ prompt, quality }) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1024x1024', quality, output_format: 'png' }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image returned: ' + JSON.stringify(data).slice(0, 400));
  return { buf: Buffer.from(b64, 'base64'), usage: data.usage };
}

const MEDIUM_SLUG = process.env.MEDIUM_SLUG || 'purple-flower';

(async () => {
  const jobs = MOMENTS.map(m => ({ ...m, quality: 'low' }));
  jobs.push({ ...MOMENTS.find(m => m.slug === MEDIUM_SLUG), quality: 'medium' });

  const results = await Promise.all(
    jobs.map(async job => {
      const started = Date.now();
      try {
        const { buf, usage } = await generate({ prompt: STYLE + job.moment, quality: job.quality });
        const file = path.join(OUT, `${job.slug}--${job.quality}.png`);
        fs.writeFileSync(file, buf);
        const out = { ...job, file, bytes: buf.length, seconds: Math.round((Date.now() - started) / 1000), usage, createdAt: started };
        console.log(`ok   ${job.slug} [${job.quality}] ${out.seconds}s ${(buf.length / 1024).toFixed(0)}KB`);
        return out;
      } catch (err) {
        console.log(`FAIL ${job.slug} [${job.quality}] ${err.message}`);
        return { ...job, error: err.message };
      }
    })
  );

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, 'style.txt'), STYLE);
  console.log('\nwrote', path.join(OUT, 'results.json'));
})();
