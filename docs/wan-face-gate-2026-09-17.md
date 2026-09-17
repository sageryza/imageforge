# Which door takes a REAL famous face — measured 2026-09-17

Sophie: *"allow robert pattinson"* · *"research which wan model might take
robert"*. Three jobs sent through Atlas that evening, all free (every one was
refused), and the answer is not the one the Wan 3.0 docs imply.

## What Wan 3.0 actually does with a face

| job | shape | what came back | when |
| --- | --- | --- | --- |
| `robert pattinson buying oranges` | 2s 480p 9:16, **no reference at all** | `The output content is suspected to include real human faces.` | after **3m46s** of drawing |
| his still + his voice (m4a) | 2s, 1 image + 1 audio | `format m4a is not supported. Supported formats: ['wav', 'mp3']` | 21s |
| the same with the voice as **mp3** | 2s, 1 image + 1 audio | `The input content is suspected to include real human faces.` | 15s |

Three things follow, and none was on file before:

1. **Wan 3.0 has a REAL-FACE gate, not a famous-face gate**, and it runs on
   BOTH ends. The input one refused a photograph of a person; the output one
   refused a clip drawn from nothing but words. Seedance on this door is the
   opposite way round — it takes a real person in and only blocks a *famous*
   face — so the two models are not interchangeable for anything with a
   person in it.
2. **The output gate is not free of TIME.** It let the model draw for nearly
   four minutes and then threw the clip away. Money was not charged; the wait
   was.
