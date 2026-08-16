// Rebuild the readable passage text from the banked transcript.
// The machine transcript's ">>" speaker marks are unreliable, so paragraphs
// are broken on those where they exist and every ~4 sentences otherwise —
// a wall of 2,000 words is not something Sophie can read on a phone.
const fs = require('fs');
const D = process.env.HORNS_DIR || '/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns';
const segs = (JSON.parse(fs.readFileSync(D + '/IJZVNv5O6rA.json')).segments) || [];
const hms = s => { s = Math.floor(s); return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };

function paragraphs(raw) {
  return raw.split(/\n\n+/).flatMap(block => {
    const sent = block.match(/[^.?!]+[.?!]+(?:\s|$)|[^.?!]+$/g) || [block];
    const out = [];
    for (let i = 0; i < sent.length; i += 4) out.push(sent.slice(i, i + 4).join('').trim());
    return out.filter(Boolean);
  });
}

const cuts = JSON.parse(fs.readFileSync(D + '/cuts.json'));
const built = [];
for (const c of cuts) {
  const raw = segs.filter(s => s.start >= c.t0 - 0.6 && s.start < c.t1)
    .map(s => (s.text || '').trim()).join(' ')
    .replace(/\s+/g, ' ').replace(/>>\s*/g, '\n\n').replace(/\[[a-z]+\]\s*/gi, '').trim();
  const paras = paragraphs(raw);
  fs.writeFileSync(`${D}/${c.slug}.txt`, `${c.slug}  [${hms(c.t0)} – ${hms(c.t1)}]\n\n${paras.join('\n\n')}\n`);
  built.push({ ...c, paras });
  console.log('===', c.slug, hms(c.t0), '-', hms(c.t1), `(${Math.round(c.t1 - c.t0)}s)`, paras.length, 'paras');
}
fs.writeFileSync(D + '/passages.json', JSON.stringify(built, null, 2));
