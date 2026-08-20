// make-vo.js — render the Vibrilify MAX voiceover as ONE wav.
// Each segment is Sophie's script verbatim (TM marks / stage directions
// removed); segments render separately because the announcer's register is
// SUPPOSED to shift (warm → radiant → accelerating panic → whisper), then the
// PCM is concatenated in pure node (no ffmpeg in the session container) with
// deliberate gaps — the 2.8s after segment A is the neighbor waving in
// silence. Usage: node scripts/vibrilify/make-vo.js out.wav
const fs = require('fs');
const path = require('path');

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'spec.json'), 'utf8'));
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

function wavData(buf) {
  // Minimal RIFF walk: return { fmt:{channels,rate,bits}, data:Buffer }.
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not a RIFF wav');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = buf.subarray(off + 8, off + 8 + size);
    if (id === 'fmt ') fmt = { channels: body.readUInt16LE(2), rate: body.readUInt32LE(4), bits: body.readUInt16LE(14) };
    if (id === 'data') data = body;
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('wav missing fmt/data');
  return { fmt, data };
}

function wavFile(fmt, pcm) {
  const blockAlign = fmt.channels * fmt.bits / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(fmt.channels, 22); header.writeUInt32LE(fmt.rate, 24);
  header.writeUInt32LE(fmt.rate * blockAlign, 28); header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(fmt.bits, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function tts(seg) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: spec.voice.model, voice: spec.voice.voice, input: seg.text,
      instructions: seg.instructions, response_format: 'wav',
      ...(seg.speed ? { speed: seg.speed } : {}),
    }),
  });
  if (!r.ok) throw new Error(`tts ${seg.id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

(async () => {
  const out = process.argv[2] || 'vibrilify-vo.wav';
  const parts = [];
  let fmt = null;
  for (const seg of spec.voice.segments) {
    process.stderr.write(`rendering ${seg.id}… `);
    const { fmt: f, data } = wavData(await tts(seg));
    if (!fmt) fmt = f;
    if (f.rate !== fmt.rate || f.channels !== fmt.channels || f.bits !== fmt.bits) {
      throw new Error(`segment ${seg.id} format mismatch`);
    }
    parts.push(data);
    const secs = data.length / (fmt.rate * fmt.channels * fmt.bits / 8);
    process.stderr.write(`${secs.toFixed(1)}s\n`);
    if (seg.gapAfter > 0) {
      const n = Math.round(seg.gapAfter * fmt.rate) * fmt.channels * (fmt.bits / 8);
      parts.push(Buffer.alloc(n)); // digital silence is fine here: TTS studio VO, not a recording with room tone
    }
  }
  const pcm = Buffer.concat(parts);
  fs.writeFileSync(out, wavFile(fmt, pcm));
  const total = pcm.length / (fmt.rate * fmt.channels * fmt.bits / 8);
  console.log(JSON.stringify({ out, seconds: +total.toFixed(2), rate: fmt.rate }));
})().catch(e => { console.error(e.message); process.exit(1); });