3. **The 2026-09-11 test that "took four person references without a word"
   is not contradicted — it is explained.** That job drew before this gate was
   measured, on the same model id. Either the gate is probabilistic (like
   ByteDance's copyright one) or it tightened. Both readings say the same
   thing for planning: **Wan 3.0 cannot be relied on for a clip with a real
   person in it.**

## Which Wan model might take him

Every `alibaba/wan-*` id on Atlas is a passthrough to **Alibaba Model
Studio** — the model records say `organization: QWEN`,
`parentFamilyName: qwen-wan` — so wan-2.5, wan-2.6, wan-2.7, wan-3.0 and
wan-3.0-prime all sit behind the same policy layer that refused twice
tonight. Prime is the same family as the model that refused; expecting a
different answer from it is a guess, not a measurement.

**The exception is the one Atlas hosts itself.** `atlascloud/wan-2.2/*` and
`atlascloud/wan-2.2-turbo/*` carry `organization: ATLASCLOUD` and the profile
*"Open and Advanced Large-Scale Video Generative Models"* — the OPEN-WEIGHTS
Wan 2.2 running on Atlas's own GPUs, with no Model Studio in front of it. So
the honest answer to "which wan model might take robert" is:

- **`atlascloud/wan-2.2/image-to-video` — 3¢/s** (turbo 2¢/s), image + prompt,
  no reference-to-video and no sound. A 2s test is ~6¢.

Two non-Wan doors on the same key are worth naming beside it, because they
are self-hosted for the same reason:

- **`minimax/h3-developer/reference-to-video` — 1.5¢/s**, its own profile
  says *"self-hosted"*, and it takes the mixed `refers` array (image + video +
  audio, mp3/wav) that Wan 3.0 takes. The closest match to the job that was
  refused, at a third of the price.
- **`xai/grok-imagine-video/reference-to-video` — 5¢/s**, 1-7 reference
  images, up to 10s. xAI's own policy on public figures is the loosest of the
  majors.

**Nothing here has been sent.** Every line above about a door that has not
refused is a reading of its model record, not a measurement — the measurement
is one 2s clip on her go.

## MEASURED, THE SAME NIGHT: WAN 2.2 TURBO TOOK HIM (her go: "try it until it works · budget $1")

`atlascloud/wan-2.2-turbo/image-to-video`, his own photograph as the first
frame, 5s at 480p, prompt `he shifts slightly in the chair and looks toward
the camera, camera at eye level` — accepted on the POST, **drew**, 576x704
30fps, 5.03s, him, moving, in the chair. ~10¢ (2¢/s). So the reading above
was right: the gate is Alibaba Model Studio's, not the model's, and the Wan
Atlas hosts itself has no such gate. Pinned in the chat as *Robert test v1*.
It is a Footage row now (`Wan 2.2 Turbo`), beside `Wan 2.7` (Alibaba-hosted,
unmeasured on a face, expect the gate). The playground also settled the
resolution ladder Atlas's pages deny: it quoted every model at its 1080p
default at 4x the 480p rate (wan-3.0 5s = $0.80 against 4¢/s), wan-2.2-turbo
at its 720p default at 2x, and wan-2.7 at 1080P at 1.5x its 720P rate.

## AND MINIMAX H3 (developer) TOOK HIM WITH HIS VOICE — the best result of the night

`minimax/h3-developer/reference-to-video` (Atlas's own profile says
"self-hosted"), his still + the 15s mp3 of his own voice, 5s at 480P, prompt
`the man in the image speaks with the voice in the audio, camera at eye level`
— drew in 16s: 480x576 24fps with SOUND, him in the chair from a new angle,
talking, and the audio is his voice saying "I, uh, I saw a still" — the first
words of the reference clip. ~8¢ (1.5¢/s). So two self-hosted doors on the
key take a real famous face, and this one takes the voice too, which Wan 2.2
cannot. Pinned as *Robert test v2*. MiniMax H3's own `refers` array is the
same shape as Wan 3.0's, so `buildOtherRequest` sent it unchanged.

**And at 768P (its native tier), the same still and voice:** 768x896 24fps,
drew in 33s, same line in his voice, visibly sharper than the 480P run
(480x576 — MiniMax's "480P" is the SHORT side, so it is ~1.5x fewer pixels
than Seedance's 3:4 "480p" of 560x752; always send 768P). Pinned as *Robert
test v3*. Wan 2.2 Turbo billed exactly the 10¢ estimated (`/spend`). **The
developer charges posted later that night: 31.5¢ for three 5s clips — one
480P (7.5¢, the flat 1.5¢/s) and two 768P (12¢ each, 2.4¢/s)** — so 768P
bills **1.6x** the listed rate on this family, the same shape as Atlas's
Seedance/Wan ladder (720p 2x, 1080p 4x). The standard `h3` charge posted later as **40¢ for one 5s 768P clip** — 8¢/s,
2.1x its 3.8¢ list, so the 768P surcharge is not one fixed ratio across the
family; the ledger is the read, the chart an estimate.
MiniMax H3's
limits, off its schema: 5-15s whole seconds; 480P · 768P native, 1080p /
1440p / 4k ESR tiers over a 768P source; ratios 21:9 · 16:9 · 4:3 · 1:1 ·
3:4 · 9:16 · adaptive; `refers` any mix of png/jpg/webp, mp4/mov, mp3/wav
with at least one picture or video (audio alone is refused), no stated cap
on the count; `prompt_expansion` off by default. Family prices per second on
the sale: developer 1.5¢ (5¢ list) · max-turbo 2.4¢ · h3 3.8¢ · fast 4.4¢ ·
max 4.8¢.

## THE STANDARD MINIMAX H3 SAYS NEW WORDS IN HIS VOICE — the developer tier does not

Same still, same 15s voice reference, the prompt asking him to say a NEW line
(`"Are you kidnapping me?"`, his line from chapter one), 5s at 768P:
- `h3-developer` (1.5¢/s): lip-synced the REFERENCE audio and smeared the
  prompt over it — whisper hears *"I, uh, I saw a kid-nap in me"*. The cheap
  tier plays the audio you give it; it cannot voice text.
- `h3` (the standard model, 3.8¢/s, 2m11s to draw, 768x1024): **says "Are you
  kidnapping me?" — clean, in the reference voice, mouth matching.** So the
  standard tier CLONES the voice from the reference and speaks the prompt's
  line, which is what a scripted film needs; no separate voice clone is
  required for dialogue on this door. (It was accepted on the POST — no face
  gate on the way in at this tier either.) Pinned as *Robert test v5*.

Which is the answer to "why the lesser version": the developer tier was the
one Atlas labels self-hosted and the cheapest probe for "does it take his
face at all"; the standard tier turned out to take the face too AND do the
one thing the cheap one cannot. Use `minimax/h3` for any clip with a line in
it; the developer tier is for silent or ambient shots.

## What shipped from this

- `video-refusals.js` carries both new rows — the real-human-faces output gate
  (its own row, above the famous-face one) and the audio-container shape
  refusal — each with the line Sophie reads on the card.
- `atlascloud.js` refuses an m4a (or any container that is not wav/mp3) on a
  Wan job **before sending it**, so that round trip is never spent again.
  `WAN.AUDIO_EXTS` is the list.

## MAX TAKES ONE STILL AND NO VOICE — and its file is 8x the bitrate (her go: "try max w the still alone")

`minimax/h3-max/reference-to-video` does not exist (Atlas: `400 not found`;
no schema file). Read off `static.atlascloud.ai/model/schema/`: **max and
max-turbo have only `image-to-video`** (one `image`, optional `end_image`, no
`refers`, so no voice reference), **fast has `reference-to-video` at 480P
only**, developer and standard have it at 480P/768P; the SR tiers are
developer (1440p) and max (1440p, 4K) — standard stops at 768P. So the top
of the door that speaks in HIS voice is standard h3 at 768P.

Max with the tied-up still alone, prompt `the man in the image says: "Are you
kidnapping me?" — camera at eye level`, 5s 768P: drew in 16s, **38¢** (Atlas's
`price`), 768x928, and it SAYS the line (whisper: exact) in an invented
voice — a deeper, generic one, not his. **The file is 5,916 kb/s against the
standard clip's 721 kb/s — 8x the bitrate at the same size** (3.9MB vs
0.56MB for 5s). So "not that sharp" on standard is at least partly the
ENCODE, not the draw; max ships its clip nearly uncompressed. Pinned as
*Robert test v6*. Price chart v2 in the chat's Compare tab carries the
corrected tier map.

## DEVELOPER AT 1440p-sr WITH THE CONTAINER LINE ("ok try ur plan")

Same still, the Chatterbox `line1.mp3` (2.2s) as the one audio reference,
`the man in the image speaks with the voice in the audio, camera at eye
level`, 5s, `resolution: "1440p-sr"` on `minimax/h3-developer/
reference-to-video`: accepted, drew in **4m57s** (the 768P runs took ~30s —
the SR pass is the wait), **22.5¢** = 3x the tier's flat 480P rate
(so the SR ladder on this family is 768P 1.6x, 1440p-sr 3x). 1440x1680
24fps, 1,383 kb/s. **Two findings:**
- **It filled the empty seconds with invented speech.** The reference held
  2.2s of words in a 5s clip; whisper hears *"Alright, can we please stop
  doing this? Are you kidnapping me?"* — the developer tier does not only
  replay the audio it is given, it continues it when the clip is longer than
  the words. Match the duration to the line, or give it a line that fills it.
- **The upscale doubled the pixels, not the detail budget.** Bits per pixel
  per frame: standard 768P 0.038 · developer 1440p-sr 0.024 · **max 768P
  0.35**. The SR file is bigger and still squashed; max's is ten times
  denser. So the sharp-file lever measured so far is the MAX TIER's encode,
  not resolution — and max takes no voice. Pinned as *Robert test v7*.

## THE TWO SHARPNESS ROADS, MEASURED (her go: "go")

Both through the new TOOL door on the Atlas module (`atlascloud.js`
`buildToolRequest`: a lip-sync or an upscaler takes a finished clip, no
prompt; `node scripts/test-atlascloud-tools.js`).
- **`veed/lipsync` on the MAX clip (v6) with the container `line1.mp3`:**
  drew in 56s. 768x928, **1,922 kb/s** (the max source re-encoded, but still
  2.7x the standard tier's density), whisper: *"Are you kidnapping me?"* —
  the mouth follows the container line. **It trims the video to the AUDIO's
  length** (2.18s from a 5s clip; veed has no sync_mode field — `sync/
  lipsync-v3` has `cut_off · loop · bounce · silence · remap`). So the audio
  has to be as long as the shot, or the shot is cut to it. Pinned *Robert
  test v8*.
- **`atlascloud/video-upscaler` on the STANDARD clip (v5, his real voice) to
  2k:** 35s. 1664x2216, **1,265 kb/s** — 0.014 bits per pixel per frame,
  LOWER than the 768P source's 0.038. It enlarges; it does not put back what
  the encode threw away. Pinned *Robert test v9*, his voice and words intact.
Neither job carried a `price` on its record; the ledger (`/spend`) is the
read. The sharp file remains the max tier's own encode, and the road to sharp
+ his words is **max draws → a lip-sync moves the mouth to the container
line**, with the line cut to the shot's length.
