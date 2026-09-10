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

- v3: the end card is gone — it ends on the real Francesca clip she drew and
  hearted in /footage that evening (`atlascloud-video/1789069801714-u8i4sn.mp4`,
  the 3:4 take; the 9:16 twin is the one she crossed out). In 3.4–10.05: a beat
  of her at the glass, "New York," the pause, "such a beautiful city."

- v4: the opening is JUST the spinning — c4 0–4.7, which is where the source
  cuts to her lying on the manhole cover; the VO is trimmed to her one line
  ("the city gets very hot at night in the summer", out 3.5). And the judge
  beat is the REDO, not the 2.5 take: `openrouter-video/1788931090997-uovoxi.mp4`
  ("B at 720p — real references", the `footage-scare-dissociation` batch),
  6.4–13.45. It is 834x1112 — 720p at the same 3:4 — it carries the whole
  sentence, and its own cut to her face lands at 9.2s, so "we'll be forced to
  get a judge…" plays over her reaction instead of over the doctor. The other
  redos on file: `ctxA`/`ctxB` (480p, same shape, complete line), `b720c`
  (720p, cuts to her a second late), `c3A`/`c3B`/`c3C`. None of them carried a
  ♥, so this pick is mine — say if you want one of the others.

- v5: the second build starts ON the purple pill and climbs the whole 22.2s to
  "let's see". MEASURED, twice: an ElevenLabs "riser" always peaks mid-clip and
  fades (v1 at 8s, v2 at 12s, v3 at 12s of 22), so no generated 22s clip climbs
  the whole way. What does is v2's first 13s — the honest build — stretched to
  22.13s with `atempo=0.588`, which keeps the pitch and slows the climb
  (`drops/_/863ac978c041ae3e833a869468b5752b.mp3`). Its own shape, per 3s:
  -68 → -56 → -47 → -39 → -33 → -28 → -22 → -18 dB, monotonic. In the render
  the music alone reads -36.5 dB at the pill and -24.6 just before the stop.

- v6: the judge beat is `apiframe-video/1788906300124-gl2cf6.mp4` — the FIRST
  climax-3 take from `climax-dissociation-accounts`, 8.04s, whole clip. It has
  the right doctor, the three questions ("tomorrow? the next day? the day after
  that?"), the whole judge sentence, and its own cut to her face at 6.0s. The
  720p redo that was in v4/v5 drew a DIFFERENT PERSON. And the socks jump was
  added after the ambulance: her own trim of the waiting-room clip
  (`footage/trims/6b410c2dc9c99c572b81214fb15c11e6d64b362e.mp4`, 4.87s), where
  she jumps the chairs in the grippy socks.

- **THE `footage-scare-dissociation` BATCH IS MARKED FAILED — DO NOT USE IT
  (2026-09-10, Sophie: "the judge u picked is a diff person · get rid of all
  the footage from that chat so no one sees it · not deleted but marked
  fail").** All 14 jobs on `forge-video-jobs` for that chat now carry
  `status:'failed'`, `hidden:true`, a `why`, and `statusWas` holding the
  original status, so the log and every surface reading it skip them and the
  clips themselves are untouched in Storage. They are the Climax 3 redos, the
  context-line pair, the seed tests and the 720p B takes. Reversing it is
  writing `statusWas` back.

- Substitutions, named: "Francesca kicked out of class" = Yolanda scolded in
  music class (s18 18.3–21.8; the seated woman is the Francesca description);
  "Michael: I know what you mean" = the hallway walk's "I know the feeling";
  Nurse Edna's "good girl" = her "Very good." (s43 18.7–20.5) after the jolly
  nurse's "let's see" (s13); the assistant's "psychiatric episode" scene is
  not shot (card).
