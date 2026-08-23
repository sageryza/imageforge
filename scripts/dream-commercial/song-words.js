// What the song actually says, and exactly when — for the song spot.
//
//   node scripts/dream-commercial/song-words.js /tmp/venus.m4a
//
// "Venus" (Afro Comb feat. DOMAINIQ, Kitsuné 2021) has no lyrics published
// anywhere — no Genius page, no lyrics site, nothing in the label's copy
// (searched 2026-08-19). So the record itself is the only source, and this
// runs it through the same Whisper pass the rest of the repo uses
// (movies.js transcribeAudio, word timestamps), then prints the line around
// "dream" with its real start time.
//
// TWO THINGS TO KNOW. Whisper is trained on speech, not singing over a
// produced mix, so treat what comes back as a first pass to check by ear —
// never file it as the lyric without listening. And the number it prints is
// what `song.hook` in spot.json wants: the spot's whole cut hangs off that
// one timestamp, so a corrected hook re-aligns the film with no other edit.
// Needs OPENAI_API_KEY and a local audio file. A cloud session can get one:
// POST /api/ytdl/grab {url, kind:'audio', to:'none'} and download the url it
// answers with — the Mac is no longer required for this.
const fs = require('fs');
const path = require('path');
const { transcribeAudio } = require(path.join(__dirname, '..', '..', 'movies'));

(async () => {
  const file = process.argv[2];
  if (!file) { console.error('usage: node song-words.js <audio file>'); process.exit(1); }
  const t = await transcribeAudio(fs.readFileSync(file), path.basename(file));
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  console.log(`\n— ${path.basename(file)}, ${mmss(t.duration)} —\n`);
  for (const s of t.segments) console.log(`${mmss(s.start).padStart(5)}  ${s.text}`);

  const hit = t.words.find(w => /dream/i.test(w.word));
  if (!hit) { console.log('\nno "dream" heard — check the segments above by ear.'); return; }
  // the line it belongs to, so the hook is the start of the PHRASE not the word
  const line = t.segments.find(s => hit.start >= s.start && hit.start <= s.end);
  console.log(`\n"dream" at ${hit.start}s (${mmss(hit.start)})`);
  if (line) console.log(`its line starts at ${line.start}s (${mmss(line.start)}): ${line.text}`);
  console.log(`\nif that is the hook, set song.hook in spot.json to ${(line ? line.start : hit.start).toFixed(1)} and re-render.`);
})().catch(e => { console.error(e.message); process.exit(1); });
