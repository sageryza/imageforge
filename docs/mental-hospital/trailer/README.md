# The trailer (2026-09-10)

Film Editor cut doc `pxan7kLF6I7iMWxlVb5C` — "Hospital night — trailer". Cut from the
rough cut `DsekWrOE5sQciRXKwtpr` plus the clips she hearted and trimmed in `/footage`
that day (the purple pill, the bathroom, the faint), in the order of her brief
(`sophie's message, the `psychiatric-episode-trailer` chat`). `cut.json` here is the
two lanes as saved; the doc is the film — edit it there, `filmcut.js diff` reads what moved.
Editor: https://imageforge-q125.onrender.com/filmeditor?c=pxan7kLF6I7iMWxlVb5C

- Every in/out was placed off a whisper-1 word-timestamp transcript of the clip
  (the exact line, ~0.2s of air either side) and the in-point frame was eyed.
- Not-shot beats ride the rough cut's own cream cards (climax 5, 43e, the poem,
  Mary and Juanita, the scale) plus one new card for the end (Francesca at the
  window). Title cards (`trailer-card-t1..t4.png`, black, her words lowercase)
  and the end card are in the Dump under "Hospital night → trailer cards".
- The eerie riser is ONE ElevenLabs sound-generation clip (v2, 22s,
  `drops/_/90e9e34ce854c29224f344e4a112f0fb.mp3`, Dump "Hospital night →
  trailer sound"), used twice at -2 dB. MEASURED: a generated "riser" peaks
  mid-way and fades (v1 peaked at 8s, v2 at 12s), so only its first 13s ride —
  the build — anchored so it ENDS on the stop: `bedA` on the ghost piece +4.5s,
  stopping 0.15s before "I don't know who I am anymore"; `bedB` on the purple
  pill +9.2s, stopping before "Very good." Per-2s RMS of the render climbs
  -32 → -21 dB into the first stop and -36 → -16 into the second. v1
  (`a09fcc852c…mp3`) is in the same Dump bundle, unused.
- v2 (2026-09-10, her notes): the sculptures beat is the OTHER Juanita take
  (`apiframe-video/1788850139906-b0hjl2.mp4`, the 06:37 job — the cleaning lady
  in the white collar with the sculptures visible in her cart; the 07:19 redo
  that was in v1 has her mopping in pajamas). And Michael's answer is its own
  piece: the source cuts to him at 23.375s of `s9`, so "I know the feeling"
  (17.9–19.35) is followed by his "Exactly." (23.4–25.3) on that cut.

- Substitutions, named: "Francesca kicked out of class" = Yolanda scolded in
  music class (s18 18.3–21.8; the seated woman is the Francesca description);
  "Michael: I know what you mean" = the hallway walk's "I know the feeling";
  Nurse Edna's "good girl" = her "Very good." (s43 18.7–20.5) after the jolly
  nurse's "let's see" (s13); the assistant's "psychiatric episode" scene is
  not shot (card).
