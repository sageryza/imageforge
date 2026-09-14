const fs = require('fs');
const S = process.argv[2];
const lines = [
 'it was 10 o’clock at night',
 'the city gets very hot, at night, in the summer',
 'there was nowhere to go, really, was there?',
 'i was walking around in circles',
 'trying to get my mind right',
 'back and forth, back and forth. go this way, no go this way. no',
 'what did it matter?',
 'which way i went',
];
const text = lines.join('\n');
(async () => {
  const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/UTkHGl2ImiT6gwtAFCql/with-timestamps?output_format=mp3_44100_192', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true } }),
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  fs.writeFileSync(S + '/take1.mp3', Buffer.from(j.audio_base64, 'base64'));
  const al = j.alignment;
  fs.writeFileSync(S + '/align.json', JSON.stringify(al));
  // line starts: character index of each line's first char → its start time
  const chars = al.characters, st = al.character_start_times_seconds, en = al.character_end_times_seconds;
  let idx = 0; const out = [];
  for (const ln of lines) {
    // find ln's first char position at or after idx
    const pos = chars.join('').indexOf(ln, idx);
    const end = pos + ln.length - 1;
    out.push({ line: ln, start: st[pos], end: en[end] });
    idx = end + 1;
  }
  console.log(JSON.stringify(out, null, 1));
  console.log('total', en[en.length - 1]);
  fs.writeFileSync(S + '/lines.json', JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
