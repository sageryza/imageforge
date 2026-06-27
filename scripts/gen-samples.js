// One-off: render a sample image for each Replicate style and save it into
// public/samples/<seg>.webp so the Test Station tiles ship with real previews.
// Uses the running server so trigger words, HOONIE's suffix + 40 steps, and
// dynamic version resolution all match production. Requires REPLICATE_API_TOKEN.
const fs = require('fs');
const path = require('path');

const BASE = `http://localhost:${process.env.PORT || 3999}`;
const PROMPT = 'a cozy little cottage, centered on a white background';
const OUT = path.join(__dirname, '..', 'public', 'samples');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const models = await (await fetch(`${BASE}/api/models`)).json();
  for (const m of models.replicate) {
    const seg = m.id.split('/').pop();
    process.stdout.write(`• ${m.name} (${seg}) … `);
    try {
      const res = await fetch(`${BASE}/api/generate/replicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: PROMPT, model: m.id, settings: { output_format: 'webp' } }),
      });
      const data = await res.json();
      if (!data.url) throw new Error(data.error || 'no url');
      const img = await fetch(data.url);
      const buf = Buffer.from(await img.arrayBuffer());
      fs.writeFileSync(path.join(OUT, `${seg}.webp`), buf);
      console.log(`saved (${buf.length} bytes)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }
}
main();
