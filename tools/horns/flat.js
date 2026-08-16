const fs=require('fs');
const OUT='/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns';
for (const [id,label] of [['IJZVNv5O6rA','part1'],['wwQcSKbqfoQ','part2']]) {
  const t=JSON.parse(fs.readFileSync(`${OUT}/${id}.json`));
  const segs=t.segments||[];
  const hms=s=>{s=Math.floor(s);return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
  const lines=segs.map(s=>`[${hms(s.start)}|${s.start.toFixed(1)}] ${(s.text||'').trim()}`);
  fs.writeFileSync(`${OUT}/${label}.txt`, lines.join('\n'));
  console.log(label, segs.length, 'segs, last', hms(segs[segs.length-1].end||segs[segs.length-1].start), '| sample:', JSON.stringify(segs[0]).slice(0,200));
}
