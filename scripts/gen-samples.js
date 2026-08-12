// One-off: render a sample image for each Replicate style and save it into
// public/samples/<seg>.webp so the Test Station tiles ship with real previews.
// Uses the running server so trigger words, HOONIE's suffix + 40 steps, and
// dynamic version resolution all match production. Requires REPLICATE_API_TOKEN.
const fs = require('fs');
const path = require('path');

// Defaults to a local server; point FORGE_BASE at the deployed one to render
// against production (the house styles need Sophie's Storage refs, which a
// local server can only load with Firebase creds).
const BASE = process.env.FORGE_BASE || `http://localhost:${process.env.PORT || 3999}`;
const PROMPT = 'a cozy little cottage, centered on a white background';
// The house grid is a COMPOSITION comparison, so its prompt must not contain
// any composition words of its own — "centered on a white background" above
// would drown out exactly the difference the roomy/lean tiles exist to show.
const HOUSE_PROMPT = 'a teapot with a sprig of rosemary beside it';
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

  // House styles (gpt-image-2 edits + Sophie's Storage refs). One identical
  // subject through all of them, so the tiles are a fair comparison and not
  // four different drawings.
  for (const m of models.house || []) {
    const seg = m.id.split('/').pop();
    process.stdout.write(`• ${m.name} (${seg}) … `);
    try {
      const res = await fetch(`${BASE}/api/generate/housestyle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: HOUSE_PROMPT, styleId: m.id, quality: 'medium' }),
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
