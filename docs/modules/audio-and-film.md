# Audio & film modules

Everything that makes or cuts moving pictures and sound: Movies, Songs, the Voice Memo library, Voice Studio, the audio drop, the Episode Editor, the Cutting Room, Search and Cut Marks — plus the YouTube uploader. The always-rules (her voice model, never loudnorming her voice, one cutter) stay in CLAUDE.md; the machinery lives here.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointer there. Nothing was rewritten; this is the text as it stood.)*

## Movies (the newest medium — iOS is the frontend)
- **Making one of Sophie's concept videos? Read
  `docs/movies/sophies-movie-pipeline.md` FIRST** — her own recorded
  instructions (Aug 2026): voiceover aligned via the NDE precise cutter,
  images in pastel variant V2 at 2:3 portrait, and her literal-image →
  metaphorical-image formula with animation between the two panels.
- `movies.js` (`/api/movies`) — story → movie pipeline, validated end-to-end in
  a July 2026 prototyping run (~$1.35 for a 12-scene film with dream bridges).
  **No web page** — the native iOS app (`ios/`, Movies tab) is the frontend.
- **Pipeline:** GPT breaks the story into ~8-12 SELF-CONTAINED scenes (each
  prompt renders alone — the video model can't infer beats between scenes),
  deliberately creating before/after panel pairs and repeating character
  continuity tokens in every prompt → gpt-image-2 panels (1024x1536,
  medium-quality storyboard first, HIGH re-render for keepers) → Replicate
  image-to-video per scene → ffmpeg edits + stitch.
- **Video tiers:** draft `wan-video/wan-2.2-i2v-fast` (480p, ~$0.06/clip,
  `last_image` conditioning animates BETWEEN the two panels of a pair);
  quality `kwaivgi/kling-v2.1` standard 720p $0.25 / pro 1080p $0.55
  (`end_image` requires pro); **`wan27` / `wan27hd` =
  `wan-video/wan-2.7-i2v`**, 720p $0.10/s and 1080p $0.15/s, i.e. **$0.50 and
  $0.75 for the standard five seconds** — three times the draft tier for the
  same length. Versions pinned in `VIDEO_MODELS`.
- **What 2.7 buys, and what it costs you besides money (measured live
  2026-08-23, two probe clips):** REAL first-and-last-frame conditioning —
  `last_frame` is a TARGET where 2.2's `last_image` is a hint — plus a
  duration anywhere from **2 to 15s** instead of a fixed 5, and 720p/1080p
  with **no 480p at all**. Two costs: **it invents its own audio** when none
  is supplied (the probe clip came back carrying an aac track and the schema
  offers no way to ask for silence — fine standalone, noise under a film that
  already has her voice, so anything stitching these must drop the track), and
  its `enable_prompt_expansion` defaults **true**, i.e. the model rewriting
  the prompt before it draws. That is off in `videoInput` on purpose.
- **SEEDANCE, AND WHAT A 3-SECOND CLIP COSTS PER MODEL (measured 2026-09-04
  off Replicate's own billing tiers and APIFRAME's catalogue, Sophie's ask:
  "needs about 3 seconds. how much does that cost each model").** Replicate
  bills Seedance PER SECOND of output, by resolution — and **THE SCHEMA'S
  DURATION RANGE IS A LIE: no Seedance takes 3s.** Replicate's schema says
  2-12 for the 1.x models, but the request goes upstream and ByteDance
  refuses it — measured 2026-09-04, `seedance-1.5-pro` at 3s: "the specified
  duration is not supported for model seedance-1-5-pro" (its real steps are
  4 / 8 / 12, as APIFRAME's catalogue says); `seedance-1-pro` and `-1-lite`
  describe themselves as 5s or 10s. So "5 is the minimum" is true of kling
  and wan-2.2 (81 frames), 4 of every Seedance, and a 3s clip is **wan-2.7
  or wan-3 (both take 2-15s+), or a 4s Seedance trimmed in ffmpeg** — a
  refusal costs nothing (under a second, no output, unbilled). Per second:
  `seedance-1-pro-fast` 1.5¢ / 2.5¢ / 6¢ (480p / 720p / 1080p);
  `seedance-1-lite` 1.8¢ / 3.6¢ / 7.2¢; `seedance-1-pro` 3¢ / 6¢ / 15¢;
  `seedance-1.5-pro` 1.3¢ / 2.6¢ / 6¢ without audio and 2.5¢ / 5.2¢ / 12¢ with;
  `seedance-2.0` (image in) 8¢ / 18¢ / 45¢ (+ $1/s for 4K), `-2.0-fast`
  7¢ / 15¢; `wan-2.7-i2v` 10¢ / 15¢ (2-15s); `kling-v2.1` 5¢ / 9¢ (5s
  floor, so 25¢ / 45¢ minimum — the 55¢ pro figure above is stale);
  `wan-2.2-i2v-fast` is per CLIP, 5s floor, 6¢. Seedance 2.0 defaults
  `generate_audio:true`, and **its floor is 4s, measured**: the schema says
  only `-1` = the model picks, and a 3s request to `seedance-2.0-mini` was
  refused at validation — "Duration must be between 4 and 15 seconds" —
  before it was billed, so a 3s Seedance clip means a 1.x model. 1.5-pro
  defaults audio OFF. **APIFRAME's Seedance floors at 4s**
  (`seedance-2-mini` 4-11 credits/s, `-2-fast` 7-18, `-2.5` 13-35, `-2` 8-209,
  `-1.5-pro` flat 6-180 at [4,8,12]; a credit is ~1¢ on the Basic plan) —
  and **the `APIFRAME_KEY` in the cloud environment answered "Invalid or
  expired token" on `GET /v2/me` that day**, so the banked credits are not
  reachable from a session until she re-pastes a key.
  **STILL TRUE 2026-09-06, AND IT IS A BAD COPY, NOT AN EXPIRY:** the
  environment's key and the server's share the prefix `afk_4691` and the
  length, the server's answers `/me` (2,681 credits), the container's 401s.
  **So a chat spends the credits THROUGH THE SERVER — `POST
  /api/apiframe/video` takes `referenceImageUrls` / `referenceVideoUrls` /
  `referenceAudioUrls` now** (the Seedance 2.x multi-reference door: nine
  panels as one clip, the prompt naming them `[Image1]`…`[Image9]`), poll
  `GET /api/apiframe/video-job/:id`. Test: `node scripts/test-apiframe-refs.js`.
  **OPENROUTER FOR SEEDANCE — THE SECOND DOOR, FOR JOBS WITH NO VIDEO
  REFERENCE (2026-09-08, Sophie: "make a note so any reference w no video
  uses open router instead").** OpenRouter added video generation
  2026-04-15 and carries Seedance 2.0 Mini / 2.0 Fast / 2.0 / 2.5 at
  ByteDance's own list price with no markup on the clip; the only fee is
  ~5% when credit is bought ($2.52 on $50, measured). Billing is per VIDEO
  TOKEN: `(width × height × 24 × seconds) / 1024` tokens, 2.5 at $10.70/M
  ($6.40/M when a reference video rides), so **480p 2.5 is 10.3¢/s and 720p
  23.1¢/s before the fee; APIFRAME's own page says 29¢/s at 720p**. 2.5 on
  OpenRouter tops out at 720p (4-30s); 2.0 goes to 1080p/4K at 37¢/s for
  1080p. Mini's 1.3¢/s is a 60% promo over a $3.50/M list.
  - **THE REQUEST SHAPE (undocumented, measured):** `POST
    https://openrouter.ai/api/v1/videos` `{model:"bytedance/seedance-2.5",
    prompt, duration, resolution:"480p", aspect_ratio:"3:4",
    generate_audio:true, input_references:[{type:"image_url",
    image_url:{url}}, {type:"video_url", video_url:{url}}, {type:"audio_url",
    audio_url:{url}}]}` — the validator names exactly those three types.
    Poll `GET /api/v1/videos/:id` (pending → in_progress → completed),
    download `GET /api/v1/videos/:id/content?index=0` with the key. There is
    NO cancel (POST …/cancel and DELETE both 404), and the charge lands the
    moment a job is accepted. References are named `[Image1]` / `[Video1]`
    in the prompt exactly as on APIFRAME.
  - **THE CATCH, AND WHY THIS IS A SECOND DOOR RATHER THAN THE DOOR:
    ByteDance's own filter refuses reference VIDEOS with people that
    APIFRAME accepts.** Scene 36a1's two untouched Seedance clips (the dress
    clip, the stretcher hallway) — which APIFRAME drew that scene from hours
    earlier — came back `InputVideoSensitiveContentDetected.PrivacyInformation`
    "may contain real person" at validation, unbilled, while the three pajama
    PICTURES on the same job passed. OpenRouter forwards to ByteDance directly
    (one provider, no routing), so BytePlus direct is the same door. What
    APIFRAME has that lets those clips through is unmeasured (its own
    backend, or ByteDance's paid "Dreamina Seedance Advanced Creation Rights").
    The C2PA-signature idea from the same day (every Seedance output carries
    a signed `uuid` box that any ffmpeg trim or remux strips — measured on
    the dress clip: 18 `c2pa` markers whole, 0 after a stream-copy trim, 0
    after a plain remux) does NOT explain this: the signed, untouched clips
    were refused here.
    - **"APIFRAME REFUSES TRIMMED VIDEOS" IS A MYTH AND IT STARTED IN THIS
      SENTENCE (2026-09-11, Sophie: "every chat last week said apiframe
      couldn't take trimmed videos · i'm so confused").** This clause used to
      read "explains APIFRAME's own trim refusals", stated as established
      fact with NO measurement, no job id and no refusal text behind it
      anywhere in the repo — and every later chat inherited the sentence.
      **Measured 2026-09-11 and it is false:** the ward film's Sophie
      reference (`ward-refs/jazz-best4s-…mp4`) IS a trim — 4.06s cut out of
      the 15.1s take, re-encoded, `strings | grep -c c2pa` = **0** — and
      APIFRAME drew from it that morning (job
      `2ac60876-4718-43b6-8208-3bfad391a882`, 2.0 · 15s, done), as did Atlas
      on 2.5 (`d0ad22fd…`). Swept all 46 APIFRAME jobs on the video log:
      **zero trim refusals** — they are real-person checks, output copyright,
      an aspect ratio, a pixel count, a `ratio` read as a video extension.
      **The nearest REAL finding underneath it is about the MODEL, not the
      door** (2026-09-09, the mini-video-references chat: "2.5 refuses a
      trimmed Seedance clip mini accepts"), and that one is itself
      contradicted by her own 6:45am 2.5 clip drawing from the same trim. So
      a trimmed reference is not a known blocker on any door; if one is ever
      refused, file the job id and the refusal text here rather than the
      conclusion. The C2PA measurement itself stands and is worth keeping —
      a trim really does strip every marker.
    - **THE 2.5 FACE CHECK IS STRICTER THAN 2.0's ON THE SAME DOOR
      (measured 2026-09-11).** The identical three references — the
      face-blocked pajamas still, the assistant's UNBLOCKED photoreal face,
      the trimmed jazz clip — drew on APIFRAME 2.0 at 06:43 and were refused
      by APIFRAME 2.5 at 07:31 in ten seconds, at validation, free:
      `the input image 'content[2]' may contain real person`. Not the video,
      the assistant's still. The eyes-blur / black-bar trick that already
      rides the Sophie reference is the documented fix.
  - **AND THE LINE IS THE PERSON, NOT THE VIDEO (measured the same night on
    the cheapest Mini 4s jobs — a refusal is free, an accepted one ~5¢):** a
    PERSON-FREE reference video (the socks B-roll, a Seedance output,
    `drops/_/f899742c…mp4`) passed and drew for 6.5¢ (job
    `9afVS72Yq3S5Ss4BRo07`), and an AI-generated face STILL (a frame of the
    Mini clip itself) was refused `InputImageSensitiveContentDetected.
    PrivacyInformation` — so "AI faces pass" (every third-party blog) is
    false for a photoreal generated face. ByteDance's own docs say why: a
    face is only allowed as an `asset://` from the trusted asset library —
    a virtual portrait ("must not resemble any real human person", signed
    commitment letter) or a face-verified real person — behind a BytePlus
    account with business verification; entry tier free, paid tiers
    $1,400/mo+ (docs 2377608 · 2333565 · 2333589 · 2275638). That is what
    APIFRAME evidently holds.
  - **THE LINE IS PHOTOREAL EYES, measured in two more rounds the same
    night (all Mini 480p 1:1 4s, the O'Hara audition prompt, one reference
    each, ~5.4¢ an accepted job, a refusal free).** (1) Three Sandy-mirror
    portraits of an invented older woman — loose ink, a finished painting,
    near-photographic — ALL accepted and drawn (jobs `O6ALzDiy8gHXMkHUn2vq`
    · `H0xjmpXRVCe97LhOWR0s` · `uSG0ZN2yLFlr6rF1EytL`); the looseness of the
    reference set the LOOK of the clip. (2) Two drawn portraits of a REAL
    person (Mayra) — loose ink and most rendered — both accepted
    (`uRmoqfuAZVxGYHlKPhAD` · `kxsivm8ZJgtzuCZrJ592`), while her real photo
    was refused whole. (3) Her real photo with ONLY a soft-blurred band over
    the eyes (`sharp` extract → blur(14) → composite; mouth, hair, skin
    untouched) — ACCEPTED and drawn (`aY9LbIGMe9T5lEcA984a`). All three
    rounds drew O'Hara, because the prompt describes O'Hara; a likeness test
    needs "the woman in [Image1]" wording — and (4) that wording over the same
    eyes-blurred photo, card 45a's scale scene, DREW HER LIKENESS
    (`OudXGDf91uEk1um3pZUt`, Mini 3:4, 5.6¢). (5) The video half of the
    trick FAILS: the scale audition clip with every face's eyes blurred on
    every frame (`scratchpad blur-eyes-video.py`: YuNet landmarks → a
    Gaussian band per face, `drops/_/6c88c11a…mp4`) was refused
    `InputVideoSensitiveContentDetected.PrivacyInformation` — a video is
    screened for a person, not a face. Every job is in `forge-video-jobs`
    under `provider:'openrouter'`, chat `openrouter-vs-apiframe`; the clips
    and stills are on that chat's Compare pages.
  - **TWO FILTERS, NOT ONE — a black bar clears the INPUT check and a famous
    face is then stopped on the OUTPUT (measured 2026-09-09, Sophie: "i wanna
    test black bar over danielle radcliffe eyes"; both jobs Mini 480p 3:4 4s,
    `no-audio`, one reference each, the prompt `The man in [Image1] sits at a
    kitchen table and looks up. Camera at eye level.`).** The control — a
    Wikimedia press photo of Daniel Radcliffe, untouched — was refused at
    validation in twelve seconds, free, `InputImageSensitiveContentDetected.
    PrivacyInformation` "may contain real person", exactly as Mayra's real
    photo was. The same file with a solid black rectangle painted over both
    eyes (PIL `ImageDraw.rectangle`, x 390-900 / y 725-825 of the 1280x1924
    original, quality 95, nothing else touched) was **ACCEPTED** — `accepted
    3SL74kD3vCOePxCzjgh4`, four `pending` polls over a full minute, i.e. it
    really drew — and then came back `failed` with a refusal no round before
    this had produced: *"The request failed because the output video may be
    related to copyright restrictions."* So the bar is as good as the blur at
    the eyes check, and the eyes check is not the only gate: something reads
    the DRAWN VIDEO afterwards. The Mayra rounds never met it because nothing
    about her is famous or branded. **UNMEASURED, and the reason to stop
    rather than guess: which half of that photo did it** — Radcliffe's
    likeness (the prompt asked for it by slot, and the blur round proved a
    likeness rides through an obscured-eyes reference), or the studio
    step-and-repeat filling the frame behind him. One more Mini job settles
    it: the same bar on a tight face crop with no backdrop in shot. Billing:
    OpenRouter holds no `generation_id` record for the failed job, so it
    reads as unbilled, and the key had another chat's Mini batch running at
    the same time, so the delta could not be attributed — treat an accepted
    Mini job as ~5.6¢ and an output failure as unknown-but-small.
  - **IT IS HIS FACE, NOT THE BACKDROP — measured the same hour.** The same
    bar on a tight crop of the face (`crop((300,420,990,1290))` of the
    original, so the studio step-and-repeat is out of frame entirely, then
    `bar-eyes.py 90 305 600 405`) was ACCEPTED, drew for four polls, and
    came back with the identical refusal: *"the output video may be related
    to copyright restrictions"* (job `YMyKELvY54v87oTEhVG8`). Two independent
    photos of one man, one with branded background and one without, both
    reach the output gate and both are stopped there. So the gate reads the
    LIKENESS.
  - **THE PUBLIC RECORD, so the gate is not mistaken for a bug (researched
    2026-09-09).** Seedance 2.0 drew a Disney cease-and-desist on
    2026-02-13 calling it "a virtual smash-and-grab", with Paramount
    Skydance, Netflix, Warner Bros. Discovery, Sony Pictures and Universal
    following; Douyin VP Li Liang said on 02-15 that Seedance 2.0 would
    temporarily stop generating realistic human faces and IP-protected
    characters, and the API access that reopened in April carries those
    filters. What the guides do NOT cover is the half we hit: they all
    document the INPUT face filter (real photographic faces refused, AI or
    illustrated ones passing — which is our own drawn-face measurement
    arrived at from the other side) and mention a post-generation rejection
    only in passing, and the output-copyright error they DO document is an
    AUDIO match. **Ours had `generate_audio:false`, so the audio reading is
    ruled out by construction.** Two more things from the same reading, both
    load-bearing for any test designed here: the filters are described as
    scoring PROBABILISTICALLY rather than pass/fail, so a single job near
    the threshold can pass once and fail the next run — one job is an
    anecdote, not a measurement — and a failed generation is not billed,
    which is exactly what both blocked jobs look like from our side.
  - **THE FAME LADDER IS UNBUILT AND IS THE NEXT PASS (Sophie's own idea,
    2026-09-09: "you could use progressively less famous people to see where
    the bar is").** Nobody has published where the output gate's threshold
    sits, and both ends of the ladder are already on file here: Radcliffe
    (global) blocked twice, Mayra (not famous) drawn. The design: the black
    bar stays on EVERY rung — without it nothing reaches the output gate at
    all, so fame is the only variable — same prompt, same Mini 480p 3:4 4s,
    free-licensed Wikimedia photos, and MORE THAN ONE run per rung because
    of the probabilistic scoring above. Cheap by construction: a blocked
    rung costs nothing and only a rung that draws bills ~5.6¢.
  - **SO: text, pictures, audio and person-free videos → OpenRouter; any
    reference with a person in it → APIFRAME.** A reference video rides
    through as `video_url` and ByteDance decides; a content refusal answers
    400 `{refusal:'content', hint}` naming APIFRAME. The door is **`openrouter.js`, `POST
    /api/openrouter/video`** (Sophie, the same day: "logs yes"): the APIFRAME
    route's body word for word, a 202 carrying `sent` (the literal body
    OpenRouter received), `GET /video-job/:id` to poll (the clip is behind the
    key, so the poll downloads it WITH the bearer, mirrors it to
    `openrouter-video/` once — the log doc is read first — and writes the
  - **THE SEED IS A NUDGE, NOT A PIN — MEASURED 2026-09-09 on 2.0 Mini, and
    ByteDance says the same.** Both doors pass `seed` (`buildRequest` in
    `openrouter.js`; `apiframe.js` hands the whole body to `seedanceVideo`,
    which reads `opts.seed`) and all four Seedance models declare seed
    support — but the same seed with the IDENTICAL prompt still draws a
    different take. Four 4s clips, `ffmpeg psnr` on the luma (identical video
    would be infinite, and every md5 differed):
    **same seed + same prompt 27.1 dB · different seed + same prompt 21.5 dB ·
    same seed + ONE sentence changed 16.8 dB · no seed + different prompts
    16.1 dB · same seed + same prompt at 720p instead of 480p 16.2 dB.**
    **AND THE GRIP FALLS OFF HARD WITH LENGTH (2026-09-09).** The same test
    at **15 seconds** — two clips sent byte-identical, seed 7, verified field
    by field before either went — is **17.8 dB at t=0 and 13.5 overall**,
    against 33.2 and 27.1 on the 4s pair and 16.1 for two unrelated runs. The
    two takes open on different framings and are on different shots by 0:08.
    So the seed holds a SHORT clip's opening and does close to nothing at the
    lengths this film actually shoots: mint it for the record, never plan a
    shot around it. Page: "Same seed at 15 seconds v1" (`erZTQLqTs3Ys5bkQbsKy`).
    **BUT A WHOLE-CLIP AVERAGE HIDES THE STRUCTURE, and Sophie read the clips
    better than the number did (2026-09-09: "the same seeds are identical,
    other markedly different").** Measured per 0.5s window, the same-seed pair
    starts at **33.2 dB and decays to 24.5** by 4s, while the different-seed
    pair starts already apart at **29.7 and decays to 18.8**. At frame 0 the
    same-seed pair really is near-identical to the eye and the different-seed
    one is visibly another take. **So the seed reproduces the OPENING and then
    drifts** — it is worth more than the average says, and it is worth most on
    a SHORT clip. A changed sentence at the same seed opens at 27.1 dB, i.e.
    between the two: the seed still helps at the start, but the prompt change
    breaks it early, which is why a difference appearing 7 seconds in (the
    pill-bottle insert) still cannot be attributed to a changed line. Consequences: **you cannot isolate one prompt line with
    a seed** (an A/B needs several takes a side and a judgement over the set),
    and **you cannot block a shot cheaply at 480p and re-render the keeper at
    720p** — that is a fresh take, not the same shot larger.
  - **EVERY 2.x CLIP CARRIES A SEED NOW, MINTED IF THE CALLER DID NOT PASS ONE
    (2026-09-09, Sophie: "random seed yes but make it enforced and
    widespread").** `video-seed.js` is the ONE rule, used by both doors:
    `seedFor(given)` keeps a caller's usable seed and mints a fresh
    `randomSeed()` (1…2^31-1, never 0 — several APIs read 0 as "unset")
    otherwise, and `takesSeed(model)` scopes it to the **2.x family only** —
    the 1.x models have no seed control and APIFRAME refuses an unknown param
    rather than ignoring it, so a `seedance-1-lite` job is untouched. The seed
    rides `params`, so it lands in `forge-video-jobs` by itself, and
    APIFRAME's 202 now answers `seed` (and `sent`) so a chat can report the
    number. **A FRESH ONE PER CLIP, never a house constant** — a fixed seed
    reproduces openings, so one number across a film would give every clip the
    same family resemblance at the start. Test:
    `node scripts/test-video-seed.js`.
  - **`return_last_frame` IS A NO-OP ON OPENROUTER AND WORKS ON ATLAS — BOTH
    MEASURED, AND IT IS FREE (2026-09-08 and 2026-09-09).** The flag is on
    Mini's card and both doors ACCEPT it with no shape error; what comes back
    is where they differ, so the door decides whether it is worth sending.
    - **OpenRouter: nothing.** The completed job answers one `unsigned_urls`
      entry and `content?index=1` replies *"Video index 1 out of range (1
      videos available)"*. Cost of finding out: one 5.6¢ probe.
    - **Atlas Cloud: a SECOND OUTPUT, and it is the real frame.** Job
      `83d5d715da794a58ad3c1334e690dd33` (Mini, 480p 16:9, 4s, no references)
      came back with `outputs` holding the mp4 **and**
      `…_last-frame.png` — 864x496 RGB, the same canvas as the clip.
    - **IT COSTS NOTHING EXTRA.** Atlas billed **40,594 tokens** and the
      video-only formula is `864 × 496 × 97 / 1024 = 40,594.5` — the clip's
      own price to the token, so the PNG rides free.
    - **AND IT IS BETTER THAN A DECODE, MEASURED AGAINST THE SAME FRAME.**
      The PNG vs the ffmpeg-decoded frame 96 of that clip: **PSNR 38.6 dB**
      (the same picture, genuinely different data), **1.18x the sharpness**
      (variance of Laplacian 67.8 against 57.5), **35,125 unique colours
      against 26,661**, and the one that settles it — **horizontal chroma
      detail 0.1421 against 0.0012, a factor of 118.** The decoded frame's
      chroma is flat between adjacent column pairs, which is exactly what
      4:2:0 does; the PNG has real per-pixel chroma, so it is rendered
      BEFORE the h264 encode rather than pulled out of it.
    - **It is the LAST frame, not a nearby one** — PSNR against the decoded
      tail climbs 19.9 · 21.4 · 23.7 · 27.0 · **38.6** over frames 92-96.
    - **Wired 2026-09-09, OFF by default** (`returnLastFrame: true` on
      `POST /api/atlascloud/video`): the PNG is mirrored to Storage under
      `atlascloud-lastframe/` and filed on the job's log as `lastFrame`. The
      two outputs are told apart **by name, never by position** — the signed
      url carries `.mp4` and `.png` inside its own query string, so a naive
      extension test matches the clip too. Test:
      `node scripts/test-atlas-lastframe.js`.
  - **THE "LAST FRAME IS THE WORST FRAME" RULE WAS HALF WRONG — MEASURED ON
    SIX OF HER REAL WARD CLIPS (2026-09-09).** The note that stood here said
    the last frame is a P-frame at the tail of a prediction chain "where the
    encoder spends fewest bits". The first half is true and the second is
    false, and it matters because it was the argument against chaining.
    - **Every one of the six ends on a P-frame** — true, and the gap back to
      the last keyframe runs 1 to 199 frames.
    - **The bits claim is FALSE.** The final packet is at or ABOVE the clip's
      median on four of the six (annie2 28,361 against a 11,306 median;
      intakeB3 23,563 / 10,130; s39a3 20,916 / 17,747; ext at the median),
      and only meaningfully below it on one (doc 14,250 / 16,759). A P-frame
      after motion is often one of the biggest frames in the file.
    - **What is real is CONTENT, about one clip in six.** Sharpness of the
      last frame as a share of the best frame in the last 25: **100% · 100% ·
      94.8% · 91.4% · 88.9%** — and then **27.5%** (intakeB3), a smooth
      monotone decay over the last eight frames (17.2 → 4.7) with brightness
      flat at 109, i.e. **the shot itself going soft**, not an encode
      artifact. A clip that ends mid-move or ends on a light change is the
      same story (annie2's tail brightens 30 → 55).
    - **So the rule is not "never chain the last frame", it is "never chain
      it blind".** Score the last half-second and take the crispest frame —
      `ward-pullstills.py` already does exactly this scoring — which costs
      nothing and turns the one bad case into a frame eight frames earlier.
      On Atlas, ask for the PNG instead and the question mostly goes away.
  - **NO SEED IS EVER RETURNED, so the seeds of clips already made are gone.**
    APIFRAME echoes back only the `seedanceParams` that were SENT (a job sent
    without one has none) and OpenRouter's completed response carries id,
    status and usage and nothing else. Passing a seed and recording it costs
    nothing and is worth doing — it is the only handle that exists and a later
    model may honour it better — but do not promise it gets a clip back.
  - **READ `usage.cost` OFF THE JOB, NEVER THE BALANCE DELTA.** OpenRouter's
    completed job carries its own exact price, and the account balance is
    shared: a delta measured while another chat was spending gave 0.93¢/s when
    the true figure was 1.39¢/s. **Measured exactly, 2.0 Mini 3:4: 480p =
    1.39¢/s (560x752), 720p = 3.07¢/s (834x1112, 2.20x the pixels).**
  - **THE AUDIO PATH DOES NOT CHANGE WITH RESOLUTION OR MODEL** — 480p Mini,
    720p Mini and 2.5 all come back 32kHz stereo AAC at ~128 kb/s. So 720p
    buys picture only; it is very unlikely to clean up dialogue.
  - **SUPERSEDED 2026-09-11 — THE KEYFRAMES ARE WIRED ON ALL THREE DOORS.**
    The paragraph below is the state of it before that day and is kept as the
    record; the line that mattered — "APIFRAME's route already wires them, the
    OpenRouter route deliberately does not" — is no longer true. See *THE
    FIRST FRAME, ON ALL THREE DOORS* immediately under this bullet.
  - **FEATURES ON EVERY SEEDANCE 2.x THAT NOTHING HERE USES YET** (off the
    served model cards, `GET /api/openrouter/models`): **`first_frame` /
    `last_frame` keyframes** — APIFRAME's route already wires them
    (`imageUrl` → `start_image`, `endImageUrl` → `end_image`), the OpenRouter
    route deliberately does not, and forcing a clip to END on the next clip's
    first frame is the continuity tool this film keeps needing
    (`return_last_frame` is measured and wired — see the bullet above);
    **`camera_fixed`** (`cameraFixed`
    on the APIFRAME route) locks the camera off. And **a job carrying a
    reference VIDEO is billed at a LOWER rate** —
    `video_tokens_with_video_input` is $2.10/M against $3.50/M on Mini and
    $6.40/M against $10.70/M on 2.5.
  - **THE 1080p REDO IS AN UPSCALE PASS, NOT A RE-SHOOT (2026-09-09).** The
    standing plan — "eventually we will redo all this footage at 1080p once
    it's perfect" — would DESTROY the takes: measured the same night, the same
    prompt and seed at 720p instead of 480p is a different performance
    (16.2 dB), so re-generating throws away every shot she picked. What
    studios do with AI footage is upscale in post. Topaz Video AI is the
    standard tool and is on Replicate pay-per-use (no $299/yr subscription);
    for AI-generated footage specifically, SeedVR2 is now preferred over the
    older CNN upscalers, and the rule of thumb is 2x at a time rather than one
    4x jump on a low-res source. **Her 480p 3:4 is 560x752, so a single 2x
    pass is 1120x1504 — already past 1080p on the short edge.** So the whole
    plan is one post pass over clips that already exist, and the prompts and
    references are worth keeping for re-cuts and pickups rather than for a
    wholesale redraw. Price not yet measured — run one of her clips through
    and read it off the prediction.
  - **THE ATLAS DOOR'S SECONDS CHECK IS PER MODEL SINCE 2026-09-11 (Sophie:
    "it says too long but 2.5 allows 30s").** `atlascloud.js` clamped EVERY
    Seedance model to 4-15, so a 30s 2.5 job that `/footage` had accepted
    (its own table says 4-30) walked OpenRouter → refused (a person in
    [Video1]) → Atlas, and Atlas's OWN door refused it with "duration is 4-15".
    Atlas's schema files (`static.atlascloud.ai/model/schema/bytedance-seedance-
    *-reference-to-video.json`) say 2.5 is 4-30 and Mini / Fast / 2.0 are
    4-15; `secondsRange(model)` reads that. Pinned by
    `node scripts/test-atlascloud-video.js`.
  - **2.5 CANNOT DO 1080p OR 4K — only `seedance-2.0` can.** The served cards:
    2.5 is 480p/720p and 4-30s; 2.0 is 480p/720p/1080p/4K but 4-15s; Mini and
    2.0-fast are 480p/720p, 4-15s. So the eventual 1080p redo of the ward film
    is a different MODEL, not a bigger setting on the one it was shot with —
    worth knowing before more footage is locked.
    permanent url and the job's real `cost`), and **the same
    `forge-video-jobs` doc APIFRAME's route files**, stamped
    `provider:'openrouter'`, with OpenRouter's statuses mapped onto the log's
    vocabulary (`apiframeStatus`). A ByteDance content refusal answers 400
    `{refusal:'content'}` and nothing is billed or logged; a short model name (`seedance-2.0-mini`, `2.5`) maps onto
    OpenRouter's id and an unknown one is refused, never guessed. `GET
    /credits` is the balance in dollars, `GET /models` the served SKUs.
    `OPENROUTER_API_KEY` is a managed key (config-loader). Test: `node
    scripts/test-openrouter-video.js`. From a container with no server,
    `node scripts/openrouter-video.js` sends one job the same way (prints the
    exact body first, never retries or reshapes, `--video` rides through) — but it
    files NO log, so a clip drawn that way is written up by hand in the reply.
  - **ATLAS CLOUD — THE THIRD DOOR, AND IT TAKES A PERSON VIDEO (2026-09-09,
    Sophie handed over Atlas Cloud's `bytedance/seedance-2.0-mini/
    reference-to-video` API reference the same day the reseller research
    landed; measured the same night on her "try the hardest thing first").**
    **MEASURED — one job, `2b0b451548d84902988d01faf8bbcf99`, logged in
    `forge-video-jobs` under chat `seedance-reference-to-video`:** the
    O'Hara stretcher clip (`drops/_/3c1e96d9f2034fc6a6a496b25926746a.mp4`,
    three people in frame, the clip OpenRouter REFUSED as
    `InputVideoSensitiveContentDetected`) as the ONLY reference, prompt
    `the woman in video 1 looks up at the ceiling, camera at eye level`,
    Mini · 4s · 480p · 16:9 · sound on → ACCEPTED on the POST, `completed`
    in 80s, and it drew HER (a likeness, in landscape). So Atlas's FAQ ("no
    real faces") is not what its Mini door does with a Seedance-made person
    video — the person filter did not fire. The output url is on
    `volces.com` under `dreamina-seedance-2-0-mini/`, i.e. ByteDance's own
    storage on the Dreamina route, not a Runway-style backend.
    **THREE MORE THE SAME HOUR (Sophie: "try radcliffe · try a human still
    not ai"):**
    - **A REAL, UNTOUCHED PHOTO PASSES AND DRAWS THE LIKENESS** — Mayra's
      real portrait (`drops/_/0a72c8a0a425afbff32e2c1dccbe74ea.jpg`, the
      photo OpenRouter refused WHOLE — no blur, no bar) as the only
      reference, `the woman in image 1 looks up, camera at eye level`, Mini ·
      4s · 480p · 16:9 → accepted, `completed` in 110s, and the clip is HER,
      near-exact (job `1341e19bf73f44bd9e038c9b15c35286`). So Atlas runs NO
      real-person check on a still at all — the eyes trick is unnecessary
      there. **A reference IMAGE is not billed as tokens** (40,594 = the
      output alone) where a reference VIDEO is (job 1 above, 80,770).
    - **A FAMOUS FACE IS REFUSED ON THE POST, FREE, AS COPYRIGHT — WITH OR
      WITHOUT THE BAR.** Radcliffe's untouched press photo
      (`drops/_/ff6f86e35eb4e6b3da3d69902d3324d6.jpg`) and the same photo
      with the black bar over both eyes
      (`drops/_/1c78121dc1631b8c0ad8b4256d91e1cd.jpg`) both came back 400
      `InputImageSensitiveContentDetected.PolicyViolation … may be related
      to copyright restrictions` in under a second, nothing drawn, nothing
      billed. **So Atlas's gate is a FAMOUS-FACE (copyright) check on the
      INPUT, not the `PrivacyInformation` real-person check ByteDance's own
      door runs** — and it recognises him THROUGH the bar, where
      ByteDance's input gate let the bar through and its output gate caught
      him (CLAUDE.md, the Radcliffe rounds). Where the famous line sits is
      still the open question, now on this door too.
    So for the ward film Atlas is a second door for EVERY person reference
    she has — her own, her family's, a Seedance-drawn person, a clip with
    people — and only a recognisable public figure is refused.
    **THE CANVAS:** 864x496 at 480p 16:9 (a 16px taller frame than the 2.5
    table's 864x480). **THE TOKENS:** 80,770 — the output (864·496·97/1024
    ≈ 40.6k) plus the reference video (560·752·97/1024 ≈ 39.9k), so a
    reference video is billed as input tokens on top. **THE PRICE — THE 80%
    SALE IS REAL, read off Atlas's own `GET /models`:** `price.actual.
    base_price` is dollars per SECOND with the sale applied and
    `price.discount` is the percent she PAYS — Mini `0.011` (origin 0.056,
    pays 20 → 4.4¢ for the 4s clip against APIFRAME's ~16¢ and OpenRouter's
    14¢ at full list); 2.5 `0.134` (origin 0.167, pays 80); 2.0 `0.09`
    (origin 0.112); Fast `0.027` (origin 0.09). `footage.js` reads it live
    (`atlasPrices()`, ten-minute cache, the list rate as the fallback) and
    the estimate stays "about" until her console pins dollars to the token
    count — Atlas has NO balance or billing endpoint (every path probed
    answers 404; only https://console.atlascloud.ai). Whether `base_price`
    changes with resolution is unmeasured (the readme says billing follows
    "the selected resolution"). `atlascloud.js`, mounted at `/api/atlascloud`, takes the SAME
    body as the OpenRouter and APIFRAME routes (`POST /video` → 202 `{jobId,
    poll, sent}`, `GET /video-job/:id` to poll, the clip mirrored to Storage
    under `atlascloud-video/`) and files the SAME `forge-video-jobs` doc,
    stamped `provider:'atlascloud'`. `ATLASCLOUD_API_KEY` is a managed key
    (config-loader), set on the Render service by API 2026-09-09 (live on
    the next deploy). From a container: `node scripts/atlascloud-video.js` (prints the
    exact body, `--dry` sends nothing, files no log). Test: `node
    scripts/test-atlascloud-video.js`. What the first job settled is above;
    what it was built to measure, as written before it ran:
    - **THE PRICE.** Atlas bills in TOKENS (`completion_tokens` /
      `total_tokens` on the prediction) and its Mini deal banner is
      unverified (CLAUDE.md); the poll files the token counts on the log and
      invents no dollar figure. Read the charge off the console after the
      first job, then put it in footage.js's table.
    - **THE FACE FILTER.** Atlas forwards to ByteDance, its FAQ says no real
      faces, and the one honest test is the eyes-blurred Mayra photo on a
      Mini job here. A refusal on the POST throws `{refusal:'content'}` and
      logs nothing; a prediction that FAILS with the refusal text patches
      `refusal:'content'` onto the log — which of the two Atlas does is
      unknown, and both are handled.
    - **THE SLOT WORD.** Atlas names references `image 1` / `@image1` in
      order; the house says `[Image1]`. Nothing rewrites her prompt. The first
      job should carry Atlas's spelling; whether the bracket form lands is a
      second cheap clip.
    - **THE OTHER MODELS.** Only the Mini id is on file. A full
      `bytedance/seedance-…/reference-to-video` id is passed through as
      given and Atlas decides; a short name other than Mini's is refused
      rather than guessed. Its resolutions are `480p · 720p · 720p-SR ·
      1080p-SR · 1440p-SR`, seconds 4-15 (or -1), ratios the six plus
      `adaptive`, up to 9 images / 3 videos / 3 audios (audio needs a
      picture or video beside it — refused before sending).
    **THE FOOTAGE PAGE'S ONLY DOOR AND THE AUTO DEFAULT FROM 2026-09-09 TO
    2026-09-11 (Sophie, that evening: "make atlas the default and only route
    through footage"; superseded by "choose cheapest" — see *THE CHEAPEST
    DOOR* below, which keeps Mini and Fast here and moves 2.0 and 2.5 off).** It rode for an afternoon as its own model row ("2.0 Mini ·
    Atlas", her "did you add it to the footage tile?") beside the OpenRouter
    Mini; by the evening the two measurements above — a person video and a
    real photo both pass, a famous face is refused free — plus the real 80%
    Mini sale made it the door. So: every 2.x row in footage.js's `MODELS`
    carries an Atlas id (`atlas`) and Atlas's LIST rate per second
    (`atlasCents`: Mini 5.6¢ · Fast 9¢ · 2.0 11.2¢ · 2.5 16.7¢, off its own
    `GET /models` `price.origin`; 2.0 at 1080p is unpriced there and null);
    the page pinned `door:'atlascloud'` on every job (it sends `auto` now),
    its model list was the rows Atlas carries (1.5 Pro stays off), its "?"
    card quotes NO balance (Atlas has none to read — the console is the only
    billing read), and its sale line reads `atlasPays` ("2.0 Mini is 80% off
    right now" while Atlas charges 20% of list). `doorFor`'s AUTO order is
    Atlas first with APIFRAME as the content-refusal fallback (a famous face
    — `startJob` re-sends there with a note saying so), OpenRouter for a
    shape Atlas does not price, APIFRAME last; a PINNED door never falls
    back, so a refusal on a door a chat named is a measurement it reads.
    **NOTHING ON ATLAS IS `exact`** — it publishes no billing API, her
    console is the only read, and no Atlas charge has ever been read against
    an estimate (2026-09-10, her "add ~ to both").

    **THE CHEAPEST DOOR (2026-09-11, Sophie, adding 2.0 and 2.5 to the page:
    "are they cheapest through router, atlas or frame? choose cheapest").**
    `doorFor`'s AUTO ranks every configured door by `priceOn` — the same
    per-door price `estimate` answers with, split out so the two cannot call
    each other forever — and sends to the cheapest. Measured live that day,
    one 4s 480p 16:9 clip: Mini **4.4¢ Atlas** · 13.6¢ OpenRouter · 16¢
    APIFRAME; Fast **10.8¢ Atlas** · 16.3¢ · 28¢; 2.0 **27.2¢ OpenRouter** ·
    32¢ APIFRAME · 36¢ Atlas; 2.5 **41.6¢ OpenRouter** · 52¢ APIFRAME · 53.6¢
    Atlas. The split is Atlas's own sale — 80% off Mini and 70% off Fast
    against 20% off the two big rows — so nothing about the order is written
    down: the shape, the resolution, the seconds and a reference video all
    move it (2.5 WITH a video is the one row where Atlas beats APIFRAME, 53.6¢
    against 60¢, because APIFRAME charges its own dearer video rate).
    - **THE CHAIN IS EVERY OTHER DOOR, NONE SKIPPED (2026-09-11 afternoon —
      this REPLACES the morning's "the walk only ever gets looser").**
      `DOOR_LOOSENESS` (OpenRouter refuses any person, Atlas a famous face,
      APIFRAME the loosest) is a preference, never a pruning rule: on 2.5 the
      price order is OpenRouter · APIFRAME · Atlas, so the old rule pushed
      APIFRAME first and dropped Atlas as "less loose" — and APIFRAME
      accepted Sophie's witchcraft-kit job and refused the real face ten
      seconds later ON THE POLL, twice, while Atlas drew the same three
      pictures (Mini ×2 that hour, then 2.5 from a container, same seed:
      3m32s, job `0eab8ac88bf740cbae9793c184b192b8`). `chain` is now the
      remaining doors with the ones whose refusal is free on the POST first
      (`DOOR_REFUSAL_FREE`: OpenRouter, Atlas), each group cheapest first;
      APIFRAME's refusal lands on the poll and whether it bills is
      unmeasured. **THE WALK IS HISTORY (2026-09-11 evening, Sophie: "if a job refuses
      references it should just fail"):** `chain` is always empty, `walk`
      never rides the log doc, `walkPlan`/`walkOn` are gone, and `startJob`
      makes ONE send — a refusal throws with `refusal`/`door` on it and
      `pollOne` returns a poll-time refusal as the failure it is. Why: the
      walk put every APIFRAME job of the day there, and on 2.0 APIFRAME
      silently drops every reference when one holds a real person, draws a
      stranger, reports COMPLETED and bills — measured on all three of the
      day's 2.0 jobs against the identical references drawn exactly on Atlas.
      The card's `why` line is door-aware (`explain(text, code, door)`) and
      says "refused, nothing drawn or charged"; it no longer sends her to
      APIFRAME.
    - **A FAILED ATLAS PRICE READ KEEPS THE LAST GOOD PRICES.** It used to
      fall back to the table's LIST rate, which was only a high number on
      screen while Atlas was the one door and is now a DOOR CHANGE — every
      Mini job to OpenRouter at 3x the real price, silently, for the ten
      minutes the cache holds.
    - **`exact` NEEDS THE CANVAS MEASURED, not only the formula**
      (`canvasMeasured`, Mini alone). The token count is w × h × frames, so an
      OpenRouter price is only as pinned as the canvas — and the published
      table has been wrong once already, which is how Mini's 2.5 canvases were
      found. Fast, 2.0 and 2.5 answer "about" there until a charge is read.
    - **THE LAST FRAME RIDES ON ATLAS ALONE**, so a 2.0 or 2.5 clip has none.
      The page's "?" card says so. With no key set the page answers a
    plain error naming `ATLASCLOUD_API_KEY`. OpenRouter and APIFRAME stay
    built and a chat pins either by hand (`door:'openrouter'` /
    `'apiframe'`).
  - **A probe that went wrong, so it is not repeated:** the first probe
    script treated every 400 as a shape error and, after ByteDance's real
    refusal, tried a passthrough envelope that dropped the videos silently;
    ByteDance accepted THAT one and drew the scene from the pictures alone —
    41¢ for a clip she never approved. A content refusal (`…SensitiveContent…`)
    is terminal; only a ZodError from OpenRouter's own validator is a shape
    error.
  - **FOOTAGE — SHE SENDS A SEEDANCE CLIP HERSELF (2026-09-09, Sophie: "the
    next step is to build a point so I can just make things on my own time by
    describing them or uploading references").**
    **THE FEED PAGES BACK PAST TODAY (2026-09-11, Sophie: "I can't go back
    farther than today in footage")** — `… older` under the feed asks
    `GET /api/footage/jobs?limit=40&before=<sentAt of the oldest clip on
    screen>`; the answer carries `more`. `pageJobs` in footage.js is the walk,
    pure; the CLAUDE.md Footage bullet has the two rules.
 `footage.js` +
    `public/footage.html` at `/footage` (the film tab's pictures stage in the
    app): a prompt box, references uploaded through the Dump (`bundle=
    Footage`, md5-deduped, each shown with its slot name — tapping `[Image1]`
    drops it into the prompt so a reference is named, never described), a
    picture icon to attach one, drop-downs for the model and the size, a typed
    seconds field, the shape chips, the price of the tap, and **the star,
    which is the one button and sends on its tap**. Both doors are called IN
    PROCESS (`startVideo` / `pollVideo`, exported from openrouter.js and
    apiframe.js; the routes are thin calls now) and file the SAME
    `forge-video-jobs` doc tagged `chat:'footage'`, so the 1080p redo list
    covers what she makes here. `GET /api/footage/jobs` polls the unfinished
    ones itself, throttled 12s per job, and bakes a poster frame into
    `footage/posters/` on completion — so the feed resumes from any phone with
    nothing in localStorage. Seconds and resolution open at the minimum on
    every load (the length and the size are the bill); the model and the shape
    are remembered. Test: `node scripts/test-footage.js`.
    - **HER OWN LIST, THE SAME DAY, IS WHY IT LOOKS LIKE THIS.** No section
      labels; the controls on as few rows as they fit on (flex-wrap, nothing
      declares a row count); **ONE DOOR** — OpenRouter that morning, **ATLAS
      CLOUD since the same evening** (see *ATLAS CLOUD — THE THIRD DOOR*
      above) — so the door row is gone, the page always sends
      `door:'atlascloud'` and **1.5 Pro is off the model list** (APIFRAME-only)
      — OpenRouter and APIFRAME are still doors in the module and a chat
      pins either by hand, and a content refusal (a famous face, on Atlas) is
      free and shows on the page with its own line saying so;
      **sound always on**, sent explicitly; **no Plan step** (she asked for
      one the day before and retired it within the day — the price sits
      beside the star instead); the sale and the words behind the **"?"**,
      read live when the card opens (Atlas has no balance to read); and the Playground's **List / Tiles /
      3-4** switch on the feed, one `--cols` driving the tile wall and a
      card's own reference row. Full rules: the *Footage* bullet in CLAUDE.md.
    - **DIVIDE HERE — ONE BLOCK IS ONE CLIP (2026-09-11, Sophie: "can u add
      the feature from story timeline that allows me to divide into two text
      blocks where my cursor · a button · says divide here · pinned or sticky
      in footage · icon this time").** The Story Timeline's divide, on the
      box she types a scene into: a mark beside the bigger-box toggle — Lucide
      `separator-horizontal`, the icon she asked for in place of the
      timeline's word — cuts the block at the cursor, and the words after it
      become a SECOND block right under the first, with the timeline's join
      mark (`fold-vertical`) in the gap to put them back. A 15-second shot on
      Mini is two clips, and until this she cut the scene in two by hand:
      copy the tail out, send the head, paste the tail back in.
      - **AND A CARET AT THE END MAKES AN EMPTY BLOCK (2026-09-14, Sophie:
        "divide here in footage should allow a divide with nothing after it to
        make a new empty block").** It used to refuse — "put the cursor where
        the second block should start" — on the reasoning that there was
        nothing to cut, and that reasoning is HISTORY: an empty block is an
        ordinary state on this page (a restored draft can hold one,
        the star refuses one with "say what the clip
        is first"), and writing shot two means asking for a box before there
        are words to put in it. Three things not to undo: **the new empty
        block takes the gold line AND the caret** (the tap means "give me
        somewhere to write", so leaving the star pointing at the block she
        just left would cost her a tap into a box she asked for) — which
        needed a second carve-out in the document click handler beside the
        fold's, since that handler runs AFTER the button's own and would drag
        the line straight back onto the block the button sits in; **a caret at
        the START is still refused**, because there her words all move DOWN
        into a new block and the empty one lands above them — a long scene
        jumping down the screen, which is not what the mark says it does (the
        way to an empty block above is a divide at the end of the block
        before); and **an empty box divides into nothing** and says so, since
        two empty blocks is not a state worth a tap. The strip is copied into
        the empty block like any other divide — one rule, and the pictures are
        what shot two is usually drawn against.
      - **THE STAR SENDS THE BLOCK SHE IS IN** — the last one she tapped into,
        wearing the star's own gold line once there are two or more; one
        block wears nothing and the page looks exactly as it did. The model,
        the seconds and the size are the JOB and are shared across the
        blocks; the block is the words AND its own pictures (below). A slot
        tap and a character's line land in that same block. Every block keeps
        its words after a send (the box's own rule) and the toast says which
        block went.
      - **A CARD'S PUT-BACK MAKES A BLOCK OF ITS OWN (2026-09-14, Sophie:
        "copy back from finished job shud make a new text block · not replace
        the selected block").** It used to write the card's words straight
        into the active box, so putting a finished clip back cost her whatever
        was in that block — the scene she was part way through, or the shot
        she had just divided out — and the only way back was the `undo`
        `copyBack` had to bank the WHOLE job for. One block is one clip, so a
        clip she puts back is another block. Five things not to undo:
          - **IT LANDS AT THE END**, never inserted beside the block she is
            standing in: an insert would renumber the shots she is reading in
            order, which is a change to her scene she did not ask for.
          - **…EXCEPT INTO A TRAILING EMPTY BLOCK**, which is the box she
            already has — a fresh page IS one empty block, and a divide at the
            end of the last one is her asking for somewhere to write. Adding
            beside either would strand an empty block she then has to take
            off. Empty means no words AND no pictures: a block carrying a
            strip is one she set up.
          - **THE NEW BLOCK TAKES THE GOLD LINE AND THE CARD'S OWN STRIP**, so
            the star sends what she just put back and the references under the
            panel are its. The block she was in keeps its words and its
            pictures exactly as they were — the whole of her ask — and there is
            nothing of any other block's to renumber, since none of them moved.
          - **NOTHING IS BANKED, because nothing is overwritten.** An `undo`
            left on the row by an earlier `clear` goes on meaning that clear.
          - **THE SETTINGS ARE STILL THE JOB and are still replaced** — the
            model, the seconds, the size, the shape and the seed belong to the
            clip whichever block sends it, and only what the record knows (a
            card with no seed clears the box, one with no keyframe brings no
            marks, a model this page does not offer leaves the picker alone).
          The window is walked to the block it landed in — never
          `scrollIntoView` (the caret keeper's and `goToCard`'s rule), and
          never simply to the top of the page, which on a panel of several
          blocks is not where the new block is.
      - **AND EVERY BLOCK KEEPS ITS OWN PICTURES (2026-09-14, Sophie: "blocks
        in footage that have images attached shud keep attached images and the
        images return when block is selected").** The strip under the panel is
        the ACTIVE block's — tapping into another hands its pictures back, and
        the references row names the block it is showing. **This supersedes
        "the references are the JOB and are shared" and the ✕ renaming the slot
        in EVERY block**; both are history rather than rules, because one block
        is one clip and the pictures that clip draws from belong to it exactly
        as its words do. Nine things not to undo:
        **FOLDING a block away no longer makes it the one the star sends** —
        the document click handler makes any button on a block active, which
        was invisible while the strip was shared and is wrong now: MEASURED,
        folding block 2 moved the gold line onto it and replaced her 2-picture
        strip on screen with block 2's 4. A heading tap that SHUTS a block is
        "put this away"; one that OPENS it still makes it active, which is her
        going there to write. (The rule lives in the document click handler,
        read off `shut` AFTER the heading's own handler has run.)
        a **DIVIDE copies the strip into both halves** (the tail's words name
        it by slot, so a second block starting empty would leave every
        `[Image2]` in it pointing at nothing — the ✕'s own renumbering rule
        arriving from the other end); a **JOIN unions the two and renumbers
        BOTH texts onto the union** (a slot is a POSITION, so below's
        `[Image1]` is a different picture from above's), with above's marks
        winning each end and below's riding only into an end above left free;
        an **UPLOAD lands on the block its tap was made from** (`addRefTo`) —
        an upload is a round trip, so tapping into another block while a
        picture uploads used to drop it there, on a scene that never asked
        for it, and the toast now names the block when it is not the one she
        is standing in; the **✕ renames the active block's words alone**, since no other
        block's pictures moved; a **card's put-back** brings the card's strip in
        on the new block it makes and touches nothing else; a **hand-off gives EVERY block the
        same strip**, since its scenes are one job's references however many
        parts they came over in; **each
        heading carries a picture glyph and a count**, so a block she is not
        standing in can never ride with pictures on no screen at all (a glyph
        and a digit rather than the word: the heading's room belongs to her
        scene); and the draft and the `clear` bank keep **`refs`/`first`/`last`
        as the FIRST block's** for a page cached from before, with the whole
        set beside them under **`jobs`** — a draft with no `jobs` gives every
        block the one strip it saved, which is what it meant while the strip
        was shared. The globals (`refs`, `firstUrl`, `lastUrl`) stay globals
        and are the live copy of the ACTIVE block's, stashed onto its node when
        she leaves it, so every attach, ✕, mark, character line and put-back
        went on reading what it always read. `jobOf(w)` is what a reader asks —
        the live copy for the active block, its `__job` for every other one —
        because a block's own button fires BEFORE the document click that makes
        it active. Test: `node scripts/test-footage-block-refs.js`.
      - **BOTH CORNER BUTTONS PIN TOGETHER.** `stickybox.js` v2: buttons on
        ONE box are one control row and pin as a group (the one-at-a-time
        rule is about two different boxes), and the divide is
        `data-stickybox="nofollow"` — a divide shrinks the box from its
        BOTTOM, so the seam is already where her eyes are, and the
        follow-back that is right for a contract would walk the page away
        from it.
      - **THE WRAP HOLDS THE ROOM WHILE A BOX IS MEASURED.** `fitBox` locks
        the `.promptwrap`'s min-height for the length of the `height:auto`
        measurement: at `auto` the box collapses to its floor for one layout,
        and if that layout leaves the document shorter than where she is
        scrolled the browser CLAMPS the scroll — measured, a divide from the
        pinned button at line 40 of a 70-line scene threw the page from
        scrollY 654 to 0 with no script scrolling anything. The same shape
        sat under every keystroke in a tall big box, where caretkeep pulled
        the caret back a frame later, so it read as a flicker.
      - **NOTHING IS SENT BY DIVIDING, NOTHING IS LOST BY JOINING** (the join
        is the two texts with a blank line between, each renumbered onto the
        two strips' union). A block DOES have a ✕ of
        its own since 2026-09-13 (the audit), so the line that used to sit
        here saying it never would is history. A caret at either end divides
        nothing and says so. A belt hand-off is
        one scene, so it is one block again. The draft keeps `prompt` as the
        first block for an older cached page and the rest under `blocks`.
      - **AND EACH BLOCK FOLDS ON ITS OWN — ITS OWN HEADING ROW (2026-09-13,
        Sophie: "make each text block in footage collapsible").** Four blocks
        of a 15-second scene is four screens of prose with no way to put any
        of them away, and the panel fold is all-or-nothing — so reading block
        4 against block 1 meant scrolling past two she had already settled.
        **THE HEADING IS THE FOLD** — the whole row, not a caret to hit (the
        chats app's part fold and judge.js's piles before it) — so it is the
        page's own `.fold` row, chevron and all, sitting INSIDE the wrap: the
        wrap stays the panel's direct child, which is what keeps the pill-gap
        fitter judging one rect per block. Seven things not to undo:
        it is drawn **only with two or more blocks** (the same `.many` class
        the ✕ and the gold line already ride), so a one-block page is
        byte-for-byte what it was; **shut, the row says that block's first
        words** (a column of rows reading "Block 2" is a scene she has to
        reopen to identify — the panel fold's own line) and open it says
        nothing, since the words are right there; what it hides is
        **DISPLAY-hidden and stays in the DOM**, so a folded block still
        sends its words, still renames its slots and reserves nothing for the
        pill; the **gold line moves to the heading** when the block she is in
        is folded away, because the box that wears it is not on screen and the
        star must never point at a block with nothing on screen saying so;
        **anything that puts words in a block OPENS it** (a slot tap, a
        character's line, a put-back, a hand-off — each writes into the block
        and then FOCUSES it, and focusing a box that is not on screen does
        nothing at all; a slot RENAME inside words she already wrote is not
        this, exactly as it is not on the panel fold); **a fold STAYS FOLDED
        across a reload** (2026-09-14, Sophie: "collapsed blocks don't stay
        collapsed") — it rides the DRAFT as `shut`, an array by position
        beside the words those folds belong to, never a settings key of its
        own, so a hand-off or a put-back replacing the blocks replaces the
        folds in the same write and a fold can never land on words it was not
        made for, and it is written only while something is really folded, so
        a page that never folds one saves exactly the draft it always saved.
        (It shipped memory-only — "a reload opens everything, the safe
        direction" — and that is HISTORY: the app keeps this web view alive
        for the whole app process, so the reload she meets is the page's own
        SELF-HEAL on a new build. Safe because a shut block still SAYS its
        first words.) And **a box is never fitted while it is folded** (`scrollHeight` on a
        `display:none` box is 0, so it would come back one line tall — every
        path that reopens one refits it). **THE FIRST DIVIDE NOW COSTS HEIGHT
        ABOVE THE SEAM** — it turns the panel `.many` and draws that block's
        heading above the box — so `divideBlock` measures the head box's top
        before and after and gives the difference back, which is what keeps
        the seam exactly where her eyes are (the caret keeper was papering
        over it a frame later, close enough to read as still and never
        exact). PHOTOGRAPHED, and it caught both real bugs: a `<button>` is
        inline-level and shrinks to fit, so the shut row ran off the right of
        the phone instead of ellipsizing, and the ✕'s own rule carries one
        class more than the blanket hide, so it floated alone over a folded
        block's heading. Test:
        `node scripts/test-footage-block-fold.js` (every assertion a
        MEASUREMENT — a heading that folds nothing, a fold whose CSS never
        landed, a block that comes back one line tall, a folded block whose
        words silently stop being sent, and a heading drawn on a one-block
        page all look identical in the source; it CRASHES against the pre-fix
        page, where there is no heading at all).
      - **A BLOCK IS A DIRECT CHILD OF THE PANEL**, never inside a wrapper,
        or the pill-gap fitter would shorten every block for a pill only the
        first one touches. `#prompt` / `#bigprompt` stay on the first block,
        so the hand-off, the tests and every older reader see the box they
        always did. Test: `node scripts/test-footage-divide.js` (every
        assertion a MEASUREMENT — the icon with no words, the two buttons
        pinned side by side and both tappable, the ring's real colour, what
        the stub really received from the star, the SEAM not moving on a
        pinned divide — the head box's own top on the glass, since the head
        shrinks from the bottom and setting `.value` drops the caret to 0 —
        the slot renamed in the second block).
    - **CHARACTERS & SETTING — ONE FOLDED BLOCK, TWO BOXES, ABOVE THE BLOCK
      SHE IS IN (2026-09-14, Sophie: "characters/setting become one collapsed
      block w two text boxes" · "characters/setting move to above currently
      selected block, w relevant characters for that block").** It shipped a
      day earlier as TWO permanent blocks pinned at the top of the panel
      (2026-09-13, "i envision two permanent default collapsed blocks at the
      top of footage: characters, then setting") and a day of cutting settled
      two things her sentence is naming:
      - **THEY ARE ONE THOUGHT**, so they are ONE fold with two boxes rather
        than two rows of chrome above every scene.
      - **WHO IS IN A SHOT CHANGES SHOT TO SHOT, WHERE THE ROOM DOES NOT.**
        That is what "relevant characters for that block" says, and it is what
        makes the move worth its cost: a block carrying the same words wherever
        it sat would be churn.
      So **CHARACTERS IS THE BLOCK'S** — `__chars` on the wrap, exactly the
      shape its strip already has, so tapping into another block hands its cast
      back the way its pictures come back — and **SETTING IS STILL THE STANDING
      VALUE**, one per project (`footage_heads`), riding every clip. What is
      written in both rides at the TOP of the prompt of the clip that block
      sends, cast first, blank line between, exactly the shape the join mark
      already gives her words. Eight things not to undo:
      - **IT IS NOT `blocks()`.** The wrap is `.headwrap`, each box sits in its
        own `.hrow` (which is what the corner button is positioned against) and
        is still `.hblock`, never `.promptwrap`/`.pblock` — so "the blocks"
        goes on meaning her SCENE blocks in every reader there is: the
        numbering, the gold line, the join marks, the ✕, the divide,
        `setBlocks`, the draft, the belt hand-off and every test are untouched
        by construction rather than by remembering to skip it. The cast rides
        the draft as `chars`, one per block, beside the words it belongs to;
        the setting rides `heads: {setting}` and the per-project map.
      - **THE GOLD LINE NEVER MOVES TO IT.** `setActive` is reached through
        `closest('.promptwrap')`, which this is not, so tapping into Characters
        leaves the star pointing where she left it — right, because the star
        cannot send a head on its own: it is the head of a shot, not a shot.
        For the same reason the scene box, not a head, is what "say what the
        clip is first" is about.
      - **IT MOVES ON EVERY PAINT, AND `placeHeads` IS THE ONE WRITER** of
        where it sits: directly above the active block, reached from
        `markActive` (which every path changing the gold line already comes
        through) and from the end of `paintBlocks`.
      - **THE NODE IS HELD, NOT HUNTED** (`HEADWRAP`). `paintBlocks` takes the
        wrap OUT while it rebuilds the join rows — a join row is inserted
        BEFORE its lower block and the wrap sits there whenever that block is
        the active one — so a lookup that walks `panel.children` answers null
        exactly when `placeHeads` needs it and the whole block is lost on the
        first divide. MEASURED: it simply vanished off the page.
      - **A JOIN ROW'S TWO BLOCKS ARE ITS NEAREST `.promptwrap` EITHER SIDE,
        NEVER ITS SIBLINGS** (`blockSide`, read by `paintJoinRows` and
        `joinAt`). The wrap sits in that gap and is SHUT by default, so reading
        the plain sibling found a shut node there and hid every join mark.
      - **AN EMPTY BOX ADDS NOTHING**, and with both empty the prompt is
        byte-for-byte the words in her box. Emptying one is how it stops
        riding: **permanent means no ✕ and no divide** — nothing takes it off
        the page and nothing turns it into two.
      - **`clear` WIPES THE CAST AND KEEPS THE ROOM.** That follows from the
        split rather than loosening the 09-13 rule: the cast belongs to a
        block, so it goes into the bank with the blocks and `undo` puts it
        back, and the room is the standing thing above the job exactly as it
        was. A belt hand-off leaves the room alone for the same reason.
      - **SHUT IS WHERE IT STARTS, EVERY LOAD** — the one place this page folds
        by default, and the opposite of a block's own fold (which rides the
        draft). It is only safe because **shut, the heading SAYS BOTH SETS OF
        WORDS**, cast first: a value riding a clip with nothing on screen
        saying so is the hidden ingredient the price beside the star exists to
        prevent.
      A **divide** copies the cast into the tail (its words name that block's
      pictures, and half a scene is the same people until she says otherwise);
      a **join** unions the two, a blank line between; a **put-back** strips a
      leading prefix that IS one of the casts on the page or the setting, and
      re-homes the cast it stripped onto the block it makes; and a **draft from
      the two-block day** seeds EVERY block with the one `heads.characters` it
      saved (dropping it on block 1 alone would leave the rest of her scene
      without the people in it). `paintHeadBlock`, NOT `paintHead` — the page
      header has a `paintHead` of its own hundreds of lines down, and a
      duplicate function DECLARATION is not an error: the last one in the file
      wins, silently.
      Test: `node scripts/test-footage-heads.js` (every assertion a
      MEASUREMENT of what really renders or a reading of what the stub server
      really received — a block that never folds, one that quietly joins
      `blocks()` and renumbers her scene, one that sits in the markup above the
      active block and paints somewhere else, a cast that reads back right and
      never reaches the door, and a join mark hidden by the wrap that moved
      between two blocks all look identical in the source).
      **AND THE STAR'S OWN LINE NAMES WHAT RIDES ON TOP (2026-09-26, Sophie,
      a $2.06 2.5 clip that went with a whole other scene in front of her
      block: "spent a bunch of money on this 2.5 flip only to see it was sent
      with extra words · why??").** MEASURED off the log that night: the moon
      block went at 04:10 with nothing in front of it, and at 04:15 and 04:16
      the same block went twice (a 30s Wan, then the $2.06 2.5) with the
      ENTIRE Newton scene — "no music / maintain the exact imperfect hand
      drawn illustration style… / shot 1: newton sits under an apple tree…" —
      in front of it, and the job's own `blocks` holding only the moon words.
      That shape is `withHeads`: the scene was sitting in the Characters
      box (or the Setting box — the log cannot tell the two apart, and
      nothing in the page writes scene text into either; the box sits directly
      above the block with a textarea the same shape as a block's). The
      2026-09-24 rule shuts the fold after EVERY send, so from then on the
      only thing on screen saying so was the shut heading's one truncated line
      — "· no music maintain t…" — which is not a disclosure anyone reads
      before a $2 tap. So the ONE place she looks before the tap says it now:
      under the price, `+ characters & setting on top · 118 words` (`.rides`,
      `paintRides`, drawn by `paintHeadBlocks` and put back by `paintGo` after
      the estimate rewrites `#cost`), the house inline opener's underlined
      word, a tap opening the fold and walking to it; only the heads THIS send
      would carry (a marked send names the setting alone, `withSetting`'s own
      rule); nothing drawn while both boxes are empty. **What is SENT did not
      change** — the shut box still rides, exactly as her 09-14 and 09-24 asks
      have it. The test measures the line under the price, its count, the tap
      opening the fold, its absence with both boxes empty, and "setting" alone
      once the cast is emptied.
    - **WHAT CHANGED — THE COMPARE PANEL (2026-09-11, Sophie: "is there an
      easy way I can diff video clips like I can't remember what I changed for
      example sometimes it's a single line or a reference for the model the
      timing etc … It's always been Sophie clips since they're pretty similar.
      I can't remember what I was trying to fix").** A compare mark on every
      card (Lucide `git-compare`) opens a paper sheet — the same ✕ in the same
      corner as the player — on THIS clip against the one BEFORE it in the
      same project, and draws only what moved: a **word diff of the prompt**
      (what she put in underlined on a green wash, what she took out struck
      on rose — her Sophie clips share ~90% of their words, so a plain
      side-by-side hides the one line), **one row per setting that changed**
      (`seconds 8s → 12s`; the seed, the model, the size, the shape, the door
      and the project — never `sound`, which every clip here has), and the
      **references matched slot by slot** in the doors' order, so a different
      picture in `[Image2]` is ONE `swapped` row rather than a removal and an
      addition, with the keyframes on their own lane. A one-line summary sits
      over it (`1 word · seconds 8s → 12s · [Image1] swapped`), which is also
      what a chat can print off `summary()`.
      - **NOTHING NEW IS STORED.** Every card already carries the exact
        prompt, the settings and every reference url; the panel is a READ of
        two cards through `clip-diff.js` — pure, at the repo root, loaded by
        the test and served to the page at `/clip-diff.js` (the
        `pause-plan.js` pattern), so the panel and the test drive one rule.
      - **A REFERENCE IS NAMED, NEVER SHOWN AS A HASH.** The name is resolved
        off the CAST LIBRARY (`castNames`: url → "Sophie · the blue pajamas",
        the character alone on a one-look entry; the wardrobe entry itself for
        a floating outfit), then the ref's own `name`, then the url's filename
        — and a Storage id (random hex) is refused as a name, so the slot and
        the thumb stand alone rather than a string that says nothing. The
        shelf is read once per film (`cmpCast`), lazily, when the panel opens.
      - **THE OTHER SIDE DEFAULTS TO THE CLIP BEFORE, IN THE PROJECT**
        (`previousOf`: next older by `sentAt`, same project; an unfiled clip
        is compared against the unfiled ones, never against another
        project's). Most redos are one clip chained off the last, so one tap
        answers "what did I change". `‹ older` / `newer ›` walk the other
        side along the project; **`pick a clip`** closes the panel, lights the
        mark on the clip the pick is for, and the next compare mark she taps
        is the other side (tapping the lit one again cancels). A clip with
        nothing before it on the page goes straight to a pick with a toast.
      - **A CLIP OLDER THAN THE PAGE HOLDS IS ASKED OF THE SERVER**, one at a
        time, off the feed's own cursor (`/jobs?limit=1&before=<sentAt>` in
        the project) — and kept in a SIDE POOL (`cmpPool`), never landed on
        the feed, so the `… older` walk's cursor is untouched and a page she
        has not walked to is not skipped.
      - **The pill still owns its column.** `#cmp` sits over the pill in
        z-order, but the pill adopts a nearly-full-screen scroller and lifts
        itself above it — which is right, the body scrolls — so the panel
        reserves the 64px on its right like every other sheet here. The
        page is locked behind it and put back on close; `__navBack` closes it
        first, the way it closes the player.
      - **LINES FIRST, WORDS SECOND — AND THE OTHER SIDE IS THE NEAREST
        TWIN, NOT THE CLIP BEFORE IT IN TIME (2026-09-11, the same evening,
        Sophie with a screenshot of the live panel: "text looks wrong. It
        should call out exactly what changed").** The first cut ran one word
        LCS over the WHOLE prompt and opened on the clip immediately older
        in the project — so a 15s 9:16 Sophie clip was diffed against a 4s
        failed 3:4 clip about something else, and every "the" and "a" the
        two shared was lined up and the rest painted as a hash of green and
        rose. Two changes, one rule each in `clip-diff.js`:
        - **The prompt is diffed as LINES.** A line that is the same is
          same; a line replaced by a near-twin (`LINE_TWIN`, half its
          distinct words shared) is word-diffed against that twin so the
          one changed word lights; anything else is a whole line struck or
          a whole line in. The newline after a line belongs to the side
          that has a line after it, which is what lets the diff still
          re-join byte for byte to BOTH prompts (an added last paragraph
          brings its own break in as an add).
        - **`kinOf` picks the other side** — the nearest OLDER clip in the
          project whose prompt shares `KIN` (0.4) of its distinct words, a
          redo. The page runs it over the clips it holds and, when the twin
          is further back than the feed has loaded, asks
          `GET /api/footage/jobs/:id/kin`, which runs the same function over
          the whole project. With no twin anywhere the plain previous clip
          answers, marked `kin:false`, and the panel says **"A different
          prompt — nothing to line up word for word"** and shows this clip's
          words plain instead of a hash; the walk and the pick are the way
          to a real twin. "‹ older" walks twin-first too.
      - **ONLY WHAT CHANGED, AND THE WHOLE PROMPT BEHIND AN OPENER
        (2026-09-14, Sophie: "default ONLY shows diff - expand button to see
        whole prompt").** The panel painted the WHOLE prompt with the moved
        words lit, which on her ward scenes is six lines of prose to find one
        green word in. It now draws only the lines that moved, with
        `… the whole prompt (2 more lines)` under them — an underlined word,
        never a button with a box (the house `.moretxt` rule) — and the state
        is a module var, so it holds while she walks clip to clip and opens
        folded again on a reload. Three things: `promptLines` in
        `clip-diff.js` cuts the diff back into lines (it re-joins byte for
        byte, so this is exact rather than a second parse) and each line is
        marked by its OWN text — **the newline an added paragraph brings in
        belongs to the END of the line above it**, so counting the break would
        light an untouched line every time she added one underneath; a changed
        line carries its unchanged words too, so what she reads is the
        sentence in place rather than a bare word; and the opener is drawn
        only when something is really behind it (a clip where every line moved
        has nothing to open, and a dead control there reads as a broken fold).
        The **"a different prompt" case folds too** — a prompt that is not a
        comparison must not fill the panel by default.
      - **EVERY CLIP LIKE THIS ONE — THE STRIP UNDER THE PAIR (2026-09-14,
        Sophie: "shows ALL clips with similar prompt, including parts of
        it").** `kinOf` answers ONE clip and is the right thing to OPEN on;
        it is the wrong answer to "which other clips are this shot". So the
        panel carries a row of tiles — poster, how much of it that clip
        carries, when it was sent — the current other side lit, and a tap
        seats that clip as "before" (the newer of the two is always "this
        clip", the pick's own rule, or her added words paint as struck-out
        deletions). `relatives()` is the rule, and it is measured TWO ways
        with the better number ranking:
        - **`alike`** — the whole prompt's Jaccard: a redo of the same words.
        - **`part`** — the share of this clip's WORDS sitting in a line the
          other clip also carries, which is what finds a clip holding one
          paragraph of it ("including parts of it") where the whole-prompt
          number is far under any bar.
        **A LINE EVERY CLIP CARRIES IS DISCOUNTED TO NOTHING** (plain IDF over
        the candidates themselves): every ward prompt ends "camera at eye
        level", and weighing lines by their words alone makes that a quarter
        of a short prompt — so without it every unrelated clip in the film
        clears the bar and the list IS the project. Measured on a six-clip
        fixture: the redo and the clip sharing a real paragraph are listed,
        the three sharing only boilerplate are not. **AND THE GATE IS EITHER
        BAR, never the better number against one bar** (`alike >= KIN ||
        part >= PART`): the whole-prompt Jaccard carries the boilerplate too,
        so one bar over `max()` lists the project again however well `part` is
        weighted. Newer clips are in as well as older — she may be standing on
        an older clip asking what it became — and another project never is.
        The list is asked of the SERVER (`GET /api/footage/jobs/:id/relatives`,
        the kin route's own reads and rules, capped at 40) because the feed
        holds the newest 40 of the view she is on, so the redo from three days
        ago is not on the page to be found; it lands in the side pool, never
        on the feed, so the `… older` cursor is untouched, and the same rule
        over what the page holds fills the strip until it arrives. **The WORD
        on a tile comes off `alike`, never off the ranking score** — `part`
        saturates at 1 for any redo, so a score-read word called every
        one-word redo "the same words".
      - Tests: `node scripts/test-clip-diff.js` (the rules pure — the diff
        re-joins to either prompt byte for byte in both shapes, unrelated
        prompts come out as one line out and one line in, a reworded twin
        line lights only its word, kin skips an unrelated older clip and
        answers `kin:false` with none, a swapped slot is one row, the names,
        a pasted scene past the size cap — then the real page headless: the
        panel opened on the nearest ward TWIN and NOT the unrelated ward clip
        right before it nor the other project's, the added word MEASURED as
        a painted span, the settings row, the cast name on the swapped
        reference, the walk, the server's kin route asked for the clip under
        the page, a no-twin clip saying "a different prompt" with no lit
        span, the pick landing on the tapped card, ✕ and `__navBack` closing
        it).
    - **SHE TRIMS A CLIP AS IT COMES OUT (2026-09-10, Sophie: "how hard
      would it be to make it possible to trim clips right as they come out of
      the footage module?").** A Mini clip is 4-15 seconds and the shot inside
      it is usually shorter — the model holds a beat before the move starts
      and drifts at the tail — and until this the only way to lose either end
      was the Film Editor, a tool away, so a clip she liked went into the
      draft carrying its dead air. Tapping a clip opens the lightbox it always
      did, now with two marks under the picture: **Start here** / **End here**
      land at the playhead, `‹ ›` walk the playhead a tenth of a second so a
      mark can be placed exactly, the strip shows what is kept against the
      whole clip, and **Trim** bakes it. `POST /api/footage/jobs/:id/trim
      { start, end }`; `{ clear: true }` undoes it.
      **IT COSTS NOTHING** — ffmpeg on our own box, no model call, no door;
      what she paid for is the clip, and trimming and undoing are both free.
      The rules, none of them optional:
      - **HER CLIP IS NEVER TOUCHED.** A part is a NEW object under
        `footage/trims/` and `video` on the log doc — the clip the door drew —
        is never written. `trims` is a list beside it, so the poll, the
        exact-prompt log and the 1080p-redo reading list all go on seeing the
        original, and taking a part off is one entry off that list rather than
        a restore.
      - **ONE CLIP HOLDS SEVERAL PARTS (2026-09-10, Sophie: "Can you also make
        it possible to re-cut the same whole clip after I've cut it to also get
        a second part").** `trims` is the shape, and the singular `trim` this
        shipped with is READ as a list of one (`trimsOf`), so nothing already
        on file needed migrating and `cardOf` still answers `trim` as the first
        part for a page cached from before. `POST /jobs/:id/trim` is the one
        door: `{start,end}` ADDS a part, `{start,end,replace:<key>}` swaps one
        span for another IN ITS OWN PLACE in the order, `{remove:<key>}` takes
        one off, `{clear:true}` takes them all off; re-adding a span already
        cut is a no-op. Four things not to undo:
        - **A TRIMMED CLIP OPENS ON ITS PART AND PLAYS JUST THAT (2026-09-25,
          Sophie: "change default to play just trimmed part").** The marks
          open on the first part she cut and loop it; "Whole clip" is right
          there for the rest, and a clip with nothing cut still opens on the
          whole; the button says Add part — the next tap
          is a second bit. (From 09-10 to 09-25 the marks opened on the WHOLE
          clip every time, which made every trimmed clip play its off-cuts
          first.) What she has cut is the dim bands on the strip and a row
          each under it. **A row's span PLAYS that part** — its marks come
          back and it loops — and its ✕ is the undo, the only one that can
          mean the right part once there are several, which is why the single
          "Undo the trim" button is history. **THERE IS NO RE-CUT OF A PART
          (2026-09-26, Sophie: "i would never probly trim within an existing
          trim")** — tapping a row used to arm a Replace (the row red, the
          button re-cutting that part in its place); that mode is off the
          page, a part she wants different is ✕ then cut again, and the
          server's `{replace:<key>}` door stays, unused by the page.
        - **THE PLAYER STAYS OPEN ON A CUT.** She is taking a second part out
          of the same clip; closing every time would mean finding the clip on
          the wall and re-opening it between every one.
        - **`video` — what Save and a note key off — is the FIRST baked part**,
          and `source` is always the original the marks are measured in.
        - **THE BAKE GUARD PATCHES ITS OWN ENTRY** rather than writing back the
          list it planned, or a part she cut while another was encoding is
          dropped when the slower bake lands.
      - **AND SHE CAN PLAY THE WHOLE CLIP TO CHECK THE CUT (2026-09-10, her
        first ask that morning: "can you make it possible to play the whole
        clip to make sure I cut the right part?").** *Whole clip* takes the
        marks off and plays the clip straight through from the start; a
        part's row puts her back on that part. It is drawn only while the
        span is narrower than the clip — with the marks at the two ends, play
        already plays it all. **It was TWO buttons until 2026-09-26** —
        *Whole clip* (marks off) beside *Play it all* (one pass past the out
        mark with the marks kept, a mode ended by the clip's end or any mark
        she moved) — and she called it: "doesn't that seem redundant?" Once a
        trimmed clip opens on its part and a part is never re-cut, whether
        the marks stay is a difference nothing needs, so *Play it all* is
        gone and its `TR.all` plumbing with it.
      - **A TRIMMED CLIP SAYS SO ON THE WALL TOO (2026-09-10, Sophie: "can
        you put a little icon on clips that have been trimmed even in the tile
        view?").** A small scissors chip in the tile's TOP-LEFT corner — the
        heart and the ✕ own the bottom corners — carrying the NUMBER only when
        the clip holds more than one part, the way the card's rows number
        themselves. Three things not to undo: it counts only a part that
        really BAKED (one still baking has cut nothing yet, and "trimming…" is
        said on the card's own row, where there is room for it); it rides as a
        CLASS toggled in `applyFilt`, OUT of the wall's signature exactly like
        the ✕, so a trim landing can never rebuild the wall and re-decode
        every poster; and its **15px at top:2 is MEASURED** — at four across a
        16:9 tile is 49px high and the heart's 26px box starts 19px down, so
        the first cut sat on it (measured at three AND four across, both ways
        round: the mark drawn, the mark off the heart, and every control still
        taking its own tap).
      - **THE SPAN IS ALWAYS IN THE ORIGINAL'S OWN SECONDS,** so the player
        opens the SOURCE even on a clip that is already trimmed: a trim can be
        widened back out, re-cut or undone. Trimming a trim would make the
        marks mean something different every round and lose a generation of
        quality per pass.
      - **IT IS BAKED ONCE** — content-addressed by the source url and the
        span, so re-cutting a span she has already cut is one HEAD and no
        encode, and an undo followed by the same trim is free.
      - **ONE DECODE AT A TIME** (`gateTrim`). A video decode is the one thing
        that has actually killed this 512MB box (the panels-cut ledger in
        CLAUDE.md), and a trim is never urgent.
      - **THE ROOM GUARD ASKS FOR THIS CLIP'S OWN ROOM, AND A REFUSED PART
        CAN BE TRIED AGAIN (2026-09-26, Sophie: "i'm worried not all my trims
        have been going through in footage").** Measured on the live log that
        morning: 43 trims ever, 33 baked — and of the 7 she cut on 09-25, **6
        were refused** by the 09-15 room guard with "the server is too full to
        trim right now (86 to 130MB free, a trim needs 150)", the box idling at
        427MB with nothing running (fresh boot ~200). Three things were wrong
        and all three moved:
        - **The 150 was a 720p clip's peak and every clip she trims is 480p.**
          Measured here on her own refused clip (496x864): 81MB with the old
          cap, **51MB with lookahead and B-frames off** (`rc-lookahead=0:ref=1:
          bframes=0:sync-lookahead=0`, `TRIM_CAP`); 720p 129 → 79. Same crf,
          the same frames out, the file ~40% bigger — a draft's clip. So the
          need is `trimNeedMB(width, height)` off the PROBE (35MB + 60 per
          million pixels: 61 for 480p, 91 for 720p, 100 for a clip the probe
          cannot size), and the room is asked for after the probe, not before
          the fetch. `ultrafast` would be 42MB and throws subpixel search and
          adaptive quantisation away — not taken.
        - **The guard read RSS, and ~60MB of RSS is code pages the kernel
          reclaims** (fresh boot measured: RssAnon 142MB, RssFile 59MB of
          201). `memwatch.anonBytes` (RssAnon + RssShmem off /proc, the RSS
          where /proc is not readable) is what the guard reads now, and
          `GET /api/promptlab/inflight` answers `memory.anon` beside `rss` so
          the live split can be measured rather than assumed.
        - **A failed part could never be retried.** Its span is its key, so
          re-tapping the same span found the part and started nothing — the
          message said "try again in a minute" and trying again did nothing.
          `bakeAgain` (stale OR failed) re-bakes on both no-op roads, after
          `rearmPart` puts the part back to `baking` dated now (so the card
          says "trimming…" and the stale clock restarts); and the card's
          failure line carries its own **Try again** (`.tagain`), for a
          failed part and for one that never finished. Storage is checked
          first, so a re-bake of a span that DID land costs no encode.
        Test: `node scripts/test-footage-trim.js` (the need per clip size, the
        anon reader, the order probe → room → cut pinned in source, the
        re-arm on both roads, the card's word). Not touched: the Film
        Editor's own `RENDER_CAP` keeps its lookahead — its renders are
        deliveries, not drafts.
      - **A LATE BAKE NEVER SPEAKS FOR A TRIM SHE HAS MOVED ON FROM** — the
        doc's own `trim.key` is the authority. Trims queue, so a second tap
        lands while the first is still encoding; the write that matters is the
        UNDO, since without this a bake finishing after `clear` puts the trim
        back on the doc by itself.
      - **THE CUT IS `clips.js`'s OWN** — `chunkGraph`, the recipe the Chunking
        library already shares with Cut Marks: trim + setpts with 12ms audio
        fades at each edge so an exact cut never clicks. A second copy of that
        would be a second set of edges to debug. **The FILE is the truth about
        its own length**, not the seconds she asked the door for (a clip is
        24·s + 1 frames), so the out-mark is CLAMPED to what ffprobe reads
        rather than refused against the ask.
      - **EVERYTHING IS A TAP** — Cut Marks' rule. Nothing drags: the marks
        land at the playhead, **tapping the strip puts the playhead where she
        tapped** (2026-09-10, Sophie: "can you make it so I can tap where the
        play head goes"), and the steppers walk it a tenth of a second at a
        time. The strip shipped as a READ-OUT — "the video's own scrubber
        already seeks" — and she overruled it the same morning, so that is
        HISTORY, not a rule. The BAND is the target and the BAR is the
        picture: 34px tall with the 10px mark drawn inside it, the fraction
        measured off the BAR's own rect so the band can grow without moving
        where a tap lands, and it pauses like the steppers. Playing plays the SPAN and loops it — that is how a trim is judged
        before it is committed — but **scrubbing is never yanked**, or finding
        the out-mark would be a fight with the loop. The button's meaning
        follows the marks: **Trim** with nothing cut yet, **Add part** once
        something is, **Replace** while a part's row is picked, and where it
        would do nothing it is not drawn at all. **AND THE KEEP BAR IS NOT
        DRAWN AT ALL WHEN THE MARKS SPAN THE WHOLE CLIP** (PHOTOgraphed): a
        bright band over the whole strip covers the dim bands of the parts she
        has already cut, and the whole clip is exactly the state the trimmer
        opens on now.
      - **/filmnote.js IS HOSTED ON THE STAGE, NOT THE WHOLE PLAYER.** It
        anchors everything it draws to its wrap's BOTTOM edge, so with
        `#player` as the wrap its Note button landed ON the trim controls
        (PHOTOgraphed, over the `›` stepper). `.pstage` carries
        `position:relative` for it and the note UI sits over the picture,
        where a note about the film belongs — pinned by a measurement both
        ways round.
      **AND THE LAST FRAME IS IN PLAY SINCE 2026-09-10 (Sophie: "on").**
      Every Atlas job asks for `return_last_frame`, so a finished clip carries
      the frame it really ends on — the door's own render rather than a decode
      of the mp4, and free. A TRIM MOVES THAT END: the baked frame belongs to
      the SOURCE clip, so the card answers it whatever the trims say (it is a
      fact about the source).
      **AND IT IS ON THE CARD SINCE 2026-09-11, WHICH IS THE ONLY DOOR IT HAS
      (Sophie: "how do i get these last frames").** The RECENT drawer was the
      only place it had ever shown and she took the outputs out of that drawer
      the same day it shipped ("recents is recent UPLOADED"), so for a day
      every Atlas clip carried a picture with nothing on the page drawing it —
      and the "?" card still said it was in the drawer, which is how it stayed
      invisible. It is a tile in the card's own picture row now, BESIDE the
      references (one grid: it takes the next free column, so the card is no
      taller — a row of its own read as a second reference stacked under the
      first, PHOTOGRAPHED both ways). Tapping it opens it big in the clip's own
      player — no trim bar, no filmnote, there is nothing to mark and no second
      to note — with a **save** in the way-out row that goes to Photos through
      the same three-path ladder the clip's save uses (`saveMedia`, which
      sniffs a picture off the url for the name and the share-sheet type; the
      native bridge already routes a picture to PhotoSaver and a clip to
      VideoSaver, so nothing on the Swift side moved). A tap ON the picture
      does not close it, the house rule the player already keeps.
      **THE LABEL SAYS `last frame · whole clip` ON A TRIMMED CLIP** — the
      frame is the end of what the DOOR drew, never the end of the part she
      kept, and that is the one thing worth knowing before chaining a shot off
      it. Re-pulling the frame from the trim is the fix if she ever wants both;
      nothing does it yet, and there is no "use this as a reference" button
      either — chaining is still save, then attach.
      **THE WAY OUT IS ITS OWN ROW ABOVE THE PICTURE (2026-09-11, Sophie:
      "all the stuff at the bottom in trim view, esp after a trim is added,
      makes it impossible to close the player").** The ✕ shipped absolute in
      the player's top-left corner — the slack a bottom-aligned stage leaves,
      which a PORTRAIT clip does not leave. Measured at the app's 390x700
      with a 3:4 clip: the stage fills to the top, the video paints over the
      button (later in the DOM, both positioned), `elementFromPoint` at the
      ✕'s centre answers VIDEO, and 0% of the screen is bare backdrop (6.9%
      with parts listed — two thin side strips). So the trim view of every
      ward clip had no way out but the app's chevron, and the main test's
      presence check on `.pclose` passed throughout. `.ptop` is a `flex:none`
      row in the column the stage yields to, so the ✕ is on screen whatever
      the clip's shape (the picture is one row shorter), clear of the video's
      own top-left controls, and the row's dead space closes like the stage.
      Pinned by the portrait block of the test (verified failing 5 pre-fix):
      the ✕ asked with `elementFromPoint`, the video's rect proved to start
      under it, and the tap a positional `mouse.click` — playwright's element
      click refuses a covered target with a timeout, a crash rather than a
      finding.
      Test: `node scripts/test-footage-trim.js` (the rules pure, then a REAL
      encode measured with ffprobe — a recipe that reads perfectly and a file
      that is the wrong length look identical to any source assertion — then
      the real page headless with a seekable VP8 fixture, every assertion a
      measurement of the rendered strip, the loop's own `currentTime`, or what
      the server really received).
    - **GRAB FRAME — THE FRAME UNDER THE PLAYHEAD, PULLED OUT ON THE SPOT
      (2026-09-12, Sophie: "I need to cut one out. I said the last frame
      doesn't have the curtains" · "it shouldn't file to the dump. It should
      give me a way to use it immediately as a reference for my next film").**
      The last frame Atlas hands back is the END of what the door drew, and
      the frame that carries continuity is often somewhere in the middle. A
      third word on the trimmer's row, beside Start here / End here: tap the
      strip to put the playhead on the frame, tap **Grab frame**.
      `POST /api/footage/jobs/:id/frame { at }` answers `{ url, at }`
      synchronously — a download plus one decoded frame is a few seconds and
      the url is what she is waiting for. **The player stays open and her in
      and out marks stay with it** (2026-09-13): it used to close, scroll to
      the top and drop `TR`, so grabbing a frame mid-cut threw the marks away.
      - **AND IT OFFERS, IT NO LONGER DECIDES (2026-09-14, Sophie: "grab frame
        shud offer to save or add as reference").** It used to land the frame
        in the strip by itself, so SAVING one meant taking on a reference she
        may not have wanted and then hunting it down in the strip to open it
        big — and she never saw the frame before it committed, on the one
        button whose whole reason for existing is that the baked last frame has
        the wrong thing in it. The pull now draws a row under the trimmer's
        buttons: **the frame itself**, the second it came from, and her two
        underlined words — `save` (the three-path ladder: the app's bridge, the
        share sheet, a download) and `reference` (`useShot`, the last-frame
        tile's own landing — one entry, no upload, no download, the draft
        carrying it). Neither fires on its own, so the reference path costs one
        more tap and buys the look at what she grabbed. Five things not to
        undo: the two are **NOT exclusive** — a frame worth keeping is often
        both — so the row stays until she grabs another, taps its ✕, or closes
        the player; `reference` **lights once the frame really is in the
        strip**, read off `refs` in `paintRefs` (the one place the strip
        changes), so a ✕ on that reference puts the word out by itself and a
        second grab of the same second opens the offer already lit; the thumb
        is **`contain`, never `cover`** (a cover crop takes a third off a 16:9
        frame's sides, which is the half of the picture the question is usually
        about); there is **no "open it bigger"** and none is needed, since the
        player directly above is paused on that very frame at full size; and
        the row sits **above the parts list**, which is the thing that scrolls,
        so the offer is on screen whatever the clip's shape.
      Four things not to undo about the pull itself:
      - **HER CLIP IS NEVER TOUCHED and NOTHING GOES TO THE DUMP** (her
        word). The frame is a new PNG under `footage/frames/`,
        content-addressed by the source url and the second, so the same
        frame grabbed twice is a HEAD and no decode; the clip's doc is not
        written at all — the frame lives in the strip she dropped it into
        and in her draft.
      - **IT IS READ OUT OF THE SOURCE**, never a trim — the player always
        opens the source, so the second she sees is the second she gets.
        `-ss` before `-i` seeks to the keyframe and decodes forward to the
        exact frame; the test pulls a frame 0.98s past a keyframe out of a
        clip whose colour changes every second and reads the pixels back.
      - **PNG AT THE CLIP'S OWN SIZE, never scaled** — a continuity reference
        is judged by the model at whatever it is, and a jpeg's ringing on a
        hairline is what such a frame must not carry.
      - **ONE DECODE AT A TIME** — it stands in `gateTrim`, the trims' own
        queue. A playhead parked on the clip's end is clamped to the last
        frame rather than refused.
      Nothing is sent: the star is still her tap. Test:
      `node scripts/test-footage-grab-frame.js` (the rules pure, a REAL pull
      measured with ffprobe and its pixels, and the real page headless — the
      row measured as one line at 390pt with every word taking its own tap,
      the second the stub really received against the playhead, the offer row
      MEASURED with its picture really decoded and its words really tappable,
      **nothing in the strip or the draft until she taps**, the strip and the
      draft after she does, the light going out with a ✕ on that reference,
      and zero Dump posts throughout).
    - **THE PRICE IS EXACT (2026-09-09, measured off 113 OpenRouter jobs, 44
      APIFRAME jobs and ffprobe on the clips).** `tokens = w × h × (24·s + 1)
      / 1024`, × the SKU, × `(1 − the live discount)` — Mini renders on the
      **2.5 canvases**, a clip is **24·s + 1 frames**, and the 5% top-up fee
      is NOT in the shown price. The sale is READ from OpenRouter's
      `pricing.discount` (cached ten minutes; a failed read is 0, full list,
      never a stale sale) rather than written down: ByteDance's 60%-off
      campaign on mini runs to 2026-10-07 but OpenRouter stopped passing it on
      this morning, so a 4s 3:4 480p Mini went 5.58¢ → **13.96¢**. A reference
      video is the one shape still unpinned and answers "about"; everything
      else answers exact. APIFRAME is per second with its own rate when a
      video rides (2.5 at 480p: 15¢/s with, 13 without). Full numbers and
      dates: *THE PRICE IS EXACT* in CLAUDE.md's Footage bullet.
    - **NOTES ON A CLIP — THE HOUSE THREAD, TWO DOORS (2026-09-10, Sophie:
      "can you make it possible to add notes on clips that come out of the
      footage module?").** A speech mark on every finished clip's card opens
      an empty box; playing a clip gives her `/filmnote.js` — tap to pause,
      note the second she stopped on — the ONE implementation, the same one
      the Chats app's pinned film and compare.js's video lightbox use.
      **No new route and nothing new stored:** both doors POST
      `/api/gallery/assets/note` (`chat` = whatever `/status` serves, i.e.
      `footage`) and the card reads `GET /api/gallery/assets/notes?chat=`,
      so a note rings the wake doorbell, lands in the one inbox every chat
      sweeps, and is answered ON the note (`from:'chat'`) — which reads back
      under hers on the card. The thread is painted OUTSIDE the card's
      signature (a note landing must not rebuild the card and re-decode its
      poster), the notes are read on load / on `visibilitychange`→visible /
      when the player closes and never on the drawing poll, an over-length
      note is refused with her words still in the box, and a clip with no url
      yet carries no mark. **The player's tap-out is the backdrop only** now
      (chats.html's rule) — the old "anything that is not a VIDEO" would have
      closed the player on filmnote's own button and sheet. Full rules and
      the six things not to undo: the Footage bullet in CLAUDE.md.
  **THE COLLECTION PAGE UNDER-LISTS — PROBE THE MODEL NAMES (same day,
  Sophie: "why did u skip 2.5 etc").** Replicate's image-to-video collection
  page showed six Seedance models; `GET /v1/models/bytedance/<name>`
  answered 200 for three more it never listed. Per second, image in:
  `seedance-2.5` 10.3¢ / 23.1¢ (480p / 720p; up to 30s, audio on by
  default), `seedance-2.0-mini` 4¢ / 9¢ (the cheapest 2.x; up to 15s), and
  `alibaba/wan-3` 2.5¢ / 5¢ / 10¢ (480p / 720p / 1080p, 2-30s) — **BUT ITS
  REPLICATE WRAPPER IGNORES THE IMAGE (measured 2026-09-04)**: a public
  png url in `image` was recorded on the prediction's input and the log
  still read "Creating Wan 3.0 T2V task"; it drew a different man in a
  different room, 16:9 from a portrait still, and billed 15¢. Text-to-video
  only until that changes; `wan-2.7-i2v` is the proven 3s image route. Probed and
  absent: 2.5-fast, 2.5-lite, 2.5-pro, 2.0-lite, 2.0-pro, 1.5-lite. A
  catalogue page is a hint; the model endpoint is the measurement.
- **THE CHARACTER LIBRARY — `cast.js`, `/api/cast`, the people icon on the
  footage controls row (2026-09-11, Sophie: "we need a version of 'characters'
  for footage so i can click a button and it auto adds the line at the top,
  adding and referencing videos and stills · characters w multiple outfits will
  have ex, sophie w pajamas vs sophie street clothes · add character icon to
  footage and have it per film - diff folders · some characters are just stills
  for now").** One shelf per FILM. A tap on a character — or on one of their
  outfits — puts that look's references into the strip and the line that names
  them BY SLOT at the top of the prompt.

  **WHY IT EXISTS.** Every ward clip's references were hunted by hand: the jazz
  clip's url, three pajama stills, the doctor's 4-second take, and the exact
  line naming each of them by slot, retyped per shot, per chat, per belt page.
  That is where the wrong-slot and wrong-outfit bugs came from, and neither
  shows as an error — the clip draws, of the wrong person, in the wrong
  clothes. **It spends nothing:** no model call anywhere, and the urls already
  exist in the Dump and the clip log.

  - **A DOC IS AN ENTRY**, keyed `<film>__<slug>` so two films may both have a
    `sophie` and neither can reach the other's:
    `{ film, slug, name, kind: 'person'|'wardrobe'|'setting', note, order,
    hidden, looks: [ { key, name, line, refs, wear, note } ] }`.
  - **A LOOK IS A CHARACTER IN ONE OUTFIT** — the references that carry it and
    the ONE LINE the prompt opens with. `sophie · the blue pajamas` and
    `sophie · street clothes` are two looks on one character; that is her own
    example, and it is why a look rather than a character is what a tap lands
    on.
  - **THE LINE IS A TEMPLATE OVER THE LOOK'S OWN REFERENCES — `{1}`, `{2}` …
    — NEVER a literal `[Video1]`, and that is the load-bearing rule.** A slot
    is decided by what else is already attached, so her ward line
    `sophie is the woman in [Video1].  she wears the blue hospital pajamas in
    [Image1], [Image2] and [Image3], NOT the dress in [Video1]` is stored with
    `{1}` for the clip and `{2} {3} {4}` for the pajamas, and resolves to
    `[Image2] [Image3] [Image4]` the moment it is attached beside a still she
    already had. Stored literally it would point at somebody else's stills as
    soon as a second character rode along.
  - **`cast-line.js` IS THE ONE RULE** — pure, loaded by `cast.js` on the
    server and served to the page at `/cast-line.js` (the `pause-plan.js`
    pattern). So **the sheet shows the exact line the tap will insert**,
    resolved against the strip as it stands, and the page and the `/plan`
    route cannot disagree about a slot. It computes the WHOLE strip after the
    attach — deduped, then ordered images → videos → audio, which is what
    `footage.slotsOf` numbers and what `orderedRefs` paints — and reads each
    slot off that. **A test pins it against `footage.slotsOf` directly.**
  - **EVERY OTHER LOOK ON SCREEN IS RE-RESOLVED AFTER AN ATTACH.** The
    previews are computed against the strip, so the slot a look would take
    moved the instant another one landed; a sheet quoting the old ones is the
    one thing this disclosure must never do. (Verified failing without the
    repaint.)
  - **AND TAKING A REFERENCE OFF TAKES ITS NAME OUT OF THE PROMPT AND
    RENUMBERS THE REST — `dropPlan`, the same file (2026-09-11, Sophie: "if i
    delete an image, it shud remove the tags associated w that image").** The
    ✕ on the strip used to remove the reference and leave her words alone,
    which is the template rule's own bug arriving from the other end: a slot
    is a POSITION, so taking the second of three images off left `[Image2]`
    naming nothing AND `[Image3]` naming a picture that is now `[Image2]` —
    and the clip still draws, of the wrong reference. Four things not to undo:
    - **ONE PASS over the prompt**, so a rename can never land on a token
      another rename is about to read — `[Image3]` → `[Image2]` beside
      `[Image2]` → gone is the ordinary case, and two sequential passes eat
      it, leaving her prompt naming one picture in two places.
    - **HER WORDS ARE NOT REWRITTEN, only the names.** The slot names are the
      page's own vocabulary (she taps them in; she never types them) and the
      whitespace a name stood in belongs to the name — so a removal leaves no
      double space and no space in front of punctuation, and leaves the
      dangling comma in `[Image1], and [Image2]` exactly where it is. A prompt
      that reads a little wrong is hers to fix; one that reads fine and names
      the wrong picture is not.
    - **THE TOAST SAYS WHAT MOVED** (`[Image2] came out of the box · 1 name
      renumbered`) — a change to her prompt she cannot see is the
      hidden-ingredient failure the price line exists to prevent. A prompt
      that never named the reference is left byte-for-byte as she typed it and
      says nothing.
    - **BY POSITION when an index is given**, because that is the row the
      strip drew: a copy-back makes NEW objects at the same urls, so an
      identity filter removes nothing (`footage.html`'s own finding). A token
      nothing maps — a name she typed pointing past the end — is left VERBATIM
      rather than quietly changed.
    Matching is tolerant of her typing (`[image 1]`, `[IMAGE2]`) and the
    replacement is canonical. `slotMap` is the ONE numbering rule now, shared
    by `stripAfter` (the attach) and `dropPlan` (the ✕), so the two halves can
    never disagree about a slot. MEASURED on the real page in
    `node scripts/test-cast.js` (verified failing 5 pre-fix) — a ✕ that
    removes the row and leaves her words alone, one that removes the wrong
    row, and one that renumbers nothing all look identical in the source.
  - **THE PAJAMAS FLOAT AND LIVE IN ONE PLACE** (her rule the same message:
    "these pajamas float w any patient so keep head off · ex
    francesca/anastasia gets pjs plus dance photo · same for mayra"). A
    wardrobe entry is its own row, and a look WEARS it by slug: bare
    `blue-pajamas` takes the outfit's FIRST look, which is the HEAD-OFF pair,
    and `blue-pajamas:sophie` names her own set. Swapping the pajama
    reference swaps it for every patient at once, and a still in two outfits
    rides ONCE and keeps one slot. **SOPHIE'S SET IS ONE FULL-BODY STILL
    SINCE 2026-09-11 (her call on the first Wan job: "just the full body
    pajama, no tape pocket or second, and note that everywhere")** — "A —
    Sophie alone" (`52a036…`, head to shin, eyes blurred) rides alone, and
    her line reads `she wears the blue hospital pajamas in {2}` where it
    counted `{2}, {3} and {4}` (A, "C — teacher cropped out" and the tape
    pocket) on every ward clip before. The head-off pair for the OTHER
    patients still carries the tape pocket; taking it off there is hers to
    say. Changed on the live shelf, in `scripts/seed-cast-ward.js`, and in
    the wan-test job.
  - **THE LINE GOES TO THE TOP, AND NEVER TWICE** — her word ("auto adds the
    line at the top"), never at the caret; a second tap on the same look adds
    nothing, because she taps a character, types, and taps it again to check.
  - **SOME CHARACTERS ARE JUST STILLS** (her words) and that is a normal entry
    — a look whose references are all images works exactly as one carrying a
    clip. A character with NOTHING on file is still listed, saying so, because
    that is how she sees who is waiting for a reference.
  - **ONE LOOK IS ONE TAP.** Opening a row to reveal a single chip decides
    nothing — Nurse Edna has one clip and one line, so the row IS the button.
    Several looks open.
  - **NO LINE, NO INVENTED WORDING.** A look she has not written a line for
    gets the barest true sentence there is — the name, then the slots
    (`Nurse Edna: [Video1].`) — because anything fuller would be a
    DESCRIPTION of a reference, which is the one thing a prompt here must
    never carry.
  - **NOTHING IS DELETED** — `hidden` is the verb for an entry. A LOOK can be
    removed, because a look is one entry in a list and its references are
    still in the Dump.
  - **A READ WITH NO FILM ANSWERS THE FIRST FOLDER**, never every film at once
    — a shelf is one film, two Sophies on it is a bug, and it saves the page a
    round trip to find out which one it is looking at. The folder she picked
    is remembered per phone; one that has gone falls back to the first, which
    is the only case that re-reads.
  - **SEEDING: `node scripts/seed-cast-ward.js`** — dry by default, `--go`
    writes, `--only <slug>` repairs one, `--direct` writes through the Admin
    SDK (which is what fills a shelf BEFORE the route it feeds is deployed,
    and is immune to a deploy restart). Every url is out of
    `docs/mental-hospital/refs/cast.json` or `belt/refs.json`, every clip
    carries the LABEL the belt pages give it, and the lines are hers VERBATIM
    wherever a card had one — the script prints how many are mine. Re-running
    repairs rather than duplicates, but it OVERWRITES a look she has since
    edited, which is what `--only` is for.
  - **A 4s TAKE PER CHARACTER WAS ALREADY DONE — MEASURED, not assumed** (her
    "maybe done already"): ffprobe on every person clip the belt pages name —
    Nurse Edna 4.00s, Ms. O'Hara 4.04, the doctor + assistant (office and
    hall) 4.04, the parents 4.04, Michael 4s, all 560x752.
  - **AND SO WAS THE 4s JAZZ CLIP — IT WAS ALREADY RIDING EVERY SOPHIE JOB
    (2026-09-11, Sophie: "it's on every sophie video in footage · is quality
    lost? a chat gave it to me first. / if lost quality, find og chat").** The
    first pass looked for it in the video LOG and the Dump by name and
    reported it missing; it is on **24 of the 83 footage jobs**, as a
    REFERENCE VIDEO called `jazz-best4s.mp4` — which is a different question
    from the one that was asked, and the reason the answer came back wrong.
    **Quality is NOT lost, measured rather than eyeballed:** it is the last
    4.06s of the 15.1s original (aligned at 11.04s by a frame-by-frame
    search), same 560x752 canvas, same 24fps, same H.264 High / level 3.1,
    2.15 Mb/s against 2.22 — and **PSNR 46-48 dB against the original span**,
    which is visually lossless (anything over ~45 dB is imperceptible). The
    decoded frames are not byte-identical, so it IS a re-encode and not a
    stream copy; at 48 dB that costs nothing worth going back to the original
    chat for. **And the two copies on file are BYTE-IDENTICAL** (md5
    `042e7aaa…`): `ward-refs/jazz-best4s-1789011108116.mp4` off the ward
    references page and `drops/_/042e7aaa….mp4` in the Dump are one clip.
    Sophie's four clip looks carry it now; the 15.1s original stays as its own
    `jazz-long` look, since 15.2s is the whole reference-video budget and it
    leaves room for nothing else.
  - **AND THE SHELF WAS FILLED FROM HER OWN FILES ALONE — THE OTHER CHAT'S
    CHARACTER PAGE HAD MORE (2026-09-11, Sophie: "did u even look on the
    character page another chat created").** It is **"The ward film — every
    reference (v7)"**, a grid page in the `pajama-assets` chat — 47 items in
    seven groups, and the first seed (built from
    `docs/mental-hospital/refs/cast.json` + `belt/refs.json`) missed a
    person and eleven references. Folded in: **Juanita**, who was not in the
    library at all (her still, her scenes-only cut, her five pulled frames);
    Mrs. Norbert's own two clips beside her 25s origin take; Sophie's other
    three faces and her three jazz stills (a door that refuses a person VIDEO
    still takes a frame of one); the doctor's second still, the assistant's
    intake still, and the socks on her feet. **A chat's own reference page is
    a source, not a duplicate — read it before seeding a library from the
    repo.** Live: **20 entries, 66 references.**
    - **HER PAJAMA STILLS ARE THE REPO'S COPIES, ON PURPOSE.** The page
      carries its own optA/optC at the identical 392x932 and 319x752 but
      smaller on disk (467KB vs 734KB, 305KB vs 326KB) — re-encodes of the
      same crop — so the seed keeps `cast.json`'s originals, the house
      *nothing stands between the source and the output* rule. The headless
      still and the tape pocket are the same file on both.
    - **The page's first group — "People — photographs" — has four
      photographs attached to nobody** (Grey sweater, Blonde studio, Blazer
      portrait, Blazer full length). They are not in the library because
      there is no character to attach them to; naming one is hers.
  - Tests: `node scripts/test-cast.js` — the slot arithmetic pure, every plan
    driven against a strip that ALREADY holds something (a line that resolves
    right on an empty box is exactly the case that can never catch this), then
    the real `public/footage.html` headless, MEASURING what is in the prompt
    box and what the strip really holds after a tap. An attach that computes
    the right line and never reaches the box, one that reaches it with the
    library's own stale slots, and one that writes the same sentence twice all
    look identical in the source.

- **EVERY REFUSAL A DOOR HAS SENT, IN ONE TABLE, CALLED OUT ON THE CARD
  (`video-refusals.js`, 2026-09-10, Sophie: "check for other refusal
  reasons, make sure they're documented and called out").** Measured that
  day over all 238 jobs on the log (48 Atlas · 45 APIFRAME · 145 OpenRouter)
  plus a read of every Atlas prediction record. The three doors forward to
  the same ByteDance model service, so the SAME refusals arrive through each,
  worded a little differently; the table matches the text (and Atlas's
  `error_code`) and answers a KIND and a LINE in her words. The footage card
  paints the line in red with the door's own text under it (`why` on the
  card, derived on every read, never stored), a refused tap answers `why` on
  the POST, and `atlascloud.js`'s `refusalKind` reads the table first. A
  reason the table has not met paints the raw text alone — add a row.
  - **`shape` — the request. Free, at validation; another door changes
    nothing.**
    - **Reference videos over 15.2s together** (Atlas 1013030, ×4 on
      2026-09-10 — two 12-15s clips on one job). **Checked BEFORE the tap
      leaves now**: the floor probe's sidecar banks each reference's length
      (`seconds`), `refVideoTotalRefusal` sums them and refuses on Atlas with
      the total, only when every length is known (a sidecar banked before
      this carries none — the next new reference does). Unmeasured on the
      other doors, so they are not checked.
    - **A reference video under ByteDance's pixel floor** (`PixelCountTooSmall`
      — upscaled by itself now, *A REFERENCE UNDER BYTEDANCE'S PIXEL FLOOR*
      above).
    - **Seconds outside 4-15** (`Duration must be between`).
    - **One reference video and no picture reads as a VIDEO EXTENSION** and
      `ratio` is refused (APIFRAME ×2).
    - **A reference picture outside 2:5-5:2** (`expected the aspect ratio to
      be between 0.40 and 2.50`, APIFRAME ×1).
  - **`content` — an INPUT gate, before anything draws. Free. The one kind a
    door falls back on** (Atlas → APIFRAME for a famous face; OpenRouter →
    APIFRAME for a person): `InputVideoSensitiveContentDetected` /
    `InputImageSensitiveContentDetected.PrivacyInformation` / "may contain
    real person" (OpenRouter and APIFRAME, on a video and on a picture), and
    Atlas's famous-face refusal on the POST (Radcliffe, 2026-09-09).
  - **`output` — DRAWN, THEN BLOCKED. Unbilled everywhere measured
    (`price:"0"`, no `generation_id`) but it cost the wait, and it is
    PROBABILISTIC — the same words drew on the next try more than once.**
    - **1012004 output video copyright** — Atlas ×2 (both on 2.0 Fast, a
      plain reference-free dialogue prompt; Mini drew the same words),
      APIFRAME ×2, OpenRouter ×1 (the Radcliffe bar).
    - **1012006 output video sensitive content** — Atlas ×1 (2026-09-10,
      a 15s Mini with no reference). NEW that day; nothing here had seen it.
    - **1012009 output AUDIO copyright** — the clip drew but its sound was
      blocked (a song, a known voice): Atlas ×1, APIFRAME ×2 ("output audio
      may be related to copyright"). NEW on Atlas that day. Say in the prompt
      what the sound should be, or send again.
  - **`down` — the door did not answer** (APIFRAME "Polling timed out after
    1200s" ×1; Atlas's gateway 2026-09-10). Nothing sent or charged.
  - **AND A REFUSED ATLAS PREDICTION COMES BACK UNDER HTTP 400** — the same
    record a running one comes back under 200 with, `data.status:'failed'`
    and the text. `pollVideo` reads it out of the error body (`failedRecord`);
    before #2283 it threw, `pollOne` swallowed it, and a refused clip said
    "drawing" on her page forever (the four 15.2s refusals sat 20 minutes).
    Test: `node scripts/test-atlascloud-failed-poll.js`.
  Tests: `node scripts/test-video-refusals.js` (every text on the log, the
  kinds, the card's `why`, the pre-send total).
- **A model's INPUT KEYS ride its `shape`, never its tier name** — `wan22`
  (`image`/`last_image`, counts frames), `wan27` (`first_frame`/`last_frame`,
  counts seconds), `kling` (`start_image`/`end_image`, fixed 5s). One builder,
  `videoInput`, is the only place that knows them, because a wrong key does
  not fail loudly: the model ignores it, draws something unconditioned, and
  the bill arrives anyway. Adding a model is a row in `VIDEO_MODELS` plus an
  arm in `videoInput` only if it is a new family. Test:
  `node scripts/test-video-models.js` (pure, no spend).
- **Dream mode:** bridge clips over every hard cut — start = previous clip's
  last frame (ffmpeg `-sseof` extract), end = next panel, num_frames 121 and an
  AI-written prompt describing one continuous PHYSICAL action (short morphs
  between different compositions read as a jarring leap).
- **Editing is first-class and free:** per-scene trim / speed / freeze / fade /
  drop / reorder, all server-side ffmpeg at stitch time, re-stitch in seconds.
  ffmpeg comes from `ffmpeg-static`/`ffprobe-static` npm packages (or
  `FFMPEG_PATH`/`FFPROBE_PATH`/PATH).
- **State:** one Firestore doc per movie (`forge-movies` collection) — story,
  scenes, prompts, panel/clip URLs, edit list, running job — so movies reopen
  and re-edit later. Long steps run as background jobs recorded in the doc;
  clients poll `GET /api/movies/:id`. Same `STUDIO_TOKEN` gate as the pipeline
  (only `GET /status` open). Scene panels/clips/films are saved to Firebase Storage
  (Replicate URLs expire ~1hr).
- **EVERYTHING MOVIES MAKES GETS OUT OF THE MOVIES TAB (Aug 2026, Sophie:
  "there shud be a way to download individual clips … right now i can make them
  but they just stay there. theres no download button and they dont appear in my
  creations").** Two halves, and both were needed — a clip she paid for was
  reachable only from inside the movie that made it.
  - **It files into "My Creations."** Every finished video — a scene clip, a
    dream bridge, a quick animation, a stitched cut — is handed to the same
    `users/{uid}/creations` collection in membry that the gallery reads, as
    `type:'clip'` (a stitch is `type:'film'`, so the grid's filter row separates
    the films from the clips they are made of) with `source:'movies'`.
    **The gallery lives in the OTHER Firebase project and movies.js does not
    hold that credential**, so server.js hands the writer down at mount time —
    `movies.init({ fileCreation })` — the same shape as `stories.init`.
  - **Every filing carries a POSTER** (the panel the clip was animated from, or
    the still a quick animate started as). A video creation has no frame the
    grid can decode out of an mp4, so without one it tiles as a blank white
    square. `Creation.thumbURL` is what the tile draws; `Creation.isVideo` reads
    the TYPE but falls back to the url's extension, so a clip filed by anything
    that called it something else still plays instead of tiling as a broken
    picture.
  - **Filing is fire-and-forget and never awaited by the render** (and de-duped
    by url by the writer): a gallery hiccup must never cost a clip that already
    exists and is already on screen. Re-rolls file too — a superseded clip is
    history she may still want, and the house rule is that she decides what is
    too much for her gallery.
  - **The download button lives on `ClipPreviewSheet`**, the one player every
    clip in Movies opens in (a scene's clip, a quick animation, a finished cut),
    so one change put it on all of them: Save to Photos + a share sheet for
    Files/AirDrop. The Gallery's raw-generations detail sheet got the same Save
    beside its existing Share — that screen is where the superseded re-rolls
    live, and they are the ones with nowhere else to go.
  - **`VideoSaver` (CreationsView.swift, beside `PhotoSaver`) is the ONE video
    download path.** Photos will not take a remote URL and will not take decoded
    frames: the clip is downloaded to tmp and handed over as a `.video` resource
    with `shouldMoveFile`, and the download's own temp file has to be MOVED
    before the callback returns or it is deleted underneath you. `denied` raises
    the Settings alert rather than a toast — `requestAuthorization` never
    re-prompts after a "Don't Allow", so a toast there is a dead end.
  - **THE BACKLOG IS A SCRIPT, AND IT WAITS FOR THE APP BUILD.**
    `node scripts/backfill-movie-clips.js` (dry by default, `--write` to file,
    `--undo --write` to remove only what it filed) walks `forge-movies` and
    `forge-quick` and files everything already made — scene clips including
    superseded re-rolls, bridges, cuts, quick animates — each with its poster
    and its REAL make-time (`stitchedAt` / `createdAt`), so a backfill
    interleaves with the rest of the gallery instead of landing in a slab at
    the top. Idempotent: it skips any url already there.
    **Measured 2026-08-22: 166 finished videos, every one of them with a
    poster, none previously in the gallery.** It was run and undone the same
    minute on purpose — **a build without video support draws a creation by
    decoding its `url` as a picture, and there is no picture inside an mp4**,
    so a clip filed before the build tiles as a blank white square. The server
    filing new clips from here on is a trickle that self-corrects the moment
    she updates; 166 at once is not. Run it for real once the build is on her
    phone.
  - Test: `node scripts/test-movies-creations.js` (pure — the wiring, the
    poster, the film/clip split, and that a failing writer never reaches the
    render).
- **Replicate gotchas baked in:** 429 retry with exponential backoff on create,
  download retries + size verification (replicate.delivery truncates under
  parallel load), ~5-parallel prediction pool.
- **Style reference:** `refs/dream-mystery.jpg` (Sophie's hand-drawn diary-comic
  page, never web-served). When present, EVERY panel renders via gpt-image-2's
  **edits** endpoint with it attached as a pure STYLE reference (prefix insists
  style only — never content/subjects/composition). `MOVIE_STYLE_REF=0`
  disables; without the file, panels fall back to the text `imageStyle` lock.
- **Character anchor** (OpenAI cookbook technique — fixes wardrobe drift): the
  breakdown marks ~3 `key` scenes; the app's character-first flow renders just
  those, then `POST /:id/anchor {sceneId}` locks one panel as the character's
  definitive look. Every later render (panels, grids, zine pages) attaches the
  anchor as an extra `image[]` reference with the preserve-list restated
  ("same face, hairstyle, clothing … Do not redesign the character"). The
  breakdown's `characters` tokens must include hair + face + exact outfit.
  `panelQuality` on the movie (set at creation via the app's Storyboard menu)
  is the default for all panel renders. Validated live: checkered flannel held
  across scenes.
- **Gallery:** re-rolls are never lost — superseded generations go to
  `scene.panelHistory`/`clipHistory` (capped 12, each with `promptUsed`); every
  stitch is kept in `movie.cuts[]`, auto-named by diffing edits/sequence vs the
  previous cut ("trimmed sc 3, slowed sc 7"), with an ordered `frames[]`
  snapshot the iOS Gallery renders as a comic-panel contact sheet.
- **Quick animate:** `POST /api/movies/animate` — one image (data URL) → one
  clip, default draft/**720p** (~$0.16); its own polled docs in `forge-quick`
  (`GET /quick`, `GET/DELETE /quick/:id`). Home-screen "Animate one image" in
  the app. `tier` picks the model and the price band (`draft` · `wan27` ·
  `wan27hd` · `standard` · `pro`); `resolution` is read by the draft tier
  ONLY — every other tier carries its size in the tier itself — and `duration`
  (2-15s, default 5) by wan 2.7 only. **The app's quality menu offers the four
  wan rows** (480p 6¢ · 720p 16¢ · 720p 50¢ · 1080p 75¢); kling is still a
  tier on the route and still on the per-scene menus inside a movie.
- **The zine:** `POST /api/movies/:id/zine` — the same scenes as a printed
  medium: a hand-lettered cover + one captioned 2x2 page per four scenes
  (captions = scene titles, rendered in the style reference's own lettering;
  validated live — text spells exactly at medium). ~$0.06/page. Lands in
  `movie.zine` (prior zines in `zineHistory`, capped 3). Lulu print step is
  the planned follow-up (`lulu.js` keys are live; a 32-page standard-color
  uncoated paperback ≈ $3.40/copy, saddle-stitch premium ≈ $4.34-7.11).
- **Dreams (dream → comic), v2 STAGED pipeline (July 2026):** the
  dream-illustration path, rebuilt around user approval BETWEEN cheap stages
  (Sophie approves order + characters before anything paid runs). **Stage 1 —
  `POST /api/movies/dream`** runs `dreamSplit()`: ONLY splits the recording
  into its distinct dreams (boundary cues — "that was that dream", "the next
  dream"), each `{title, text (verbatim slice), driftCues (out-of-order
  phrases, exact substrings to highlight), mentions (people, "me" first)}` —
  NO beats, NO image descriptions. Runs `DREAM_BREAKDOWN_MODEL` (default
  `gpt-5.6-sol`; a `claude-*` id routes via Anthropic, NO silent fallback) at
  `DREAM_SPLIT_EFFORT` (default `none` — validated: still splits/orders
  right, ~18s vs ~60s). Each split dream doc also gets `castSuggestions`:
  every mention looked up in the saved character sheet via
  `character.js:matchCandidates` — ALL plausible candidates per name (an
  ambiguous "Jonathan" returns both Jonathans; unmatched "Miriam" returns
  `[]` → the UI shows a blank describe-them card). **Stage 2 — approval in
  the app:** "is this the order of your dreams?" (▲▼ moves WHOLE dreams;
  persisted via `POST /dream/reorder {ids}` which re-staggers `createdAt`)
  and "are these the characters?" (pick a candidate / unpick = not them /
  type a description). **Stage 3 — `POST /dream/:id/render {quality,
  characters:[{name, url|image|desc}]}`:** `dreamPaginate()` lets the model
  decide how many IMAGES the dream needs (1-6, never padded) and allots each
  image a verbatim slice of the dreamer's words in TRUE chronological order
  (drift cues fix the narration order); then `makeDreamPagesV2` draws
  sequentially — each page gets the style ref FIRST, then ONLY that slot's
  approved character cards (image refs; desc-only people ride as text
  continuity lines), then up to 3 already-drawn earlier pages
  (`dreamPageRefs` — a face is carried from the page it first appeared on),
  plus the whole dream for context and "THIS page tells ONLY this part".
  **The model decides each page's layout** (single drawing or panels — no
  fixed 2x2). Pages store `{url, promptUsed, text, captions, who, softened}` —
  **`text`/`captions` are what the picture ACTUALLY says**, so anything
  rendering captions from the doc matches the drawing; when the safety filter
  forced a rewording, **Sophie's own wording is kept beside them as
  `textOriginal`/`captionsOriginal`** (present ONLY on a softened page, so
  ordinary pages carry no redundant copy). The dream is a record of what she
  said — a content filter must never silently replace her sentence with a
  paraphrase, and `softened:true` alone couldn't tell you WHICH sentence
  changed. Plan kept on
  `dream.pagePlan`. ~$0.06/page medium. Legacy beat docs still render
  through the old `makeDreamPages` 2x2 path (`order:[beatId]` still
  honored). Own polled docs (`GET /dream`, `GET/DELETE /dream/:id`,
  `GET /dream-batch/:id` for the background read), background job on the
  doc, `pageHistory` capped 3, separate `forge-dreams` collection.
  **Render survives leaving the app:** fire-and-forget server job; iOS
  `DreamsView` records rendering ids in `@AppStorage("dreams.activeRenderIDs")`
  and resumes polling on return; transient poll failures retry (phone locked /
  Render cold start) — only a real job error surfaces.
  **A gpt-image-2 SAFETY REFUSAL is terminal, never a retry (Aug 2026).** The
  filter refuses ordinary dream content — the "Mommy Evaluates Kid" render died
  on a breastfeeding line, flagged `safety_violations=[sexual]`. A refusal is
  deterministic, so retrying it is waste: that render burned 9 API calls over
  ~65s of backoff and reported "3 rounds of retries", which reads like a network
  fault. Now `isSafetyRefusal()` short-circuits every retry ladder
  (`openaiPanel`, `openaiPanelEdit`, `drawPagesResilient`'s rounds), and the page
  gets redrawn with its NARRATIVE softened — `softenRefusedNarrative`
  (gpt-4o-mini) rewords only the page's slice of the dream, its captions and the
  context line, and the structural half of the prompt (style ref, continuity
  clauses, attachment numbering) is rebuilt untouched around it, so softening
  can't scramble the references. **Rewording Sophie's own sentences to get past
  the filter is allowed — she asked for it (2026-08-06).** A page that lands
  softened is marked `softened:true`. Softening escalates over TWO passes (pass 2
  rewrites pass 1's output), then gives up with a plain reason instead of a retry
  count. Refused requests are rejected before generation and cost nothing, so the
  extra pass only ever spends a few seconds.
  **`SOFTEN_SYSTEM` is empirically calibrated — don't reword it casually.**
  Probed live against the filter on the refused page (2026-08-06): `feed it milk
  from her breasts`, `breastfeed the baby` and even the VAGUER `feed it milk from
  her body` are all REFUSED; `nurse the baby`, `feed the baby` and `hold the baby
  close and feed it` are ACCEPTED. So being vaguer does not help and euphemism is
  the wrong move — the first version of the prompt said "rephrase only what is
  likely to trip it" and the model produced "from her body", which was refused
  again. The prompt now tells it to REFRAME THE ACTION in ordinary everyday
  verbs, with that worked example baked in; verified end-to-end (pass 1 →
  "Then she went to nurse the baby." → page drawn).
  Tests: `node scripts/test-dream-refusal.js`.
  **The page must not re-render while she scrolls.** `dreams.html` polls every
  3.2s during a render and used to call `render()` each tick, reassigning
  `root.innerHTML` — which re-decodes every image and drops scroll position.
  Scrolling "Past dreams" during a render therefore flickered and jumped to the
  top (her report, 2026-08-06; renderArchive's own comment already warned that
  rebuilding "re-decoded every image"). `liveUpdate()` now patches the status
  line and APPENDS newly-landed pages instead, and returns early when she's on
  the archive/zine tab so a background render never touches the view she's
  reading. Tests: `node scripts/test-dreams-scroll.js` (headless Chromium;
  playwright is an optionalDependency, the script skips without it). Characters keep their
  ORIGINAL backgrounds (the transparent cleanBox step was removed by request
  — background separation only matters if a character is composited later).
  Same `STUDIO_TOKEN` gate. iOS is the frontend; a web page port of the new
  flow is planned to follow the TestFlight build.

## Chunking (`clips.js`) — the clip library, searchable

Rebuilt from scratch 2026-08-15 (Sophie asked for a fresh take on the first
build). Page at `/chunking` (`/clips` is the honest alias), API at
`/api/clips`, iOS tile under the FILM filter. Collection
`forge-clip-library` (+ `forge-clip-library-meta` for the harvest job) in
deckfactory.

**What it is.** The shelf of every small, self-contained clip the studio has
made — the pieces films get cut from, never the films themselves — so a
re-cut with different emphasis reuses clips instead of re-paying for them.
It generates and stitches nothing and costs nothing. The page is a
Story-Room-style shelf: poster tiles four to a row, serif names underneath,
a search bar on top, kind chips (scenes · bridges · quick · shorts), and a
lightbox that plays the clip and edits its name/tags/note.

**A CHUNK is the unit Sophie named the tool for (Aug 2026):** a named,
tagged SECTION of a finished video — footage and voiceover together — that
she would reuse whole in a different video. Her examples: the Sheldrake
telepathy bridge inside the Evan video (reusable anywhere she talks about
telepathy); the manifestation trio — the chocolate bars, the cat, the third
thing she visualized at night (reusable in any witchcraft video about
manifestation); the shirt she imagined and saw the next day; the envelope in
El Salvador. Chunks are kind `chunk` on the same shelf, chip first. File one
with `POST /api/clips/chunk { url, start, end, title, vo?, tags?, from? }`
(or `node scripts/make-chunk.js --url … --start … --end … --title …`): the
doc is content-addressed by url+span (re-filing converges, a failed bake
retries safely) and the BAKE runs in the background on the chunk's own doc —
Admin-SDK download, accurate trim with 12ms audio edge fades (the cutmarks
recipe), poster, its own file under `clip-library/chunks/`. `vo` holds the
span's voiceover text and is searchable (`vo:telepathy`); the span cap is
600s — a chunk is a section, not the video. The harvest never touches
chunks, and PATCH lets her (or a chat) fix title/tags/note/vo/hidden with
the same her-edits-win protection.

**Two sources, one harvest** (`runHarvest` in `clips.js`; CLI
`node scripts/harvest-clips.js [--dry]`, server `POST /api/clips/harvest`
as a background job on the meta doc, polled by the page):

- **Firestore** — `forge-movies` scene clips, kept re-rolls
  (`clipHistory`) and dream bridges; `forge-quick` quick-animates. These
  carry their real titles and the generation PROMPT (the treasure — it is a
  searchable field and shows in the lightbox).
- **A Storage sweep** — the shorts chats built into their own prefixes
  (witch-shorts/, story-shorts/, hospital-film/, two-panel-gallery/ …).
  **The skip list is the load-bearing half** (`SKIP_PREFIXES`, measured
  2026-08-15 against 697 video files): the Dump (`drops/`), whole
  interviews (`nde-audio/`), finished episodes (`nde-episodes/`), the
  movies pipeline's own storage (`movies/` — the Firestore half covers it
  with better metadata), the pad's still-encode cache and films
  (`scratchpad/`), voice notes (`writing-notes/`), Cut Marks / Cutting Room
  renders, and this module's own posters. A swept file over **64MB** is
  skipped before download; anything probing over **180s** is a film wearing
  a clip's name and is skipped and counted, never filed.

**Her edits always win.** `PATCH /:id` (title/tags/note/hidden through an
EDITABLE whitelist) records the touched fields in `editedFields`; a
re-harvest merges through `mergeClip`, which never overwrites a touched
field, and note/hidden are never the harvest's to write at all. Docs are
content-addressed (`sha1(url)`), so re-running the harvest upserts and
nothing ever doubles. There is deliberately NO delete route — hiding is the
verb; a deleted doc would just resurrect on the next harvest.

**Posters read the bytes via the Admin SDK, never the url** — ffmpeg cannot
reach the cloud sandbox's HTTPS proxy, so the harvest downloads with the
SDK (works everywhere, handles private objects), probes with ffprobe (a
file with no video stream is refused), grabs a frame at ~15% in (frame 0 is
often a fade from black), and ships it as a **480px webp** (~15KB, the
webp rule) under `clip-library/posters/`, cache-immutable.

**Search is the whole interface.** `search-grammar.js` parses (the ONE
house grammar); matching is the clip-library way — lowercase alphanumerics,
substring hits, so her punctuation and dictation never decide a match.
Fields: `tag:` `title:` `from:` (the film it came out of) `prompt:` `note:`
`kind:`. The page mirrors the same parse client-side over the loaded shelf
(no request per keystroke) and the box runs through `liveInput`, so iOS
dictation searches as she speaks. `GET /api/clips?q=` answers the same
grammar server-side. Semantic search is deliberately not built yet
(Sophie: fine to do later; it would cost an embedding pass).

**CHUNKS ARE THE DEFAULT VIEW (Sophie, Aug 2026: "since the main point is
chunking not random clips… hide the clips by default and only show them when
asked").** The chip row is TWO piles and nothing finer — **chunks** (what she
named on purpose) and **clips** (every atom, one tap away), plus **hidden**
when it exists; the old per-kind chips (scenes/bridges/quick/shorts) are
gone. A search runs inside the open pile, and when it comes up empty there
but has hits in the other one the state line offers them ("Nothing matches in
clips · 1 in chunks") rather than dead-ending. The page is **cream**
(`--bg:#faf6ee`), and it out-specifies the injected pill's own palette so the
pill matches it — see the pill note in the `new-page` skill, because `:root`
alone cannot reach an injected pill. A **back-to-top** button sits
bottom-right (the pill owns top-right) once the scroll passes 500px.

**Two layout bugs found by MEASURING the rendered page (2026-08-15), both
invisible in a passing test suite:** a tile's `.ph` is a `<span>` inside a
`<button>`, so it was inline and `aspect-ratio:1` never applied — the squares
only looked square while their posters happened to load, and collapsed to
77x111 whenever one was slow or missing (`display:block` fixes it); and the
house 56px pill reserve left the "?" 8px underneath the pill at 390pt (64px
clears it). Screenshot a page before calling it done.

**Gotchas earned elsewhere, honored here:** opening the page never spends
money and never starts a harvest (it only *shows* a running one); the
lightbox freezes the page and restores the exact scroll position; the
video element is torn down on close so the download stops; text boxes ship
empty; the pill's five tokens are defined on `:root` and the page script
is an IIFE.

Tests: `node scripts/test-clips.js` — the grammar matching, the sweep skip
list, the title fallback, the her-edits-win merge, and the gatherers, all
pure, no network.

## Assembly (`assembly.js`, `/assembly`) — clips in order → one film

Sophie's ask (Aug 2026): "one thing missing from our image film pipeline is
an easy way to assemble clips — I can put them in order, sort of like the
scratch pad in Story Room, but for clips. They appear on a timeline at the
bottom; dropping one in gives you a little place indicator between each clip
that already exists, and you click one to drop the clip between the two
existing clips." That sentence is the whole interaction, built literally:

- **Two levels, one page** (the timeline.html pattern): the shelf of
  assemblies, then one open. Opening pushes a history state, so the browser
  back, the swipe-back gesture and the native chevron (`window.__navBack`)
  all go shelf-ward before they leave the tool. `?a=<id>` opens one cold.
- **An open project's surface is its own pieces — the POOL — not the library
  (Aug 2026 v4, Sophie: "i still don't see the things but there's all these
  other chunks or clips that compete for my attention … think carefully if
  moving them out of the way is the best fit, versus detaching or creating a
  separate surface, with the clips to go in").** The first cut put the whole
  Chunking shelf on the main of the screen with a cramped tray strip in the
  dock, and she could not find her own nine uploads among a hundred library
  tiles. Now the main grid IS the pool (`doc.tray` — the field name is
  historical), labeled READY TO DROP IN, big tiles four to a row; the
  **Chunking library detached to its own door** — the third button, **From
  the shelf**, a full-screen picker sheet carrying the house search grammar
  and the all/chunks/clips chips. Tapping a clip there closes the sheet with
  the clip IN HAND (her original arm-and-place interaction, one door
  deeper); the library loads LAZILY on the sheet's first open, so a project
  never pays for the whole shelf up front. Still read-only — nothing in
  Assembly ever writes a library doc.
- **An item is a clip OR a still, and the Dump is the one-button door (Aug
  2026 v2)** — her flow: Playground images, some animated with Midjourney,
  dumped from her phone as one album. **Add from the Dump** (inside an open
  assembly) lists the Dump's albums (`GET /sources` — registered ABOVE
  `GET /:id`, the promptlab-styles Express lesson); tapping one POSTs
  `/:id/import { album }` and every file in it — photos and videos alike —
  lands **in the TRAY in album order** (`photoIndex`), ready to drop in.
  **EVERYTHING ARRIVES IN THE TRAY, NEVER ON THE TIMELINE (2026-08-21, from
  her first real use: "they're supposed to be above the timeline so i can
  drop them in. i'm confused").** The first import went straight onto the
  timeline and broke the one mental model; `mergeIntoTray` is the rule now —
  deduped by id against the tray AND the placed clips, so re-importing an
  album (or importing the album her own Upload button filled) can never
  double a piece. Two more findings from that night, both fixed: the tray
  strip read as the timeline (it now wears a **READY TO DROP IN** label and
  its own surface paper), and every auto-named assembly said "Assembly ·
  Aug 21" — she uploaded into one and reopened another. Names carry her
  **Pacific** date and time now ("Assembly · Aug 21 · 9:50 pm"; the server
  clock is UTC, which had also been flipping an evening assembly to
  tomorrow's date).
  `itemsFromDrops` is the pure mapper: a photo becomes `kind:'image'` with
  `hold` (seconds on screen, default 4, clamped 0.5–30) and a DERIVED
  `/api/story/thumb` tile (never the full-res original); a video keeps its
  baked `posterUrl`. Nothing is copied, nothing is filed onto the Chunking
  shelf — the harvest still skips `drops/` on purpose (a raw dump is not a
  made clip; here she picked the album herself). A still picked up on the
  timeline shows 2s·4s·6s·8s chips in the in-hand bar; its badge and the
  total count its hold (`itemSeconds`). In the render a still is the pad
  film's beat-art encode — `-loop 1 -t hold` onto the same canvas over
  `anullsrc` silence — so mixed assemblies stay one concat-copy join. And
  `cleanClips` keeps an unknown length `null` rather than coercing it to a
  confident 0 (found by the round-trip test).
- **Upload is one button in the page, and the TRAY is where it lands (Aug
  2026 v3** — her third cut at the same flow: "a button in assemblies where u
  can upload the footage and it appears above the timeline, ready to drop
  in"**).** The Upload button clicks a hidden
  `<input type=file multiple accept="image/*,video/*">`, so on the phone it
  is the native Photos picker. Files upload ONE AT A TIME (the 512MB box)
  through the Dump's own `/api/drop/upload-file` — never a re-implementation:
  that path already does HEIC→JPEG, md5 dedupe (re-uploading a file can
  never store it twice) and video poster extraction. The batch shares one
  Dump session (the first response mints it) under an album named after the
  assembly, so the bytes are also findable in the Dump later. Each stored
  item maps through the page's `trayItemFrom` (the itemsFromDrops mirror)
  into `doc.tray`, painted above the timeline as it arrives. A tray piece
  arms exactly like a shelf clip — indicators, tap a gap, it moves
  tray→clips in one save; the in-hand bar's remove reads **Remove** there
  (vs **Take off** on the timeline) and discards it. `POST /:id/clips` now
  takes `{clips?, tray?}` — each an ARRAY SAVED WHOLE, a missing field left
  alone — and the render still reads `clips` only, so nothing in the tray
  can ever leak into a film.
- **The timeline is docked at the bottom** and everything is a tap (the
  wrist rule): tap a shelf clip to pick it up → a `+` place indicator
  appears in every gap (both ends included; an empty timeline shows one) →
  tap the gap and it drops in between. Tap a clip already ON the timeline to
  pick it up instead — the same indicators MOVE it, and the in-hand bar
  above the strip carries ▶ (play just this clip), **Take off** (timeline
  only — the clip stays on the shelf) and ✕ (put it down).
- **The arrangement saves WHOLE** (`POST /:id/clips`, debounced) — order and
  membership always change together, so a partial write could never be
  right. Items are snapshots `{id,url,title,poster,seconds}` whitelisted by
  `cleanClips`; the id ties back to `forge-clip-library`.
- **The gap arithmetic lives in assembly.js** (`placeAt`/`movePlace`,
  mirrored on the page, pinned by the test): gap `g` means "before the clip
  now at index g", and a move counts gaps against the list SHE is looking at
  — the two gaps hugging the lifted clip are both "staying put".
- **Render is free and is the scratch-pad film's recipe** (do not simplify
  it): per clip — download via the Admin SDK first (`clips.bucketForUrl`),
  probe, normalize onto ONE canvas (`targetFrom`: the first clip's frame,
  evened, long edge capped 1280; `segmentFilters`: scale + pad, fps=30,
  setsar=1, yuv420p) as its own x264 segment; audio as PCM WAV cut/padded
  (`apad -t`) to the segment's REAL encoded length, `anullsrc` when the clip
  is silent. Video segments join via the concat demuxer `-c copy`; the WAVs
  concatenate sample-exact; AAC is encoded ONCE at the mux. Per-piece aac
  would add priming at every join and walk the sound off the picture — the
  pad film's measured finding (~24ms per two units).
- At render time each item **re-resolves its current library doc by id**, so
  a re-baked chunk renders from its newest file; the snapshot url is the
  fallback. One source file on disk at a time (512MB box).
- **Renders never overwrite**: `assembly/<id>/film-<n>.mp4`, kept on the doc
  newest-first, capped 12. `assembly/` is on clips.js's `SKIP_PREFIXES` so a
  film made OF clips is never harvested back onto the shelf as a clip.
- The round ▶ on the bar plays the arrangement **clip by clip in the
  browser** — a rough preview with a beat at each join; the render is the
  real, gapless film. The renders list is lines of text with play buttons
  (never an embedded `<video>`), newest first, above the shelf.
- Background job on the doc (`job` + `GET /:id/job`), stale takeover at
  20 min, re-open resumes polling. `POST /` mints an assembly (auto-named by
  date), `POST /:id/title` renames, `DELETE /:id` removes the doc (Storage
  renders stay).

Tests: `node scripts/test-assembly.js` — the place arithmetic, the
whitelist, the canvas and filter chain, the shelf row, all pure; then the
real page in headless Chromium (gaps appear only while something is in
hand; a drop lands between the two clips; a pick-up moves; Take off never
touches the shelf).

## Songs (phone recording → real song, keeping the real voice)
- `songs.js` (`/api/songs`, page at `/song`) — Sophie sings a made-up song into
  her phone; out comes a produced track with HER actual voice (built because
  Suno-style covers replace the singer). Pipeline: **resemble-enhance**
  (Replicate, `denoise_flag:true`) strips background noise + restores the vocal
  → **meta/musicgen** `stereo-melody-large` writes an instrumental that follows
  the cleaned vocal's melody (`input_audio` conditioning, `continuation:false`)
  → **ffmpeg** mixes voice over instrumental (adjustable gains, `loudnorm` to
  -14 LUFS) into a 192k mp3. Version hashes pinned in `AUDIO_MODELS`.
- MusicGen holds a melody for ~30s, so longer recordings are cut into ≤30s
  chunks, generated with ONE shared seed (cohesion), padded/trimmed back to
  exact chunk length (`conformChunk` — keeps sync with the voice), and joined.
  Max 4 minutes (`MAX_SONG_SECONDS`); ~$0.11 per 30s chunk + ~$0.03 enhance.
- Uploads arrive as data URLs, are transcoded to mono 44.1k WAV first
  (`toWav` — voice memos are m4a, browser recordings webm), and Firebase
  Storage is REQUIRED (Replicate must fetch the audio by URL). The style
  prompt always gets `STYLE_SUFFIX` ("instrumental backing track, no vocals")
  or MusicGen sings its own oohs.
- Re-mix (gains) is free ffmpeg; re-rolling the instrumental with a new style
  re-runs only MusicGen + mix. Old mixes go to `mixHistory` (capped 12).
- State: movies.js pattern — one Firestore doc per song (`forge-songs`),
  background jobs recorded in the doc, clients poll `GET /api/songs/:id`. Same
  `STUDIO_TOKEN` gate (only `GET /status` open); `/song` served via
  `serveGated` like `/photo`.

## Voice Memos — ONE library, every path files into it (Aug 2026)
- **The library** = membry Storage `memo-audio/<id>.m4a` + `manifest.json`
  (`memos.js`, `/api/memos`) — the stamped 1100+ recording archive. Every way
  audio arrives now funnels into it through `memos.fileIntoArchive()`: the
  Mac push (`scripts/push-memos.mjs`), the iOS share sheet / audio drop
  (`audio.js` auto-files each new recording, keeping its own `forge-audio`
  doc with `memoId` as the reference), Story Room voiceover pastes
  (recordings only — TTS renders stay out), and a chat with a pasted file.
- **The Mac push is AUTOMATIC once installed (Aug 2026, Sophie's ask):**
  `scripts/install-memo-autopush.sh` (served at `/install-memo-autopush.sh`,
  queued in `docs/desktop-tasks.md`) writes a launchd agent
  (`com.imageforge.push-memos`) that runs the push at every login and daily at
  noon, downloading the CURRENT `push-memos.mjs` from the server each run (with
  an offline fallback to its cached copy), logging to
  `~/Library/Logs/imageforge-push-memos.log`. The one macOS trap: a launchd job
  doesn't inherit Terminal's Full Disk Access, so the agent can be blind to the
  Voice Memos database Terminal reads fine — the installer detects that exact
  failure in the first run's log and prints the one-time System Settings fix
  (add the `node` binary to Full Disk Access). Re-running the installer is
  always safe. Test: `node scripts/test-memo-autopush.js` (generation on a
  scratch HOME, no launchd, no Mac).
- **A chat files a pasted recording with ONE call — never reconstruct the
  stamp by hand:** `POST /api/memos/ingest?title=…&dur=…&ext=m4a` with the
  raw bytes as the body. `stamp` is optional; without it the server derives
  one from the file's internal clock and the **md5 of the bytes** does the
  real deduping (every manifest record carries `hash`). The internal clock
  is the moment recording STOPPED, which is why hand-built stamps went wrong
  (2026-08-05: filed `_1330`, her phone said 1:28) — don't guess it.
- **A filed recording TELLS SEARCH (Aug 2026).** `fileIntoArchive` notifies
  `memos.onFiled` listeners once a record is really appended (never for a
  duplicate; a listener that throws is swallowed — filing is the half that
  must not fail), and `search.js` registers one that arms its append-only
  index sync. That is the whole reason a recording is findable minutes after
  it lands instead of whenever somebody remembers to rebuild the index — see
  the Search section for what the sync does and what it costs. A restamp
  notifies too: a new id is, to an id-keyed index, one gone and one arrived.
- **APPLE'S OWN TRANSCRIPTS FILL THE GAPS — one line on her Mac (Aug 2026).**
  Measured 2026-08-17: **94 of the 1,137 records carry no transcript at all** —
  over the 45-minute ceiling, over Whisper's 24MB cap, heard as empty, or a
  failed enrich that banked the audio and moved on. Search searches WORDS, so
  those recordings are invisible in it. **Realistically ~57 of the 94 can be
  filled** — 11 are zero-length and 26 more are under 5 seconds, so Apple has
  nothing for them either; the 57 with real audio are **66.5 hours**, 14 of
  them over an hour each. Voice Memos already transcribed them on
  the phone, free, the long ones included, and **only her Mac can read that
  database** — so the Mac hands the words over and the server does the rest,
  exactly like the push:
  `curl -fsSL <app>/import-apple-transcripts.mjs -o /tmp/apple-tx.mjs && node
  /tmp/apple-tx.mjs` (`--dry-run` first; queued in `docs/desktop-tasks.md`).
  - **FILL ONLY, NEVER OVERWRITE.** `POST /api/memos/transcript {id,
    transcript}` refuses a record that already has words: two transcripts of
    the same audio disagree in small ways, and swapping the one Search indexed
    for another is how a passage she found yesterday stops matching tomorrow.
    Filling one re-runs `classify` (it had no words, so its `cat` was a
    placeholder) and notifies `onFiled`, so Search picks it up by itself.
    `GET /api/memos/untranscribed` is the list of empty ones with their
    `stamp|duration` match keys.
  - **THE SCRIPT DISCOVERS THE SCHEMA; IT DOES NOT ASSUME ONE.** Apple has
    moved transcripts between layouts across OS versions, and a guessed column
    name that isn't there returns zero rows — which reads exactly like "you
    have no transcripts". So it scans for columns/tables mentioning
    transcription, says what it found and how it read them, and handles three
    layouts: a text column on the recording row, a segment table joined back by
    a recording link (re-joined in time order), and an archived blob (plutil,
    falling back to text runs). Found nothing → it says so, exits non-zero and
    points at `--report`, whose output is what a chat needs to fit the reader.
  - Matching is `stamp|duration`, the same key the push filters on — never the
    stamp alone. Two recordings sharing a minute AND a rounded length are
    reported and left alone rather than guessed.
  - Tests: `node scripts/test-apple-transcripts.js` — drives the real script
    end to end with no Mac and no network (fixture databases in all three
    layouts, `sqlite3` shimmed onto PATH with `node:sqlite`, a stub archive).
    Its own earned bug: the harness first used `execFileSync`, which blocks the
    event loop the stub server runs on, so the child's fetch deadlocked.
- **THAT IMPORT IS DEAD — THE MAC TRANSCRIBES THE AUDIO ITSELF (2026-08-19).**
  Apple's transcripts are produced per-device, on demand, and are **not carried
  across iCloud**, so the phone's transcripts stayed on the phone.
  `CloudRecordings.db` on the Mac has no transcript column in any of its 30
  tables, `EncryptedCloudRecordings.db` has none either, and the Recordings
  container holds only `.m4a` and `.waveform` files. This is not the "layout
  differs on this OS version" case `import-apple-transcripts.mjs` anticipated —
  there is nothing to fit a reader to. **The audio is all here though**, so the
  Mac transcribes it itself: `scripts/transcribe-local.mjs`, whisper.cpp with
  `large-v3-turbo`, no API key and no per-minute cost.
  - **Neither limit that emptied these records applies locally.** whisper.cpp
    streams a file of any length in 30-second windows, so the 45-minute ceiling
    and the 24MB cap are both gone and **nothing is chunked** — the 5.9-hour
    recording goes through the same code path as a 6-minute one.
  - **VAD IS NOT OPTIONAL — it is the whole reason the output is usable.**
    These are quiet recordings (sleep-talk, a phone across the room), and
    Whisper invents speech over silence. Same 31-minute recording, measured
    2026-08-19: **with** `--vad` it returns 121 characters of real fragments
    ("Startled by my own strength… Hesitant to try"); **without**, 975
    characters of `. . . Thank you. Thank you. Thank Thank Thank`. VAD hands
    the model only the stretches containing a voice, so there is no silence to
    fill in. It is also enormously faster on quiet audio — 149× realtime
    against 14× — because the silence is never decoded.
  - **A WRONG FILL IS PERMANENT, SO THE BAR IS "SKIP IF UNSURE".**
    `POST /api/memos/transcript` is fill-only; once a record has words it stops
    appearing in `/untranscribed` and nobody ever retries it. So the script
    filters before sending: sound tags (`*crickets*`, `[BLANK_AUDIO]`) stripped,
    a blocklist of Whisper's silence fillers ("Thank you.", "Thanks for
    watching"), one-phrase decoder loops, and anything under four words.
    **Earned the hard way:** the first run had no filter and banked four junk
    transcripts — two "Thank you.", one "*gunshot*", one "*crickets*" — which
    cannot be cleared, because there is no route that unsets a transcript. The
    server's own `length < 8` floor caught three more.
  - **What it can and cannot reach** (measured 2026-08-19): of 101 wordless
    records, **45 have real audio on this Mac** (48.7 hours, 22 over 45
    minutes, longest 5.9 hours). The other 56 are out of reach here — 26 have
    no recording in Voice Memos at all, 3 have a stamp+length that matches two
    recordings and are left alone rather than guessed, and 27 are under 5
    seconds.
  - Matching is `stamp|duration`, the same key the push filters on — never the
    stamp alone.

- **Transcription is UNCONDITIONAL** (Sophie 2026-08-05) — no toggles;
  `transcribe=0` params are ignored everywhere. Bank first, enrich after: a
  Whisper failure files the audio with `enrichError` on the record instead
  of losing the recording.
- **THE FILE md5 IS NOT A FINGERPRINT OF THE RECORDING (Aug 2026 — this is
  what let duplicates through after the "one library" fix).** iOS rewrites an
  m4a's QuickTime creation/modification dates every time the file is exported
  or shared, so re-sharing a recording gives DIFFERENT BYTES for identical
  audio. Measured on a real pair: both copies 2,820,952 bytes, **36 bytes
  different, every one a date field** (copy A `2026-08-02T19:43:44Z`, copy B
  `2026-08-04T04:31:10Z` — each the moment it was FILED), all 2.8MB of audio
  bit-identical. **That single cause defeated BOTH dedupe layers at once**,
  because `mvhdDate()` reads the same rewritten clock, so the server-derived
  stamp was "when it was shared" too. Don't diagnose a repeat memo as a hash
  bug — the hash was working; it was hashing the wrong thing.
- **Dedupe is THREE layers now, and each catches what the one before cannot:**
  1. **file md5** (`hash`) — a byte-identical resend, i.e. a retried upload.
  2. **audio fingerprint** (`ahash`, `memos.audioHash`) — the file md5 with
     every mvhd/tkhd/mdhd date zeroed, so a re-SHARED recording matches. The
     scan is a whole-buffer search, NOT a tree walk from the top-level moov:
     Voice Memos leaves an earlier copy of those boxes inside the mdat region
     (headers at 17814 *and* 2755110 in the measured file) and iOS updates
     both — a tree walk finds one and the fingerprints still disagree.
  3. **transcript backstop** (`memos.transcriptTwin`) — exact duration + ≥40
     words + ≥90% word agreement. This is what catches a re-ENCODED copy,
     where even the audio bytes differ. **The thresholds are calibrated
     against the real archive, not guessed** (swept over all 1,117 records:
     they flag the 9 genuine duplicates and nothing else). Every gate is
     load-bearing — EXACT duration because Sophie re-records the same line
     constantly and those takes land 1–2s apart (±2s slack wrongly flagged
     four of them); 40 WORDS because an 8-second line repeated ten seconds
     later really is word-for-word identical and is NOT a duplicate; 90%
     because Whisper transcribes the same audio differently each run (which
     is exactly why duplicates read as different memos). Re-run
     `node scripts/memo-dedupe.js` after touching any of them.
- **A SHARED STAMP IS NOT A DUPLICATE, and the stamp no longer dedupes
  anywhere (Aug 2026).** It is minute-resolution, Sophie records several short
  thoughts back to back, and the archive holds **70 groups of recordings that
  honestly share a minute** — so the rule was wrong for about one recording in
  fifteen. It cost a real one: a 28-minute recording from 2025-09-12 was
  refused as "already in the archive" because an unrelated 11-second clip
  (91KB against 14.2MB) was made in the same minute. Identity is bytes or
  words; the stamp only NAMES a record.
  - The Mac push had it worse, because it filters BEFORE uploading — a new
    recording sharing a minute with an archived one was never sent at all, so
    the server's layers never got to judge it. `GET /status` returns **`keys`**
    (`stamp|duration`) and `push-memos.mjs` skips only when both match;
    duration comes free from the Voice Memos database, so this costs no file
    reading. (`stamps` is still returned for older callers.)
  - **The direction of the risk is deliberate**: a false SEND is harmless (three
    real layers catch it, and a fingerprint match costs nothing — not even
    transcription), while a false SKIP loses a recording for good.
- **Never hand-build a stamp** — POST the bytes and let the server work it out.
  A stamp equal to NOW is a caller guessing (12 records got in that way, 0–3
  min from their own upload); it still names the record but earns the id a hash
  suffix so two derived minutes can't collide.
- A skip after the audio is already uploaded now DELETES those bytes, or they
  become an orphan object nothing can reach (five of those had accumulated).
- **Repairs: `node scripts/memo-dedupe.js`** — `--fingerprints` (backfill
  `ahash`), `--merge` (merge duplicate pairs), `--orphans` (sweep audio no
  record points at), `--all`, `--dry-run`. **It never deletes**: a merged-away
  recording's audio moves to `memo-audio/_removed/` and the manifest is backed
  up beside itself before any write, so every repair is reversible by hand.
  Bare (no flags) it scans and changes nothing — run that first.
- Ran 2026-08-07, end to end: 9 duplicate pairs merged (1,117 → 1,108) — 6 from
  the 11 July bulk build (`export-voice-memos.sh` appends `_1` when a filename
  already exists, so a second export run into the same folder copied some
  recordings out twice and each copy was transcribed and titled separately),
  3 from re-shares in Aug. Then `ahash` backfilled over all 1,108 (4.86GB read,
  ~$0.60 of egress; 3 zero-duration empties have no container to fingerprint),
  and the 5 orphan objects re-filed → **1,113 records, 0 duplicate pairs**. One
  of those orphans was a 28-minute DREAM with a 19,316-character transcript
  that had been invisible since Sept 2025.
- **After any merge or re-file: rebuild the Search index AND re-embed.** The
  index keys its vectors to `builtAt` + chunk count, so a reindex that changes
  chunking leaves meaning-search 409ing on `stale-vectors`.
  `POST /api/search/reindex` (free) then `POST /api/search/embed` (~$0.05).
- Earlier one-time repairs (both ran 2026-08-05):
  `scripts/memo-unify-backfill.js` — phase A stamped `hash` onto existing
  records from Storage md5 metadata, phase B merged strays from `forge-audio`
  into the archive. Note phase A landed AFTER two of the three Aug duplicates,
  so the md5 layer wasn't even present when they were filed.

## Voice Studio (`voicelab.js`, `/voice`) — her ElevenLabs voices, two tabs
- Pick a voice, type words, tap Render — TTS without leaving Deck Factory.
  Deliberately NO settings: every render is the stock v2 defaults (stability
  0.5, similarity 0.75, style 0, speaker boost), `eleven_multilingual_v2`.
  Background job on a `forge-voicelab` doc, audio to Storage `voice-lab/`.
- **The voice picker is a row of coloured SQUARES, one per person, ALL ON ONE
  ROW** (Sophie, Aug 2026: "a lot smaller and definitely all fit on one row").
  `.vbtn` is `flex:1 1 0` with `max-width:40px` and `aspect-ratio:1`, so any
  number of people fits any phone; the dropdown under it is the who-is-who
  fallback, and there is **no name line under it** — the dropdown already says
  who is picked. Each square is a FLAT COLOUR, no glyph (Sophie, Aug 2026:
  "make the little icons into squares instead of circles" — the Lucide `user`
  that used to sit on them is mostly a circular head at 30px).
  **`OFFERED_VOICE_IDS` is an explicit ALLOWLIST** — empty would
  sweep in every Voice Library professional on the account. Cloning someone
  new = add the id + a colour there; **culling one is just dropping its id**,
  which is how Richard v1/v2/v3, Miriam, Gilad, Alpha and "Sophie — doctor"
  came off the picker on Aug 18 2026. Nothing was deleted at ElevenLabs.
- **♥ / ✕ ON A TAKE, AND THE TWO FILTERS OVER THEM (2026-08-28, Sophie: "add
  the same playground heart x hide pattern in voice studio").** Both marks on
  every FINISHED take's meta row (after the ⤓), tapping the lit one clears it;
  one segmented box of two filters on each list's header line. The full rules —
  one setting across both tabs, the two lit colours differing, the both-ways
  Assets sync, no marks on an unfinished or failed take, and a filtered card
  hidden rather than removed — are written out once in CLAUDE.md's Voice Studio
  bullet. The mechanics here:
  - `POST /api/voicelab/render/:id/vote {vote:'like'|'dislike'|''}` writes one
    `vote` field on the `forge-voicelab` doc. `/history` already returns whole
    docs, so nothing about the read changed and every take already on file
    picks this up.
  - `syncVoteToAssets` writes the `forge-asset-votes` doc keyed
    `sha1(ASSETS_CHAT|url)` — the same id `assetVoteRef` in server.js derives,
    which is what makes the two records the same record. `voteFromAssets` is
    the return trip, exported and called from `/api/gallery/assets/vote`
    beside `syncVoteToPlayground`; it matches on `url` and does nothing for a
    url outside `voice-lab/`.
  - The page keeps the marks and the filters in ONE place
    (`voteBtns` / `paintFilt` / `applyFilt` in `public/voice.html`), and
    `card()` calls `applyFilt` on every repaint — a take arriving or finishing
    has to be judged by the live filter, or a fresh render appears on a
    hearts-only list nothing has hearted.
  - The `.secthead` row reserves the injected pill's column the same 56px
    `.acctabs` and the bigger-box button already reserve on this page.
  - Test: `node scripts/test-voicelab-votes.js`.
- **Her words STAY in the box** (Sophie, Aug 2026): a render does not empty it
  and neither does leaving the page (`localStorage['voicelab_text']`), because
  she runs the same line through voice after voice. **Clear** is the only
  thing that empties it, and it only shows when there is something to clear —
  at the FAR RIGHT of the row, as far from Render as the row allows.
- **NO CHARACTER COUNTS ANYWHERE, and the header is ONE ROW (Aug 18 2026,
  Sophie: "it says Voice Studio twice, once at the top and once below it… get
  rid of basically the whole header, including the line" / "I don't need to know
  how many characters everything is").** The brand row, the credits line and the
  rule are gone and the credits moved **behind an ⓘ** at the left of the tab
  row — the number is still fetched at boot, it just costs a tap to read.
  - **THE TITLE CAME BACK WHEN APPLE'S BAR WENT (2026-08-27, Sophie: "this
    header doesn't match the app pattern").** Her complaint above was the name
    twice, one strip above the other — so the page's own h1 came off and the
    NATIVE bar carried it. Then `.forgeWebToolBar` removed that bar from every
    web-wrapped tool, and the half holding the name went with it: pagehead.js
    found no header row to sit in, fell through to its row-less branch, and drew
    a bare `#forgehead` strip holding the chevron and NOTHING ELSE. **The tool
    was nameless, and the screen looked like nothing else in the app.**
    - The page owns its header now, which is the house rule for a web-wrapped
      tool: one `.app-header` row of the shape Meta Assets uses, into which
      pagehead inserts the chevron and whose title `.fh` centres on the SCREEN
      between the chevron and the pill's column (64px reserved here — 56 is a
      hair tight at 390pt).
    - **STILL ONLY ONE "Voice Studio" ON SCREEN, on either build.** `?embed=1`
      hides `.app-header` when `window.__forgeLeave` is absent, so on an older
      build Apple's bar keeps the title alone and her original complaint cannot
      come back. `node scripts/test-voice-changer.js` measures BOTH states —
      the two failures live on opposite sides of that one flag, and a check of
      one state alone cannot see the other coming.
    - **The lesson is the STALE NOTE, not the header.** "The native tool bar
      carries the title" was true when it was written and was quietly falsified
      by a change in another file; both this doc and CLAUDE.md went on telling
      the next chat to keep the page headerless. A page that leans on chrome it
      does not own should say WHICH chrome, so the day that chrome goes the
      note reads as a question rather than an instruction.
  - **This page had no `<h1>` at all, and it is not the only one** — swept
    2026-08-27, of the 38 gated pages **10 have no header row** for pagehead to
    sit in (dump, dreams, dreams-archive, films, character, instagram, ingest,
    crystals, audio, voice). Seven of those still draw an `<h1>` in their
    content, so they read as a bare chevron strip ABOVE their own title rather
    than as one row; **`dump.html` and `dreams.html` have no title anywhere**,
    the same nameless shape this fixed. Neither is a `GatedWebTool` today (the
    Dump and Dreams are native screens), so neither shows Sophie a chevron —
    but the day either is opened as a wrapped web tool, it ships nameless.
  Render and Apply voice are the same height as Clear (`align-items:stretch`
  on `.renderrow`, because their borders differ by half a pixel).
  The rows that now sit in the injected pill's top-right band each keep the
  56px reserve, `.vsel` included (`max-width:min(22em, calc(100% - 56px))`).
- **TWO TABS — TEXT · VOICE (Aug 2026, Sophie: "a separate hairline tab in
  the voice studio"; renamed from SPEAK · CHANGE on Aug 18 — "rather than
  speak it should say text, because it's text to speech, and change should say
  voice, because it's voice to speech").** The house `.acctabs` hairline
  pattern. The tabs swap only the LOWER half; **the voice picker is SHARED**,
  because "which voice" means the same thing on both sides (words to say /
  voice to become). The picker's own "VOICE" section label is gone — it sat
  above a row of coloured squares and said nothing the squares didn't.
  - **The VOICE tab is speech-to-speech** — `POST /v1/speech-to-speech/{voice}` on
    **`eleven_multilingual_sts_v2`** (verified live against `/v1/models`:
    `can_do_voice_conversion`, 29 languages). It keeps the PERFORMANCE —
    timing, emphasis, where a laugh lands — and swaps only the voice, which
    is the whole reason it isn't just TTS. **No v3 here either**, same rule
    as her TTS.
  - **Two ways in: record in the page, or choose a file** (a Voice Memo, once
    it is in Files). The record button sits in the MIDDLE of its row — three
    grid tracks (`1fr auto 1fr`), not a centred flex row, so the timer growing
    beside it never moves it — and the file picker is a **folder icon**, since
    it is the fallback, not the headline. `recMime()` asks the browser what it can record —
    **iOS Safari has no WebM, `audio/mp4` is what it records**, so never
    assume a container. Recording needs `mic: true` on the `/voice`
    `GatedWebTool`; the file picker works with no build.
  - **The SOURCE is uploaded to Storage BEFORE the conversion is attempted**
    (`voice-lab/sources/<id>.<ext>`, her ask: "the recorded voice will also
    save to firebase"), so a failed or refused conversion still leaves her
    the take. A finished change plays BOTH halves.
  - **The take SURVIVES the send**, the same reason her words do. Dropping it
    is an **✕ in the take card's top-right corner, and it asks first** (Sophie,
    Aug 2026: "drop this take is right next to the play button, so I'm afraid
    I'll accidentally delete my take rather than pressing play"). The confirm
    covers the card rather than opening a dialog, so the answer is where the
    question is. A RECORDED take draws no name — the player already shows its
    length — while a PICKED file keeps its file name, the only thing that says
    which file she chose.
  - `POST /change?voiceId=&voiceName=&ext=&name=` takes the audio as the
    **RAW body** (base64 in JSON inflates a memo by a third — the
    `audio.js` `/upload-file` precedent) and the page sends it with XHR so a
    phone upload shows real progress. Cap 25MB. It writes the body to tmp
    BEFORE responding, so the background job never holds a whole recording
    in memory beside the next request's.
  - `GET /history?kind=tts|sts` filters **in memory, not in the query** — a
    `where()` would silently hide every render made before `kind` existed.
    Absent means `tts`, which is what they all were.
- **EVERY TAKE IS KEPT, AND EACH ONE HAS A ⤓ (Aug 2026, Sophie: "does it save
  every audio take somewhere / how can I download them").** It always saved
  them — a Firestore doc per take plus permanent public Storage objects
  (`voice-lab/<id>.mp3` out, `voice-lab/sources/<id>.<ext>` in) — but the page
  gave her nothing but a native `<audio>` player, which on a phone has no way
  out, and the SOURCE existed nowhere she could reach at all.
  `GET /file/:id` streams a take as a same-origin **attachment** (`?src=1` for
  what she recorded), the `cuttingroom.js` `/:id/file` precedent. **The link
  must point at OUR server, not at Storage** — a cross-origin href ignores the
  `download` attribute and the phone just plays the file. The source keeps its
  OWN extension (`sourceExt`); a `.webm` recording renamed `.mp3` is a file her
  phone opens wrong.
  **The whole library is still only the newest 30 per tab** (`/history`), and
  nothing on the page lists a take older than that — worth building a real
  shelf if she starts keeping them; the audio itself is never deleted.
  A voice-changer take is also the one kind of render that does NOT file into
  an Assets tab (only `renderJob`, the TTS half, does).
- Tests: `node scripts/test-voice-changer.js` (drives the real page headless
  against a stub API — the tabs, the take, the raw-body send, which list a
  card lands in, both download links and a hit-test of them, and a hit-test of
  both tabs at 375/390/430).

## Audio drop (`audio.js`) — recordings off the phone → permanent URLs
- `audio.js` (`/api/audio`, page at `/audio`) is the generic destination for
  audio. Nothing else did that job: `/api/story/voiceover` attaches ONE
  recording to ONE story, `/api/songs` runs the whole song pipeline,
  `/api/memos` files into the stamped 993-memo archive (and costs money per
  file), and the Dump takes images + video only. A folder of recordings in the
  Files app had nowhere to go.
- **The iOS Share sheet IS a way in (Aug 2026).** `DumpShare` activates for
  files too and routes audio extensions here (`POST /upload-file`, one
  date-stamped batch per share). The sheet's old "Transcribe the recordings"
  toggle is now a NO-OP — the server transcribes every recording
  unconditionally and also files it into the Voice Memo library (see the
  section above); over-25MB files record a clear error on the doc. Uploads are a BACKGROUND URLSession via the
  `group.com.sageryza.imageforge` App Group — the sheet stages files in the
  shared container, queues the tasks, and dismisses; fire-and-forget, the md5
  dedupe means re-sharing heals a lost upload. Other ways in: the `/audio`
  page's file picker, or Voice Memos → Share → Copy → Story Room's "Paste a
  recording" when it belongs to one story.
- **Dump first, label afterwards** (same as the Dump): uploading asks only for a
  batch name, defaulted to the date. `name` (from the filename), `notes`,
  `tags`, `track` are all fillable later, from the page or by a chat.
- **Files are keyed by the md5 of their bytes**, so re-sending a batch after a
  dropped connection tops it up instead of doubling it (`duplicate:true`).
  `seq` comes from a **transaction** on the batch doc, never from counting the
  collection — that's the bug that scrambled album order in `dropbox.js`.
- One Firestore doc per recording (`forge-audio`, deckfactory), bytes at
  `audio/<batch>/<NN>-<name>.<ext>` — a readable path, because these urls get
  pasted into other tools by hand. `seconds` comes from ffprobe (best-effort;
  no binary just leaves the field null). Public url = what every downstream
  step wants: an Episode Editor source, a Story Room voiceover, `/api/nde`'s
  from-video ingest, a chat that needs to hear it.
- **Routes:** `GET /status` (open), `GET /batches`, `GET /items?batch=&track=`,
  `GET /items/:id`, **`POST /upload-file?batch=&filename=&name=`** (ONE file as
  the RAW body — no base64 inflation, and XHR reports real progress on a phone),
  `POST /upload` `{batch, files:[{audio:dataURL|url, filename?, name?}]}` (the
  chat path), `PATCH /items/:id`, `DELETE /items/:id`. Same `STUDIO_TOKEN` gate.
- PATCH writes are whitelisted to `EDITABLE`; url/storagePath/hash/bytes/
  seconds/createdAt are server-owned. Queries use one equality filter and sort
  in memory, so there's no composite index to set up.
- The page uploads **one file at a time** (a phone uplink shared eight ways just
  makes them all slow) and the transfer is foreground — leaving the page stops
  it. Transcription is deliberately NOT wired in; a recording's words come from
  whichever pipeline claims it.

## Episode Editor (transcript spans → snippet cards → finished audio)
- **ANY work on Sophie's audio starts with the `sophie-audio` skill**
  (`.claude/skills/sophie-audio/`) — cutting, pause removal, take selection,
  assembling narration, TTS. It is the tripwire for the two docs below, and
  it ends with the rule chats keep skipping: run
  `node scripts/vo-verify.js` before handing a cut back.
- **Full cutting-pipeline documentation: `docs/nde-precise-cutting.md`** — read
  it before cutting interview audio; it is the doc of record for the precise
  cutter (alignment caches, snapping rules, both implementations, data layout).
- `editor.js` (`/api/editor`, page at `/editor`, iOS tile "Episode Editor") — Sophie selects spans of a real
  interview transcript as **snippet cards**, arranges them (with **narration**
  and **gap** cards) into an episode, taps **Render**, and gets the finished
  audio. The cloud version of the hand-run supercut
  (`scripts/nde-supercut-precise.py`), so no computer is in the loop.
- **The cutting logic is a faithful port of that Python** and the reason the cuts
  sound edited rather than sliced: `phraseSpan` locates the snippet text in the
  REAL AUDIO's word timestamps via a contiguous best-match slide (a repeated word
  later in the window can't stretch the cut); `clampBounds` pads **gap-aware** —
  never past the midpoint of the silence to the neighbouring word, which used to
  swallow the next word's first syllable; `detectSilences`+`snapToSilence` move
  both cut points into REAL silences (forward-only at the end, hard-capped at the
  next word so snapping can't add words); then micro-fades + `loudnorm I=-16`.
  difflib's `SequenceMatcher(autojunk=False)` is ported too, so the JS picks the
  same spans the validated Python cuts did.
- **Word timestamps: cached alignment first, Whisper as the fallback.** The
  drift-repaired forced-alignment caches live in Storage at
  `nde-align-cache/<videoId>_<winStart>.json` as
  `{videoId, winStart, winDur, words}` — publish/refresh them with
  `node scripts/upload-align-cache.js ~/align-cache:80 ~/align-cache-150:150`
  (127 windows live as of July 2026 — pass the 80s dir FIRST so the 12 that also
  exist at 150s overwrite it with the longer window). A render picks the one that covers
  the snippet's anchor; with no covering window (or if the phrase isn't really in
  it) it listens to a fresh window with OpenAI `whisper-1` word timestamps. Each
  render's `notes[]` records which path every clip took.
- **Every finished cut is banked in the permanent clip cache (Aug 2026):**
  `nde-episodes/editor/clip-cache/<sha1>.mp3`, keyed by
  `CUT_VERSION|videoId|normalized words|rounded anchor` — so a clip is cut ONCE
  ever, across previews, renders and episodes; after that it's a single small
  download (render notes say `from clip-cache`). `POST /:id/preview` checks the
  cache first and answers `ready` instantly on a hit — no job. Narration is
  cached the same way (`narr-cache/<sha1>.mp3`, keyed by voice+model+tempo+
  prefix+text), so re-rendering an episode never re-bills ElevenLabs for
  unchanged lines. Bump `CUT_VERSION` in `editor.js` when the cutting logic
  changes — every stale cut re-cuts itself on next use.
- **Editing during a render is safe (Aug 2026).** Jobs persist ONLY
  `job`/`renders` via field-level patches (`patchEpisode`), the page's PUT
  patches only what changed, and preview completions patch their snippet inside
  a transaction — nothing stamps a whole stale doc anymore (the old bug: the
  job's 1.5s progress saves silently reverted anything Sophie edited
  mid-render). A render always uses the arrangement as it was when Render was
  pressed. The page saves are debounced (600ms) and applied optimistically, so
  buttons respond instantly; a pending save flushes on navigation/pagehide.
- **One episode per montage** (Realer Than Real, Telepathy, Not My Body, The
  Colors, Universal Knowledge, The Music, Life Review, Welcomed Home, Deceased
  Loved Ones, The Grass): cut lists banked in `scripts/nde-montages/*.json`
  (the exact lists the delivered montage audios were cut from; PROOF's is
  `proof-veridical.json`), seeded by `node scripts/seed-editor-montages.js`
  (`--render` also renders each sequentially, which warms every clip into the
  clip cache and drops the montage audio in the episode's Renders list;
  `--only slug,…`, `--replace`, `--base`).
- **Data:** Firestore `forge-editor`, one doc per episode —
  `{ id, title, sources:[{videoId, experiencer, timeSec, audioUrl}],
  snippets:[{id, name, videoId, text, timeSec}], sequence:[{type:'clip'|
  'narration'|'gap', snippetId?, text?, dur?}], renders:[{url, at, seconds,
  cards, notes}] (capped 10), job }`. `snippet.timeSec` is the picked span's
  absolute position in the interview — that anchor is what selects the alignment
  window, so it matters. Transcripts are NOT copied into the doc: `GET /:id`
  reads `forge-nde-videos` server-side and returns a word-tokenized ±150s window
  per source (~150KB for 12 sources) so the phone stays light.
- **Routes:** `GET /status`, `GET /` (list), `POST /` `{title, sources}`,
  `GET /:id` (doc + transcript windows), `PUT /:id` `{title?, sources?,
  snippets?, sequence?}`, `POST /:id/render`, `GET /:id/job`, `DELETE /:id`.
  Same `STUDIO_TOKEN` gate as the pipeline (only `GET /status` open).
- **Render = background job on the doc** (movies.js pattern): the POST returns
  immediately, the page polls `GET /:id/job`, records the pending render in
  `localStorage` and RESUMES polling on return — leaving the page never loses it.
  Each UNIQUE snippet is cut once no matter how many times it appears in the
  sequence. Narration = ElevenLabs voice `UTkHGl2ImiT6gwtAFCql` on
  `eleven_multilingual_v2` (**NEVER `eleven_v3`** — voice rule under Design
  rules), no whisper prefix, no tempo nudge, ONE constant gain instead of
  loudnorm (Aug 2026, Sophie — she rejected the dynamic squeezing;
  editor.js is the live copy of all of this, `docs/narration-voice-settings.md`
  the human record).
  `ELEVENLABS_API_KEY` is in config-loader `MANAGED_KEYS` (Render env or
  `config/pipeline`) — **without it narration cards FAIL the render with a clear
  job error, they are never silently skipped**. Output: one 44.1k mono mp3 at
  `nde-episodes/editor/<id>-<n>.mp3`.
- **Seed:** `node scripts/seed-editor-proof.js [--base <url>] [--replace]`
  rebuilds the **PROOF** episode — the 12 verified veridical moments as sources +
  snippets (named by experiencer), the "Pajamas hook" opener, and the v4 running
  order with its narration fills. 23 cards.
- **Each render row has a SCISSORS → the Cutting Room** (Aug 2026), where the
  pauses and filler words come out by tapping them. See the Cutting Room
  section for the contract; nothing about the render itself changed, and
  pause/filler removal deliberately does NOT happen inside a render.
- **iOS:** `EpisodeEditorView.swift` = a WKWebView on `/editor` that answers the
  HTTP Basic gate with the studio token (same wrapper pattern as
  `WritingRoomView`), registered as the `editor` tool in `RootView` — home-grid
  tile "Episode Editor", SF Symbol `waveform`, deep link `deckfactory://editor`.
  It pauses the page's audio on a screen change so a preview never keeps playing
  from a hidden tab. Page changes ship via Render deploy — no TestFlight build.

## Cutting Room (her recordings → marked on the transcript → cut/sent)
- `cuttingroom.js` (`/api/cutroom`, page at `/cuttingroom`, iOS tile "Cutting
  Room", SF Symbol `scissors`, deep link `deckfactory://cutroom`) — Sophie
  opens one of her OWN recordings (the audio-drop list, i.e. everything shared
  off Voice Memos), marks it on its **transcript** — never a waveform — cuts
  pauses out, and slices sections off to save or send on. The hallway between
  Voice Memos and the rooms that use her voice. Designed around her wrist
  (tendinitis): **everything is a tap, nothing drags, scrubs, or scrolls**
  (playback follows itself — current word highlighted, page auto-centers).
- **Design (Aug 2026, Sophie): icon-first, gold-on-cream.** Buttons are GOLD
  outline + GOLD icon on CREAM (never white/text on the accent), words only
  where unavoidable (sheet rows, confirms). Send = the Apple share glyph, cut
  out = scissors, MARK = bookmark, tighten = chevrons pointing inward, render
  = arrow-down-to-line. Same paper/gold palette as editor.html — sibling tools.
- **Marking model:** tap first word, tap last word → a section (bar appears:
  cut out / save-send). Tap a pause chip → cut it (rose, struck; tap again to
  keep). "Tighten" cuts every pause in one tap. MARK drops a pin at the word
  being spoken. Cut-out words show struck-through; tapping them offers restore.
  **A picked section STAYS picked after save/send** (Aug 2026, Sophie) — she
  saves AND sends the same span without re-picking; only the ✕ (or cutting it
  out) lets go.
- **The room is TWO hairline tabs — TRANSCRIPT | CLIPS (Aug 2026, Sophie:
  "the scrolling is pretty brutal")** — saved clips and renders live behind
  the second tab instead of below the transcript. Long-recording navigation
  on the transcript tab: **chapter notches** down the left edge (every 5 min,
  10 for >1hr; tap = jump the page to that minute) for recordings over 8 min,
  and a **find-a-word** magnifier in the tools row (live matches highlighted,
  next-arrow cycles; commits on blur — she dictates). Tab row reserves the
  pill's 56px corner; the sliding line is `calc((100% - 56px)/2)`.
- **Cuts are the Episode Editor's cutter** (imported from editor.js —
  `clampBounds` + `detectSilences` + `snapToSilence`, ONE implementation): a
  tap never needs to be precise, edges land in real silences. **A planned
  "manual mode" (cut at the exact tapped millisecond, no snapping) is PARKED
  by request — not in v1.**
  **Every real cut RE-LISTENS first (Aug 2026, earned):** the stored words
  come from the 75s-chunked whole-recording pass, which is chips-only
  accuracy — Sophie's first clip started at "yeah" and grabbed the "he said"
  before it, because the bulk pass timed "yeah" early. `cutSection` and the
  render's cut-outs therefore extract a small window, take FRESH whisper
  word timestamps, and locate the span with `phraseSpan` (buildClip's exact
  precision path); the bulk timings survive only as the fallback. Never cut
  from the stored words directly. Clip entries carry `wi0`/`wi1` so a clip
  can be re-cut.
- **Pause detection = vo-remove-pauses.js's two passes** (word-timing +
  relative-energy breath pauses, room-tone runs — silencedetect alone CANNOT
  find noisy pauses, see docs/nde-precise-cutting.md). Detection only; nothing
  is removed until she taps. A removed pause is COMPRESSED to ~0.28s (KEEP),
  never deleted outright. The RMS profile is folded streaming off the decoded
  PCM (an hour of 16k s16le is ~115MB — never read into one Buffer on the
  512MB instance).
- **HER VOICE IS NEVER LOUDNORMED** (the Episode Editor narration finding —
  she rejected dynamic squeezing). Renders and clips are cuts of the original
  bytes; clips get micro-fades on the edges only.
- **Hand-offs:** save → clip file + a `forge-audio` doc (batch
  `cutting-room`, track `cutroom`, content-hash deduped, no second copy of
  bytes). **Do NOT point Sophie at `/audio` to find a clip** — that page is
  an UPLOADER whose list shows only the batch typed in its box (defaults to
  today's date), so a `cutting-room` clip is invisible there (Aug 2026, bit
  for real). The review surface is the room's own Sections list, and every
  clip/render row carries a **download** button (Apple's arrow-into-box
  glyph): in a browser it's a same-origin attachment
  (`GET /:id/file?u=<storage url>&n=<name>` — validated to the recording's
  own folder), in the app the `cutroomShare` WKScriptMessage bridge fetches
  the file natively and opens the iOS share sheet (Save to Files/AirDrop);
  **Story Room** → clip cut here, then
  `scratchpad.attachVoiceUrl(padId, beatId, url)` (a normal voice take —
  every take kept); **Episode Editor** → NO audio is cut: the recording gets
  a `forge-nde-videos` doc (`cr-<id>`, segments grouped from our words) and
  `editor.addExternalSnippet()` adds source + snippet card + sequence entry —
  the editor re-cuts it natively (same whisper fallback, same clip cache).
- **Data:** one doc per recording in `forge-cutroom` (deckfactory),
  content-addressed by sha1 of the audio URL (reopening resumes). Word
  timestamps live in Storage `cutroom/<id>/words.json` (chunked whisper-1,
  75s chunks — the honest-on-long-files finding), NOT on the doc. Doc holds
  `pauses` (s/e keep-adjusted + removed flag), `cuts` (word-index spans),
  `pins`, `clips` (saved/sent sections), `renders` (capped 8 — every render a
  NEW file, originals untouched), `job`. All slow steps are background jobs on
  the doc; the page polls and resumes from `localStorage` (`cutroom_open`).
- **Routes** (STUDIO_TOKEN gate, only `/status` open): `GET /sources` (audio
  drop items + project states), `POST /open {url,name}` (starts the listen
  job: transcribe + find pauses), `GET /:id`, `POST /:id/{pause,tighten,pin,
  cutout,uncut,title}`, `POST /:id/section {wi0,wi1,action:'save'|'story'|
  'editor',…}`, `POST /:id/render`, `GET /:id/job`, `DELETE /:id`.
- Transcription cost ≈ $0.006/min of recording (whisper), paid once per
  recording. Caps at 90 min.
- iOS: `CuttingRoomView.swift` = the **Episode Editor wrapper pattern** (v1
  shipped bare and Sophie flagged it — see the Headers design rule): native
  `.forgeToolBar("Cutting Room")` whose chevron asks `window.__navBack`
  first (room → recordings list → leave the tool), `__nativeNavBar`
  injected so the page hides its own back button (`body.native`; the page
  header also folds away on the recordings list, where it would duplicate
  the bar), audio paused on screen changes. The page carries the injected
  shared pill, so the native pill is suppressed (`showAutoScroll`). Page
  changes ship via Render deploy; wrapper changes need TestFlight.
- **The "?" circle on the tools row** is the instructions for an icon-first
  tool: tap → a card naming what every icon does, tap anywhere → hidden.
  Keep it in step with the icons if any control changes.
- The recordings list links out to **Search** (below) — the way in when she
  knows what was said but not which recording said it.
- **A finished Episode Editor render comes here to have its pauses and filler
  words taken out (Aug 2026, Sophie's ask).** Each render row in the editor
  carries a **scissors** (that tool's own glyph) → `/cuttingroom?url=…&name=…`;
  the page opens that url on boot and strips the param, so a reload lands
  where she actually is. `POST /open` already accepted any https url, so this
  needed NO new server code and NO TestFlight build — the nav chevron asks
  `__navBack` (room → list) then falls through to the web view's history back
  to the editor, exactly the path Search's memo hand-off uses.
  **The cut number comes from the render's FILE** (`<episode>-7.mp3`), never
  its row position: `renders` is capped at 10 and newest-first, so positions
  drift as old cuts fall off while the files keep counting up.
  Each render is its own content-addressed room, so marking cut 7 never
  touches the marking on cut 6. Tests: `node scripts/test-cutroom-handoff.js`
  (drives both real pages in headless Chromium; skips without one).
- **Do NOT move pause/filler removal INTO the editor's render** (Aug 2026,
  the decision behind the hand-off). The editor's cuts are safe because both
  edges land in detected silences; removing an "um" from the MIDDLE of a clip
  is a splice, and a splice is something to approve by ear, not have happen
  invisibly inside a render. That is what this room is for. Caveat worth
  knowing: **Whisper often doesn't transcribe "uh"/"um" at all** (that is what
  caused the doubled-word bug — see phraseSpan in
  `docs/nde-precise-cutting.md`), so filler removal by transcript is partial;
  the pause detection catches many of them anyway as breath pauses.

## Pausing (`pausing.js`, `/pausing`) — how long a beat sits

The other half of the polish pass, and the half that decides how a cut
actually sounds. Shipped Aug 2026; before that it existed only as a
hand-authored Compare page, "Evan — the pause timeline (v7b)" in the chat
`evan-story-visual-summary`, page `s9rSf9bZo0AqnScX0OON` — still worth reading
as the reference for what the tool does.

**What it is for.** The Cutting Room can REMOVE a pause: it compresses one to
`KEEP` (~0.28s) and that is the only length it has. Nothing else in the app
could make a pause 1.2 seconds, or put a pause somewhere she never left one.
Four things lived on that page and nowhere else, and they are the tool:

1. **Setting a LENGTH**, not just removing — the whole idea of rhythm.
2. **ADDING a pause** where the recording has none.
3. Building it out of the recording's **OWN ROOM TONE**.
4. **Playing HER EDIT** rather than the source (Sophie: "I need to be able to
   hear it to know how long of a pause I want"). Pressing play used to play
   the recording as it is, so a pause she had just set sounded exactly the
   same and there was no way to judge a length.

**A pause is never digital silence.** This is the finding the tool is built
on: a room has a floor, and a pause rebuilt as zero samples reads as a
dropout — it is what made the "45 percent" line sound bungled. So every pause
is real audio out of her own recording, and the only question is which piece:

- an **existing gap** lends its own air, trimmed if she shortened it and
  repeated if she lengthened it — the best possible source, because it is
  literally the room at that exact moment;
- an **added pause** has no gap of its own, so it borrows the quietest
  sustained stretch of the same file, baked once during the listen job to
  `pausing/<id>/room.wav` and read by both the preview and the render.

Fades are 12ms on the OUTER edges of a pause piece and nowhere else. A fade at
every loop boundary pumps audibly on room tone; a butt join between two copies
of near-silence does not.

**Detection is imported, never re-implemented.** `cuttingroom.js` exports
`breathCuts`, `roomToneCuts`, `mergeRanges` and `rmsProfile` — the
vo-remove-pauses passes (see `docs/nde-precise-cutting.md`, "Noisy pauses":
breath and mouth noise sit only 4-7dB under quiet speech, so no absolute
silence threshold finds these pauses). Every constant in them is a measured
finding. A second copy would find DIFFERENT pauses and the same recording
would read differently in two rooms.

Those passes hand back ranges to REMOVE, **already inset by `KEEP`/2 on both
sides**. Pausing wants the GAP, so `pausesFrom` takes that inset back off —
and no further, because the 0.10s margins inside `breathCuts` are deliberate
protection for the speech either side. Get this wrong and every pause she is
shown is 0.28s shorter than the one she hears: the tool's whole job, silently
off by a beat. Two filters then apply: below **0.35s** a gap is articulation
rather than rhythm and gets no chip (a chip on every comma buries the pauses
that matter), and head/tail air is a TRIM, which is the Cutting Room's job.

**The edit itself is ONE shared file.** `pause-plan.js` is loaded by the
render on the server (`require('./pause-plan')`) and served to the page at
`/pause-plan.js`. She sets a length by EAR, so the 1.2s she approved in the
preview has to be the 1.2s that comes out of the render — two implementations
would drift and the tool would quietly stop being trustworthy. `planEdit`
turns her marks into ITEMS over the original timeline and walks them into
PIECES that tile it exactly: a gap in them is audio silently dropped out of
her recording, an overlap is audio played twice. Picking the length a gap
already had is **not a change** (re-cutting a gap to itself would add two
fade-joins to audio that needed none), and overlaps are dropped rather than
merged.

**It does not cut words.** The reference page had a CUT mode; the Cutting Room
and Cutting Blocks both do that properly, with the re-listen every real word
cut needs. Pausing only ever touches AIR, which is why its word timings never
have to be cut-accurate and it never re-listens. "out" is 0.08s of room tone —
an elision, not a splice.

**The unit of listening is the PARAGRAPH.** The artifact decoded one 90-second
film into memory and rebuilt the whole thing on every play. A real recording
can be ninety MINUTES, which decoded is most of a gigabyte of Float32 in a
WKWebView. So the server cuts a paragraph span once (`/api/search/clip-span`,
banked immutably, ~45KB for a sheet preview), the page decodes it, and her
pauses are spliced in the browser — which keeps the thing that mattered:
changing a length and hearing it with no round trip. Paragraphs are derived
client-side, broken at the LONGEST pauses, and the page opens FOLDED to them
(the progressive-expansion rule) and draws words only where she goes in.

**Undo collapses consecutive changes to one pause into one step.** Deciding a
length is a run of taps — 0.4, then 0.8, then 1.2, listening to each — and one
entry per tap means undo walks back through her auditioning instead of back
out of the pause. Adding a pause opens the sheet, so add-then-length was two
entries and one undo left an unwanted pause sitting at its old length (caught
by the page test).

**Data.** One doc per recording in `forge-pausing` (deckfactory),
content-addressed by a sha1 of the source url so re-opening resumes. Words in
Storage (`pausing/<id>/words.json`); only `set` and `added` — her marking
state, the part that changes — live on the doc, through a whitelisted
`POST /:id/state`. Renders capped at 8. **Her voice is never loudnormed.**

**Money.** Opening a recording transcribes it, ~$0.006/min, once ever per
recording. Previews are ffmpeg span cuts, banked forever. Rendering is ffmpeg
on our own box. Nothing spends on load.

**Routes** (mounted at `/api/pausing`, STUDIO_TOKEN gate, only `/status`
open): `GET /status` · `GET /sources` · `GET /` · `POST /open` ·
`GET /:id` · `POST /:id/state` · `GET /:id/plan` (her edit as the render will
perform it — free, no ffmpeg) · `POST /:id/title` · `POST /:id/render` ·
`GET /:id/job` · `DELETE /:id`.

**Tests.** `node scripts/test-pausing.js` — the inset arithmetic, the room-tone
pick, and the shared plan's tiling, pure and no network. `node
scripts/test-pausing-page.js` — the real page in headless Chromium against a
synthetic recording the stub cuts on demand, asserting on the SAMPLES the page
hands the speakers: the pause must be quiet AND non-zero. A regression there is
invisible in code review and obvious in her ears.

## Search (`search.js`) — every transcript, one search
- `search.js` (`/api/search`, page at `/search`, iOS tile "Search", SF Symbol
  `magnifyingglass`, deep link `deckfactory://search`) — one search across
  **BOTH** transcript libraries: the 77 interview transcripts in
  `forge-nde-videos` (~3.5M chars) and the 1,022 transcribed voice memos in the
  membry archive (~2.2M chars). Nothing could search either before: the Cutting
  Room only searches inside ONE recording already open, the Episode Editor only
  shows a ±150s window around a snippet she already knows about.
- **Results are PASSAGES, not files** — a ~48s window of transcript with its
  timestamp, whose recording it is, and audio. Same paper/gold palette as
  editor.html / cuttingroom.html; the three audio tools are one family.
- **The hand-offs are the point** (a search that only lists is worse than
  scrolling). Each hit goes to the tool that owns that kind of audio:
  **interview → Episode Editor** (`editor.addExternalSnippet` — a snippet card
  lands in an episode and the editor re-cuts it natively), **memo → Cutting
  Room** (`POST /api/cutroom/open` with the recording's url). Search cuts no
  audio of its own except `/clip-words` below; every path feeds the ONE
  cutter in `editor.js`.
- **CLIP-THESE-WORDS on a hit (Aug 2026, Sophie: "pick the words from that
  step if I just want one clip and not the whole recording").** The scissors
  Clip button puts the hit's passage in pick mode — tap first word, tap last
  word, ✓ — and `POST /clip-words {src, text, chunk, timeSec}` cuts JUST
  that span (background job, content-addressed cache
  `search-clips/words-*`), with ▶ + a download button on the result (share
  bridge in the app / same-origin attachment `GET /clip-file?u=&n=` in a
  browser). Rules: BOTH kinds cut through ONE path, `cutInWindow` in
  search.js (fresh window listen + `edgeSpan` + clampBounds + silence snap +
  micro-fades) — an INTERVIEW gets the loudnorm every episode clip gets; a
  MEMO is HER VOICE, never loudnormed, bytes downloaded server-side via
  `memos.memoAudioToFile` (memo audio is not public). A memo's anchor is
  PROPORTIONAL (memo chunks carry no clock): the chunk's place in the
  transcript maps to time, and the listen window slides once each way when
  the phrase isn't where the estimate said.
  - **`edgeSpan` exists because the pick text and the cut come from
    DIFFERENT transcripts** (index words vs the fresh listen): `phraseSpan`
    trims unmatched edge words as never-said — right same-transcript, wrong
    here, where a fresh-listen disagreement on an edge word would silently
    cut picked words off. Each edge anchors on its own 6-word sub-phrase and
    reclaims disagreed edge words by position. Its pick tokens are
    AUDIO-SHAPED (first normWords piece per spoken word) — raw `normWords`
    splits contractions ("it's" → it, s), overshoots the audio span, and the
    reclaim then opened clips one word early (measured live).
  - **Verifying a clip by raw-transcribing it LIES about its first words
    (Aug 2026, measured — cost a needless fix cycle).** Whisper drops the
    fast opening words of an abruptly-starting clip, so a correct cut reads
    as "starts late". Pad ~1s of silence on the front before transcribing,
    or locate the clip in its source by RMS envelope correlation against
    word timestamps (the settling measurement both times). Same rule in the
    `sophie-audio` skill.
- **A hit's Play NEVER points at the banked interview audio.** Those files are
  what yt-dlp downloaded — webm/opus, one object per whole interview (the
  Darius one is **62MB**). Play asks the server to cut THAT PASSAGE to mp3 once
  via `editor.extractWindow` (ffmpeg seeking over HTTP — it never pulls the
  whole file), banked at Storage `search-clips/<videoId>-<start>.mp3`,
  immutable-cached, instant ever after. `GET /clip?src=&t=` is a background job
  (`{status:'making'}` → poll → `{status:'ready', url}`). Two reasons:
  **size** (measured — a 56s passage is ~800KB against 62MB; on a phone that is
  the difference between a tap that plays and one that doesn't) and **format**
  (iOS Safari has no WebM audio support; Opus plays there only inside CAF).
  Voice memos skip all of it — m4a, minutes long, streamed through `/audio/:id`.
- **A page that FETCHES audio needs CORS on the bucket, and testing it
  same-origin hides that completely (Aug 2026, the pausing tool).** An
  `<audio src>` needs no CORS, so every media element in the app worked and
  nothing looked wrong — but `fetch()` + `decodeAudioData` (what any WebAudio
  page does) is a cross-origin read and the browser blocks it. Both buckets
  had **zero** CORS entries, so every such page would have failed live while
  passing its tests, because a local test server serves the mp3 from the
  page's own origin. Both now allow GET/HEAD from
  `imageforge-q125.onrender.com` + `secretlyawitch.com` (added, never
  replaced — `bucket.setCorsConfiguration` overwrites the whole list).
  Check it with `curl -D - -H "Origin: https://imageforge-q125.onrender.com"
  <url> | grep access-control` — a missing header is the bug, and it is
  invisible from a same-origin test.
- **Two things about audio CANNOT be tested from a chat's sandbox** (both cost
  real debugging time — don't re-derive them): ffmpeg's **direct HTTP seek**
  fails because the sandbox's outbound HTTPS proxy is one ffmpeg can't use (it
  exits 2 with no message and falls back to downloading the source), and a
  headless browser has **no network to `storage.googleapis.com` at all**, so
  in-browser playback of any Storage URL is untestable — a `MEDIA_ERR code 4`
  there is a network failure, NOT proof of a codec problem. Verify playback on
  the phone.
- **The index** lives at Storage `search-index/index-v1.json` (~10MB, ~600ms to
  load, ~49MB heap) and is cached in process for 15 min. Built from Firestore +
  the memo manifest; a rebuild is FREE of paid APIs and runs as a background job
  via `POST /reindex` (the page has a "Rebuild the index" button). A missing
  index builds itself on first use.
- **IT CATCHES ITSELF UP NOW — nobody re-indexes after an ingest (Aug 2026).**
  It used to move only when somebody tapped the button, and nobody did:
  **measured Aug 2026 it held 1,035 recordings against the archive's 1,137**.
  Anything she had recorded lately returned nothing, which reads as the
  recording not existing — and it silently broke the SLICE IN hand-off
  (Search → Cutting Room) for everything recent.
  - **A sync APPENDS; it does not rebuild.** A full rebuild re-chunks
    everything, which renumbers every position and so invalidates every vector
    — meaning search then wants the ~$0.05 whole-library re-embed. Per memo
    that is ~$5 and gigabytes of Storage traffic for one Mac catch-up run of
    ~100 recordings. Appending leaves every existing position — and every
    embedding already paid for — untouched, so a new memo costs only its own
    ~2 passages, about **$0.000004**.
  - **A recording that is GONE loses its `sources` entry, and its chunks stay
    where they are.** Both searches already skip a chunk whose source is
    missing, so it vanishes from results without renumbering anything behind
    it. `counts.dead` is what that costs in file size — the honest argument for
    an occasional full rebuild, and the only thing a rebuild now reclaims.
  - **Debounced, and the delta comes from the LIBRARIES, not from a queue.**
    `memos.fileIntoArchive` notifies Search (`memos.onFiled` — one listener
    covers the Mac push, the share sheet, a Story Room paste and a chat's
    pasted file, since they all funnel through it); the flush runs after 45s of
    quiet, capped at 5 min from the first mark, so a 100-recording burst is ONE
    index write and ONE tail embed. It then asks "what does the archive hold
    that the index doesn't", so a restart, a crash, an ingest path that said
    nothing, and the 102-recording backlog all heal through the same code with
    nothing to replay. A search arms the same check at most every 30 min as a
    backstop (that is what catches a video ingested straight into Firestore on
    her Mac). Force it with `POST /api/search/sync`; `GET` it to watch.
  - New interview docs are found with a Firestore `select()` id listing (no
    transcript bodies pulled just to ask what's new), and a doc that has no
    transcript YET adds no source — or it would count as indexed forever after.
- **Chunks OVERLAP on purpose** (step 30s / span 48s; memos 700 chars / step
  460). Terms are ANDed, so two words spoken in one breath either side of a
  boundary would find NOTHING — "darius pyramids" really did miss the memo that
  says "Darius is like … he describes how the pyramids are like a chamber"
  because a 700-char cut fell between them. `search()` then dedupes the
  near-duplicate hits overlap creates (by timestamp for interviews, by chunk
  adjacency for memos).
- **A term may match the recording's TITLE instead of its words**, scored well
  below a spoken match and left out of the proximity test. Without it "darius
  pyramids" finds nothing in the one interview entirely about Darius, because
  YouTube's auto-caption mis-hears his name in the first sentence ("my name is
  sh right") and he is never named again.
- **TWO MODES, a chip row under the kind filter.** **WORDS** (default) is
  keyword: ANDed terms, `"quoted phrases"`, proximity scoring, prefix matches
  at a discount, word-boundary matching (so "art" never hits inside "heart").
  Instant and free. **MEANING** is embeddings — "the part where he explains how
  the heart holds the soul in" finds it without knowing a word of the wording.
  Only Words highlights the query in a passage (a meaning hit needn't contain
  the words, and marking nothing would imply the match was lexical).
- **The vectors (Aug 2026, live).** Every chunk embedded ONCE with
  `text-embedding-3-small` at `dimensions: 512` (the model's Matryoshka
  property — a truncated vector still works), re-normalised and quantized to
  **int8**: 12,905 × 512 × 1 byte = **6.3MB** at Storage
  `search-index/vectors-v1.bin` (+ a small `-v1.json` meta), loaded as ONE
  Buffer with no JSON parsing. Native 1536-dim float32 would have been 79MB.
  Whole-library cost was **$0.046**, ~16s; a query costs one tiny embedding
  (~$0.000002) and a linear dot-product pass (~150ms).
- **Vectors are KEYED TO THE INDEX BUILD** (`meta.builtAt`, the model and the
  dimensions must match). Chunk N in the vector file has to be chunk N in the
  index, so a full reindex re-chunks and makes them stale — meaning search
  returns **409 with `code:'stale-vectors'`** (or `'no-vectors'`) and the page
  offers a one-tap re-embed with the price on the button, instead of silently
  ranking against the wrong passages. **`POST /reindex` now re-embeds by
  itself** (`{embed:false}` opts out): a rebuild that leaves meaning search
  broken until someone happens to switch modes is how it stayed broken.
- **A vector file is valid as a PREFIX, which is what lets the index move
  without paying $0.05 (Aug 2026).** Since a sync only appends, vectors
  covering the first N chunks are still exactly right about those N —
  `vectorState()` calls that **partial**, meaning search ranks the N and
  reports `pending`, and the sync embeds the tail (a fraction of a cent). Only
  a real mismatch is **stale**. So a memo filed a minute ago can never break
  meaning search for the rest of the library, and a missing `OPENAI_API_KEY`
  costs the tail, not the mode.
- **Similarity is a RANKING, not a set — hence two floors.** Every chunk gets a
  score, so with no cut-off "the heart holds the soul" honestly reported
  **1,080** passages and pure nonsense still reported 23. Measured on this
  library: a good query tops out ~0.54 and decays slowly, nonsense tops ~0.31.
  So: **absolute floor 0.38** (nonsense returns nothing at all) **plus a
  relative floor of 0.85 × the top hit** (a strong query answers with its
  handful, a vague one can't pad itself out).
- **`embed()` retries transient failures, and that is not boilerplate.** The
  first real run died on a plain OpenAI **500 at 4,800 of 12,905** chunks and
  threw away every embedding already PAID FOR, because one bad response failed
  the whole job. 429/5xx now retry with backoff (5 attempts); a 4xx is
  permanent and fails immediately.
- **`/api/search/audio/:id` widens an existing restriction, on purpose.**
  `memo-audio/**` is readable only by a signed-in Firebase user, and
  `/api/memos/audio/:id` deliberately serves ONLY `cat:'dream'` recordings to
  keep the other ~940 locked down. A hit you can't play isn't a result, so
  Search's own route serves ANY memo — behind the same STUDIO_TOKEN gate. One
  streamer implementation: `memos.streamMemoAudio(id, req, res, {dreamsOnly})`.
- **Routes** (STUDIO_TOKEN gate, only `/status` open): `GET /status`,
  `GET /?q=&mode=words|meaning&kind=&limit=&offset=`, `GET /sources`,
  `POST|GET /reindex`, **`POST|GET /sync`** (catch up with the libraries — see
  above; normally nobody's job), **`POST|GET /embed`** (build/inspect the
  vectors), `GET /clip?src=&t=`, `GET /audio/:id`, `POST /to-editor`,
  `POST /to-cutroom`. Deep link a query with `/search?q=darius`.
- **Tests:** `node scripts/test-search-sync.js` — the append rules, pure, no
  Firestore and no API key (positions never renumbered, a gone recording
  dropped by source not by slot, a failed manifest read never mistaken for an
  emptied archive, and the prefix/stale vector states).
- **Playback gotcha, earned:** the `<audio>` element is `preload="none"`, so
  waiting for `loadedmetadata` BEFORE calling `play()` deadlocks — nothing
  loads until play, so the event never fires. `play()` must be called
  synchronously in the tap (iOS also requires that) and the seek hangs off
  `loadedmetadata` as a backstop.
- iOS: `SearchView.swift` = the Episode Editor wrapper pattern (native
  `.forgeToolBar("Search")`, chevron asks `window.__navBack` then the web
  view's own history — a memo hand-off really does navigate to
  `/cuttingroom` — `__nativeNavBar` injected, audio paused on screen
  changes). Page changes ship via Render deploy; the wrapper needs TestFlight.

## Cut Marks (mark your own cuts on a playhead — video or audio)
- `cutmarks.js` (`/api/cutmarks`, page at `/cutmarks`, iOS tile "Cut Marks",
  SF Symbol `timeline.selection`, deep link `deckfactory://cutmarks`) — the
  **manual** sibling of the Cutting Room (Aug 2026, Sophie's ask): no
  transcript, no waveform — she plays the file, taps the scissors at the
  exact spot, and the marks split it into PIECES she keeps or drops; render
  bakes one new file. Opens recordings from the audio drop AND videos from
  the Dump (`media:'video'` docs) — one room either way.
- **The transport is small on purpose** (Sophie rejected the big five-speed
  shuttle in the mockup: "just to keep playing the video"): a slim horizontal
  three-button pill — back 2s · play/pause · forward 2s — plus tap-the-strip
  to jump. Precision lives on the MARK, not the playhead: each mark row has
  −.1/+.1 nudges and tap-its-time-to-jump. Everything is a tap (wrist rule).
  **The transport sits CENTERED right under the video/audio card** (Aug 2026,
  Sophie: "so it's right there"), not in the bottom bar; the fixed bottom bar
  is just time + the MARK scissors. **Undo, render and "?" are SMALL header
  icons** (30px, top-right before the pill's reserved corner) — undo is a
  session-only snapshot stack (marks + drops, capped 40); renders never
  overwrite anything so they need no undo. In native builds the page hides
  its EYEBROW too (`body.native .eyebrow`) — the nav bar already says CUT
  MARKS and Sophie flagged the double.
- **TWO HAIRLINE TABS AT THE TOP — CUT · MARKS & PIECES (Aug 2026, Sophie:
  "tabs at the top and one of them is for cutting out of the video and the
  other tab is for looking at all the marks and pieces you've made").** The
  row is the first thing in the room, above the picture, and the two halves
  take turns on the WHOLE screen: **CUT** is the cutting — the video or the
  audio card, the transport, the strip — and **MARKS & PIECES** is everything
  she has made, the pieces, the marks and the finished Cuts, each under its
  own heading. Neither is stacked under the other, so neither is ever a scroll
  away, and the cutting tab does not scroll at all. It opens on CUT, and a
  recording always REOPENS on CUT whatever she left lit.
  - **The bottom bar (the time and the MARK scissors) is on both** — it is
    fixed chrome, and marking from either tab grows the lists.
  - **▶ on a piece, and a tap on a mark's time, hand her back to CUT** —
    "play this piece" means watch it, and both the picture and the playhead
    live there. The nudges (−.1/+.1) deliberately do not: she is working the
    list then, not looking at it.
  - **Nothing marked yet → the lists tab says so** rather than showing a blank
    screen; an old recording with renders and no marks still lists its Cuts.
  - **THE FIRST CUT AT THIS PUT THE ROW UNDER THE PLAYER** (the two lists
    taking turns *below* the strip, the instrument always on screen) and she
    rejected it: "no, you did that wrong… tabs at the top". Worth knowing
    because that shape needed real machinery to work — a JS-measured pane that
    scrolled inside itself, since a video is ~30vh and the list still ran off
    the bottom — and all of it went away when the tabs took the whole screen.
    A tab row that splits a screen needs no layout code; one that splits what
    is BELOW something does.
  - The piece row is ONE line (times · length · dropped), which came out of
    that first attempt and stayed: the stacked second line cost 12px a row for
    nothing. Test: `node scripts/test-cutmarks-tabs.js` (the real page,
    headless at 390x750, asserting on the SCREEN — what is reachable without
    scrolling — rather than on the markup).
- **Dropped pieces are keyed by the piece's times, and every mark edit REMAPS
  them by piece index** (`droppedIdxSet`/`setDroppedByIdx` in cutmarks.html):
  a nudge keeps the same pieces, an added mark splits one (both halves stay
  dropped), a removed mark merges two (merged piece stays dropped only when
  both halves were). Without the remap, nudging a boundary silently
  un-dropped the piece beside it — caught in testing, don't regress it.
- **Renders are exact cuts at the marked times.** Audio: one atrim+concat
  filtergraph with 12ms edge micro-fades so a manual cut never clicks — NO
  loudnorm (her voice rule), channels kept. Video: ONE `filter_complex`
  trim/atrim+concat pass with a single encode (libx264 veryfast, aac) —
  deliberately not per-piece files + concat demuxer, because concatenated
  AAC pieces add ~24ms priming per join and walk the sound off the picture
  (the Scratch Pad film finding). A soundless video renders video-only
  (`hasAudio` probed at open).
  **WHERE A RENDER GOES:** it never touches the original — it bakes a NEW
  file into Storage (`cutmarks/<id>/render-<ts>.<ext>`), adds it to the
  **Cuts** list on that recording (capped 8, newest first, nothing
  overwritten), and an AUDIO render ALSO files into the audio library
  (`forge-audio`, batch `cut-marks`, track `cutmarks`, md5-deduped) — so it
  lists on `/audio` and is reachable from the other rooms. Cut Marks' own
  pick list filters that batch back OUT, so a cut never reappears as a source
  to cut again. A VIDEO render stays on the Cuts list only (the audio library
  is audio). From a finished audio cut the scissors hand it on to the Cutting
  Room for pauses and filler.
- **Data:** one doc per file in `forge-cutmarks` (deckfactory),
  content-addressed by sha1 of the url (reopening resumes): `{ id, title,
  kind, source, seconds, hasAudio, marks:[t], dropped:[key], renders (capped
  8), job }`. `POST /:id/state {marks, dropped}` saves the whole marking
  state (the page debounces 600ms, flushes via sendBeacon on pagehide).
  Probe + render are background jobs on the doc (house rule); the page polls
  and resumes from `localStorage['cutmarks_open']`.
- **Routes** (STUDIO_TOKEN gate, only `/status` open): `GET /sources`,
  `GET /`, `POST /open {url, name, kind, itemId, poster}`, `GET /:id`,
  `POST /:id/state`, `POST /:id/title`, `POST /:id/render`, `GET /:id/job`,
  `DELETE /:id`. Tests: keptSegments/audioGraph/videoGraph are exported;
  render graphs validated against real files (exact durations), page flow
  validated headless (playwright).
- iOS: `CutMarksView.swift` = the Episode Editor wrapper pattern (native
  `.forgeToolBar("Cut Marks")`, chevron asks `window.__navBack`,
  `__nativeNavBar` hides the page back button, media paused on screen
  changes — `audio,video` both). Page carries the injected shared pill;
  native pill suppressed in RootView's `showAutoScroll`.

## YouTube auto-upload (witchy video channel)
- Finished videos post straight to Sophie's business YouTube channel as **private
  drafts** — she reviews in YouTube Studio and taps Publish. Nothing goes public
  automatically. Helper: `scripts/youtube_upload.py` (stdlib only, no deps).
  `python3 scripts/youtube_upload.py clip.mp4 --title "…" --description "…"
  --tags "a,b,c" [--privacy private|unlisted|public] [--short]`. Prints the video
  id + a `studio.youtube.com/video/<id>/edit` review link. Importable: `from
  youtube_upload import upload`.
- **Auth** = one OAuth "Desktop app" client + a durable **refresh token**, read
  from env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.
  The refresh token mints access tokens forever, so no re-auth per session. Scope
  is **upload-only** (`youtube.upload`) — it can post but not read the channel, so
  a `channels.list` call 403s by design. The OAuth app ("Secretly a Witch") is
  published to Production (unverified) so tokens don't expire in 7 days. Re-auth
  only needed if the token is revoked or a wider scope is required.
- **Shorts** need no special call: a **vertical 9:16 clip that is short** is
  auto-classified by YouTube as a Short. `--short` just appends `#Shorts`.
- **Voiceovers** use Sophie's ElevenLabs Instant Voice Clone "Voice A"
  (`voice_id` `TbXVSG5Ejm1c91umIzJN`, needs `ELEVENLABS_API_KEY`), model
  `eleven_multilingual_v2`, punchy settings (stability ~0.34, style ~0.45) and
  ~6% faster. Illustrated episodes render panels through the diary-comic style ref
  `refs/dream-mystery.jpg` (gpt-image edits) then animate with Wan (`VIDEO_MODELS`
  in `movies.js`). See also `what-sage-should-do-at-her-computer.md`.

## THE CLEAN EXPORT — standard for every FINAL video (Sophie, 2026-08-27)

**Any video that is the final version being exported for posting gets a
metadata-stripped CLEAN COPY, filed where she can download it.** Her ask,
made standing after the PWC reel: "make that standard procedure for any
video." (Images will get their own version of this later — not built yet.)

The procedure, start to finish:

1. **Strip with a stream copy — pixels must stay byte-identical:**
   ```
   ffmpeg -i final.mp4 -map 0 -c copy -map_metadata -1 \
     -movflags +faststart -fflags +bitexact -flags:v +bitexact -flags:a +bitexact \
     clean.mp4
   ```
   `-c copy` means no re-encode; `bitexact` keeps the muxer from writing its
   own encoder tag back in. **Verify, never assume:** the decoded video
   stream must hash identical before and after
   (`ffmpeg -i f.mp4 -map 0:v -c copy -f md5 -`), and `ffmpeg -i clean.mp4`
   must show no `encoder` line.
2. **File it into the Dump with a real filename** —
   `POST /api/drop/upload-file?session=&bundle=&filename=<name> - clean.mp4`
   with the raw bytes as the body. A real name matters: a Safari download
   otherwise lands as `too many men 2.mp4` (the lesson from the first time
   this was done, in `too-many-men-reel`).
3. **Hand her the direct save link** — `/api/drop/file/<item id>` downloads
   instead of playing. Every Dump item also has Save in the app.

**What this does and does not remove:** it removes the container metadata
(the `encoder: Lavf…` tag, handler names, creation times). Our own renders
carry no C2PA credential at all — measured by the `ai-media-detection` chat
with the official C2PA reader — because AI-generated source images lose
their provenance chunk the moment ffmpeg re-encodes them into frames. The
x264 SEI line inside the stream survives a stream copy, but it names an
encoder, not an AI.

**The paid-ads carve-out (ai-media-detection's finding): do NOT strip before
running a PAID ad.** On organic posts stripping is harmless-to-pointless; on
paid, provenance rules differ. When a film becomes an ad, upload the regular
export, not the clean copy.

**Aspect ratio: a 9:16 (1080x1920) reel is Instagram's native full-frame —
never letterbox it.** Black bars would shrink the picture inside the same
9:16 canvas and the bars ship as part of the film. The feed/grid PREVIEW
center-crops (~4:5 and the grid's 3:4) — that is how every reel behaves, and
opening the reel shows the full frame. Keep anything that must survive the
preview crop near the vertical center; do not "fix" the crop with bars.

### THE FIRST FRAME, ON ALL THREE DOORS (2026-09-11)

The last frame of one clip, pinned as the frame the next one starts on — the
continuity tool this draft keeps needing, and until this day it existed only
as `start_image` on APIFRAME, which the Footage page never sent. Every door
now takes the SAME two fields, **`firstFrameUrl` / `lastFrameUrl`**, and maps
them onto whatever it calls them on the wire. Read off each vendor's own docs
on the day; NOTHING here has been SENT — every check is a unit test or a dry
build of the request body, no clip was drawn and no money spent.

- **ATLAS CLOUD — a keyframe is a DIFFERENT MODEL ID.**
  `bytedance/seedance-2.0-mini/image-to-video` beside the
  `…/reference-to-video` this door has always used (the same pattern per
  family: `…/seedance-2.5/image-to-video` and so on). It takes `image` (the
  first frame, **required**) and an optional `last_image`, and takes **no
  `reference_images` / `reference_videos` / `reference_audios` at all**. Same
  price per second as reference-to-video, so nothing about the estimate moves
  — only which door can take the job. `atlascloud.js` swaps the id itself
  (`imageToVideoOf`) when a first frame rides.
- **OPENROUTER — `frame_images`**, each entry an `input_references` entry plus
  a `frame_type`: `{ type:'image_url', image_url:{url},
  frame_type:'first_frame'|'last_frame' }` (its own guide's example,
  verbatim). Its guide is explicit: *"If both fields are provided,
  `frame_images` takes precedence and the request is treated as
  image-to-video"* — i.e. `input_references` is **dropped, with nothing in the
  answer saying so**.
- **APIFRAME — unchanged.** `start_image` / `end_image` beside the reference
  lists, exactly as it always has; the shared names are read as aliases of its
  own `imageUrl` / `endImageUrl`. It is the one door that takes a keyframe AND
  references on one job.

**MEASURED 2026-09-12 (Sophie: "we're trying atlas"): ATLAS REFUSES A FIRST
FRAME PLUS A REFERENCE, ON THE POLL, FREE.** A raw probe from a container —
`…/seedance-2.0-mini/image-to-video` with `image` (her hooded still) AND
`reference_images` (a mansion still), 4s · 480p · 9:16 — was ACCEPTED on the
POST (`status:'processing'`, job `42bf07d7888b4e9885362198afc7dc87`) and came
back `failed` on the first poll with Atlas's own line: *"First/last frame
images cannot be combined with reference media (reference images, videos, or
audio) in the same request."* No `price`, nothing drawn. So the schema
reading above is the truth and the module's refusal at the door is right; the
line is a row in `video-refusals.js` now. **The same shape on APIFRAME the
same hour (job `1bbfdf17-271c-4555-9a80-7dbbf8958f6e`, `seedance-2-mini`,
`start_image` + one `reference_image_urls`) failed as "The input or output was
flagged as inappropriate"** — an AI-drawn hooded woman as the first frame and
a mansion as the reference — so whether APIFRAME honours a frame AND a
reference together is STILL unmeasured; its filter answered first. **A first
frame ALONE on Atlas Mini drew and opened on the exact upload** (job
`03d4d2afb6f5419b9c8b086b2d17ce89`, opening frame a 2.2/255 mean pixel
difference from the still she marked, 88s, image-to-video id, last frame
returned) — and, worth knowing, the identical still sent as a plain
REFERENCE seven seconds earlier also opened near-verbatim on it (3.3/255),
so on Mini a lone still reference already tends to start the clip; the flag
is what guarantees it.

**THE TWO SILENT DROPS ARE REFUSED AT THE DOOR, NEVER HALF-SENT.** A job
carrying a first frame AND references is refused on Atlas (its image-to-video
schema has no reference lists) and on OpenRouter (its own guide says the
references go), each with a line naming APIFRAME as the door that takes both.
A LAST frame with no first frame is refused on Atlas alone — its `image` is
required — and is sent as asked on the other two.

**THE DOOR CHOICE ASKS THE SHAPE BEFORE IT ASKS THE PRICE.** `doorTakes` in
`footage.js` is the rule and `doorFor` ranks only the doors that can take the
job at all, so auto can never send a keyframe job to a door that must refuse
it; with no door open for a shape the send is refused with **what to change**
("take the references off, or take the first frame off") rather than sent
half-dropped. `GET /estimate` carries `first` / `last` / `refs` so the price
and the DOOR she reads before the tap are the ones the tap really gets.

**A KEYFRAME IS NOT A SLOT.** A picture marked as the first or last frame
does not ride the reference lists, takes no `[ImageN]`, and the pictures after
it renumber as if it were not there — the ✕'s own rule from the other end,
through the same `cast-line.js` primitives, so a slot means one thing on that
page. Her prompt is renumbered, never reworded, and the toast says what moved.

**THE LOG KEEPS ONE VOCABULARY.** Every door writes `start_image` /
`end_image` into `params`, which is what `video-log.js` already reads into
`references.startImage` / `endImage` — so a chained clip is on the
1080p-redo reading list under the same name whatever door drew it, and the
exact-prompt rule is satisfied with no new field.

**ON THE PAGE** (`/footage`): a small flag on a picture reference's thumb
marks it — a press cycles none → first frame → last frame → none (the
tick-list's rule: a mark with nothing to aim at may cycle; it is not the
three-way TRACK the house rule forbids cycling on) — and the slot line under
the thumb says `first frame` / `last frame` in place of its name. A first
frame WITH other references draws a line under the strip saying plainly, in
her words, what the doors will do with it, BEFORE she taps; the line is not
drawn at all until the server has said which door, because a wrong line is
worse than a beat with none. A finished clip's **last-frame tile** opens the
frame big, and the two doors onto the next clip live there beside `save` —
**first frame** and **reference** — so chaining is two taps and no
save-and-re-attach. A belt hand-off may carry `firstFrame` / `lastFrame` urls,
and a url that is not among the references it handed over is ignored rather
than attached invisibly.

**WHAT IS UNMEASURED, PLAINLY:** whether ByteDance honours a `start_image`
and a reference list together on APIFRAME (unchanged from before, and the
reason APIFRAME is the fallback for that shape rather than a promise); which
Seedance models accept `frame_images` on OpenRouter (its guide's example is a
Wan model and it names no model list); whether a `last_frame` alone is
accepted there; and Atlas's image-to-video price against a real charge — it is
assumed equal per second to reference-to-video, off its own model list. Wan
3.0's image-to-video sibling is unmeasured on the Atlas door, so a keyframe on
Wan is refused rather than sent under a key nothing has read back.

Tests: `node scripts/test-video-keyframes.js` (the three build functions, the
shape rules, the log and the send — pure, nothing sent; verified failing 45 of
57 pre-fix), plus the keyframe blocks of `node scripts/test-footage.js`,
`node scripts/test-footage-handoff.js` and `node scripts/test-video-log.js`.


## Moved from CLAUDE.md (2026-09-14)

Moved here verbatim from `CLAUDE.md` on 2026-09-14 so that file stays readable;
CLAUDE.md keeps a one-sentence pointer per entry. Nothing was reworded.

### Footage

- **A SENT BLOCK STAYS — REVERTED 2026-09-25 (Sophie: "yesterday i said get
  rid of sent boxes · revert that pls").** For one day (2640, 2026-09-24) a
  block whose clip really went took itself off the page (`dropSent`). She
  asked for that back: a sent block stays in the box, wearing its red
  **sent**, exactly as before — the words and pictures are still on the
  clip's card, and the block is hers to keep, reuse or take off with its
  own ×. Do not rebuild the auto-remove without her word.
- **Footage** (`footage.js`, `/api/footage`, page at `/footage`, iOS tile
  under the FILM filter's pictures stage — 2026-09-09, Sophie: "the next step
  is to build a point so I can just make things on my own time by describing
  them or uploading references") — **she sends a Seedance clip herself.** The
  chat ritual as a page: her words in the box, references through the Dump
  (each wearing its slot name — tap `[Image1]` and it lands in the prompt, so
  a reference is named by its slot and never described), the model, the
  seconds, the size, the shape, the price of the tap, and **the star, which is
  the one button and sends on its tap**.
  **WAN 3.0 IS ON THE PAGE — TWO ROWS, ATLAS ONLY, THREE ENDPOINTS BEHIND
  EACH (2026-09-17, Sophie: "wan endpoints atlas" · "allow robert pattinson"
  · "3.0 30s?").** `Wan 3.0` and `Wan 3.0 Prime` sit after 2.5 in the model
  box: 2-30 seconds in ONE pass (the picker now runs 2 · 4 · 8 · 12 · 15 · 20
  · 30, each model narrowed to its own range, so 2.5 finally reaches its 30
  too), 480p / 720p / 1080p, no 21:9, ten pictures + five videos + five
  audios (`atlasCaps` on the row; Seedance's 9/3/3 did not move). Atlas
  carries `alibaba/wan-3.0/{text,image,reference}-to-video` and the same
  three under `wan-3.0-prime`; the row holds the reference id and
  **atlascloud.js picks the endpoint from the shape** (`wanEndpointOf`): no
  reference → text-to-video, a first frame → image-to-video (`image` +
  `last_image`, no `ratio`, and references beside it are REFUSED rather than
  dropped, `refers` not being in that schema), references or a script file →
  reference-to-video. The log's `model` is the id that really went out and
  `rowOfDoorModel` folds it back onto the row (which also fixes an Atlas
  Seedance keyframe clip reading as a raw string in `cardOf`). **THE PRICE
  IS THE SAFE DIRECTION, NOT ATLAS'S PAGE:** Atlas lists one flat 4¢/s (5¢
  list; Prime 6.1¢ / 6.8¢) "uniform across resolutions", but Alibaba's own
  ladder is 5 / 10 / 20¢ and Atlas billed Seedance by resolution behind a
  flat figure once already, so `resScale` quotes ×2 at 720p and ×4 at 1080p
  until a real 720p charge is read; the one measurement is 15s 480p = 60¢.
  A 30s clip is ~$1.20 at 480p. **WHY THE ROW EXISTS — the famous face.**
  That evening Seedance Mini on Atlas drew *"a guy that looks suspiciously
  like robert pattinson, but isn't actually him"* twice and blocked *"a
  robert pattinson lookalike contest"* at the OUTPUT gate (copyright, drawn
  then refused, free) — the same minute. Nothing in this repo blocks a name;
  ByteDance's output gate does, sometimes. Wan 3.0's docs say nothing about
  faces and its one job took four person references without a word; whether
  it draws a FAMOUS face is UNMEASURED, and a 2s 480p text-to-video clip
  (~8¢) on her go is the measurement.
  **MEASURED THE NEXT MORNING, AND IT IS A REAL-FACE GATE ON BOTH ENDS —
  `docs/wan-face-gate-2026-09-17.md`.** Three free refusals: a text-only
  `robert pattinson buying oranges` drew for 3m46s and was then blocked
  (*"The output content is suspected to include real human faces"*), his own
  photograph as a reference was blocked on the way IN with the same sentence,
  and an m4a reference sound was refused for its container (Alibaba takes wav
  and mp3 only — `atlascloud.js` now refuses one before sending). So Wan 3.0
  is the opposite of Seedance here: Seedance takes a real person and blocks a
  famous one, Wan blocks any real face either way. Every `alibaba/wan-*` id is
  a passthrough to Alibaba Model Studio and shares that gate, Prime included;
  **THE ROW THAT DOES TAKE HIM AND SPEAKS — `MiniMax H3` (2026-09-17, Sophie:
  "add minimax model we're using").** `minimax/h3/reference-to-video`, the
  standard tier: a still of the person plus a short clip of their voice as
  references, the prompt saying the line, 5-15s, any of the page's shapes,
  480P/768P (MiniMax's own words, the SHORT side — the row spells them
  lowercase and `atlasRes` puts the capitals back at the door; 768p leads the
  list). Measured 40¢ for 5s at 768P (`resScale` 2.1 over the 3.8¢ list),
  no sound flag (it always draws sound), `atlasCaps` 9/9/9 because its schema
  states none. **AND `upscale 2K` ON EVERY FINISHED CARD** (same day, "add
  upscale button to footage" · "can we upscale later if we like it ·
  pipeline"): `POST /api/footage/jobs/:id/upscale {resolution:'2k'}` sends the
  clip's url through `atlascloud/video-upscaler` on the Atlas module's TOOL
  door (`buildToolRequest` — a lip-sync or an upscaler takes a finished clip,
  no prompt) and files the answer as a NEW card beside the source (`parent`,
  `upscale` on the doc; `cardOf` reads it as "Upscale 2K" with the source's
  seconds and shape). `upscalePlan` is pure and refuses an unfinished clip,
  an upscale of an upscale, and any size but 2k (1080p is unmeasured and not
  offered). Measured: 5s 768x1024 → 1664x2216 in 35s for 14.4¢ (2.9¢/s, the
  page's `UPSCALE_CPS`), sound and words untouched — and NO SHARPER: it
  enlarges, it cannot put back what the source's encode dropped. So the
  pipeline is draw at 768P, keep, upscale the keepers. Tests: the MiniMax and
  upscale pins in `scripts/test-footage.js`, `scripts/test-atlascloud-tools.js`.
  the one Atlas hosts ITSELF — `atlascloud/wan-2.2/image-to-video`, 3¢/s,
  organization `ATLASCLOUD`, the open weights — is the Wan with no policy
  layer in front of it, and it is unmeasured.
  **HER OWN LIST THE SAME DAY IS WHY THE PAGE LOOKS LIKE THIS (2026-09-09).**
  "no button word labels above (eg seconds)" — every uppercase section label is
  gone and the controls stand on their own. "consolidate buttons. same row
  unless it bleeds over" — every row is flex-wrap, so a group wraps only where
  it genuinely does not fit, and nothing declares a row count (MEASURED at
  390pt with the pill's 62px column reserved: the six shapes are 267px of the
  278 the panel has, so they are one row; with no pill on screen the whole
  control set is one row). The Add word is a **picture icon** (Lucide `image`
  in a rounded square at the house 6px, never a circle). Resolution and shape
  are **drop-downs** with the platform's chrome off (`appearance:none`) and our
  own inline chevron drawn in. **THE MODEL IS A DROP-DOWN OF THE WHOLE 2.x
  FAMILY — MINI · FAST · 2.0 · 2.5 (2026-09-11, Sophie: "ok add 2.0 and
  2.5"; Fast came back 2026-09-10, "add 2.0 fast back as an option").** It was
  pinned to Mini alone one morning ("get rid of the model choice · just mini
  for now"): **`PAGE_MODELS` in `footage.html` is the one line**, Mini leads
  and is the default, and taking a row off again is that array. **1.5 Pro
  stays off — it is on APIFRAME only.** The list is still DERIVED (a model
  must be in `PAGE_MODELS` AND on at least one live door — it used to require
  ATLAS specifically, which with the door chosen by price would take a row off
  the page for being missing from a door that is not even the cheapest one for
  it), a belt
  hand-off's `model` is honoured when the page offers it and falls to Mini when
  it does not, and the seconds and the size re-validate against whichever model
  is picked. **THE MODEL IS NOT STICKY, and that is a change from before the
  pin:** Fast is ~8x Mini a second on Atlas (36¢ against 4.4¢ for a 4s 480p
  clip), so a Fast left over from last week silently drawing today's clip is
  the hidden ingredient the seconds and the resolution are already kept
  unsticky for — the page opens on Mini every load and Fast is her own tap
  (sticky is hers to ask for). **And Fast is the STRICTER of the two** — its
  output gate has refused a plain reference-free prompt with the copyright line
  (free, unbilled, measured 2026-09-09) where the same words drew on Mini — so
  the "?" card says so. The controls row wraps to two lines at 390pt with the
  model back on it, which is `flex-wrap` doing what her "same row unless it
  bleeds over" asks. **Same
  day, bugs fixed on this page:** a slot tapped with the caret at the start of
  the box landed at the END (a null `selectionStart` check, not a 0 check);
  the references strip, the folds and the seed box were hidden until `/status`
  answered; the draft was WIPED on send while the words stayed in the box (a
  reload then lost them — the words stay, so the draft stays);
  `resize:vertical` fought `fitBig`; and a card first drawn in TILES view
  never got its "… more" (the Playground's own `resyncClamps` rule). Server
  side, `ensureVideoFloor` PROBED and DOWNLOADED every reference video on
  every send despite the "baked once" promise — the decision is banked now
  (`floorDecided` in memory, a sidecar under `footage/upscaled/<sha1(url)>.json`
  across restarts). **THE SECONDS ARE A DROP-DOWN OF FOUR —
  4 · 8 · 12 · 15 (2026-09-14, Sophie: "seconds drop down · 4,8,12,15
  only").** A typed number with a -/+ stepper made every length in the range
  reachable and none of the four is where she actually cuts. `SEC_STEPS` is
  the one list and the rows are it NARROWED to the model's served `secs`
  range, never a hardcoded 4-15, so a model with a tighter range offers fewer
  rows rather than a length the server would clamp. `clampSec` SNAPS to the
  nearest offered row rather than clamping to the range — a stored 9, or a
  belt hand-off naming one, has to land on a row the picker really has or the
  box shows one number while `S.seconds` holds another (the hand-off
  fixture's 9 lands on 8). Typing, the stepper and the clamp-on-blur rule
  that protected a "1" on its way to "12" are HISTORY. **Sound is always on**, sent explicitly rather than left to the model's
  default. And **what is left lives behind the "?"**, read live when the card
  opens — it is a fact about the account, not a control, and it was sitting
  where the price of the tap belongs; OpenRouter's balance only, since APIFRAME
  is not this page's door.
  **WHICHEVER DOOR IS CHEAPEST, CHOSEN BY THE SERVER (2026-09-11, Sophie,
  adding 2.0 and 2.5: "are they cheapest through router, atlas or frame?
  choose cheapest").** This SUPERSEDES the 2026-09-09 "make atlas the default
  and only route through footage" — which was right while the page offered
  Mini and Fast, because Atlas IS far the cheapest for those two and simply
  wins the ranking. It is not the cheapest for the two big rows, so with them
  on the page the pin would be spending her money to keep a rule that was only
  ever about price. **Measured live 2026-09-11, one 4s 480p 16:9 clip, off all
  three doors' own prices:** Mini **4.4¢ Atlas** · 13.6¢ OpenRouter · 16¢
  APIFRAME; Fast **10.8¢ Atlas** · 16.3¢ · 28¢; 2.0 **27.2¢ OpenRouter** · 32¢
  APIFRAME · 36¢ Atlas; 2.5 **41.6¢ OpenRouter** · 52¢ APIFRAME · 53.6¢ Atlas.
  The split is Atlas's sale: 80% off Mini and 70% off Fast against only 20% off
  2.0 and 2.5. So the page sends `door:'auto'` and `doorFor` ranks the doors by
  what THIS tap costs — the shape, the resolution, the seconds and a reference
  video all move the answer, so nothing is written down.
  - **AND THE OTHER DOORS ARE ONE TAP, PRICED (2026-09-12, Sophie, on an
    OpenRouter refusal: "my job got refused. send it through atlas").** The
    refusal named the doors that would take it and the page had no way to DO
    that — it pins `auto` and nothing else — so the only route through was
    retyping a fifteen-second scene somewhere else. The refusal line grows an
    underlined door word per door that can still take THAT exact job, with
    what the tap costs beside it; tapping one re-sends the same job pinned to
    it. **Still always HER tap, never a walk** — the rule below stands word
    for word. Offered on a CONTENT refusal only (a shape refusal is refused
    wherever that shape is; a door being down says nothing about this job),
    the doors read off free `/estimate` calls so one is never offered that
    would only refuse her again, and the server returns which door refused it
    so that one is not offered back (an older cached page falls back to the
    door the price line named).
  - **AND A REFUSED JOB IS LOGGED (2026-09-12, Sophie, after an OpenRouter
    refusal cost her a fifteen-second scene: "can you log refuse jobs?").**
    It was the one thing that left no trace anywhere: every door throws
    inside `startVideo` BEFORE `forge-video-jobs` is written, so her prompt
    and her references lived only in the box she typed them in — which is
    why a chat could not re-send one for her, and why closing the page lost
    the scene. `startJob`'s catch files it now through
    `videoLog.refusedRecord` — the same prompt, the same references, the
    same project and folder tags — so the 1080p redo reads it like any other
    clip and the card's own **Try again** puts her words back. Three things
    not to undo: the status is **`failed`, never a new word** (every reader
    already knows that one, and a page cached on her phone draws an unknown
    status as a clip that draws forever), `refused`/`refusal`/`door` ride
    beside it so the card can tell a refusal from a failure and offer the
    other doors, and the write is **best-effort and caught** — a log that
    fails must still let the door's own words reach her, unchanged. Test:
    `node scripts/test-footage-refusal-log.js` (every assertion a
    MEASUREMENT of what really landed in the store; verified failing 14
    pre-fix).
  - **A REFUSED JOB FAILS. IT IS NEVER SENT THROUGH ANOTHER DOOR, AND NEVER
    DRAWN WITHOUT ITS REFERENCES (2026-09-11 evening, Sophie, looking at three
    APIFRAME clips: "i think these r being sent without references" · "if a
    job refuses references it should just fail … never sent without
    references ever ever ever" · "when I send a job through a chat, it just
    says that it was refused if the references didn't go through — why can't
    the same thing happen through footage?").** Footage does what a chat does
    now: auto picks the cheapest door, ONE send, and a content refusal is the
    card's answer ("refused, nothing drawn or charged"); which door to try
    next is hers. **The WALK that shipped that morning is history** — a
    chain of every other door on the POST, and `walk`/`walkPlan`/`walkOn`
    re-sending on the poll. It put all six of the day's APIFRAME jobs there,
    and **on 2.0 APIFRAME does not refuse a real face — it SILENTLY DROPS
    EVERY REFERENCE, draws a stranger, reports COMPLETED with our urls echoed
    on its own record, and bills (~32¢ each).** Measured on all three 2.0
    jobs: with an AI-drawn face and a dress as references (18:13) it honoured
    both; with her real jazz VIDEO among them (06:43) it drew a blonde
    stranger; with her real PHOTO among them (21:14) it drew a stranger and a
    box matching neither box picture, while Atlas Fast drew the identical
    three references exactly. On 2.5 the same check refuses on the poll
    instead. There is nothing on an APIFRAME job to catch — so a chat pinning
    APIFRAME with a real person in a reference on 2.0 gets a clip that looks
    done and is not; Atlas is the door for a person. **And the first two
    readings of this were wrong the same way:** the page log, the server's
    own params and APIFRAME's job record all said the references were sent,
    and they were — a record of what was POSTED says nothing about what the
    model was given. **Compare the clip to the reference before saying a
    reference rode.** Tests: the refusal blocks of `node scripts/test-footage.js`.
  - **A PINNED DOOR NEVER FALLS BACK** — a refusal on a door a chat named is a
    measurement, not a reason to spend elsewhere. Only `auto` ranks and walks.
  - **THE PRICE LINE NAMES THE DOOR AGAIN.** It came off 2026-09-09 only
    because one door was left to name; which door a tap goes to is a fact about
    the CLIP as well as the bill — **the last frame rides on Atlas alone**, so
    a 2.0 or 2.5 clip has none.
  - **A FAILED ATLAS PRICE READ KEEPS THE LAST GOOD PRICES** (`atlasPrices`).
    It used to fall back to the table's LIST rate, which was only a high figure
    on screen when Atlas was the one door and is now a DOOR CHANGE: every Mini
    job would go to OpenRouter at 3x the real price (13.59¢ against 4.40¢) for
    the ten minutes the cache holds, silently.
  - **AN OPENROUTER PRICE IS `exact` ONLY WHERE THE CANVAS IS MEASURED**
    (`canvasMeasured`, Mini alone). The token count is w × h × frames, so the
    price is only as pinned as the canvas — and the published table has been
    wrong once already, which is how Mini's was found. Fast, 2.0 and 2.5 answer
    "about" until a real charge is read against one.
  The "?" card quotes no balance (Atlas has none to read — the console is the
  only billing read) and says "2.0 Mini is 80% off right now" while there is a
  sale. A content refusal that reaches HER has been through every door, so the
  page says so rather than naming one to try next. **720p IS THE PIXEL RATIO DEARER THAN 480p, AND THE PAGE QUOTED
  THEM THE SAME UNTIL 2026-09-10 (Sophie: "check 720p prices in footage").**
  Atlas's `GET /models` publishes ONE flat `base_price` per model, so the
  Atlas branch priced purely per second, ignored the resolution it was handed
  and marked it `exact` — measured wrong three ways: Atlas's own model readme
  says "final billing follows the active model pricing configuration for the
  selected **resolution**, duration, account, and environment"; the one 720p
  job on file (12s Mini 3:4, one reference video) spent **435,628 tokens
  against 197,811** for the identical 480p job, i.e. **2.20x**; and APIFRAME,
  which does publish per resolution, prices its own 720p at the pixel ratio on
  every row (Mini 4→9¢/s, Fast 7→16, 2.0 8→18, 2.5 13→29). So Atlas's rate is
  read as a **480p rate** and scaled by the canvas (`resFactor`, per SHAPE —
  16:9 is 854×480 → 1280×720 = 2.2482x, 3:4 is 560×752 → 834×1112 = 2.2021x,
  which is what the token count is made of). What that moves, at Atlas's live
  sale: a 4s Mini 720p clip 4.4¢ → **~9.7¢**, and **2.5 at 720p ~$1.21 for 4s
  / ~$4.52 for 15s** against 53.6¢ / $2.01 before — so for step 2 of the plan
  **APIFRAME is slightly CHEAPER than Atlas at 720p on 2.5** ($1.16 / $4.35),
  because the 80%-off sale is Mini's and 2.5 only gets 20% off there.
  **AND NOTHING ON ATLAS IS PINNED — the price wears a "~", at BOTH
  resolutions (2026-09-10, Sophie: "add ~ to both").** Atlas has no billing
  API (her console is the only read), so every Atlas figure answers `about`.
  **THAT IS WRONG AS OF 2026-09-12 — ATLAS DOES PUBLISH A BILLING API, AND
  SHE FOUND IT (Sophie: "I checked, and Atlas Cloud does have a proper
  Billing Public API. I was wrong in my previous answer").** Read off its own
  docs the same day: base `https://api.atlascloud.ai/public/v1`, the same
  `Authorization: Bearer apikey-…` header, three reads — `GET /balance`
  (`{value:"125.500000", currency:"usd"}`, money as fixed six-decimal
  strings), `GET /model-usage` and `GET /model-costs` (daily buckets;
  `start_date` inclusive and `end_date` exclusive, YYYY-MM-DD, up to 180
  days; optional `scope` self|account, `group_by[]` model_type|model|api_key,
  `model_types[]` text|image|video, `model_ids[]`, `api_key_ids[]`, `limit`
  1-1000 and a `page` cursor from `next_page`; 429 carries `Retry-After`).
  **BUILT 2026-09-12 ON HER GO** — `atlascloud.js` carries the reader on its
  own `BILL_BASE` (`/public/v1`, deliberately a SECOND constant: pointing it at
  the generation prefix 404s every read and that is invisible in the source).
  `GET /api/atlascloud/balance` (60s cache), `/spend` and `/usage` (5 min;
  `?days=7`, `?model=`, `?group=`, `?fresh=1`). The walk PAGES on `next_page`
  — a read that stops at `has_more` under-reports what she has spent — and the
  180-day range is refused HERE rather than at Atlas, free and in the rule's
  own words; a 429 hands its `Retry-After` on rather than being retried inside
  the reader.
  **THE TWO SHAPES ARE MEASURED OFF HER OWN LIVE ANSWER, AND BOTH DIFFER
  STRUCTURALLY FROM ATLAS'S PUBLISHED EXAMPLES (2026-09-12, read back the hour
  the reader deployed).** Written from the docs alone it answered
  `left:null` and `total:0, rows:1, priced:0` against two 200s — the prefix and
  the key were right and every figure was a confident zero. Both are pinned by
  fixtures lifted verbatim now:
  - **MONEY IS A NESTED OBJECT IN NAMED POCKETS, not a top-level string.**
    `/balance` answers `{available, cash, bonus, subscription_bonus, frozen,
    credit_grant}`, each `{value:"23.555722", currency:"usd"}`. **`available`
    is the pocket she can spend** — `cash` alone misses a bonus, and totalling
    them all counts frozen money she cannot spend. `String({value})` is
    `"[object Object]"`, which is exactly what the first wiring filed as her
    balance.
  - **A `/model-costs` ROW IS A DAY BUCKET, NOT A CHARGE.**
    `{object:'model_cost.bucket', date, start_at, end_at, covered_until,
    partial, results:[{model:{id,name,type}, amount:{value,currency}}]}` — so
    a reader that priced the ROW found nothing, and the model's own NAME lives
    one level in. One row can hold a whole day's models (hers held five).
  - **TODAY IS `partial:true` WITH A `covered_until` A FEW MINUTES BEHIND
    NOW**, so the figure is honest-but-behind while she is still drawing —
    the "?" card says **"so far"** rather than a timestamp.
  **WHAT ONE DAY REALLY COST, the first real read (2026-09-12): $20.12** —
  Mini reference-to-video $13.83, 2.5 $4.02, 2.0 $1.35, Mini image-to-video
  $0.60, Fast $0.33 — against $23.56 left. A money field is hunted across
  `BAL_KEYS`/`COST_KEYS` and one level into a wrapper rather than trusting one
  spelling, the whole `/balance` body rides back as `body`, and any row nobody
  could price rides back as `unpriced`: a total of zero beside rows that really
  came back is the one wrong answer this must never give quietly. **`money(null)`
  is a finite ZERO** (`Number(null) === 0`), so an absent field is refused
  before it is read as a real charge of nothing.
  On `/footage` the "?" card's top line is now **what is left on every door
  plus what today really cost** (`GET /api/footage/spend` — Atlas only, and it
  says so, because the other two publish a balance and no history), so the
  2026-09-09 note that "Atlas has no balance to read" is WRONG and is corrected
  in the page, in `balances()` and in `test-footage.js`. **A DAY TOTAL IS EXACT
  WHERE A CLIP'S IS NOT** — Atlas stamps no job id on a charge — so the
  per-tap figure keeps its `~`. Still not built: `cost` filled in per job on
  `forge-video-jobs` (it cannot be joined exactly), and cost per PROJECT, which
  needs a key per project first. Test: `node scripts/test-atlas-billing.js`.
  **AND THE PRICE LINE SAYS HOW LONG THIS SHAPE USUALLY TAKES (2026-09-12,
  Sophie: "also make it say the average time it has taken for things to draw at
  that exact size and length, etc.").** `drewMs` — the DOOR's own latency, on
  every card since 2026-09-10 — existed nowhere she could use it BEFORE a tap,
  and a 15s 2.5 clip and a 4s Mini clip are minutes apart. `GET /estimate`
  answers `drew` beside the price (one read of the log, cached 5 min, grouped
  by door · model · resolution · ratio · seconds) and the page draws *usually
  ~1m 10s* on its own small line under the price — a block inside `#cost`, so
  the row grows in HEIGHT and never in width (MEASURED at 390pt: a fifth thing
  ON that line wraps `clear`/`undo` onto a line of their own). Four things not
  to undo: it is the **MEDIAN, not the mean** — the one deviation from her
  word, because one clip that sat in a queue drags a mean minutes off what the
  next tap will do (the mean rides along on the answer and in the tooltip, so
  nothing is hidden); the **ladder loosens one fact at a time and SAYS which
  rung answered** (exact → ratio → door → size), a borrowed figure adding
  "· similar clips" rather than claiming to be this shape's; **a rung with
  fewer than three clips yields to a fuller one** and is used only as a last
  resort, since one clip is not a "usually"; and **a shape nothing has drawn
  says NOTHING at all** (the Assets tab's silence rule) rather than showing the
  last shape's figure. `drawKeyOf` refuses a doc with no `model` — `x.or ===
  d.model` on a doc with none matches undefined against undefined and buckets
  that clip under a model it was never drawn on. Test:
  `node scripts/test-footage-draw-time.js`.
  **AND APIFRAME HAS NOTHING TO BUILD (checked the same day, her ask: "check if
  API frame has something and build that if it does").** Its own docs publish
  `GET /v2/me` and no billing, credits, usage or history endpoint at all — and
  `/me` has been wired since 2026-08-27 as `GET /api/apiframe/me` (that
  module's own comment: "every other billing read 404s, measured 2026-08-27").
  So its balance is already on the "?" card and there is no spend history to
  read. OpenRouter is the same shape: a balance
  (`GET /api/openrouter/credits`), no history.
  **HER "~" STAYS, BUT THE ESTIMATE HAS NOW BEEN READ AGAINST REAL CHARGES
  AND IT IS RIGHT (2026-09-11, she exported her Atlas cost history).** 117
  charges over 40 hours, joined to `forge-video-jobs` by time, 106 of them
  paid: the page's number lands within a few percent on every shape with
  enough jobs to trust — Mini 12s 480p 3:4 real/estimated **1.008** (n=7),
  Mini 15s 480p 16:9 **1.025** (n=12), Fast 15s 480p 3:4 **0.992** (n=6),
  2.5 at 15s and at 30s **1.02** each. **And the pixel scaling is confirmed
  to 0.2%**: Mini 3:4 billed 1.11¢/s at 480p and 2.44¢/s at 720p (an 8s and
  a 12s clip agreeing), a factor of 2.198 against `resFactor`'s 2.2022 — so
  the 2026-09-10 reasoning that resolution is a billing dimension Atlas does
  not publish was correct. **A refusal is free, confirmed again:** 10 of the
  117 rows are $0.00. The shapes that read 1.4-2.3x are all single jobs whose
  charge could not be matched to the right job — **Atlas stamps no job id on
  a charge**, so a burst inside one minute cannot be joined exactly, which is
  also why this can never be pinned to `exact` from the console alone.
  **WHAT THE 40 HOURS ACTUALLY COST: $24.75** — Mini 99 jobs $14.07, 2.5
  **3 jobs $6.17** (two drawn clips, a quarter of the bill), Fast 14 jobs
  $3.92, Wan 3.0 one job 60¢. **The bill is SECONDS, not the model**: 15s is
  Mini's max and **69 of the 99 Mini jobs are at it — $10.85, 77% of the
  Mini spend and 44% of everything** — 16.6¢ a clip against 4.5¢ at 4s. The tilde is the
  compact form of the WORD she cut the day before ("just see the price not
  'about'" — it fired on nearly every job and spent a line saying the same
  thing every time); one character costs nothing and still says the number is
  not a promise. **ONE RULE ABOUT THE PRICE ON THIS PAGE: a real charge is a
  number, an estimate wears a `~`** — so the card marks one too (falling back
  to `estimate` because the door reported no `cost` IS the unpinned case, and
  it is the standing case on Atlas), or the send line and the card under it
  would print two different things for the same clip. `#cost`
  `dataset.about` still carries the flag, pinned by a test. **What would
  settle the factor is one console read**: the 12s 720p Mini clip of
  2026-09-10 was quoted 13.2¢ and should read ~29¢ beside the 480p ones.
  **NOT BUILT and hers to ask for: Atlas's SR tiers** — `720p-SR` /
  `1080p-SR` / `1440p-SR` generate one rung down and upscale with FlashVSR,
  which its own docs call a lower-cost HD option; the page offers native
  480p/720p only, and 1080p is not native on Mini at all. **OpenRouter and APIFRAME
  are still doors and `footage.js` keeps them** — a chat pins either by hand,
  and the module's own AUTO is Atlas first with APIFRAME behind it for a
  refused face (re-sent with a note saying so on the card), OpenRouter for a
  shape Atlas does not price (2.0 at 1080p).
  **PLAN BEFORE GO IS HISTORY (2026-09-09, "no plan button").** She asked for
  it the day before — "plan before go" — and retired it within the day: the
  first button used to open a read-back card under the controls (her words
  verbatim, every reference by its slot, model · seconds · resolution · shape ·
  sound · door, "This tap: about N¢") and Go was a second tap. Now the star is
  the one button, the price sits beside it and her words are in the box above
  it, so the read-back is on screen AT the moment of the tap rather than behind
  an extra one. **Don't build the card back** — and nothing else may send
  either: the failed card's "Try again" puts the clip back in the box and stops
  there. (A second chat built the same tool as `/motion` the same hour — PR
  #2231, tag `motion-page-3f0fce9` — and it was NOT merged: one ask, one tile.)
  **THE FEED HAS THE PLAYGROUND'S SEARCH AND ITS FILTER DRAWER (2026-09-11,
  Sophie: "add a search button and filter like playground" · "single
  magnifying glass button that expands" · "yea footage" · "filter is sub menu
  of glass · only one main button").** A GLASS in its own box beside the ♥/✕
  pair: a tap opens the field (on the folder's line, after the funnel) and
  lights the glass in INK — a door, not a mark; shutting it CLEARS the words,
  since a query she cannot see must never go on hiding clips. The ✕ inside
  the field wipes the words and keeps her in it. **THE FUNNEL IS NOT BEHIND
  THE GLASS ANY MORE — IT SITS BESIDE THE FOLDER, ALWAYS (2026-09-25, Sophie:
  "where is the filter button in footage · shud be next to the folder").**
  From 2026-09-11 to 09-25 it was the glass's sub menu ("filter is sub menu of
  glass · only one main button"): it came and went with the field, and the
  glass wore the count while it was tucked away — and she could not find it.
  Now the folder, the funnel, the search field and the drawer are ONE flex
  item of the bar (`.narrow` in `footage.html`), and that wrapper is the whole
  trick: MEASURED at 390pt the bar's one line was full to the pill's column
  (view switch, ♥/✕, glass and folder ran 12→315 against a pill at 324), so
  a fifth control cannot fit on it, and a bare flex-wrap would have dropped
  the funnel ALONE to the next line, under the view switch and nowhere near
  the folder. Wrapped, the pair drops TOGETHER: at 390pt the bar is view ·
  ♥✕ · glass, then folder · funnel (the field beside them when the glass is
  open); on a wider screen it is one line. The funnel wears its own count
  (the shell's) and is lit while anything is on; the glass is lit only while
  it is open. The mount stays `display:contents` so the shell's tap-out still
  sees every row of the drawer, and the 58px pill reserve rides on the row.
  **AND A FOURTH ROW, TRIMMED (same day, "add a filter for trimmed clips")** —
  `Trimmed · Not trimmed`, one lit at a time, sticky under `footage_filt_trim`,
  reading `bakedParts` (the tile's own scissors rule: a part still baking or
  failed does not count), so the filter and the scissors chip can never
  disagree about which clips are trimmed. The house grammar, searched as she dictates (`/feedkit.js`); the loaded
  feed is narrowed AT ONCE and a beat later the server answers over the WHOLE
  log — `GET /jobs?q=` filters before the page is cut, up to 300 hits, and a
  hit the feed never paged in lands as a card like any other (the Assets
  tab's truncate lesson). **ONE haystack, `footage-hay.js`** — loaded by
  footage.js and served to the page (the clip-diff.js pattern), so the client
  filter and the server search read the same words: the prompt, the model's
  label and id, the door, `4s`, the size, the shape, the project, `seed N`,
  the status, `trimmed`, `video ref`, `first frame`. The `… older` door is
  off while a search stands (there is no page under a whole-log answer). The
  **AND THE ROWS ARE DROP-DOWNS HERE (`layout:'drop'`, 2026-09-18, Sophie:
  "buttons shud be drop downs to minimize space")** — one line of named doors,
  `MODEL ⌄ · RESOLUTION ⌄ · WHEN ⌄`, each opening its own chips, one at a
  time. MEASURED at 390pt: 34px of drawer at rest against 266px of chips, so
  the composer's Go button and the first clip stay on screen with the funnel
  open. The shell owns the shape (*THE ADVANCED SEARCH DRAWER* in
  `docs/chats-app.md`); this page owns the one word that asks for it.
  The
  funnel is `/searchfilters.js`, the one shell, with this page's three rows —
  MODEL (the `PAGE_MODELS`, several at once), RESOLUTION (`PAGE_RES`, the rung
  the clip came out at), WHEN (the shell's own days-back chips) and, since
  2026-09-25, TRIMMED (`bakedParts`, one chip lit at a time) — sticky
  under `footage_filt_*` like the ♥ and ✕ beside them; an emptied feed names
  which of them emptied it. Both stay OUT of the drawer (her 2026-09-02 word).
  **RESOLUTION IS THE QUALITY ROW, AND THERE IS ONLY ONE OF THEM (2026-09-18,
  Sophie: "add a filter by model and quality and resolution in footage").** A
  clip carries no quality field the way a picture does — MEASURED over her 200
  newest clips, a card's facts are the model, the resolution, the shape, the
  seconds and the door, and nothing else — so on video the quality IS the
  rung, `480p · 720p · 768p · 1080p · 2K`, and the TIER she picks between
  (Mini against 2.5 against Wan Prime) is the MODEL row that was already
  there. 2K is on the ladder although no model draws it: it is what the
  upscaler makes out of a finished clip. **AND THE RUNG IS CASE-FOLDED**,
  which is not tidiness: MiniMax writes its own resolutions in CAPITALS and
  the door stores what it was sent, so **27 of those 200 clips are on file as
  `480P` / `768P` against 157 lowercase** — a chip matching the literal string
  would have hidden a seventh of her feed while reading as a filter that
  works. (Two values on file match no chip and are meant to: `1440p-sr` from a
  chat's developer-tier MiniMax job, and the empty string on a lipsync clip.)
  **AND THE PROJECT IS A FILTER TOO — A SEARCH INSIDE ONE SAYS HOW MANY IT
  FOUND OUTSIDE IT (2026-09-15, Sophie, standing in "Secretly a Witch" with
  `cider` typed and "Nothing matches that." under it: "where r the rest of my
  clips???").** The project narrows the feed AND the search — `projQ()` rides
  the search read and `shown()` drops a card of another project — and from
  down at the feed it is the one filter with no chip, no light and no count,
  so an empty answer reads as a lost library. **Measured on her live log that
  morning: 90 of her 500 clips carry NO project at all, 53 of them sent the
  day before** — the Christmas commercial she was searching for — because the
  project stamps at SEND time (`project: S.project` on the POST) and she was
  in All when she sent them; they are not lost, they are in All. The
  narrowing STAYS, because a project is what she asked the picker for; what
  was missing is the number. `outsideCount` (footage.js, pure and exported)
  counts the matches outside the project/folder over the whole collection the
  read already holds and rides back as `elsewhere` — free, no second read —
  and the page draws the house underlined word under the empty line:
  `… 2 outside this project` (`this folder` when she is in one), whose tap is
  `setProject('')`, her words still in the box. Two rules: a **hidden** clip
  is never counted (`hidden` is this page's delete, and a count promising
  clips the feed would not draw sends her to All to find nothing), and a
  **tucked** film IS counted — a search is her asking for something by name,
  the route's own carve-out. The empty line names the project now too
  (*Nothing matches that in Secretly a Witch.*). Test:
  `node scripts/test-footage-elsewhere.js` (the count pure, then the real
  page headless — the word MEASURED as a box with width on screen, the tap
  asked as a real tap, and the read the server received checked, since a
  count computed but never drawn and one drawn but hidden look identical in
  the source; verified failing 12 pre-fix).
  Test: the search block of
  `node scripts/test-footage.js` (every assertion a MEASUREMENT of what is on
  screen or of what the stub server really received — a word only an older
  clip says has to reach the server and come back as a card).
  **THE FEED HAS THE PLAYGROUND'S SWITCH (same list: "add tile/list/3/4 grid
  feature from playground")** — LIST is a box per clip, TILES is the posters
  `--cols` across, and the third segment is the NUMBER, 3 or 4, never bars (at
  16px two bar counts are one grey smudge). ONE variable on the root drives the
  wall AND a card's own reference row, so the segment is never a dead control
  in list view; all three choices are sticky under `footage_*` keys. The ✕ mark
  rides as a CLASS, out of the wall's signature, so hearting a clip cannot
  rebuild the wall and re-decode every poster — **and a whole page of clips
  paints the wall ONCE**: `loadJobs` hands every clip to `jobCard` in turn and
  the signature changes on each one, so a paint per card rebuilt the wall N
  times to end with N cells (measured on a first load of 40 clips: 39 wipes,
  820 cells created for the 40 that stayed). Only a BATCH is deferred — a
  vote, a new job and a view switch still paint on the spot.
  **AND THE BAR IT LIVES ON IS ALWAYS ON SCREEN (2026-09-14, Sophie: "tiles/
  list bar shud be always visible - either under the prompt, or sticky/pinned
  in gallery").** It sat in the flow between the panel and the feed, so the
  one row that says how the gallery is READ — the switch, the ♥/✕ marks, the
  glass and the project picker — scrolled away the moment she was reading the
  gallery: switching to tiles or narrowing to a folder meant scrolling the
  whole feed back up first. It is `position:sticky` at `--headtop`, the second
  of her two seats and the only one that is true all the way down (under the
  prompt leaves with the panel). Four things not to undo: **it needs no offset
  and no script to clear the panel's own sticky fold row**, because a sticky
  element is constrained by its containing block — the panel carries that row
  up and off with it, so by the time the bar reaches the top the row's bottom
  is already at or above it (MEASURED across the whole transition: the gap
  never goes negative); the background is the PAGE's cream, not the panel's
  white, or the clips scroll through the row, and the 10px that was a bottom
  MARGIN is padding (`.panelrow`'s own lesson — a sticky element holds its
  margin edge at `top`); the **FUNNEL CHIP now reserves the pill's 58px** like
  the drawer beside it always has, UNCONDITIONALLY rather than while pinned,
  because pinned its line sits in the pill's band at every scroll position
  (MEASURED at 390pt with the search open: x 344-378 against a pill starting
  at 324) and a reserve that comes and goes with the scroll is the
  narrow/full-width bug; and **`goToCard` subtracts the pinned bar** —
  `stuckH()` — or a tapped tile lands its card BEHIND the controls, which
  reads as the tap going to the wrong clip. Test:
  `node scripts/test-footage-feedbar-sticky.js` (every assertion a
  MEASUREMENT, since a sticky that never pins, one the clips show through, one
  whose own controls sit under the pill, and one that leaves a card behind it
  all look identical in the source; verified failing 12 pre-fix).
  **AND IT IS STICKY AT BOTH ENDS — IT IS THE DIVIDER (2026-09-14, her
  correction the same day: "i want the tiles bar as a middle · in prompt block
  mode its pinned to bottom · gallery its top (as now) · textblock / bar /
  gallery · bar always visible").** Pinning at the top alone answers only half
  of "always visible": with a long scene, the big box open or a strip of
  references, the prompt block is taller than the screen and the bar sits
  below the fold the whole time she is up in it (MEASURED at 390x844 on a
  22-line scene with the big box open: the panel is 1,988px and the bar's
  natural spot is y=2054, two screens down). `bottom:0` beside the `top` is
  the whole fix — a sticky element sticks to whichever edge its natural
  position is pushed past, so the bar is at the bottom while she is in the
  prompt block, at the top once the gallery has reached it, and in the flow
  for the stretch in between. It needs no script and keeps no copy of its own
  height; the containing block is the page, which spans both halves.
  Two things not to undo. **A box's pinned corner buttons sit ABOVE it** —
  `stickybox.js` pins the bigger-box and divide buttons at the bottom of
  caretkeep's band and the bar is bottom-pinned at the bottom of the same
  band, so without this they land on each other on exactly the long scene
  that makes the bar bottom-pin at all (MEASURED: the buttons' bottom 812
  against a bar top of 793). The bar carries `data-pagechrome` and
  `chromeBottom()` reads it LIVE on every pass, never cached — the bar is at
  the bottom for one stretch of the scroll, in the flow for the next and at
  the top after that, and a set remembered at find time would reserve a band
  that is no longer there. **`band()` itself is still NOT narrowed** (the
  2026-09-13 ratchet), because this is a row stickybox does not move. And
  **nothing was added to `caretkeep`**: the bar is a body-level sticky row, so
  `findStuck` already finds it and `caretBand` lifts her caret line clear by
  itself. Pinned by sections 7 of
  `node scripts/test-footage-feedbar-sticky.js` (verified failing 4 against
  the top-only CSS, and 1 more with the stickybox half reverted).
  **AND THE FEED PAGES BACK PAST TODAY (2026-09-11, Sophie: "I can't go back
  farther than today in footage").** The read was the newest 40 clips and
  nothing else — at ~70 Mini clips a day that IS today, so everything before
  it sat on the log with no door (the Assets tab's hard-truncate lesson,
  arriving at the page she draws in most). An underlined **… older** under
  both views asks `GET /jobs?before=<sentAt>` for the page under the OLDEST
  clip on screen; the route answers `more` beside the jobs (`pageJobs`,
  pure). Two things not to undo: the cursor is a **sentAt, never a count** (a
  clip landing while she reads would shift a count and repeat a page), and
  **the newest-page poll's `more` is ignored once she has walked past it** —
  that read runs every few seconds and always says "there is a page under the
  first 40", which says nothing about the pages she already holds; it only
  ever ADDS to `jobsById`, so a page she walked back to stays put. Pinned by
  the walk block of `node scripts/test-footage.js` (the cursor read off what
  the stub really received, the order off the DOM).
  **THE PRICE IS EXACT, AND THE 60% SALE IS OPENROUTER'S TO PASS ON
  (2026-09-09 — measured off 113 completed OpenRouter jobs' own `usage.cost`,
  44 APIFRAME jobs' `creditCost`, and ffprobe on the output clips).** Four
  things were wrong at once, and each hid the others:
  - **MINI RENDERS ON THE 2.5 CANVASES**, not the 2.0 ones — 480p 1:1 is
    640x640, 480p 3:4 is 560x752, 720p 3:4 is 834x1112, on every clip
    (`sizes` on a model row names the canvas table it really renders on).
    **AND SO DOES 2.0 — measured 2026-09-12, and it was UNDER-QUOTING her.**
    The one 2.0 job that has gone through OpenRouter (4s 480p 3:4) was quoted
    **$0.2037** off the published 2.0 canvas and **BILLED $0.2792** — a factor
    of 1.371, which is 560x752 / 480x640 = 1.3708, the 2.5 canvas to four
    figures. So `sizes:'2.5'` is on the 2.0 row too; it stays `about`, since
    one job at one shape fixes a canvas and does not pin every rung. The door
    ranking is unchanged (OpenRouter still wins 2.0 on every shape).
    **ONLY FAST HAS NEVER GONE THROUGH OPENROUTER NOW**, so only Fast keeps
    the published table unverified — and that table has now been wrong TWICE,
    which is why the bar is a real charge rather than a vendor page.
  - **2.5's CANVAS IS MEASURED AND THE `~` IS OFF IT (2026-09-12).** Not by
    ffprobe but by the better evidence: OpenRouter hands its REAL charge back
    on every job, and across four distinct shapes the estimate and the charge
    agree **to the cent** — 480p 9:16 30s $3.0883, 720p 9:16 15s $3.4764
    (twice), 720p 9:16 30s $6.9432, 720p 3:4 4s $0.9400. A 2.5 job with a
    reference VIDEO still answers `about`: that surcharge is measured on one
    job and nothing else.
  - **A CLIP IS 24·s + 1 FRAMES**, not 24·s — the billed count fits 97 exactly
    on a 4s ask, and that +1 is what makes the formula land on the cent.
  - **THE 5% TOP-UP FEE IS NOT IN THE PRICE.** It is paid when credit is
    bought; OpenRouter's balance and its per-job charge are both in list
    dollars, so a price with the fee folded in does not subtract from the
    balance she is looking at. `OR_FEE` is still exported, and the "?" card
    says once that credits cost 5% more to buy than they show.
  - **THE SALE IS READ, NEVER WRITTEN DOWN.** Mini was billed at 0.40 × list —
    a real 60% off — on all 111 jobs from 2026-09-08 21:13 UTC to 2026-09-09
    06:39 UTC, and the two jobs since (18:09 and 18:22 UTC, both from
    `/footage`) at FULL LIST: **13.96¢ for a 4s 3:4 480p Mini against 5.58¢.**
    ByteDance's own campaign is still running (Seedance 2.0 mini at 40% of list
    and 2.0 fast at 75%, both to 2026-10-07 14:00 UTC+8; 2.5 at 1080p only at
    72%, to 2026-09-17; plain 2.0 is not in it), so it is OPENROUTER that
    stopped passing it on. It exposes the factor per model as
    `pricing.discount` on `GET /models/<id>/endpoints` — 0 right now, and its
    cached page used to advertise mini "from $0.01345/second" (= 0.40 ×
    $0.03363). So `footage.js` FETCHES it (`discounts()`, cached ten minutes),
    prices at `list × (1 − discount)`, and **a failed read is 0 — full list,
    the safe direction — never a stale sale**. `GET /status` carries it per
    model and the "?" card says "2.0 Mini is 60% off right now" only while
    there is one. **RE-SWEPT 2026-09-12: no new sale on any door, and
    nothing ended that day.** OpenRouter's `discount` reads 0 on all four
    Seedance rows — checked against its own API rather than our cache, since
    a failed read also answers 0 and the two look identical from inside;
    Atlas's sale is live and unchanged (Mini 1.1¢/s = 80% off, Fast 2.7¢/s =
    70%, 2.0 and 2.5 only 20%); APIFRAME has no sale mechanism at all. **The
    cheap way to detect one is the REAL CHARGES, not a vendor page**: divide
    each job's `usage.cost` by its own token count and a sale starting or
    ending shows as a step. Over the whole log there is exactly one step —
    Mini going 1.4e-6 → 3.5e-6 at 2026-09-09 18:09 UTC, this sale ending —
    and 2.5 has billed a flat 1.07e-5 from 09-11 through today. The old hardcoded `sale: 0.72 / 0.75` are gone: wrong numbers
    that only looked right on 1:1, where the canvas was wrong too. (`orTok`
    stays the OpenRouter-LISTED figures, which is what it bills against — its
    Fast price is already ByteDance's discounted one; don't try to reconcile
    that in code.)
  So the formula is **tokens = w × h × (24·s + 1) / 1024, × the SKU, × (1 − the
  live discount)**, in list-credit cents to the hundredth. An estimate answers
  `exact:true` where it is pinned and `about:true` where it is not, and the page
  prints "about" only for the second. **A REFERENCE VIDEO IS THE ONE SHAPE
  STILL UNPINNED** — one job only (1:1 480p 4s Mini: 6.48¢ with against 5.43¢
  without, under the sale), i.e. ~19% MORE rather than the discount the
  published SKU advertises — so it is estimated at the same rate and marked
  "about"; the published `orVidTok` figures are deleted rather than left lying
  around wrong. **APIFRAME is per second and has its own rate with a reference
  video** (`afVid`): 2.5 at 480p is 15¢/s with one and 13 without — 44 jobs,
  every one exact (4s = 60 or 52, 15s = 225, 30s = 450); Mini at 480p with a
  video is 5¢/s. 720p is unmeasured on every model there, as is Mini with no
  video, so those still answer "about". (A FAILED APIFRAME job still shows a
  `creditCost` — 60-450 on the refused 2.5 jobs — and the team total sits
  ~1,100 credits UNDER the sum of them, so some failures are refunded; which
  ones is unmeasured.)
  **One log**: both doors are called in process (`startVideo`/`pollVideo`,
  exported from `openrouter.js` and `apiframe.js`) and file the same
  `forge-video-jobs` doc, `chat:'footage'`, so the 1080p redo reads it like any
  chat's. The server polls the unfinished jobs itself (12s throttle per job)
  and bakes a poster, so the feed resumes from any phone. **The price is
  SERVED** (`GET /estimate`, the model table on `GET /status`) — the page holds
  no cost figure at all, and a test pins that. Seconds and resolution open at
  the minimum on every load; the model and the shape are remembered. Nothing is
  deleted — ♥/✕ marks, `hidden` is the verb. **Hide-the-✕'d opens ON since 2026-09-14** (her "default to hide x" — the rule and its four guards are in the Playground's ✕-filter note, which also carries the 2026-09-15 split: the PLAYGROUND went back to default-off and this page did not). **A chat's clips do NOT go here**
  — this is her feed, the Playground's rule; a chat's clips are tagged with the
  chat's own slug. Test: `node scripts/test-footage.js`.
  **A BELT SCENE HANDS ITS WHOLE JOB TO THIS PAGE — ONE localStorage KEY,
  `footage_handoff` (2026-09-10, Sophie: "add a button to each scene that
  automatically puts all the right references in the same text to footage so I
  can edit it or press go myself").** Her belt pages are served from this same
  origin, so the hand-off needs no route and no doc: the belt writes
  `{ prompt, refs:[{url, kind:'image'|'video'|'audio', poster?, name?}],
  model?, seconds?, res?, ratio?, seed?, from?, title?, at: Date.now() }` and the page
  CONSUMES it — reads, applies, **removes the key** — which is what makes it
  land exactly once and never come back on a later load. It only fills the box:
  **nothing is sent, the star is still her tap**, which is the whole of what she
  asked for.
  - **IT IS READ AT FOUR MOMENTS, AND LOAD IS ONLY ONE OF THEM**, because the
    app keeps a tool's web view alive for the whole app process (*A WRAPPED PAGE
    CAN BE DAYS STALE*) and walking to this page from the belt fires no load at
    all: on **load** right after `loadCtl()` (the order is what makes the
    hand-off beat the restored draft), on **`visibilitychange`→visible**
    (coming back to the tool inside the app — the ordinary case), on
    **`pageshow`** (the back-forward cache hands the page over with neither),
    and on the **`storage` event** for that key (another same-origin DOCUMENT
    writing it while this one is on screen — the only moment the page can act
    immediately).
  - **A hand-off REPLACES the draft** (it is a button she pressed; her words
    were going into `footage_draft` all along), refs are deduped by url and an
    unknown `kind` rides as a picture (`slotsOf` counts per kind and would
    otherwise name a slot `[AudioNaN]`), and the model/res/ratio/seconds are
    set live on `S` so **`paintControls` is what validates them** against the
    served table — an unknown model falls to the first row, 99 seconds clamps
    to the model's max. Nothing here holds a copy of that table.
  - **Older than a day is dropped** (she has moved on) and **a malformed value
    is dropped silently** — a belt page with a bug must not throw a page error
    here. Either way the key is taken off the shelf rather than re-read at
    every one of the four moments.
  - Test: `node scripts/test-footage-handoff.js` (the real page headless, every
    assertion a MEASUREMENT — a hand-off that parses and never reaches the box,
    one that leaves the key behind, and one whose seconds skip the clamp all
    look identical in the source; the `storage` moment is driven by a SECOND
    page in the same context, which is the only honest way to ask. Verified
    failing 20 pre-fix.)
  **THE CARD'S LINE CARRIES NO `sound` TAG (2026-09-10, Sophie: "get rid of
  sound since they all have sound").** The page sends `sound: true` on every
  job, so the word was on every card and told her nothing. **`silent` is KEPT**
  for a clip that genuinely has none — it can never render for a clip drawn
  here, and a silent one saying nothing about it would be the card lying. The
  card's price dropped its "about" in the same breath, for the reason above.
  **EVERY CLIP SAYS HOW LONG IT TOOK TO DRAW (2026-09-10, Sophie: "can you
  make it say the number of seconds or minutes each clip took to draw on the
  clip?").** A `drew in 2m 34s` tag at the end of the card's own line, from
  `drewMs` on the log doc. **`doneAt` CANNOT ANSWER THAT AND NEVER COULD — it
  is when the SERVER NOTICED, and the poll only runs when someone reads the
  feed.** Measured on two of her real Atlas clips: both stamped done within
  0.7s of each other because one `/jobs` read polled them together, one having
  really finished 13s earlier and the other 3m37s earlier — close the app for
  an hour and `doneAt` is an hour late. So the figure is read from the DOOR's
  own record and the shapes live in ONE place, `video-log.js`'s `drewMsOf`
  (Atlas's `latency_ms`, else a `created_at`→`completed_at` pair, else the
  other doors' timestamp names); all three doors hand `finishPatch` their raw
  record. Three things not to undo: **a door that does not say writes NOTHING
  and the card draws no tag** (the Assets tab's silence rule — a number that is
  really "how long until she next opened the page" is worse than none); a span
  that is **backwards or over six hours is refused** rather than shown, since a
  clock skew must leave the figure absent, not wrong; and the page has **one
  `dur(ms)`** which `ago()` also reads, so the drawing line and the finished
  tag can never format a span two ways. The clips already drawn were filled in
  by `node scripts/footage-drew-backfill.js` (dry by default, free — a read per
  job on the door, one field written; 33 of her 41 finished clips recovered,
  8 whose door does not say left alone and counted). Tests:
  `node scripts/test-video-log.js` (the rule pure) and the drew-time block of
  `node scripts/test-footage.js` (MEASURED off the rendered tag — a card that
  computes the span and never paints it, and one that paints sentAt→doneAt
  instead, are the same markup to any source check; verified failing 2 pre-fix).
  **THE RECENT BOX IS WHAT SHE UPLOADED — NOTHING THE DOOR DREW (2026-09-10,
  Sophie: "take out trimmed clips from recents" → "recents is recent
  UPLOADED" → "uploaded videos").** The drawer lists the REFERENCES off
  earlier cards — her stills and her uploaded videos alike, newest job first,
  one tile per url — so re-attaching one is a tap instead of a hunt through
  Photos. Three things not to undo: the dedupe is **by url across both
  kinds** (a clip that was also a reference is one tile, and it is listed as
  the REFERENCE); a video with a poster wears a small film mark in its corner
  (one with none already draws the film glyph, so it needs no mark); and the
  drawer is DERIVED from the feed, so it repaints with it and nothing is
  stored.
  **AND TYPING SHUTS IT (2026-09-13, Sophie: "recent references closes when i
  start typing" → "it shud close").** The drawer is open to ATTACH; the moment
  she is writing the scene it is a row of thumbnails between her words and the
  buttons — and on a phone it is already under the keyboard, so it costs a
  scroll to reach and a scroll to put away (MEASURED at 390pt: an empty box
  puts it at y=362, a scene at y=480, under a keyboard starting at ~430). So
  the first character in a prompt block closes it, exactly as her tap would.
  Three things not to undo: it is **TYPING, never focus** — a tap to place the
  caret is not writing; it hangs off the block's own `input` and **not
  `saveDraft`**, which is the one signal every path that changes the job sends,
  so **attaching leaves it open for the second reference**; and the character
  sheet beside it is untouched (she named the Recent drawer).
  **AND FOLDING THE PANEL AWAY TAKES IT WITH IT — AN ID BEAT THE FOLD'S OWN
  SWEEP (2026-09-13, her screenshot of a SHUT panel with the drawer still
  drawn under it).** `#recent` is a direct child of the panel, so
  `.panel.shut > *{display:none}` was meant to hide it like everything else —
  but that selector is two classes (0,2,0) and `#recent{display:flex}` is an
  ID (1,0,0), so the drawer went on rendering with the panel folded away and
  **no control left on screen to close it** (`#rectog` hides with the Buttons
  row). MEASURED headless: shut panel, `display:flex`, 52px tall. The fold's
  two rules carry `!important` now rather than being fixed one id at a time —
  any child styled by its own id would have done the same, silently. Reopening
  the panel brings the drawer back exactly as she left it; `paintFolds` still
  really CLOSES both drawers when the BUTTONS row folds, since there the
  toggles go and the drawers would otherwise stay. Pinned by
  `node scripts/test-footage-recent.js` (verified failing 1 pre-fix).
  **THE CLIPS AND THEIR LAST FRAMES ARE HISTORY, NOT A RULE — DON'T PUT THEM
  BACK.** For a few hours that morning the box also listed a job's own
  FINISHED CLIP ahead of its references, at her ask ("make the recent box
  keep videos, not just stills" — her references really are mostly stills, and
  the shot before is what this draft keeps needing), and then that clip's
  baked LAST FRAME right behind it ("on"). She retired both the same day, in
  three messages: first the trimmed ones ("take out trimmed clips from
  recents" — a trimmed clip's `video` points at its FIRST part, so the tile
  offered a piece of a shot rather than the shot), then the whole idea. **The
  outputs belong to the WALL**; a clip is chained from by putting its prompt
  back, and its last frame from its own card. `return_last_frame` is still
  asked for on every Atlas job and `lastFrame` is still on the log — only the
  drawer stopped listing it. Test: `node scripts/test-footage-recent.js`
  (every assertion a MEASUREMENT of the rendered drawer or of what the send
  really POSTs — a clip's poster and a still reference are the same markup,
  and a lit thumb says nothing about what left the phone; verified failing 5
  against the page that listed them).
  **AND IT PAGES, AND IT ORGANIZES — `… older references` AND A PENCIL
  (2026-09-14, Sophie: "add a more / see older references / and organize
  button mode / to delete and add recent references without using them").**
  Two complaints in one: the drawer was the newest 24 references with nothing
  behind them reachable at all, and every tap on it meant ATTACH, so the only
  thing she could do with a tile was use it. Now the drawer is a column — its
  own little line (the organize mark, what a tap means, the undo), the tiles,
  and `… older references` at the end, which widens it 24 at a time and is
  drawn only while there really is something behind that page. **LIT, A TAP NO
  LONGER ATTACHES**: every tile wears a ✕ that takes it OFF, tapping the tile
  OPENS IT BIGGER (`openRef`'s own two doors — she is deciding whether to keep
  it, and a 52px thumb does not answer that), and **the picture button on the
  buttons row ADDS to the drawer instead of to the job**, which is the "add …
  without using them" half. Six things not to undo:
  - **NOTHING IS DESTROYED.** The file is in the Dump and on every clip it
    already rode; a ✕ is only this drawer forgetting it. The last removal is
    banked (`footage_recundo`) so one `undo` puts it back — the page's own
    clear/undo rule, **an undo instead of a confirm**.
  - **THE TWO CURATION LISTS ARE HER PHONE'S** (`footage_rechide` /
    `footage_reckeep`), like every other setting here: the drawer is DERIVED
    from the feed, so they say only what to leave out of it and what to stand
    in front of it. A reference she ADDS leads the drawer — she put it there
    to find it again.
  - **A ✕ HIDES WHETHER THE TILE WAS KEPT OR DERIVED**, and adding un-hides —
    or a kept tile with a job behind it walks straight back in as a derived
    one, and a tile taken off could never be put back by hand.
  - **THE MODE AND THE WIDENED LIST DIE WITH THE SCREEN** (memory only, and
    `recClose` is the one door): the Playground's SELECT rule and the deck's
    lane rule, one drawer over. Reopening is the calm 24 again.
  - **THE PICTURE BUTTON SAYS WHICH IT IS ABOUT TO DO**, set BEFORE the
    signature check — it is the one control the mode reaches outside the
    drawer, and a label that still said "Add a reference" would be the tap's
    meaning changing invisibly.
  - **AN EMPTY DRAWER STAYS REACHABLE WHILE THERE IS AN UNDO IN IT** — taking
    the last tile off would otherwise close the drawer over the one control
    that could put it back, and the history icon would go with it.
  Test: `node scripts/test-footage-recent-organize.js` (every assertion a
  MEASUREMENT of the rendered drawer, of what the send really POSTs, or of
  what is really in localStorage — a tile that wears a ✕ and attaches anyway,
  an opener that widens nothing, a removal that never reached storage and an
  upload that lands on the job as well as the drawer all look identical in the
  source; it CRASHES against the pre-fix page, which has no opener at all).
  **A CHOSEN REFERENCE OPENS BIGGER — TAP ITS THUMB (2026-09-12, Sophie:
  "make clicking on a chosen reference open it bigger").** A 72px tile is too
  small to check that the picture riding as `[Image2]` is the one she meant,
  and the strip was the one place on this page a picture could not be looked
  at. It opens in the SAME overlay the clip and the last frame use — one
  lightbox on this page, so the way out is the one she knows (the backdrop,
  the ✕, the app's chevron). Four things not to undo: a PICTURE is the still
  view with **save** and **no "use this frame" doors** (`openShot(url,
  {use:false})` — "reference" would do nothing at all, since it already is
  one, and "first frame" is the flag on its own tile); a VIDEO is the ordinary
  player with **no trim bar** (`openPlayer(url, null)` — a reference is a file
  she attached, not a clip this page drew, so there is nothing to cut); an
  AUDIO tile stays a plain `<div>` with no control at all (nothing to open
  bigger — the Assets tab's silence rule); and `.ref .im` needs `padding:0`
  now that it is a `<button>`, or the page's base button rule (7/11) insets
  the picture inside its own tile. The tap is wired BY POSITION like the ✕
  beside it, so a copy-back that replaces every object in the strip cannot
  strand it. Test: `node scripts/test-footage-ref-big.js` (every assertion a
  MEASUREMENT — a tile carrying a handler that opens nothing, one that opens
  the overlay still showing the 72px thumb, and one that opens the trim bar
  over a reference all look identical in the source; verified failing 9
  pre-fix).
  **DIVIDE HERE — ONE BLOCK IS ONE CLIP (2026-09-11, Sophie: "can u add the
  feature from story timeline that allows me to divide into two text blocks
  where my cursor · a button · says divide here · pinned or sticky in footage
  · icon this time").** The Story Timeline's divide on the prompt box: a mark
  beside the bigger-box toggle (Lucide `separator-horizontal` — her "icon this
  time") cuts the block at the cursor, the words after it become a SECOND
  block right under the first, and the timeline's join mark (`fold-vertical`)
  in the gap puts them back with a blank line between. **THE STAR SENDS THE
  BLOCK SHE IS IN** — the one she last tapped into, wearing the star's gold
  line once there are two or more; the model, the seconds and the size are
  the job and are shared, the block is the words; a slot tap and a
  character's line land in the active block, and a **PUT-BACK MAKES A BLOCK
  OF ITS OWN** (2026-09-14, Sophie: "copy back from finished job shud make a
  new text block · not replace the selected block") — see the paragraph after
  next. **A CARET AT THE END MAKES AN
  EMPTY BLOCK, AND IT TAKES THE GOLD LINE AND THE CARET WITH IT (2026-09-14,
  Sophie: "divide here in footage should allow a divide with nothing after it
  to make a new empty block")** — the old refusal there is HISTORY (an empty
  block is an ordinary state here, and writing shot two means asking for a box
  before there are words for it); a caret at the START is still refused (her
  words would jump down the screen) and an empty box divides into nothing.
  **AND PUTTING A FINISHED CLIP BACK MAKES A BLOCK RATHER THAN OVERWRITING
  ONE (2026-09-14, Sophie: "copy back from finished job shud make a new text
  block · not replace the selected block").** A card's copy button used to
  write its words straight into the box she was standing in, so putting a clip
  back cost her whatever was in that block — the scene she was part way
  through, or the shot she had just divided out — and the only way back was the
  `undo` `copyBack` had to bank the WHOLE job for. One block is one clip, so a
  clip she puts back is another block. Five things not to undo: it lands at
  the **END**, never inserted beside her (an insert renumbers the shots she is
  reading in order); **except into a TRAILING EMPTY block**, which is the box
  she already has — a fresh page IS one empty block and a divide at the end is
  her asking for somewhere to write, so adding beside either would strand an
  empty block she then has to take off (empty means no words AND no pictures);
  the new block **takes the gold line and the card's own strip**, so the star
  sends what she just put back and the references under the panel are its;
  **nothing is banked**, because nothing is overwritten — an `undo` left on
  the row by an earlier `clear` goes on meaning that clear; and **the
  SETTINGS are still the job and are still replaced** (model, seconds, size,
  shape, seed), only what the record knows, exactly as before. The window is
  walked to the new block — never `scrollIntoView`, and never simply to the
  top of the page, which on a panel of several blocks is not where it is.
  Both corner buttons pin
  together (`stickybox.js` v2 — buttons on one box are a group; the divide is
  `nofollow`, since it shrinks the box from the bottom and the seam is
  already where her eyes are). **`fitBox` holds the wrap's height while a box
  is measured** — at `height:auto` the box collapses for one layout and the
  browser clamps a deep scroll to the shorter page (measured: scrollY 654 →
  0 on a pinned divide at line 40; the same shape flickered under every
  keystroke in a tall big box). Nothing is sent by dividing, nothing is lost
  by joining, no ✕ on a block on purpose; a hand-off naming no `blocks` is one
  scene and collapses to one block (**since 2026-09-13 one naming them lands
  as several — see the next paragraph**); the draft keeps `prompt` as the first block for an
  older page and the rest under `blocks`; a block is a direct child of the
  panel or the pill-gap fitter would shorten them all.
  **AND EACH BLOCK FOLDS ON ITS OWN (2026-09-13, Sophie: "make each text block
  in footage collapsible")** — a heading row per block, drawn only with two or
  more, and THE HEADING IS THE FOLD (the chats part-fold's rule). Shut it says
  that block's first words and its box is DISPLAY-hidden, so a folded block
  still sends its words and still renames its slots; the gold line moves to
  the heading when the block she is in is folded away; anything that puts
  words in a block OPENS it. **AND A FOLD STAYS FOLDED ACROSS A RELOAD SINCE
  2026-09-14 (Sophie: "collapsed blocks don't stay collapsed")** — it shipped
  MEMORY-ONLY on the reasoning that "a reload opens everything, the safe
  direction", and that is HISTORY rather than a rule: the app keeps this web
  view alive for the whole app process, so the reload she actually meets is
  the page's own SELF-HEAL firing on a new build — something she never asked
  for and cannot see coming — and a fold springing open there is the fold not
  working. It rides the DRAFT (`shut`, an array by position, beside the words
  those folds belong to), never a settings key of its own, so a hand-off or a
  put-back replacing the blocks replaces the folds in the same write and a
  fold can never land on words it was not made for; it is written only while
  something is really folded, so a page that never folds one saves exactly the
  draft it always saved. Safe because a shut block still SAYS its first words.
  A box is never fitted while it is folded (`scrollHeight`
  on a `display:none` box is 0, so it would come back one line tall), and the
  first divide gives back the height its own heading adds above the seam.
  **AND A PLUS UNDER THE LAST BLOCK MAKES A NEW ONE AND PUTS EVERY OTHER
  BLOCK AWAY (2026-09-17, Sophie: "add a button that makes a new text block
  at the bottom of footage and collapses all other blocks" · "character and
  setting shud be above the selected text block btw").** `#newblock`, a
  rounded-square Lucide plus in its own `.newrow` under the last block (the
  join mark's own shape and size), drawn with one block too. One tap
  (`newBlockBelow`): an EMPTY block under the last one whatever block she is
  standing in — it carries no strip, no cast and no mark, because it is a new
  clip and not half of one, so the divide's copy rule does not apply — every
  other block folded to its heading line with the same `shut` her own tap
  writes (so the draft banks it), the gold line on the new block, the caret
  in it, and the characters-and-setting wrap above it, which is `placeHeads`
  doing what it has done since 09-14 (`markActive` moves the wrap above the
  block that takes the gold line; the test measures it after the tap and
  after tapping back into an older block). The pill fitter judges this row
  on its BUTTON, as a block is judged on its heading: the row is the panel's
  width and a centred plus is nowhere near the rail, so judging the row
  shifted the plus 50px off-centre whenever the row sat in the pill's band
  (PHOTOGRAPHED with one block). Test:
  `node scripts/test-footage-new-block.js` (the real page headless — the
  block, the folds, the gold line and the caret all MEASURED, the heads'
  bottom meeting the active block's top, the draft, a reload).
  **AND EVERY BLOCK KEEPS ITS OWN PICTURES (2026-09-14, Sophie: "blocks in
  footage that have images attached shud keep attached images and the images
  return when block is selected").** The strip under the panel is the ACTIVE
  block's: tapping into another block hands its pictures back, and the
  references row says which block it is showing. **This SUPERSEDES "the
  references are the JOB and are shared" and the ✕ renaming the slot in EVERY
  block** — both are history, not rules: one block is one clip, so the
  pictures it draws from belong to it exactly as its words do. What follows
  from her sentence rather than loosening it: a **DIVIDE copies** the strip
  into both halves (the tail's words name it, so an empty second block would
  leave every `[Image2]` in it pointing at nothing); a **JOIN unions** the two
  and renumbers BOTH texts onto the union (a slot is a POSITION, so below's
  `[Image1]` is a different picture from above's); an **UPLOAD lands on the
  block its tap was made from**, since an upload is a round trip and tapping
  into another block while it runs would otherwise drop the picture there
  (the toast names the block when it is not the one she is standing in); the
  **✕ renames the active
  block's words alone**, since no other block's pictures moved; a **put-back**
  brings the card's strip in on the NEW block it makes and touches no
  other; a **hand-off gives every block the same strip** (one job's references, however many parts its scene
  came over in). **AND FOLDING A BLOCK AWAY NO LONGER
  MAKES IT THE ONE THE STAR SENDS** — the document click handler makes any
  button on a block active, which was invisible while the strip was shared and
  is wrong now: folding block 2 away moved the gold line onto it AND swapped
  her pictures on screen for its (MEASURED: her 2-picture strip became block
  2's 4). A heading tap that SHUTS a block is "put this away"; one that OPENS
  it still makes it active, which is her going there to write. Each heading
  carries a picture glyph
  and a count, so a block she is not standing in cannot ride with pictures on
  no screen at all. The draft and the `clear` bank keep `refs`/`first`/`last`
  as the FIRST block's for a page cached from before, with the whole set
  beside them under `jobs`; a draft with no `jobs` gives every block the one
  strip it saved, which is what it meant when the strip was shared.
  **AND EVERY BLOCK'S HEADING SAYS WHETHER IT HAS GONE — A RED SENT / UNSENT
  (2026-09-14, Sophie: "add a red 'sent' or 'unsent' to top of collapsed
  block").** One block is one clip, and a folded block is a clip she cannot
  read: four shots into a scene, which of them had actually left was a fact the
  page knew and said nowhere. **IT IS THE WORDS THAT WENT, NEVER A FLAG ON THE
  BLOCK** — the Playground's `promptlab_panels_drawn_<g>` rule ("the EXACT
  array that was sent, so editing one box after a draw makes that grid undrawn
  again"): the question is only ever *are the words in this box words that have
  gone*, so the mark is position-independent by construction and a divide, a
  join, a removal, a reorder, a put-back and `use this` need no bookkeeping at
  all (dividing a sent block leaves both halves UNSENT, which is right — neither
  half is the clip that went).
  **THREE SOURCES ANSWER IT, AND THE FEED IS THE ONE THAT WAS MISSING
  (2026-09-15, Sophie: "they all read unsent").** It shipped with two, and
  both are blind to an ORDINARY block: the local bank is empty on a page that
  has not sent yet, and `histOf` needs a `unit`, which only a STORY part has —
  so every ordinary block, and everything sent before the mark existed, read
  UNSENT forever. **The FEED is the third and it is already loaded**: every
  card carries the exact `prompt` that went, so it needs no request.
  `sentIndex()` builds the set once per feed change and `wasSent` asks it
  last. Five things not to undo: **the match is at a PARAGRAPH BOUNDARY, both
  ends** — `withHeads` joins the heads and the words with a blank line and an
  appended multi-block send joins the blocks the same way, so a block's words
  are a contiguous run of the prompt's own `\n\n` segments and never a phrase
  floating inside one (a loose "contains" would read SENT off any clip that
  happened to say those words, and a false SENT is the direction that costs
  her a shot); the **whole prompt counts too**, which is what a put-back of an
  older clip leaves in the box; **a FAILED or refused clip is skipped**, the
  bank's own rule; it is **built once and cached**, because `paintSent` runs
  on every keystroke and this walks every clip on screen; and **a clip landing
  REPAINTS the headings** (`sentDirty` → `sentRepaint`, called from
  `paintFeed`) — without it the index is right and the word on screen is the
  one built before the feed arrived, which is exactly how this read UNSENT on
  a page whose own feed held the clip. `sentDirty` is set only when a LIVE
  index was thrown away, so an ordinary poll that added nothing repaints
  nothing. **THE SCOPE OF THAT INDEX IS THE FEED SHE IS LOOKING AT** —
  narrowed by project, and paged, so a clip from further back than she has
  walked is not in it.
  **AND THE FOURTH SOURCE IS THE LOG ITSELF, ASKED (2026-09-16, Sophie:
  "sent/unsent seems to be wrong or backwards").** Measured on her screen that
  night: block 2 and block 4 had gone out inside twelve longer clips over two
  days, every one of them past the newest forty in ALL — and the bank had
  rolled them off too (20 sends, and she had sent more than that since) — so
  both read UNSENT beside a block 7 that had just gone, which is exactly
  "backwards". Every source the mark had was a window; the log never forgets
  and was only ever read through the feed's. `POST /api/footage/sent
  {texts:[…]}` answers off the WHOLE collection with the page's own match
  (`sentAmong` in footage.js — a whole prompt, the `words`, a run of `\n\n`
  paragraphs, never a phrase inside one, never a failed clip), and the page
  banks the answer in `sentFar`. It asks ONLY for words it does not already
  know (a SENT is permanent; an UNSENT answer is held a minute), debounced
  700ms off `paintBlockHeads` and the keystroke, so a page whose blocks are
  all known asks nothing. No model call; one collection read. Test:
  `node scripts/test-footage-sent-far.js` (the helper pure, then the real page
  against an EMPTY feed — SENT has to come off the ask alone).
  A story part's
  own `hist` — every clip sent from that part, read off the log by
  `loadHistory`, whose `words` is the block's text before the heads — so a part
  reads SENT on a phone that never sent it and after a page's whole life has
  been forgotten; the local bank (`sentTexts`, riding the draft) is the fallback
  for an ORDINARY block, which has no part and so no history to read, and for
  the seconds between a send and the next sweep. The union can only ever ADD a
  SENT, never take one away, and `loadHistory` calls `paintBlockHeads` rather
  than `forEach(paintHist)` — a sweep that only repainted the ‹ › row would
  leave a part that really has been sent reading UNSENT. Six things not to undo: it rides the heading **OPEN OR
  SHUT**, like the reference count beside it (the don't-say-it-twice rule only
  bites where the thing is right there on screen, and nothing in an open box
  says whether it was sent); **a block with no words is neither** and draws
  nothing; **editing a sent block flips it back to UNSENT** on the keystroke
  that breaks the match, and restoring the words flips it back (whitespace she
  cannot see is not an edit); **a REFUSAL banks nothing** — nothing drew and
  nothing was charged; a **PUT-BACK reads SENT**, because those words came off
  a clip that really drew, so a put-back-and-tweak flips the moment she changes
  a word (and so does `use this` off the ‹ › walk); and **`clear` leaves the
  bank alone**, so the undo hands her blocks
  back still knowing which of them went. What is banked is the block's own
  words **without the two heads** the send puts on top of them (`peelHeads`,
  ONE copy of that rule, shared with the put-back — `copyBack` took the cast
  head it peeled and that is the same peel), and a door word's re-send
  banks the body that was REFUSED rather than the box, since she may have typed
  since. The bank rides the DRAFT beside the words it is about, like `shut`, so it
  survives a reload and the page's own self-heal — **but it is written by
  `saveSentBank`, which PATCHES the stored draft, and never by `saveDraft`,
  which rebuilds it from the live DOM (MEASURED: a send answers a round trip
  later, so a `saveDraft` there writes the old scene back over a hand-off or a
  put-back that landed in between, and it is why main deliberately leaves the
  draft alone on the send path)**; it is the page's own red
  (`#a0402a`, the refusal line's) and never a second one; `margin-left:auto`
  puts it at the end of its own heading in both fold states; **`paintSent`
  reads the BOX and never `paintBlockHead`'s `txt`**, which on a story part is
  the PART's own words rather than the prompt (the red word is about what is
  about to be sent); and the mark has
  **its own painter** (`paintSent`) so a keystroke can repaint it without
  walking every heading and every join row — an ordinary keystroke writes
  nothing at all (the 2026-09-12 typing rule). Full
  note: *DIVIDE
  HERE* in `docs/modules/audio-and-film.md`; tests
  `node scripts/test-footage-sent-mark.js` (the real page headless — every
  assertion a MEASUREMENT of what really renders or a reading of what the stub
  really received, since a mark whose CSS never landed, one painted in the
  row's own grey, one that reads SENT off a block that was merely TYPED and one
  that stays SENT after she edits a word all look identical in the source; it
  CRASHES against the pre-fix page, which has no `.bsent` at all),
  `node scripts/test-footage-divide.js`,
  `node scripts/test-footage-block-refs.js` and
  `node scripts/test-footage-block-fold.js`.
  **AND SHE PICKS WHICH BLOCKS GO IN ONE CLIP — ANY OF THEM, NOT NECESSARILY
  NEXT TO EACH OTHER (2026-09-15, Sophie: "how do i select multiple non
  adjacent text blocks in footage to send appended as one prompt").** Blocks 1
  and 3 without block 2, which neither send on the page could do. **THE HISTORY
  MATTERS HERE, because the obvious build is one she has already rejected:** an
  ALL STAR shipped 2026-09-13 at her own ask ("sending two boxes at once"), was
  corrected the same hour to ONE appended clip rather than N jobs, and was
  taken out again a day later on her note "button is stipid get it out"
  (#2397). What she rejected was a SECOND BUTTON that sent every written block
  or nothing; what she is asking for here is the pick it could never do. So:
  **the star is still the ONLY send** and it READS the marks — a second button
  must not grow back, and `test-footage-audit-5.js` pins exactly that rather
  than the old "only the active block sends".
  **A MARK PER BLOCK, ON ITS OWN HEADING** — a rounded square at the house 6px,
  grey outline empty, the page's own red with a check when it is on (her words
  for what a checkbox is, from the keep-pile's read box), never a circle. It is
  a SPAN with `role="checkbox"` and not a button, because the heading IS a
  button and one inside another is invalid markup — the same reason the ‹ ›
  walk sits on a row of its own — and its tap **stops propagation**: the
  heading's own handler would fold the block away and the document's
  `.promptwrap` handler would drag the gold line onto it, where marking a block
  is "send this one too" and never "work here" (PHOTOGRAPHED: the gold line
  stays where she left it). The band is the target and the box is the picture
  (the `.mtick` rule) — 16px of paint with a transparent `::before` carrying
  the thumb's ~28px, so the row is the height it has always been.
  **THE STAR SAYS WHAT IT WILL SEND** — `Go` with nothing marked, `Go · 3` with
  three — because those words are spread over blocks she may have folded away,
  and the label is the read-back at the moment of the tap (her "have me approve
  the prompt and references" rule, on a page where the page itself is the
  read-back). **The price beside it is the UNION's**, asked with the union's
  own shape and counts, because that is the clip the tap sends and ten pictures
  is a job Atlas must refuse where one is not. ONE price path and not two — the
  removed All star needed a second estimate only because it was a second
  button. **`sendingJob()` is the one answer** to "what would the star send",
  read by the price, the keyframe note, the doors card and the star.
  **THE UNION IS BUILT THE WAY A JOIN IS**: every picked block's references
  deduped in block order and put in the doors' order (`pickStrip`), the two
  keyframe marks going to the first picked block that has one, and **every
  block's words renumbered onto it through `reslotText`** — a slot name is a
  POSITION, so block 3's `[Image1]` is a different picture from block 1's and
  appending without the rewrite would draw the wrong reference silently, which
  is the one failure this page must not have. **The cast rides with its own
  block and the setting once at the top** (`withSetting`): characters is the
  BLOCK's since 2026-09-14, so several picked blocks are several casts and it
  cannot be lifted to the head of the scene the way the room can — that is the
  one place the order differs from a single block's send, and it differs
  because there are several casts and one room.
  **THE MARK IS A FACT ON THE WRAP** (`__pick`), like the strip and the cast
  beside it, so a **divide COPIES** it (the tail is half of a scene already in
  the next clip), a **join keeps** it if either half had it, **taking the first
  block off** brings block 2's mark up into `#prompt` with block 2's words, and
  the **draft** (`picks`, by position, beside `shut`) and the **`clear` bank**
  carry it, so it survives a reload and `undo` puts it back. Written only while
  something is really marked, so a page that never marks one saves exactly the
  draft it always saved. **A mark means nothing on a one-block page and an
  EMPTY marked block has nothing to append** — both are simply not picked, and
  the mark she can see on an empty block is the page saying so; typing into it
  puts it in and the star's count says so on that keystroke.
  **OVER $3 IT ASKS** — the house rule as a second tap rather than a dialog:
  the first arms the star (a gold ring, the accent this page already uses for
  "this is the one") and names the total, the second sends, eight seconds or
  any change to the picked set disarms it. **NO FIGURE, NO SEND** — the removed
  star's own audit finding, kept: skipping the ask whenever the estimate had
  not landed is how it came to send at any price with no read-back at all.
  **It arms only on a picked send**; a single block's star is one tap today and
  stays one tap. **Her blocks are not touched and the ticks stay**, so sending
  again is one tap — and **every picked block banks its own words**, so all of
  them read `sent` afterwards rather than none (the joined prompt is in no box
  on the page and would mark nothing). **An appended send belongs to no one
  story part** and carries the story with no `unit`, rather than filing a clip
  of four parts under whichever was first. Test:
  `node scripts/test-footage-pick-blocks.js` (the real page headless, every
  assertion a MEASUREMENT — the tap asked with `elementFromPoint` at the mark's
  own centre, the gold line and the fold read back after a tick, the posted
  BODY read off the stub rather than the page, and the arm driven both ways;
  verified failing 34 pre-fix).
  **AND CHARACTERS & SETTING IS ONE FOLDED BLOCK THAT RIDES ABOVE THE BLOCK
  SHE IS IN (2026-09-14, Sophie: "characters/setting become one collapsed
  block w two text boxes" · "characters/setting move to above currently
  selected block, w relevant characters for that block").** It shipped a day
  earlier as TWO permanent blocks pinned at the top of the panel (2026-09-13,
  "i envision two permanent default collapsed blocks at the top of footage:
  characters, then setting") and a day of cutting settled two things: they are
  ONE thought, so they are one fold with two boxes rather than two rows of
  chrome above every scene; and **who is in a shot changes shot to shot where
  the room does not**, which is what "relevant characters for that block"
  says. So **CHARACTERS IS THE BLOCK'S** — `__chars` on the wrap, exactly the
  shape its strip already has, so tapping into another block hands its cast
  back the way its pictures come back — and **SETTING IS STILL THE STANDING
  VALUE**, one per project, riding every clip. `placeHeads` puts the wrap
  directly above the active block on every paint, which is what makes the move
  earn its cost: a block carrying the same words wherever it sat would be
  churn. Eight things not to undo: **it is not `blocks()`** (the wrap is
  `.headwrap`, each box sits in its own `.hpart` and is still `.hblock`, never
  `.promptwrap`/`.pblock` — and `.hpart`, NOT `.hrow`, because the story
  blocks took `.promptwrap .hrow` for their prompt-history walk); **the gold
  line never moves to it** (`setActive` is reached through
  `closest('.promptwrap')`, so tapping into Characters leaves the star
  pointing where she left it); **the NODE IS HELD, not hunted** (`HEADWRAP` —
  `paintBlocks` takes it OUT while it rebuilds the join rows, so a lookup that
  walks `panel.children` answers null exactly when `placeHeads` needs it and
  the whole block is lost on the first divide; MEASURED, it simply vanished
  off the page); **a join row's two blocks are its nearest `.promptwrap`
  either side, never its siblings** (`blockSide` — the wrap sits in that gap
  and is SHUT by default, so reading the plain sibling hid every join mark);
  **an empty box adds nothing**; **permanent means no ✕ and no divide**;
  **`clear` wipes the cast with the blocks and leaves the room** (the cast
  belongs to a block, so it rides the bank and `undo` puts it back — that
  follows from the split rather than loosening the 09-13 rule); and **shut is
  where it starts, every load** — the one place this page folds by default,
  safe only because **shut, the heading says both sets of words**, cast first.
  A divide copies the cast into the tail, a join unions the two, a put-back
  re-homes the cast it stripped off the card's prompt onto the block it makes
  (the log's own `words` win when the card has them), and a draft from the
  two-block day seeds EVERY block with the one `heads.characters` it saved.
  Named `paintHeadBlock` because the page header already has a `paintHead`,
  and a duplicate function DECLARATION is not an error — the last one in the
  file wins, silently. Full note: *CHARACTERS & SETTING* above in this file;
  test `node scripts/test-footage-heads.js`.
  **A BLOCK IS A STORY PART, AND ‹ › WALK THE PROMPTS ALREADY SENT FOR IT
  (2026-09-14, Sophie: "replace footage blocks w story blocks, next and back
  to see old prompts").** The Story Timeline's Send to Footage carries the
  story by id and one entry per connected part (`story: {id, title}`,
  `units: [{key, ids, text}]`, `key` = the part's FIRST moment id — it
  survives a reorder and a join, and a split makes a new part with a new key);
  Footage binds the page to the story (`STORY`, on the draft) and each block
  to its part (`unit` + the story's own words `utext` on the block's job, so
  every path that already carries a strip — a divide, a join, the draft, the
  bank, a put-back — carries the part with it). A block's heading says
  **Part N** and, shut, the STORY's words for it rather than the prompt's; the
  panel row names the story; a one-part story still draws its heading. **THE
  SAME STORY SENT AGAIN MERGES** — a part she already has keeps the prompt she
  wrote here, its pictures and its fold (sub-blocks she divided out of it
  included), a new part comes in with its words, a part gone from the story
  goes (the whole job is banked first, `undo` has it), and the order is the
  story's; a different story, or a belt scene, replaces as it always did and a
  belt scene unbinds. Nothing writes back to the story — the Story Timeline
  is where the story is edited. **EVERY SEND FROM A STORY BLOCK IS TAGGED**:
  `story`, `unit` and `words` (the block's own text BEFORE the two heads) ride
  the body the way `project` does, the doors file them on the log doc
  (`video-log.js` whitelists the first two, caps `words` at 4000; a REFUSED
  send keeps them too), `cardOf` answers them and `GET /jobs?story=&unit=`
  filters over the whole log before the page is cut (a story is asked by
  name, so a tucked project does not narrow it). An appended All send carries
  the story only — it spans parts. **THE WALK** is one read per story
  (`loadHistory`, `/jobs?story=<id>&limit=300`, grouped by part, newest first;
  on bind, on load, and on coming back to the tool throttled like the panels
  sweep; a send this page makes lands on its own part at once) drawn as a
  small `‹ now · 3 sent ›` row under the heading of a part that has been sent
  from and NOWHERE else (the silence rule). ‹ shows the old prompt READ-ONLY
  in the box's place — the box and its corner buttons leave the layout, and
  stickybox is told (`hidden`, then `sync()`), because a pinned button is
  `position:fixed` and went on floating over the words (PHOTOGRAPHED) — with
  one line under it (`sent Sep 14, 10:34 pm · 4s · 2.0 Mini · drawn`, a tap
  goes to that clip's card) and **use this**, which is the card's own
  `copyBack` (the references and the settings ride, `undo` has what was
  there; `stay:true` keeps her where she is). `copyBack` puts back `words`
  when the log has them — the whole `prompt` carries the heads, and a box the
  heads are prepended to again would send them twice. Stepping never saves and
  never sends, and **the star REFUSES while an old prompt is showing** (the
  star sends the box, which is exactly what she cannot see then). Not built:
  editing a part's words back into the timeline, history for a plain (non-
  story) block, a belt scene's hand-off carrying a story. Tests: `node
  scripts/test-footage-story-blocks.js` (the real page headless against a stub
  that files what it receives — every assertion a MEASUREMENT: the parts and
  their keys, what a send really carried, the merge keeping her prompt, the
  old prompt read back off the log after a reload, the box really out of the
  layout, the star's refusal, `use this` and its bank, a belt scene unbinding,
  a plain page unchanged) plus the story rows of `test-timeline.js` and
  `test-video-log.js`.
  **AND A STORY TIMELINE STORY COPIES OVER, ONE CONNECTED PART PER BLOCK
  (2026-09-13, Sophie: "how do i copy a story to footage · each connected part
  its own section · lines breaks back").** A **Send to Footage** link on an open
  story writes the ordinary `footage_handoff` key — same origin, no route, no
  doc — with one entry in a new `blocks` array **per UNIT**, since a unit is
  what she joined together there and so is the part that belongs in one clip,
  and the moments inside a unit joined by a **newline each** (her "lines breaks
  back" — never run together into a paragraph). Four things not to undo: the
  link is a **REAL link** to `/footage` (on her phone that opens the app on the
  tool — the scene-index keys' own pattern) and **NOTHING IS SENT**, the star is
  still her tap; `blocks[0]` also rides as `prompt`, so a Footage page cached
  from before this reads the first part as it always did; **a blank entry is
  dropped** rather than becoming an empty block the star could send; and
  `setBlocks(list)` is the ONE writer on the Footage side — `collapseBlocks` is
  a call to it with one string, so a belt scene's hand-off is byte-for-byte what
  it was. The button is drawn only once the story has something to send. Tests:
  `node scripts/test-timeline.js` and `node scripts/test-footage-handoff.js`
  (verified failing 5 pre-fix).
  **WHAT CHANGED BETWEEN TWO CLIPS — THE COMPARE MARK ON EVERY CARD
  (2026-09-11, Sophie: "is there an easy way I can diff video clips like I
  can't remember what I changed … sometimes it's a single line or a reference
  for the model the timing etc · It's always been Sophie clips since they're
  pretty similar").** One tap opens a paper sheet on this clip against the
  clip BEFORE it in the same project and draws only what moved: a word diff
  of the prompt (in = underlined on green, out = struck on rose), one row per
  setting that changed (`seconds 8s → 12s`), and the references slot by slot
  — a different picture in `[Image2]` is ONE `swapped` row, named off the
  cast library ("Sophie · the blue pajamas"), never a Storage hash. `‹ older`
  / `newer ›` walk the other side along the project, `pick a clip` lets her
  tap any card's mark instead, and a clip older than the page holds is read
  off the server one at a time into a side pool (the `… older` cursor is
  untouched). **Nothing new is stored** — every card already carries the
  prompt, the settings and every reference, and `clip-diff.js` (pure, served
  at `/clip-diff.js`) is the one rule the panel and the test drive. **LINES
  FIRST, AND THE OTHER SIDE IS THE NEAREST TWIN (the same evening, her
  screenshot of the live panel: "text looks wrong. It should call out
  exactly what changed")** — a whole-prompt word LCS against the clip merely
  before it in time lined up every "the" in two unrelated paragraphs and
  painted a hash. Now the prompt is diffed as LINES (a near-twin line is
  word-diffed against its twin, anything else is a whole line out or in),
  `kinOf` picks the nearest older clip in the project sharing 0.4 of its
  words (the page over what it holds, `GET /api/footage/jobs/:id/kin` over
  the whole project when the twin is further back), and with no twin the
  panel says "a different prompt" and shows the words plain rather than a
  hash. Full note: *WHAT CHANGED — THE COMPARE PANEL* in
  `docs/modules/audio-and-film.md`; test `node scripts/test-clip-diff.js`.
  **CLEAR, AND THE UNDO BESIDE IT (2026-09-11, Sophie: "add a clear button to
  footage · with an undo · make a draft save automatically").** Two underlined
  words at the end of the star's row — the house inline opener's paint, never a
  boxed button — each drawn only while it means something. **Clear wipes the
  JOB**: every block, the references, the two keyframe marks and the seed. It
  leaves the SETTINGS alone — the model, the size, the shape, the seconds and
  the project are hers and sticky, and a clear that reset them would be the
  shape rule running backwards once a day. Five things not to undo:
  - **IT ASKS NOTHING.** She asked for an undo INSTEAD of a confirm, and that
    is the cheaper direction: a confirm costs a tap on every clear, an undo
    costs one only on the clears she regrets. The Playground's panel Clear asks
    over unseen work; this one never does, because nothing here is lost.
  - **THE CLEARED JOB IS SAVED AUTOMATICALLY — the third line of her ask.** Her
    words and her references have gone into `footage_draft` on every keystroke
    since the blocks landed; what was missing is the one moment that
    deliberately EMPTIES that draft. The cleared job is banked in its own key
    (`footage_cleared`), so the undo survives a reload, an app restart and a
    deploy rather than living for the life of one page — which matters here,
    because the app keeps this web view alive for the whole app process.
  - **UNDO IS A SWAP, so it can never lose anything**: the banked job comes
    back and whatever was on screen takes its place in the bank. Tap it again
    and you are where you started. The one asymmetry is deliberate — swapping
    back an EMPTY job drops the bank rather than leaving an `undo` on screen
    that would restore nothing.
  - **THE SEED RIDES THE BANK, the one exception to "the seed is never sticky
    across loads".** That rule is about a value that rides a job with nothing on
    screen saying so; here the tap IS the saying, and the number lands back in
    its own visible box. An ordinary reload still opens with the seed box empty.
  - **A BELT HAND-OFF BANKS THE JOB IT REPLACES.** `takeHandoff` overwrites the
    draft in the same breath it replaces the box, so a belt scene arriving on
    top of a scene she was writing was the one silent loss left on this page —
    and the comment there claimed the opposite. The undo is exactly the
    mechanism for it.
  **BOTH WORDS SIT ON THE STAR'S OWN LINE SINCE 2026-09-13 — THE SEED MOVED OFF
  THIS ROW.** It used to wrap and her own rule said so ("same row unless it
  bleeds over"): MEASURED with the Buttons fold open, the seed (130) + the star
  (75) + the price (95) plus two 8px gaps left 24px of a 340px row against a
  25px word, so a drawn word landed hard right on the line under the price
  (40px → 69px). With the seed up in the BUTTONS row the four sit together and
  the row costs no height at all. With neither word drawn the GROUP is
  hidden outright, so an empty page is byte-for-byte the row it always was. `paintWipe` is called from `saveDraft`, which is the ONE signal
  every path that changes the job already sends. Test:
  `node scripts/test-footage-clear.js` (the real page headless — every
  assertion a MEASUREMENT or a reading of what really landed in storage, since
  a clear that empties the box and leaves the references attached, a bank that
  never reached localStorage, and a word drawn where the pill covers it all
  look identical in the source; verified failing pre-fix).
  **THE WHOLE PROMPT AREA USED TO FOLD, AND SHE HAD IT TAKEN OFF (2026-09-14,
  Sophie: "remove prompt collapse").** It shipped 2026-09-11 as the one button
  down to the gallery — a **PROMPT** row led the panel and shut, the panel WAS
  that row — and it is **HISTORY now, not a rule: do not build it back.** What
  went with it: `.panelrow`, `#panelfold`, the `panel` entry in `FOLDS`,
  `panelLab()`, `.panel.shut`, the `openFold('panel')` every path that put
  words in the box had to remember, the row's own sticky `--headtop` pin, and
  `scripts/test-footage-panel-fold.js`. **What survives, so the gallery is
  still one gesture away:** the FEED BAR is sticky, so the view switch, the
  marks, the search and the project picker are on screen all the way down, and
  the three folds that are still hers — each block's own heading, References,
  Buttons — each put a third of the panel away. Three readers moved with it:
  the STORY's own name is its own `#storyrow` label at the top of the panel
  (it rode that fold row, and a page of parts with nothing saying which story
  is a hand-off she has to remember — drawn only while a story is bound);
  `goToBlock` aims at the characters-and-setting wrap when that sits above the
  block it is walking to (landing the BLOCK at the top would push the two
  boxes belonging to it off the screen, which is the one thing the move was
  for); and `test-caret-under-button.js`'s sticky-row section measures the
  RULE — nothing pinned, at either end, over the line she is typing on —
  rather than that one row.
  **THE SEED IS ON THE CARD AND IN A BOX SHE CAN TYPE IN (2026-09-10, Sophie:
  "put a seed box that exposes the seed after the clip is drawn and put a copy
  button next to it so I can reuse the seed … make it into a text box so I can
  change it if I want to").** Every clip has always CARRIED a seed —
  `video-seed.js` mints one per job when the caller sends none — and it was
  reachable only from the job log: `cardOf` dropped it and the page never sent
  one. Now `#seedbox` sits at the end of the controls row (its own row when the
  row wraps), every finished clip's card carries a `seed <n>` line with a copy
  button, and the card's put-the-prompt-back button fills the box too.
  **AND IT IS REALLY IN THAT ROW SINCE 2026-09-13 (Sophie: "seed textbox shud
  go on the same row as the other buttons above").** It had been living in the
  STAR's row and folding away with the Buttons by hand — the same fold spelled
  twice — while it is a SETTING like the model and the size. Three things came
  with the move: the row is THREE lines inside the pill's reserved column
  (MEASURED at 390pt, 563px of controls and their gaps against 291 — two is
  arithmetically impossible, and her "same row unless it bleeds over" is what
  allows the wrap), the STAR's row stopped wrapping so `clear`/`undo` sit
  beside the price and **the panel is no taller than it was**, and `pillRect`
  now measures the band the pill WOULD fill WITH ITS ARROWS — the back-to-top
  and to-the-bottom arrows appear a screen into the scroll and grow the rail
  ~92px, and this row sits 3px off the short band's edge (page y 276 against a
  band ending at 273), so without that the reserve arrived only once she had
  scrolled and the row re-wrapped under her: the 2026-09-11 "switches back and
  forth between narrow and full width" complaint, one row down. `goToCard` asks
  for `fitPillGap` before it measures for the same reason — the reserve lands a
  frame or two behind a view change, and a card measured against a panel that
  is about to grow leaves the window 42px short of the card she tapped.
  - **BLANK MEANS A FRESH ONE, AND THAT IS WHY IT IS NOT STICKY** — nothing is
    stored across loads and `copyBack` CLEARS the box for a clip that carries
    no seed (an older clip, one drawn before the mint), the *only change what
    the record knows* rule. A seed left in the box from last week silently
    pinning tonight's clip is the Playground's hidden-ingredient failure.
  - **AN UNUSABLE VALUE IS DROPPED, NOT SENT** — `videoSeed.okSeed` is the ONE
    rule both sides ask, so the box and the door cannot disagree; `seedFor`
    would replace a bad value at the door anyway and the card would then read
    back a number she never typed. Digits are cleaned on BLUR, never while she
    is still typing.
  - **THE CARD'S SEED IS WHAT THE DOOR REALLY USED** — `startJob` reads it off
    the door's own `params`, so the optimistic card carries it without waiting
    for the first poll, and `cardOf` reads `params.seed` off the log. A clip
    with none shows no seed row at all (the Assets tab's silence rule).
  - **CLEARING IT NEVER OPENS THE KEYBOARD (2026-09-14, Sophie: "exing seed
    shud not trigger keyboard").** The ✕ used to `focus()` the box after
    emptying it — the home search bar's rule, where she is mid-hunt and about to
    type again. Here the ✕ means *no seed on this clip*, which is the END of
    typing, and this box sits in the CONTROLS row, so the keyboard rose over the
    star and the price. The focus is gone, and the button's pointer press is
    `preventDefault`ed so the tap can never land in the field (the ✕ is
    absolutely positioned INSIDE the input's padding, so a tap at its edge lands
    on the input itself).
  - Test: `node scripts/test-footage.js` (the seed section — the box ships
    empty, nothing sticky, the card's line, the copy filling the box, what the
    job REALLY receives, copyBack filling then clearing, and the ✕ MEASURED as
    leaving the caret out of the box — a `focus()` left in the handler and one
    taken out look identical in every assertion about the box's value).
  **A REFERENCE UNDER BYTEDANCE'S PIXEL FLOOR IS UPSCALED BEFORE IT IS SENT —
  AND THE CARD SAYS SO (2026-09-10, Sophie: "the first was just an iPhone ·
  why failed").** Her first video reference was refused at validation, free,
  with `InvalidParameter.PixelCountTooSmall: Pixel count must be between
  407696 and 8295044` — the clip was **480×360 = 172,800 pixels**. **It really
  was an iPhone recording (the file still carries Apple's `com.apple.quicktime`
  camera keys) and NOTHING HERE SHRANK IT**: the page sends raw bytes and the
  Dump stores video untouched (its one re-encode is HEIC stills, explicitly at
  original size). iOS downscaled it on its way out of Photos through the web
  file picker, so a reference she picked in good faith failed with an error
  that reads like a bug in the tool. `video-floor.js` is the rule (the floor
  and the ceiling are ByteDance's, so it is door-agnostic) and
  `ensureVideoFloor` in footage.js bakes the copy. Four things not to undo:
  **her original is never touched** (a new object under `footage/upscaled/`,
  the webp rule applied to video), **it is baked once** (content-addressed by
  the source url and the canvas, so a reference re-used on ten clips encodes
  once and every later send is a HEAD), **it is best-effort and never blocks a
  send** (no ffmpeg, no bucket, a probe that will not read, a failed encode —
  every one answers the ORIGINAL url, so the job goes as it would have gone
  and fails honestly at the door rather than the guard being what breaks it),
  and **it is LOUD** — the card says what the clip was, what was sent, and
  that her original is untouched, because a step that silently transforms what
  she attached is exactly what *nothing stands between the source and the
  output* forbids. **The probe reads DISPLAY dimensions**, so a phone clip
  carrying a rotation matrix is measured the way the model will see it.
  **IMAGES ARE DELIBERATELY NOT COVERED** — a reference still has its own floor
  and nothing has measured it; applying this number to stills would be a guess
  wearing a measurement's clothes. Test: `node scripts/test-video-floor.js`
  (the rule pure, then a REAL encode measured with ffprobe — a plan that reads
  perfect and a file still under the floor look identical to any source
  assertion).
  **A TILE CARRIES BOTH DOORS, AND THE NOTE ON IT ALONG THE TOP (2026-09-10,
  Sophie: "can u have a play button, and a list view button on tiles · so both
  options are available" · "i also wanted notes to show as the firs words that
  fit on just the top of the tile" · "just my notes · not claude's").** Two chips in the MIDDLE of every tile —
  **▶** plays it, the list mark opens its card — and **the poster itself is not
  a button**: with two doors drawn on it, a third meaning hidden under the
  picture is the thing that started this thread. The middle is the one place a
  tap is never near another control at three across OR at four (the corners are
  spoken for: the marks below, the note above), and the row they sit in is
  `pointer-events:none` — a transparent strip across every tile would swallow
  whatever it lies over (the toast's own lesson, one page down). A clip with no
  url yet carries the CARD door alone rather than a play button that would do
  nothing. Along the top: **HER newest note, never a chat's answer** — the strip
  is what tells one poster from the next when she is scanning for the one SHE
  said something about, and a chat's reply is the answer to a question she
  already knows she asked (the whole exchange is on the card). It shipped as
  the newest message whoever wrote it and she cut that within the hour; **a
  clip only a chat has spoken on draws no strip at all.** "Hers" is anything
  not stamped `chat`, which is exactly how `paintThread` draws the same thread
  one function up — one page, one meaning of whose words those are, so a legacy
  note carrying no `from` reads as hers in both places.
  Four things not to undo: **"the words that fit" is the BROWSER's answer**
  (one line, `text-overflow:ellipsis`) — a character count guesses at a width
  that changes with the column count; **it wears the marks' own flat plate**,
  because white text on a bright frame is unreadable and a scrim behind it may
  not be a gradient (the house rule); **the scissors rides in the same row**
  rather than under it, so the trim mark and the words can never sit on each
  other; and it is painted in `paintTileNote`, **outside the wall's
  signature** like the marks and the cut chip, so a note landing never
  re-decodes a wall of posters. A clip nobody has said anything about draws no
  strip at all — the Assets tab's silence rule.
  **A TILE GOES TO ITS CARD, NOT TO THE TRIMMER (2026-09-10, Sophie: "clicking
  on a tile in footage · scrolls to it in list view, or opens in a lightbox").**
  The wall is for FINDING a clip; the CARD is where the clip lives — its words,
  its tags and price, its seed and the button that puts it back, its
  references, save, the note thread — and none of that was reachable from the
  wall at all, because the tile's face went straight to the player. So a tap
  switches to LIST, scrolls the window to that clip's card and flashes it, and
  the card's own picture is what plays it. The list is the detail view this
  page already has: one of them, never a second copy behind a second overlay.
  Four things not to undo: **the play triangle came OFF a poster tile** — the
  poster stopped being a button at all, and a play glyph on a picture that does
  nothing is the tile lying (a clip with no poster still needs a face: the film
  mark when it is finished, the ✕ when it failed). Play came back the same day
  as its own chip, above; **the WINDOW is scrolled, never
  `scrollIntoView`**, which walks every scrollable ancestor (the caret keeper's
  and `__pagePlace`'s own rule); the measurement is **TWO frames out**, because
  `#feed` was `hidden` a moment ago (every card reads y=0 in that frame) and
  `resyncClamps` adds its "… more" openers in the first, which moves every card
  under them; and **the flash is what says WHICH card** — a scroll that ends
  silently on a page of near-identical boxes leaves her hunting the clip she
  just tapped. **AND A CARD REBUILT UNDER HER KEEPS HER OPEN NOTE BOX AND THE
  WORDS IN IT** — found by this test landing in the window where it happens.
  The thread was already painted outside the card's signature so a note LANDING
  never rebuilds the card, but anything the card PRINTS changing rewrites it
  whole, and a vote coming back from the server is the ordinary one: she taps
  the heart halfway through a note and the box went with it. The node is lifted
  out and put back rather than re-made, so its own Send and Cancel keep working.
  Test: the tile-to-card and rebuild blocks of `node scripts/test-footage.js`
  (every assertion a MEASUREMENT — a tap that switches the view and never moves
  the window, one that lands on some other card, and one that also opens the
  trimmer are the same markup to any source assertion; the smooth scroll is
  waited out by watching it SETTLE, since asking whether the card is on screen
  answers true before the scroll has begun. Verified failing both ways pre-fix).
  **SHE CAN NOTE ON A CLIP, AND IT IS THE HOUSE THREAD — TWO DOORS, ONE
  CONVERSATION (2026-09-10, Sophie: "can you make it possible to add notes on
  clips that come out of the footage module?").** A speech mark on every
  finished clip's card opens an empty box, and PLAYING one gives her
  `/filmnote.js` — tap to pause, note the SECOND she stopped on — the ONE
  implementation, the same one the Chats app's pinned film and compare.js's
  video lightbox use. **Nothing new is stored and no route was written:** both
  doors POST `/api/gallery/assets/note` and the card reads
  `GET /api/gallery/assets/notes?chat=<the chat /status serves>`, so a note on
  a clip rings the wake doorbell, lands in the ONE inbox every chat sweeps,
  and is answered ON the note (`from:'chat'`) rather than in a reply she has
  to hunt for. Six things not to undo:
  - **THE CHAT IS SERVED, NEVER TYPED** — `/status` already answers the
    module's own `chat` (`footage`), so the page and `footage.js` cannot
    disagree about where a note lands.
  - **THE THREAD IS PAINTED OUTSIDE THE CARD'S SIGNATURE**, with its own — the
    wall's own rule one card in: a note landing must never rebuild the card
    and re-decode its poster.
  - **NOT ON THE DRAWING POLL.** `loadJobs` runs every few seconds while a
    clip draws and the notes route is two Firestore queries. The notes are
    read on load, on `visibilitychange`→visible (inside the app that is the
    only moment a stale page is about to be read), and when the player closes.
  - **HER WORDS ARE NEVER LOST TO A REFUSAL** — the box empties only once the
    server has the note, and an over-length one comes back REFUSED with the
    count (the asset-note route's own rule) with her text still in the box.
  - **A CLIP WITH NO URL CARRIES NO MARK** — the Assets tab's silence rule; a
    drawing or failed job has nothing to note ON.
  - **ONLY THE BACKDROP CLOSES THE PLAYER NOW** (chats.html's rule). It used
    to close on "anything that is not a VIDEO", which would eat every tap on
    filmnote's own Note button and inside its sheet.
  Test: `node scripts/test-footage.js` (the note section — every assertion a
  MEASUREMENT or a reading of what the stub server really received, since a
  box that opens and posts nothing, a note filed under the wrong chat and a
  thread that never reaches the card are the same markup).
  Full note: *FOOTAGE* under the OpenRouter note in
  `docs/modules/audio-and-film.md`.
  **EVERY REFUSAL IS ONE TABLE AND THE CARD SAYS WHY (2026-09-10, Sophie:
  "check for other refusal reasons, make sure they're documented and called
  out").** `video-refusals.js` matches every reason the three doors have ever
  sent (measured over all 238 jobs on the log) and answers a kind — `shape`
  (the request: reference videos over 15.2s together, the pixel floor, 4-15
  seconds, a lone reference video read as an extension, a picture outside
  2:5-5:2) · `content` (an input gate — a person or a famous face, the one
  kind a door falls back on) · `output` (drawn, then blocked: video
  copyright 1012004, video sensitive content 1012006, AUDIO copyright
  1012009 — unbilled, probabilistic, re-send) · `down` — and a line in her
  words, which the footage card paints in red over the door's own text and a
  refused tap answers as `why`. **The 15.2s reference-video total is checked
  before the tap leaves** (Atlas only, from the floor probe's banked lengths).
  **AND A REFUSED ATLAS JOB COMES BACK UNDER HTTP 400** with the record in
  the body — read as the answer since #2283; before that a refused clip said
  "drawing" forever. A reason the table has not met paints the raw text
  alone: add a row. Full list: *EVERY REFUSAL A DOOR HAS SENT* in
  `docs/modules/audio-and-film.md`; test `node scripts/test-video-refusals.js`.
  **SAVE GOES TO PHOTOS, NOT TO A DOWNLOAD (2026-09-10, Sophie, on the card's
  save link: "shud save directly to my photos").** It was an `<a>` at the
  clip's own url — in the app that opens a player she then has to long-press
  out of. It is a button now, and `saveVideo` is the Playground's own ladder
  with a clip in place of a picture: the native `forgeSave` bridge in the app,
  the share sheet ("Save Video") in Safari, a plain download on a desk.
  - **THE BRIDGE ROUTES A VIDEO TO `VideoSaver`** (`ForgeSaveBridge.swift`) —
    Photos takes a clip only as a FILE added as a `.video` resource, so the
    raw `Data` `PhotoSaver` handles can never save one. **WHICH it is is asked
    of the url and then of the server** (the extension, else a HEAD's
    `Content-Type`), never of the page: the doors hand back their own urls (a
    Storage object ending `.mp4`, an Atlas clip with no extension), and the
    body stays a plain String so an older page posting an image url is
    unchanged. A HEAD it cannot read answers "not a video" — the safe
    direction, since the picture path reports Photos' own words.
  - **AND `GatedWebTool` INSTALLS THE BRIDGE FOR EVERY PAGE IT HOSTS.** It had
    been installed per tool (the Playground and Meta Assets), so any page
    under that wrapper could offer nothing better than a download —
    remembering to add it is exactly the kind of thing that gets missed, the
    way `?embed=1` was. **The Swift half ships with a TestFlight build**; until
    she installs one the page falls through to the share sheet, and an older
    build reports Photos' refusal in its own words rather than saying nothing.
  - **THE SHARE SHEET NEEDS THE BYTES ALREADY IN HAND**, so `primeSave` starts
    the fetch on the button's `pointerdown` — a fetch inside the tap handler
    spends the transient activation and `navigator.share` rejects silently
    (asset-actions.js's own lesson). Not ready at the tap → "Getting the clip —
    tap save again in a moment", never a silent nothing.
  - **THE BUTTON IS A WORD, NOT A BOX** — the same paint the link wore
    (underlined, hard right), so nothing on screen moved. PHOTOgraphed.
  - Tests: `node scripts/test-save-to-photos.js` (the bridge's video route and
    the wrapper's install, pure) and the save block of
    `node scripts/test-footage-trim.js` (what the bridge REALLY receives on a
    trimmed clip — an href assertion cannot follow a button).
  **SHE TRIMS A CLIP AS IT COMES OUT — THE PLAYER IS THE TRIMMER (2026-09-10,
  Sophie: "how hard would it be to make it possible to trim clips right as they
  come out of the footage module?").** A Mini clip is 4-15 seconds and the shot
  inside it is usually shorter — the model holds a beat before the move starts
  and drifts at the tail — and the only way to lose either end was the Film
  Editor, a tool away, so a clip she liked went into the draft carrying its
  dead air. Tapping a clip opens the lightbox it always did, with two marks
  under the picture: **Start here** / **End here** land at the playhead, `‹ ›`
  walk the playhead a tenth of a second so a mark can be placed exactly, the
  strip shows what is kept against the whole clip, and **Trim** bakes it.
  `POST /api/footage/jobs/:id/trim {start,end}`; `{clear:true}` undoes it.
  **IT COSTS NOTHING** — ffmpeg on our own box, no model call, no door; what
  she paid for is the clip, and trimming and undoing are both free.
  - **HER CLIP IS NEVER TOUCHED.** A part is a NEW object under
    `footage/trims/` and `video` on the log doc — the clip the door drew — is
    never written; `trims` is a list beside it, so the poll, the exact-prompt
    log and the 1080p-redo list all go on seeing the original and taking a
    part off is one entry off that list rather than a restore.
  - **ONE CLIP HOLDS SEVERAL PARTS (2026-09-10, Sophie: "Can you also make it
    possible to re-cut the same whole clip after I've cut it to also get a
    second part").** `trims` is the shape; the singular `trim` this shipped
    with is READ as a list of one, so nothing already on file needed
    migrating, and `cardOf` still answers `trim` as the first part for a page
    cached from before. `POST /jobs/:id/trim` is the one door: `{start,end}`
    adds a part, `{start,end,replace:<key>}` swaps one span for another IN ITS
    OWN PLACE in the order, `{remove:<key>}` takes one off, `{clear:true}`
    takes them all off. A TRIMMED clip opens on its FIRST PART and plays just
    that (2026-09-25, "change default to play just trimmed part"; until then
    the marks opened on the whole clip) — what she has cut is the dim bands on
    the strip and a row each under it; a row's span PLAYS that part (the
    Replace mode a row used to arm is gone since 2026-09-26, "i would never
    probly trim within an existing trim") and its ✕ is the undo, the only one
    that can mean the right part when there are several. **The player STAYS OPEN on a cut** —
    she is taking a second part out of the same clip, and closing every time
    would mean finding the clip and re-opening it between every one. `video`
    (what save and a note key off) is the FIRST baked part; the bake guard
    PATCHES ITS OWN ENTRY rather than writing back the list it planned, so a
    part she cut while one was encoding is never dropped.
  - **AND SHE CAN PLAY THE WHOLE CLIP TO CHECK THE CUT (2026-09-10, her first
    ask that morning: "can you make it possible to play the whole clip to make
    sure I cut the right part?").** *Play it all* is ONE PASS past the out
    mark, never a mode: it ends when the clip does, and any mark she moves
    ends it too; tapping it again goes back to the part and plays that. It is
    drawn only while the span is narrower than the clip — with the marks at
    the two ends, play already plays it all. **The label is short on purpose**
    (PHOTOgraphed beside "Whole clip", which resets the MARKS: two long labels
    there read as one thing said twice).
  - **THE SPAN IS ALWAYS IN THE ORIGINAL'S OWN SECONDS**, so the player opens
    the SOURCE even on a clip already trimmed — a trim can be widened back
    out, re-cut or undone. Trimming a trim would move what the marks mean
    every round and lose a generation of quality per pass.
  - **BAKED ONCE** (content-addressed by the source url and the span, so a span
    she has already cut is one HEAD and no encode) and **ONE DECODE AT A TIME**
    (`gateTrim` — a decode is the one thing that has actually killed this 512MB
    box, and a trim is never urgent).
  - **A LATE BAKE NEVER SPEAKS FOR A TRIM SHE HAS MOVED ON FROM.** Trims
    queue, so a second tap lands while the first is still encoding — and the
    write that matters is the UNDO: without the guard a bake finishing after
    `clear` puts the trim back on the doc by itself, with nothing on screen
    saying why. The doc's own `trim.key` is the authority and a bake whose key
    is no longer there stands down silently.
  - **THE CUT IS `clips.js`'s OWN `chunkGraph`** — the recipe the Chunking
    library already shares with Cut Marks, 12ms audio fades at each edge so an
    exact cut never clicks — and **the FILE is the truth about its own length**
    (a clip is 24·s + 1 frames), so the out-mark is CLAMPED to what ffprobe
    reads rather than refused against the ask.
  - **EVERYTHING IS A TAP** (Cut Marks' rule): nothing drags — the marks land
    at the playhead, **TAPPING THE STRIP PUTS THE PLAYHEAD WHERE SHE TAPPED**
    (2026-09-10, Sophie: "can you make it so I can tap where the play head
    goes"), and the steppers walk it a tenth of a second at a time. **The
    strip shipped as a READ-OUT and she overruled that the same morning** — the
    reasoning was "the video's own scrubber already seeks, and a second
    scrubber over it is one control saying two things", and it is HISTORY
    rather than a rule now; don't turn it back. **The BAND is the target and
    the BAR is the picture**: a 10px bar is far under any tap target, so the
    button is 34px tall with the light mark drawn inside it (the `.mtick`
    rule — buy the size without making the mark heavier), the fraction is
    measured off the BAR's own rect so the band can grow without moving where
    a tap lands, and it PAUSES like the steppers, because a tap on the strip
    is her looking for a frame to mark. Playing
    plays the SPAN and loops it — that is how a trim is judged before it is
    committed — but **scrubbing is never yanked**. The button's meaning follows
    the marks: **Trim** with nothing cut yet, **Add part** once something is,
    **Replace** while a part's row is picked, and where it would do nothing it
    is not drawn at all. **AND THE KEEP BAR IS NOT DRAWN AT ALL WHEN THE MARKS
    SPAN THE WHOLE CLIP** (PHOTOgraphed): a bright band over the whole strip
    covers the dim bands of the parts she has already cut, and the whole clip
    is exactly the state the trimmer opens on now.
  - **A TRIMMED CLIP SAYS SO ON THE WALL TOO (2026-09-10, Sophie: "can you
    put a little icon on clips that have been trimmed even in the tile
    view?").** A small scissors chip in the tile's TOP-LEFT corner — the two
    marks own the bottom corners — carrying the NUMBER only when the clip
    holds more than one part, the way the card's rows number themselves.
    Three things not to undo: it counts only a part that really BAKED (one
    still baking has cut nothing yet, and "trimming…" is said on the card's
    own row); it rides as a CLASS toggled in `applyFilt`, out of the wall's
    signature exactly like the ✕, so a trim landing can never rebuild the
    wall and re-decode every poster; and its **15px at top:2 is MEASURED,
    not picked** — at four across a 16:9 tile is 49px high and the heart's
    26px box starts 19px down, so the first cut sat on it.
  - **A TOAST IS A MESSAGE, NEVER A CONTROL — `pointer-events:none`, and that
    was a LIVE BUG on this page, found by measurement.** Fading to opacity 0
    does not stop an element hit-testing, so the toast box sat invisible at the
    bottom-left for the life of the page and swallowed every tap that landed on
    it — on the feed, the corner of a card. It also moves to the top while the
    player is open: a refusal she cannot read over the two buttons it is
    refusing is no refusal.
  - **AND /filmnote.js IS HOSTED ON THE STAGE, NOT THE WHOLE PLAYER.** It
    anchors everything it draws to its WRAP's bottom edge — the Note button,
    the sheet, the prompt panel, the toast — so with `#player` as the wrap its
    Note button landed ON the trim controls (PHOTOgraphed at 390x844, sitting
    over the `›` stepper). `.pstage` is `position:relative` for it, and the
    note UI now sits over the picture, where a note about the film belongs.
    Pinned by a MEASUREMENT both ways round — no overlap, and every trim
    control really takes its own tap.
  - **PHOTOGRAPHED, and it changed the layout**: centred in its stage the
    picture left ~270px of dead dimmed page between the clip and its own trim
    bar, so the two read as unrelated things. The picture is bottom-aligned
    now, its own scrubber directly above the marks.
  - **THE WAY OUT IS ITS OWN ROW ABOVE THE PICTURE (2026-09-11, Sophie: "all
    the stuff at the bottom in trim view, esp after a trim is added, makes it
    impossible to close the player").** The ✕ shipped absolute in the top-left
    corner, in the slack a bottom-aligned stage leaves — which a PORTRAIT clip
    does not leave: MEASURED at 390x700 with a 3:4 clip, the video painted OVER
    the button (later in the DOM, both positioned), `elementFromPoint` at its
    centre answered VIDEO, and 0% of the screen was bare backdrop (6.9% with
    parts listed) — no way out but the app's chevron, while
    `test-footage.js`'s presence check on `.pclose` passed. `.ptop` is a
    `flex:none` row the stage yields to, so the ✕ is on screen whatever the
    clip's shape and clear of the video's own top-left controls; the row's
    dead space closes too. **A control is TAPPED in a test, never merely
    found** — with a positional `mouse.click`, since playwright's element
    click refuses a covered target with a timeout, a crash rather than a
    finding. Pinned by the portrait block of `test-footage-trim.js` (verified
    failing 5 pre-fix).
  Full note: *SHE TRIMS A CLIP AS IT COMES OUT* in
  `docs/modules/audio-and-film.md`; test `node scripts/test-footage-trim.js`.
  **AND SHE GRABS A FRAME OUT OF THE MIDDLE — GRAB FRAME, THE THIRD WORD ON
  THAT ROW (2026-09-12, Sophie: "the last frame doesn't have the curtains" ·
  "it shouldn't file to the dump. It should give me a way to use it
  immediately as a reference for my next film").** Playhead on the frame, tap
  the word, and the frame is pulled out for any second of the clip. `POST
  /api/footage/jobs/:id/frame {at}`: a PNG at the clip's own size out of the
  SOURCE, content-addressed under `footage/frames/`, one decode at a time in
  the trims' queue, the clip's doc untouched, NOTHING to the Dump (her word).
  The player stays open and her in and out marks stay with it (2026-09-13).
  **AND IT OFFERS, IT NO LONGER DECIDES (2026-09-14, Sophie: "grab frame shud
  offer to save or add as reference").** It used to land the frame in the strip
  by itself, so SAVING one meant taking on a reference she may not have wanted
  and then hunting it down in the strip to open it big — and she never saw the
  frame before it committed, on the one button whose whole reason for existing
  is that the baked last frame has the wrong thing in it. The pull draws a row
  under the trimmer's buttons — the frame itself, the second it came from, and
  two underlined words: **save** (the three-path ladder) and **reference**
  (`useShot`, the last-frame tile's own landing). Neither fires on its own.
  Four things not to undo: the two are **NOT exclusive**, so the row stays
  until she grabs another, taps its ✕, or closes the player; `reference`
  **lights off the STRIP** (repainted in `paintRefs`, the one place it
  changes), so a ✕ on that reference puts the word out and a second grab of the
  same second opens already lit; the thumb is **`contain`, never `cover`** (a
  cover crop takes a third off a 16:9 frame's sides, which is the half the
  question is usually about); and there is **no "open it bigger"** — the player
  directly above is paused on that very frame at full size.
  Full note: *GRAB FRAME* in `docs/modules/audio-and-film.md`; test
  `node scripts/test-footage-grab-frame.js`.
  **THE FIRST FRAME OF THE NEXT CLIP IS THE LAST FRAME OF THIS ONE — WIRED ON
  ALL THREE DOORS (2026-09-11).** Every door takes the same two fields,
  `firstFrameUrl` / `lastFrameUrl`, and maps them onto its own shape: **Atlas
  swaps the MODEL ID** to `…/image-to-video` (`image` required, optional
  `last_image`, and NO reference lists at all, same price per second),
  **OpenRouter sends `frame_images`** (`{type:'image_url', image_url:{url},
  frame_type}`), **APIFRAME is unchanged** (`start_image`/`end_image` beside
  the reference lists — the one door that takes both). **A FIRST FRAME AND
  REFERENCES TOGETHER ARE REFUSED AT THE DOOR, NEVER HALF-SENT** — Atlas's
  image-to-video has no reference lists and OpenRouter's own guide says
  `frame_images` WINS and the references are dropped silently — so `doorFor`
  ranks only the doors that can take the job's SHAPE, that job goes to
  APIFRAME, and with no door open the send is refused with what to change. A
  keyframe is NOT a slot: it leaves the reference lists, takes no `[ImageN]`,
  and the pictures after it renumber (her prompt is renumbered, never
  reworded). The log keeps ONE vocabulary — every door writes
  `start_image`/`end_image` into `params`, which `video-log.js` already files
  as `references.startImage`/`endImage`, so a chained clip is on the 1080p
  reading list under the same name whatever door drew it. On the page: a small
  flag on a picture's thumb cycles none → first → last → none, the slot line
  says which, a line under the strip says plainly what the doors will do
  BEFORE she taps, and a finished clip's **last-frame tile** opens big with
  **first frame** / **reference** beside `save` (no save-and-re-attach). A belt
  hand-off may carry `firstFrame`/`lastFrame`. **Measured 2026-09-12:** Atlas REFUSES a frame plus a reference on the
  poll, free ("cannot be combined with reference media" — a row in
  `video-refusals.js`); a frame ALONE on Atlas Mini drew and opened on the
  exact still. **Unmeasured and named:**
  whether ByteDance honours a keyframe and references together on APIFRAME
  (the one try was refused by its content filter before drawing),
  which Seedance models take `frame_images` on OpenRouter, whether a last
  frame alone works there, and Atlas's image-to-video price against a real
  charge. Full note: *THE FIRST FRAME, ON ALL THREE DOORS* in
  `docs/modules/audio-and-film.md`; test
  `node scripts/test-video-keyframes.js`.
  **A CLIP BELONGS TO A PROJECT, AND THE PAGE SHOWS ONE PROJECT AT A TIME
  (2026-09-11, Sophie: "group projects and character references so when I
  switch between projects, I can only see those references offered to me and
  only related files in the tiles list view area" · "good plan … go ahead for
  now").** The cast library's FILMS are the projects — one vocabulary, never a
  second list — and `project` is ONE field on the job doc read everywhere: the
  picker (one drop-down on the **feed bar**, between the search and the funnel, remembered
  as `footage_project`, replacing the sheet's own `footage_castfilm`), the feed
  (`GET /jobs?project=`, filtered server-side over the whole collection before
  the page is cut, and `shown()` on the page for a card a poll lands), the
  Recent drawer (derived from the feed, so it narrows by itself), the character
  sheet (opens on the project's shelf, no film chips while a project is
  picked; a project with no shelf yet shows an empty one, never another film's
  people), the Dump (an upload lands in an album named after the project), and
  the star (every clip sent carries it, on all three doors' log tags). **All is
  a real stop**: every clip shows, each card says its project. Switching
  empties the feed and re-asks; her words and the references already attached
  stay — only what is OFFERED narrows. **A belt hand-off switches the picker**
  (the plan's first automatic case): a belt declaring `var PROJECT='…'` names
  it, else its `from` chat is mapped through `HANDOFF_PROJECTS` in footage.js
  (served on `/status`; every ward belt → `ward`, Ticky Tack → `ticky-tack`),
  and a project the shelf lacks becomes a film on it (`POST /api/cast/films`).
  **THE PICKER IS ON THE FEED BAR, BETWEEN THE SEARCH AND THE FUNNEL
  (2026-09-12, Sophie marked the spot on a screenshot: "folders should go in
  red spot").** It rode three seats in a night before landing there — the
  Buttons FOLD row beside the word, the PANEL's fold row beside "Prompt", and
  the Buttons row itself — and the seat she picked is the one the control was
  always looking for: **the picker is a FILTER over the feed before it is a
  setting on a clip**, so it belongs with the feed's other filters, and unlike
  every panel seat it cannot be folded away from the feed it is filtering.
  Three things not to undo: it is its NEIGHBOURS' height there (34x32, the
  heart and the glass's own box) because a 34-tall box makes that hairline row
  2px taller than every other one on the page; its lit box is the LIST
  segment's dark fill, so a narrowed feed says so on the row that narrowed it;
  and it sits at flex `order:0` in the `.narrow` row while the funnel chip is
  `order:1` and the field `order:2`, which is what keeps it first on that row
  whatever the markup order (since 2026-09-25 the funnel is on the bar beside
  it whether or not the search is open — see THE FEED HAS THE PLAYGROUND'S
  SEARCH above). Its rows say "All" and
  "New…" rather than anything longer because a select is as wide as its
  longest row.
  **AND A PROJECT'S FOLDERS FOLD (2026-09-12, Sophie: "make the commercials
  collapsible in the drop-down").** Six witch commercials plus everyone
  else's turns one drop-down into a list she has to read; shut, a project is
  ONE row with a fold row under it saying how many folders are behind
  (`▸ 6 folders`), and the folder rows are not in the list at all. **The fold
  row is its own option** — a `<select>` has no other way to carry a control —
  and picking it toggles and puts the value straight back, so folding never
  moves the feed or a clip. Three things not to undo: **the project she is IN
  is always open** whatever the memory says (its folder has to be an option or
  the select cannot show where she is — same for a card, whose menu opens its
  own clip's project); it is **REMEMBERED** (`footage_open`), because this is a
  picker she opens all day and re-expanding the same project every time is the
  fold not working, and the picker and every card's menu read the ONE set; and
  **shut counts, open does not** (the archive summary's don't-say-it-twice
  rule).
  **AND SINCE 2026-09-13 THE PICKER IS A POSTER SHEET, FIVE ACROSS (Sophie,
  after four mocked options: "i like poster" · "more per row so all fit" ·
  "5!").** The folder icon opens a sheet of TILES instead of a native list —
  every folder here already has a picture, the last clip drawn in it, and a
  row of words threw that away. Six things not to undo:
  - **FIVE IS THE FLOOR, NOT THE NUMBER.** `fitShelf` widens to 6, 7 or 8 when
    five would push a row off the bottom, measured off the real grid, so "all
    fit" stays true as folders pile up and the density never needs choosing
    again. It NEVER narrows: a two-folder project would otherwise draw two
    enormous tiles and the sheet would look like a different screen every time.
    (Measured at 390x844 on the mocked page before the widening: five across
    holds 34 folders, six 41.)
  - **TWO LEVELS** — the films, then one film's folders. A project WITH folders
    descends on a tap and its level-2 **Everything** tile is how the whole
    project is picked; one without folders simply picks. Descending moves
    nothing: it is a level of the sheet, not a pick.
  - **THE FACES COME FROM THE SERVER AND HAVE TO** — `GET /api/footage/shelf`
    (`shelfOf`, one pass over the log, cached 60s, asked when the SHEET OPENS
    and never on the feed poll). The page's own feed is narrowed to the project
    she is standing in, so it holds no clip from anywhere else to draw a face
    from. The face is the NEWEST clip that really drew, a HIDDEN clip faces
    nothing and is counted by nobody, a project counts its folders' clips too,
    and **a folder nothing has finished in draws an EMPTY square** rather than a
    neighbour's picture (the Assets tab's silence rule).
  - **THE TILES ARE NOT REBUILT UNDER HER** — a signature skip over the labels,
    faces and counts, since a recreated `<img>` decodes async and the whole
    sheet strobes blank (the house repaint rule).
  - **A FOLDER SLUG READS BACK AS WORDS** (`folderName`: hyphens out, first
    letter up) on the tile, in the header, in the toasts and in the card's
    rows, so a folder is spelled one way wherever she meets it. Display only —
    `folderSlug` is still the only thing that writes.
  - **AND SINCE 2026-09-15 THE CARD'S MOVE CONTROL IS THIS SHEET TOO
    (Sophie, looking at the card's native list: "switch to new file
    system").** It was the last native list on the page. The card carries a
    folder BUTTON saying where the clip is — "No project", "The ward",
    "The ward › Socks" — and it opens the same sheet in MOVE mode: it opens
    at the FILMS (a move is most often a move out, and landing inside would
    cost a back tap every time) with the clip's place lit — its project at
    level 1, its folder at level 2; the level-1 "All" tile reads **No
    project** there; the TUCK is not offered (hiding a film from All is a
    filter decision, and this sheet is deciding where one clip lives); and
    New project… / New folder… move the clip straight into what they make,
    the folder inside whichever project the sheet is standing in. **The FOLD
    ROWS went with the select** — `viewRows`, `FOLD`, `footage_open` and the
    remembered open set are deleted, because a sheet of two levels has no
    rows to fold. So the 2026-09-12 fold note above is history, not a rule.
  The tuck is a WORD in the sheet's own header, offered only inside a project;
  `shelfPick` is the old `<select>`'s handler body, so `setProject` /
  `setFolder` / New project… / New folder… mean exactly what they meant. Test:
  `node scripts/test-footage-shelf.js` (the widening MEASURED off the real
  boxes — a grid that sets `--c` and never reflows looks identical in the
  source; verified failing with `fitShelf` stubbed out).

  **EVERY CHAT'S CLIPS RIDE THE FEED SINCE THE SAME EVENING (Sophie: "most
  of them made in chat. Are you adding them to footage? If so, good")** — the
  read was `chat == footage`, the page's own 174, and ~200 clips the chats had
  drawn for the same films were reachable from nowhere she looks; `/jobs`
  reads the whole log now and a card that was not this page's says
  `from <chat>`. **AND THE SORT WAS DONE BY READING THE PROMPTS, NOT BY ONE
  WORD (her "lots of different projects … are you able to sort that out").**
  The first backfill filed all 174 as `ward`, which was wrong for a third of
  them — the page had drawn the Jonathan and Sean scenes, the witch
  commercials, the train and the house under one picker. Every clip on the
  log (369) was read and stamped from a `{id: project}` map
  (`node scripts/footage-project-backfill.js --map sort.json --go`, the
  whole log, overwriting; `--project` still only fills a blank): ward 220 ·
  secretly-a-witch 66 (the kit commercials, the b-roll, the christmas and
  "It's Sophie" voiceovers, the doctor-with-a-wand and pill-commercial
  scenes) · jonathan-and-sean 17 · box-on-the-shelf 13 (the little-girl
  kit-on-the-closet-shelf scene) · train 12 · nautchaug 10 (the bus, the
  school library) · house 8 (the woods and the mansion) · ticky-tack 6 ·
  none 17 (door probes, the dialogue test, the harry potter joke, the taxi,
  the dunce-hat class, the therapy-with-ants clip — hers to place). The seven
  new films are on the cast shelf (`POST /api/cast/films`), so the picker
  lists them. **MOVING A CLIP IS THE FOLDER BUTTON ON ITS CARD** (her "add the
  move project UI"; a `<select>` until 2026-09-15, the poster sheet since): the same films, "No project" first, the clip's own lit;
  a change POSTs `/jobs/:id/project`, the toast says where it went, and
  inside a project view the card leaves. A wrong guess above is one tap.
  **AND A PROJECT HAS SUB-FOLDERS SINCE THE SAME NIGHT (Sophie: "can we do
  sub folders ex the witch commercials" · "make the drop down a folder icon
  · the name of the current folder replaces footage in the header").** One
  more field on the clip, `folder`, the same slug shape, meaningful only
  beside a `project`. **The folders a project has are DERIVED, never
  stored** — `foldersOf` in footage.js answers `folders: {project: [...]}`
  on every `/jobs` read off the whole log — so a folder is exactly the clips
  filed in it, an emptied one stops being offered, and there is no second
  vocabulary to keep in step with the cast shelf. **The picker is ONE
  `<select>` drawn as a Lucide `folder` icon** (34px rounded square, its own
  text transparent, lit in ink while a project is picked — a narrowed feed
  is never silent), its rows every project with its folders indented under
  it (`project/folder` values), "New project…" always and "New folder…"
  inside a project; **the header says where she is** — Footage · The ward ·
  The ward › commercials. Every card's move control opens the same
  folders, so one control moves a clip anywhere; **a move to another project drops the
  folder** (it belonged to the project the clip left), and a folder named on
  a card joins the picker at once. The feed asks `?project=&folder=`,
  remembered as `footage_folder` beside the project; a belt hand-off may
  carry `folder`. The three doors and `video-log.js` file it on the log tag;
  `footage-project-backfill.js --map` takes `project/folder` values — the 25
  witch commercial clips are **one folder EACH, never one `commercials` pile**
  (2026-09-12, Sophie: "I want each of the witch commercials to be in a
  separate folder. I thought that was clear"), read off their own prompts:
  `travel-kit` 11 · `christmas` 4 · `its-sophie` 4 · `pill` 3 · `huge-kit` 2 ·
  `not-always-a-witch` 1. **A folder is one PIECE OF WORK, not a genre** —
  that is the rule the first pass missed, and it is what makes a folder worth
  opening.
  Not built yet, deliberately: the evidence
  rules (a job's references on one film's shelf, chaining off another job's
  output) — they PROPOSE a project and belong to step 5 of
  `docs/footage-projects-plan.md`. Tests: the project section of `node
  scripts/test-footage.js` (the picker's rows, the feed read asked FOR the
  project, only its clips on screen in both views, the send and the upload
  carrying it, the sheet reading its shelf, a reload remembering, All
  bringing the rest back, and a hand-off from a second page switching it —
  every assertion a measurement) and the PROJECT line of
  `node scripts/test-scene-index.js`.
  **AND A PROJECT CAN BE TUCKED AWAY — LEFT OUT OF ALL AND OUT OF NOTHING
  ELSE (2026-09-13, Sophie: "can u hide the ward, the boyfriend one and the
  pee wheel ones if i'm not in those folders").** Measured that morning: the
  ward alone is **220 of her 506 clips**, so All was mostly one film and
  everything else was scrolled past. One flag on the cast shelf's film
  (`tucked`) — the same one vocabulary the picker is drawn from, so both
  phones agree and there is no second list — filtered SERVER-side over the
  whole log before the page is cut, and by `shown()` too so a card a poll
  lands stays off both views. Five things not to undo: it hides the project
  from **All alone** (picking it shows every clip in it, its folders are
  untouched, the character shelf is untouched); a **SEARCH reaches it
  whatever is tucked**, because a search is her asking for something by name
  (the ALL tab's own carve-out for the bug-fix pile); the picker still lists
  it wearing **`· hidden`**, so the list never lies about why All is short;
  the control is a **row in the picker offered only inside a project** (the
  fold row's own pattern — `Hide from All` / `Show in All`), and picking it
  puts the value straight back, so tucking never moves the feed or a clip;
  and `POST /api/cast/films` **merges** now, so a rename cannot untuck a film
  and a tuck cannot forget its name. Tucked on her word: `ward` ·
  `nautchaug` · `pee-wheel`. **THE PEE WHEEL HAD NO PROJECT AT ALL** — nine
  clips of one scene (the dunce hat, the classroom, the wheel) filed nowhere,
  which is exactly why they sat on the front screen; `node
  scripts/footage-tuck.js` (dry by default) names them by ID, never by a
  word, and only ever fills a blank. Tests: the tuck block of `node
  scripts/test-footage.js` (every assertion a MEASUREMENT of what really
  renders and of what the stub really received — a picker row saying "hidden"
  over a feed that still holds the clips, a toggle that never reached the
  server, and one that also hides the project from its own view all look
  identical in the source) and `node scripts/test-cast.js`.
  **THE CHARACTER LIBRARY — ONE TAP PUTS A PERSON AND HER LINE IN THE PROMPT
  (`cast.js`, `/api/cast`, the people icon on the controls row; 2026-09-11,
  Sophie: "we need a version of 'characters' for footage so i can click a
  button and it auto adds the line at the top, adding and referencing videos
  and stills · characters w multiple outfits will have ex, sophie w pajamas vs
  sophie street clothes · add character icon to footage and have it per film -
  diff folders · some characters are just stills for now").** Until this, every
  ward clip's references were hunted by hand — the jazz clip's url, three
  pajama stills, the doctor's 4-second take, and the exact line naming each of
  them by slot, retyped per shot, per chat, per belt page. **It spends nothing**
  — it stores urls that already exist in the Dump and the clip log.
  - **A LOOK IS A CHARACTER IN ONE OUTFIT** — its references, and the ONE LINE
    the prompt opens with. `sophie · the blue pajamas` and `sophie · street
    clothes` are two looks on one character, which is her own example.
  - **THE LINE IS STORED AS A TEMPLATE AND RESOLVED AT THE TAP — `{1}`, `{2}`
    … over the look's own references, NEVER a literal `[Video1]`.** That is the
    load-bearing half: a line written when the pajamas were `[Image1..3]`
    points at somebody else's stills the moment a second character rides along
    — and the clip still draws, just of the wrong person. `cast-line.js` is
    the ONE rule, loaded by `cast.js` on the server and served to the page (the
    `pause-plan.js` pattern), so **the sheet shows the exact line the tap will
    insert**, resolved against the strip as it stands. Every other look on
    screen is re-resolved after an attach, or the sheet is quoting slots that
    moved.
  - **AND THE ✕ TAKES THAT NAME BACK OUT, RENUMBERING THE REST — `dropPlan`,
    the same file (2026-09-11, Sophie: "if i delete an image, it shud remove
    the tags associated w that image").** The template rule's own bug from the
    other end: a slot is a POSITION, so taking the second of three images off
    left `[Image2]` naming nothing AND `[Image3]` naming a picture that is now
    `[Image2]`, and the clip still drew, of the wrong reference. ONE pass over
    the prompt (a rename must never land on a token another rename is about to
    read); **only the NAMES change** — the name takes the space it stood in
    with it and nothing else, dangling commas included, because the slot names
    are the page's vocabulary and the sentence is hers; and the TOAST says what
    came out and how many moved, since a change to her prompt she cannot see is
    the hidden-ingredient failure. `slotMap` is the one numbering rule now,
    shared by the attach and the ✕. Full note in
    `docs/modules/audio-and-film.md`; measured by
    `node scripts/test-cast.js` (verified failing 5 pre-fix).
  - **THE PAJAMAS FLOAT AND LIVE IN ONE PLACE** (her rule: "these pajamas float
    w any patient so keep head off · ex francesca/anastasia gets pjs plus dance
    photo · same for mayra"). A wardrobe entry is its own row and a look WEARS
    it by slug — `blue-pajamas` takes the outfit's FIRST look, which is the
    HEAD-OFF pair, and `blue-pajamas:sophie` names the three-still set her own
    line counts. So swapping the pajama reference swaps it for every patient at
    once. A still in two outfits rides ONCE and keeps one slot.
  - **A LINE GOES TO THE TOP OF THE PROMPT, and never twice** — her word ("auto
    adds the line at the top"); a second tap on the same look adds nothing.
  - **SOME CHARACTERS ARE JUST STILLS and that is a normal entry**, not a
    half-made one; a character with nothing on file is still listed, so she can
    see who is waiting for a reference. **One look is one tap** — Nurse Edna has
    one clip and one line, so the row IS the button; several looks open.
  - **NOTHING IS DELETED** — `hidden` is the verb for an entry; a LOOK can be
    removed, since its references are still in the Dump.
  - **THE WARD SHELF IS SEEDED FROM HER OWN FILES** —
    `node scripts/seed-cast-ward.js` (dry by default; `--go`; `--direct` writes
    through the Admin SDK, which is what fills a shelf before the route is
    deployed). Every url is out of `docs/mental-hospital/refs/cast.json` or
    `belt/refs.json` and every clip carries the label the belt pages give it;
    the lines are hers VERBATIM wherever a card had one, and the script prints
    how many are mine. **20 entries, 66 references** (15 people, 2 outfits,
    3 places).
  - **A 4s TAKE PER CHARACTER WAS ALREADY DONE, MEASURED** (her "maybe done
    already"): ffprobe on every person clip the belt pages name — Nurse Edna
    4.00s, Ms. O'Hara 4.04, the doctor + assistant (office and hall) 4.04, the
    parents 4.04, Michael 4s (560x752).
  - **THE 4s JAZZ CLIP WAS ALREADY RIDING EVERY SOPHIE JOB, AND NO QUALITY IS
    LOST (2026-09-11, Sophie: "it's on every sophie video in footage · is
    quality lost? a chat gave it to me first / if lost quality, find og
    chat").** The first pass hunted it in the video LOG and the Dump BY NAME
    and reported it missing; it is on **24 of the 83 footage jobs** as a
    REFERENCE VIDEO (`jazz-best4s.mp4`). Measured against the 15.1s original:
    the last 4.06s of it (aligned at 11.04s frame by frame), same 560x752,
    same 24fps, same H.264 High/L3.1, 2.15 Mb/s against 2.22, **PSNR 46-48 dB
    — visually lossless**, so there is nothing to recover from the original
    chat. A re-encode, not a stream copy (the decoded frames differ), and the
    two copies on file are BYTE-IDENTICAL (md5 `042e7aaa…`). Sophie's four
    clip looks carry it; the 15.1s take stays as its own `jazz-long` look.
  - **AND ANOTHER CHAT'S CHARACTER PAGE HAD MORE THAN THE REPO DID (2026-09-11,
    Sophie: "did u even look on the character page another chat created").**
    It is **"The ward film — every reference (v7)"**, a grid page in the
    `pajama-assets` chat, 47 items in seven groups — and the first seed, built
    from `docs/mental-hospital/refs/cast.json` alone, missed **Juanita
    entirely** plus eleven references (Mrs. Norbert's own two clips, Sophie's
    other three faces and three jazz stills, the doctor's second still, the
    assistant's intake still, the socks on her feet). **A chat's own reference
    page is a SOURCE, not a duplicate — read it before seeding a library out
    of the repo.** Her pajama stills stay the repo's ORIGINALS: the page's
    optA/optC are the identical crops re-encoded smaller. Four photographs on
    that page are attached to nobody and are deliberately left out — naming
    them is hers. Full note in `docs/modules/audio-and-film.md`.
  - Tests: `node scripts/test-cast.js` (the slot arithmetic pure — every plan
    driven against a strip that ALREADY holds something, since a line that
    resolves right on an empty box is the case that can never catch this — then
    the real page headless, measuring what is in the prompt box and what the
    strip really holds after a tap; verified failing against a sheet that does
    not re-resolve).

### Stitch

- **Stitch** (`stitch.js`, `/api/stitch`, page at `/stitch`, iOS tile under the
  FILM filter's shelf stage — 2026-09-12, Sophie, after saying Assembly "never
  really worked" and the Film Editor "was the one that never worked": "i'm
  thinking something very simple. We're just select clips and then move them
  around and ffmpeg stitches them together … it could be called stitch" ·
  "could you reuse the shell so I can switch between tiles and list view?").
  **Pick clips, put them in order, one button joins them — and nothing else.**
  Her Footage clips are the picker (every finished clip on the log, whichever
  chat drew it, narrowed by the project/folder drop-down; a TRIMMED clip
  offers each PART beside the whole — the chamomile skipping clip is two parts
  she cut, and the parts are what go in the film); a tap puts a clip in the
  ORDER at the top and the tile wears its number; a second tap takes it out.
  Every picked clip is a row: a number she can TYPE, ↑ ↓ arrows, ✕ — the
  Story Timeline's controls, nothing drags. **Stitch** is a background job on
  the doc (poll, resume from `stitch_pending`); every render is kept, newest
  first, as a LINE with a play button and a `save` that goes to Photos
  through the three-path ladder. **It costs nothing** — the clips are
  already drawn, a stitch is ffmpeg on our own box. No trim (that is on
  Footage), no sound lane, no stills, no timeline.
  - **THE RENDER IS THE FILM EDITOR'S OWN `renderCut`, not a fourth copy of
    the recipe.** A stitch doc IS a cut with one lane (cut-model's `clips`
    shape: key · kind · url · title · poster · seconds · in 0 · out), so
    `filmeditor.renderCut({clips, sounds:[]})` bakes it — the same
    one-canvas concat-copy join, the same PCM-then-AAC-once audio, and the
    SAME segment bank in Storage (`filmeditor/seg-cache/`): a clip stitched
    twice encodes once, and a clip the Film Editor banked is a hit here.
    Renders land at `stitch/<id>/film-<n>.mp4` under the Film Editor's own
    numbering (`nextRenderIndex`, never overwriting), capped 12; `stitch/`
    is on clips.js's SKIP_PREFIXES. **Measured the day it shipped, in this
    container over the real log: her first stitch — the nine doctor's-office
    takes, 2:15 — rendered end to end and published onto the doc.**
  - **THE PICKABLES ARE `footage.cardOf` READ THE WAY FOOTAGE READS THEM**
    (`pickables`, pure): a drawing, failed or hidden clip is out, a part
    still baking is out, the whole of a trimmed clip is the SOURCE (never
    the first part), a part with no poster takes the clip's, newest first,
    the title is the prompt's first words and never the url. **And a clip she
    crossed out is not offered either — hide-the-✕'d opens ON since
    2026-09-14** (her "default to hide x"; the rule and its four guards are in
    the Playground's ✕-filter note), which on her real shelf is 103 of 174
    pickables the picker used to offer exactly like the rest.
  - **THE ORDER IS SAVED WHOLE** (`POST /:id/clips`, debounced 500ms,
    flushed on pagehide) — order and membership change together, so a
    partial write could never be right (Assembly's rule). The page keeps a
    MIRROR of the order arithmetic (`window.__stitchRules`) so a tap answers
    on the spot; the test drives the mirror and the module over the same
    fixture so the two cannot drift.
  - **STITCH MODE ON FOOTAGE — THE NUMBERS SHE PUTS ON THE TILES ARE THE
    ORDER (2026-09-23, Sophie: "make a version of stitch mode where i press
    the stitch mode icon in footage and then i select the clips and add
    numbers to them · and then they go to the stitch area in that order").**
    Stitch's own picker is a wall of the same clips where a tap appends and
    the tile wears its place; this is that gesture brought onto FOOTAGE, where
    she is already looking at the clips, so picking and ordering is one pass
    over the feed rather than a trip to another page and a second search. The
    button is in Footage's HEADER beside the `?` (Stitch's own tile glyph, the
    three boxes — a button that opens another tool wears that tool's icon;
    NOT on the feed bar, whose first line at 390pt is already full to the
    pill's column, measured by `test-footage-feedbar-sticky`: a fifth control
    put the folder button 35px under the pill). On, every tap on a tile (the
    two doors leave the tiles — the whole tile is the pick) or on a list
    card's picture puts the NEXT number on that clip, top-left in the marks'
    own plate; a second tap takes it off and the ones after it move up; a
    heart or ✕ in the mode is still a heart or ✕. **A trimmed clip puts its
    PARTS in, one number each, and its tile reads "3–4"** — the parts are what
    go in the film, the picker's own rule. A row under the feed bar counts
    them and carries **Send to Stitch**: `POST /api/stitch/from-footage
    {ids, project}` with the pickable ids IN HER ORDER (a job id for a whole
    clip, `<job>:<trim key>` for a part — the very ids the Stitch picker
    uses), and the page opens the stitch it made (`/stitch?s=<id>`), where
    the arrows, the typed number and the one button are what they were. The
    server (`fromPicks`) turns the ids into the order through the SAME
    `addPick` a tap on Stitch uses, reads ONLY the jobs the ids name through
    `footage.cardOf`, fills the lengths the way a save does, and NAMES
    anything it could not keep (`missing`: hidden or still drawing since she
    numbered it; `dropped`: no readable length) rather than losing it
    quietly. The order survives a reload (sessionStorage — the self-heal and
    the poll must not cost her twelve taps) and not the closing of the tool;
    turning the mode off hides the numbers without dropping them; `clear`
    drops them. Nothing here is a model call. Tests:
    `node scripts/test-footage-stitch-mode.js` (the real page headless — every
    number READ off its tile, the doors measured gone, the heart still voting,
    the reload, the list card picking rather than playing, the ids the stub
    really received in her order, Send clear of the pill's column) and the
    `fromPicks` block of `node scripts/test-stitch.js`.
  - **TWO LEVELS** — the shelf of stitches and one open (`?s=<id>`), a
    history state per level, `window.__navBack` shelf-ward before it
    leaves; the player closes first. Nothing is deleted — `hidden` is the
    verb (`POST /:id/hide`).
  - **THE PILL'S BAND IS RESERVED ROW BY ROW** — Footage's `fitPillGap`
    over `[data-pillrow]`, judged at the TOP of the page (Freeform's rule),
    the title INPUT shortening by width rather than margin (an input at
    100% overflows rather than shrinks — PHOTO'd).
  - Tests: `node scripts/test-stitch.js` (the pickables, the order
    arithmetic, cut-model's cleaner, the wiring pins, then the real page
    headless — three across MEASURED, the shared switch, a pick numbering
    its tile, the arrows and the typed number, ✕, the order the stub really
    received, Stitch's POST and the render row off the poll, the player, a
    control in the pill's band asked with `elementFromPoint`, both levels)
    and `node scripts/test-viewswitch.js`.

### Movies

- **Movies** (`movies.js`, `/api/movies`, iOS Movies tab — no web page) — story ->
  ~8-12 self-contained scenes -> gpt-image-2 panels -> Replicate image-to-video ->
  ffmpeg stitch, ~$1.35 for a 12-scene film.
  **480p WAN CANNOT DO A SHORT CLIP — `num_frames` HAS A FLOOR OF 81
  (2026-08-28, Sophie: "does 480p wan have a timing option - can it do 1 or 2
  seconds instead of 5? if so? is it cheaper?").** No, and the question of
  whether short is cheaper does not arise. `wan-2.2-i2v-fast` refuses anything
  under 81 frames at validation — *"input.num_frames: Must be greater than or
  equal to 81"* — so at its 16fps the usable range is **5s to 7.5s** (81-121
  frames), and there is no 1s or 2s clip to price. **The probe cost nothing:
  a 422 is refused before it is billed**, which makes this shape of question
  free to settle — ask the API, do not reason about it.
  The schema also settles why the house price is BANDED rather than
  per-second: it says pricing is "based on the video duration at 16 fps", and
  the only two rungs inside 81-121 frames are the 6c/8c the ledger already
  records. **Want 1-2 seconds of motion? Render 81 frames and TRIM** (ffmpeg
  on our own box, free) — same 6c either way, and she picks which second. Wan
  **2.7** genuinely takes 2-15s and is per-second, but has no 480p at all, so
  a 2s clip there is 20c at 720p rather than 6c.
  **THE ANIMATE BUTTON CAN RUN WAN 2.7 SINCE AUG 2026 (Sophie's ask), AND IT IS
  NOT A FREE UPGRADE — it is priced per SECOND** ($0.10/s at 720p, $0.15/s at
  1080p, so 50¢ and 75¢ for the standard five seconds against draft's 16¢).
  What it buys, measured live rather than read off a page: real
  first-and-last-frame conditioning (`last_frame` is a TARGET, where 2.2's
  `last_image` is only a hint), 2-15s instead of a fixed 5, and no 480p at
  all. What it costs besides money: **it writes its own audio** when none is
  handed to it and there is no way to ask for silence, so a 2.7 clip stitched
  under her voice must have its track dropped deliberately. The quality menu
  on the animate button is four wan rows now (480p 6¢ · 720p 16¢ · 720p 50¢ ·
  1080p 75¢) — kling is still a tier on the route and still on the per-scene
  menus inside a movie, it just no longer holds two of those four rows.
  **A MODEL'S INPUT KEYS RIDE ITS `shape`, NEVER ITS TIER NAME**, in one
  builder (`videoInput`): a wrong key does not fail loudly — the model ignores
  it, draws something unconditioned, and the bill arrives anyway. Test:
  `node scripts/test-video-models.js` (pure). Also holds **Dreams** (the staged
  dream -> comic pipeline, where a gpt-image-2 SAFETY REFUSAL is terminal and the
  page is redrawn with its narrative softened — never retried), the character
  anchor, dream-bridge clips, the zine, and quick-animate. Editing is free
  server-side ffmpeg; every re-roll is kept.
  **EVERYTHING IT MAKES GETS OUT OF THE MOVIES TAB (Aug 2026, Sophie: "they
  just stay there. theres no download button and they dont appear in my
  creations").** Every finished video — scene clip, bridge, quick animation,
  stitched cut — files into "My Creations" as `type:'clip'` (a stitch is
  `'film'`), carrying a POSTER, because there is no frame the grid can decode
  out of an mp4 and a video creation without one tiles as a blank square. The
  gallery is in the OTHER Firebase project, so server.js hands movies.js the
  writer at mount time (`movies.init({ fileCreation })`) — filing is
  fire-and-forget and never awaited by the render. The download button lives on
  `ClipPreviewSheet`, the ONE player every clip in Movies opens in, and
  `VideoSaver` (beside `PhotoSaver`) is the one video-to-Photos path: Photos
  takes neither a remote URL nor decoded frames, only a downloaded FILE as a
  `.video` resource.
  **Full details: `docs/modules/audio-and-film.md`.** Making one of her concept
  videos? `docs/movies/sophies-movie-pipeline.md` first.

### Assembly

- **Assembly** (`assembly.js`, `/api/assembly`, page at `/assembly`, iOS tile
  under the FILM filter) — put pieces IN ORDER on a timeline, then bake one
  film. Sophie's ask (Aug 2026): like the Story Room's scratch pad but for
  CLIPS — the arrangement rides a **timeline at the bottom**; tapping a piece
  lights a **place indicator in every gap**, and tapping a gap drops it
  between the two already there. Tapping a timeline piece picks it UP (the
  same indicators move it; Take off removes it back out of the film).
  Everything is a tap, nothing drags. **AN OPEN PROJECT'S SURFACE IS ITS OWN
  PIECES, NOT THE LIBRARY (Aug 2026 v4, Sophie: "all these other chunks or
  clips compete for my attention … think carefully if moving them out of the
  way is the best fit, versus detaching or creating a separate surface, with
  the clips to go in").** The main of the screen is the POOL — everything she
  has brought in, READY TO DROP IN, big tiles; the Chunking library sits
  behind its own door (**From the shelf**, a picker sheet with the house
  search — tapping a clip there closes the sheet with the clip IN HAND, ready
  to place; the library loads lazily, never up front). The first cut put the
  whole library on the surface and her nine uploads were invisible in a
  cramped dock strip. **It costs nothing** — the library is
  `forge-clip-library` read-only, and Render is ffmpeg on our own box. One
  doc per assembly (`forge-assemblies`); the arrangement saves WHOLE (order
  and membership change together — an insert is both).
  **AN ITEM IS A CLIP OR A STILL, AND THE DUMP IS THE ONE-BUTTON DOOR (Aug
  2026 v2, Sophie: "i made images in the playground and animated them w
  midjourney and wanted to dump them in — some were just images, some
  animated. one button and they all go into a project, ready to arrange").**
  She dumps the album from her phone (photos and videos together), taps **Add
  from the Dump** inside an assembly, picks the album, and everything in it
  lands **in the TRAY, in album order — NEVER straight onto the timeline**
  (2026-08-21, her live report the first version earned: "they're supposed to
  be above the timeline so i can drop them in. i'm confused"; the import is
  deduped by id, so re-importing — or importing the album her own uploads
  made — doubles nothing). The tray IS the pool — the labeled main surface
  above the timeline (it began as a cramped strip in the dock and she
  couldn't find her own uploads in it) — and new assemblies are named with
  her Pacific date AND time ("Assembly · Aug 21 · 9:50 pm") — five identical
  "Assembly · Aug 21" rows is how her uploads "disappeared" into the wrong
  project that night. A still carries `hold`
  (seconds on screen, default 4 — pick it up on the timeline and the
  2s·4s·6s·8s chips set it) and renders like the pad film's beat art, held on
  the canvas over silence. Imported items reference the Dump's own urls — nothing is copied
  and nothing is filed onto the Chunking shelf (the harvest skips `drops/` on
  purpose; here she picked them herself). A still's timeline thumb is a
  DERIVED copy via `/api/story/thumb` — the original is never touched.
  **AND UPLOAD IS ONE BUTTON, IN THE PAGE (Aug 2026 v3, Sophie: "couldn't it
  just be one. a button in assemblies where u can upload the footage and it
  appears above the timeline, ready to drop in").** Upload opens the phone's
  own picker (photos and videos together); each file rides the Dump's
  `/api/drop/upload-file` (HEIC→JPEG, md5 dedupe, video posters — bytes never
  stored twice, the batch shares one Dump session/album named after the
  assembly) and lands in the doc's TRAY, a strip just above the timeline, as
  it arrives. A tray piece arms like a shelf clip — indicators light, tap a
  gap, it drops in and leaves the tray; Remove discards it. The tray saves
  WHOLE alongside the arrangement (`POST /:id/clips {clips, tray}`), so a
  half-placed batch survives leaving the app; the render reads `clips` only.
  **The render is
  the scratch-pad film's recipe, not a fresh one**: every clip normalized onto
  ONE canvas (the first clip's frame, evened, long edge capped 1280 — 30fps,
  setsar=1, yuv420p) as its own segment so the concat demuxer joins with
  `-c copy`, and audio as per-segment PCM cut/padded to each segment's REAL
  encoded length, concatenated sample-exact, AAC-encoded ONCE at the mux —
  per-piece aac priming walks the sound off the picture (the pad's measured
  finding). A clip re-resolves its CURRENT library doc at render time, so a
  re-baked chunk renders from its newest file. Renders never overwrite
  (`assembly/<id>/film-<n>.mp4`, capped 12, newest first) and `assembly/` is
  on the clip harvest's SKIP_PREFIXES — a film made OF clips must not harvest
  back onto the shelf as a clip. The round ▶ plays the arrangement clip-by-clip
  in the browser as a rough preview; the render is the real join.
  Tests: `node scripts/test-assembly.js` (the place-indicator arithmetic pure,
  then the real page headless). **Full details: `docs/modules/audio-and-film.md`.**

### Film Editor

- **Film Editor** (`filmeditor.js`, `/api/filmeditor`, page at `/filmeditor`,
  iOS tile under the FILM filter) — **the one surface that CUTS video**, built
  Aug 2026 from Sophie's own Claude Design canvas (`docs/film-editor-design/`,
  which also carries the other chat's gaps file — the build fixed every bug it
  names). Her tap-only editor: split · trim in · trim out · earlier · later ·
  sync · delete, a transport that steps ±1 frame / ±1s, ONE audio track with
  an offset. **A piece is a REFERENCE into a source file (url + in/out), so
  every tool is non-destructive metadata** — a split is two references into
  one file, a trim can always be trimmed back out, and the render is the only
  moment anything is actually cut. **The selection FOLLOWS the playhead**
  (the prototype's worst bug — split/trim always act on the piece she is
  looking at), refused taps say why in the quiet line, and two swapped
  `<video>` elements keep a source boundary from flashing black. Sources
  arrive through the Dump's `/api/drop/upload-file` (md5 dedupe, posters —
  the assembly pattern), the audio track through `/api/audio/upload-file`;
  lengths are read CLIENT-side before a piece joins the timeline, so an
  undecodable file reports itself. **The render is the scratch-pad recipe via
  assembly.js's own exports** (`targetFrom`/`segmentFilters` — one canvas,
  per-segment PCM, AAC once at the mux) with `-ss/-to` as INPUT options for
  the trim (source timestamps, accurate under a re-encode) and the track
  mixed at the mux with `normalize=0` (amix's default halves both voices).
  One download per unique source url — twelve pieces of one recording cost
  one download. **AND EVERY PIECE IS BANKED SINCE 2026-09-05 (Sophie: "does
  it have to rerender everything every time" — it did).** A piece's segment
  and its PCM are keyed on url + kind + requested in/out + gain + mute + the
  canvas + `SEG_VERSION` (`segKey`, pure) and banked in Storage under
  `filmeditor/seg-cache/`, the Episode Editor's clip-cache shape; a hit skips
  the download, the probe and both encodes, so a change to one shot re-cuts
  one shot. Only the LEAD source (the canvas) is still downloaded every
  render. Bump `SEG_VERSION` when the segment recipe changes; a cache that
  dies never fails a render. `banked` on the render result says how many came
  out of the bank; the progress line says "(banked)". Pinned by the cache
  section of `node scripts/test-filmeditor-render.js`. **It costs nothing** — ffmpeg on our own box; the only paid
  side-effect is the audio library's unconditional transcription of an
  uploaded track (~$0.006/min, once ever per file). One doc per cut
  (`forge-film-edits`); arrangement + audio save WHOLE (a split changes two
  pieces and the order at once). Renders never overwrite
  (`filmeditor/<id>/film-<n>.mp4`, capped 12) and `filmeditor/` is on
  clips.js's SKIP_PREFIXES. The film icon top-left (a dead control in the
  prototype) opens the films sheet — Render, the job line, every render kept.
  The page is ONE screen, never scrolls, NO pill. Story Room = think about
  the story, Assembly = arrange footage, this = actually cut it.
  **THE PLAYER RUNS ON PREVIEW PROXIES; THE RENDER CUTS ORIGINALS (Aug 2026,
  from her live stalls).** Her sources are HEAVY, not unplayable — measured:
  a 784x1168 Midjourney export at 19 Mbps, 12.3MB for five seconds — and
  streaming that raw is what stalled the player. Each unique source gets a
  baked preview copy (`forge-film-proxies`, sha1(url), 720p cap / crf 25 /
  maxrate 3M / faststart — measured 12.3MB → 278KB), one bake at a time on
  our own box; `POST/GET /api/filmeditor/proxies` starts and reports them,
  the page polls and **adopts a fresh proxy only between plays**, and a small
  light source is honestly `skip`ped. This is the house display-copy rule
  (the webp rule) applied to video — the original is never touched. Four
  player rules that came from her reports, all pinned by tests: **the video
  is the playhead's clock** (a stall freezes both), **the picture is the
  truth** (no new PRESENTED frame for 350ms → the playhead holds even if the
  clock moves — `requestVideoFrameCallback`, per presented frame; NOT the
  quality counters where rVFC exists: iOS WebKit batches `totalVideoFrames`
  in ~1s clumps, which held the playhead back a beat and leapt it to catch
  up — her lag-and-leap report, 2026-08-23. The counter path survives only
  as the fallback, its hold capped at 1200ms so a flatlined counter can
  never freeze the playhead), **a joint never touches a RUNNING music
  track** (same day, same root: syncAudio compared the music against the
  LAGGING playhead, read >0.35s of "drift" at every joint and yanked the
  music backward — the stop-start chop on same-source cuts too. The joint
  path now only STARTS a paused track — and drift is PACED, never yanked:
  every swap joint holds the playhead a beat while the next piece paints, the
  music rolls on through it, so drift ACCUMULATES joint by joint — her 17.9s
  cut crossed a 0.5s hard-reseek threshold around the 12s mark, which was
  "fine for a while, then choppy at 3/4 of the way through" (2026-08-23).
  `audioPace` leans the rate 4% against a moderate drift (inaudible on a
  music bed, hysteresis 0.3→0.12); only a drift past 2s is hard-resynced.
  **And the music track gets its own audio-only proxy** — measured the same
  day: her "music" was a 13.9MB 480p YouTube VIDEO mp4 streamed through the
  <audio> element for a 17.9s film. `bakeAudioProxy` (filmeditor.js — a
  video file or >12MB always bakes, a small pure-audio file skips) answers on
  the same `/proxies` routes under `audio`, and the page plays `audSrc()`,
  adopted between plays like the video proxies. **AND THE TRACK IS PRIMED
  LIKE A VIDEO (2026-08-23, round two: "starts late" + "keeps pausing about
  3/4 of the way through").** iOS treats `preload=auto` as a suggestion on
  `<audio>` exactly as on `<video>` — the warmNext lesson, never applied to
  the audio element — so the track's fetch began AT her play tap (the late
  start) and the buffer ran dry mid-film (the pause). `primeAudio` is the
  audio twin of warmNext: a muted play parked at the track's spot, retried on
  her next tap when a no-gesture play() is refused; and the track RE-ALIGNS
  the moment it actually starts sounding (`audEntry`, armed by our own play()
  or a genuine `waiting` stall — never a seek's own echo, so pacing still
  owns a rolling track), because the 4% lean needs ~25s to absorb one late
  second. A stalled/buffering element is skipped by pacing and the 2s resync
  outright — a frozen clock is not drift, and reseeking INTO the unbuffered
  region it is stalled on was the repeated mid-film pause.
  **A WRAPPED PAGE CAN BE DAYS STALE — THE APP KEEPS RECENT TOOLS ALIVE, SO A
  PAGE LOADS ONCE PER APP PROCESS AND NO DEPLOY CAN REACH IT (2026-08-23, the
  round-three finding, MEASURED: ten Film Editor PRs shipped in one day while
  she kept reporting the pre-fix symptoms verbatim; her play posted no
  telemetry beacon while the live route round-tripped fine — the one honest
  proof her phone was running an old page).** RootView holds the three recent
  tools in a ZStack (state survives tab switches — deliberate), so re-entering
  a tool only toggles opacity; the WKWebView's page is whatever loaded FIRST
  in that app process. Two consequences, both built here and worth copying to
  any wrapped tool where page-version skew bites: **the page heals itself**
  (`buildCheck` — every 5 min it compares its `BUILD` const against
  `GET /api/filmeditor/build`, served from the html itself, and reloads IN
  PLACE only while idle: never mid-play, mid-upload, within 10s of a save, or
  under a sheet; `?c=` puts her back in the same cut), and **every play posts
  a TELEMETRY beacon** (`POST/GET /api/filmeditor/telemetry?cut=` — build id,
  rVFC fire counts, playhead holds, boundary reveal waits, audio start
  latency/entries/stalls, proxy-vs-raw, capped 20 sessions) so a bug report
  from her hand comes with the device's own account. **Before diagnosing ANY
  "still broken" report on a wrapped tool, read the beacon's build id first**
  — a report about an old build is not a bug in the new one), **a source boundary keeps
  the old frame on screen until the new one can paint** (the black-second
  gap), and **a joint never seeks the element on screen** (2026-08-23, her
  "little pauses between all the clips": #1564 fixed the seek-at-every-joint
  chop for the AUDIO track only, and the video half lived on — every joint
  re-seeked the visible element, a decoder flush and, on the phone, a fetch.
  `warmNext` parks the idle element ON the next joint's frame — muted
  prime-play, because iOS treats `preload=auto` as a suggestion — a
  contiguous split joint just ROLLS ON with no seek at all, and a
  same-source JUMP (the middle trimmed out) swaps to the parked element
  instead of seeking the one she is watching. `seekVideo` picks whichever
  element already sits nearest the wanted frame; stepping/scrubbing still
  always seeks, exactness matters there). SVG icons toggle via ATTRIBUTES —
  the `hidden` IDL property is
  HTMLElement-only and `.hidden =` on an SVG is a dead expando (the
  pause-button-that-never-was). The progress line (`#msg`) lives OUTSIDE
  `#editBox`, because the first upload happens while the empty state shows.
  **NEVER CONNECT FOOTAGE AND VOICEOVER UNLESS IT IS ON PURPOSE (2026-09-05,
  Sophie: "the methodology is an issue · u shud never connect footage and
  voiceover unless its on purpose").** A narration part is anchored to the
  shot it is ABOUT, never to a distant shot with a running offset, and the
  picture is cut to the words — a shot is as long as the line it carries.
  Earned the same day on the desk-sweep commercial: the one-take narration
  rode the Matrix shot, so shortening the fridge by a second and a half slid
  every later shot under different words. Full rule in the `film-cut` skill.
  **TWO LANES, BOTH HERS, AND THE DOC IS THE FILM (2026-09-02, Sophie:
  "clips laid out exactly the same so we can both edit in parallel … i need to
  be able to move the sound around. that's literally what i can't describe to
  the chat").** `cut-model.js` is the ONE shape (served at `/cut-model.js`,
  validated by the server and the page): a PICTURE lane of clips and stills
  and a SOUND lane of any number of overlapping sounds, each with in/out, a
  start second, a level in dB, fades, mute, and an optional ANCHOR to a shot
  (screams ride the horror clip wherever she moves it). A gain ride is the bed
  split into sound pieces with their own levels — the same split/trim/move
  tools on both lanes, never a curve to drag. A chat and Sophie edit ONE doc:
  a save carries `base` (the `updatedAt` it loaded) and a stale save is
  refused with her current doc, never merged or silently overwritten; every
  render carries `by` and a snapshot, and `GET /:id/diff` says in words what
  moved since. **No doorbell** — her message is the wake (her call): the chat
  runs `node scripts/filmcut.js diff` when she next writes. The pinned row
  and the deliverables list carry a door into the cut (`cut:<id>` on the
  pin). Plan: `docs/film-editor-parallel-editing-plan.md`; the chat's
  ritual: the `film-cut` skill. Tests: `node scripts/test-cut-model.js`,
  `node scripts/test-filmeditor-render.js` (a real render of stills + an
  anchored sound following a reorder).
  **A CHAT'S SAVE STARTS THE PROXIES, CARRIES A POSTER, AND KNOWS ITS
  LENGTHS (2026-09-05, measured on her two live cuts).** Three holes on a
  cut a chat wrote through `filmcut.js set`: no proxy bake ever started
  until SHE opened the cut (6 of 14 matrix pieces and the ant's new voice
  track had no proxy doc at all — she played raw sources while the bakes ran
  one at a time), every tile was blank (`poster:null` on every chat-written
  piece), and every sound was `seconds:null`, so the page learned the
  lengths on open and saved them as HER edit — seventeen `updatedAt` bumps,
  the chat's next set 409'd, and its "same lanes?" check read the filled
  seconds as her change and stopped with "STALE" when she had touched
  nothing. Now: `saveCut` warms `proxyStates` for every source url a save
  INTRODUCES (fire-and-forget, never awaited, `newSourceUrls`); `bakeProxy`
  pulls a poster frame beside the proxy (15% in, ≤480 wide, jpg, ~36ms —
  answered as `poster` on `/proxies`, the picture itself for a still);
  `filmcut.js set` fills `seconds` by probing (`probeUrl`) and passes a
  Dump `poster` through. **LENGTHS ARE FACTS, NOT EDITS** — `CutModel.
  lanesDiffer` ignores `seconds`/`poster` and both sides use it: a stale
  save that only learned lengths is accepted and leaves `lastEditBy` alone,
  `carrySeconds` keeps a learned length a writer does not know, and the
  chat's 409 check retries rather than reporting her edit. Pinned by
  `node scripts/test-filmeditor.js` (a fake store drives the real `saveCut`)
  and the poster case in `test-filmeditor-render.js` (the jpg measured).
  **A CHAT RENDERS A CUT IN ITS OWN CONTAINER — THE DEFAULT, NOT THE EXCEPTION
  (2026-09-05, Sophie: "why didn't u just make it in ur container to begin
  with? is there some disadvantage? if not, write that in notes as the
  default").** There is none. Measured that night on the desk-sweep
  commercial: the 512MB box OOM-killed a 16-piece render TWICE (Render's own
  `oomKilled` events, 02:54 and 03:01 Pacific-night), the editor showed the
  dead job as "running" for 20 minutes, and this container then rendered the
  identical cut in **61s** against the box's 102s for a smaller one — and a
  merge by any chat restarts the box mid-render, where a container is immune.
  `node scripts/filmcut.js render <id>` renders HERE whenever
  `FIREBASE_SERVICE_ACCOUNT` is in the environment: filmeditor.js's own
  `renderCut` + `publishRender` (the ONE writer of a render record, which the
  box's job also goes through), the same segment cache in Storage (a piece
  banked here is a hit on the box and the other way round), the same record
  on the same doc, the same shot map. `--box` is for a deliberate reason
  only, and the box's Render button stays HERS. Do not read "render THROUGH
  the doc" as "render ON the box" — through the doc means the doc is the
  film and the render lands on it, wherever the ffmpeg ran.
  Tests: `node scripts/test-filmeditor.js` (pure + the static page
  contracts, no network) and `node scripts/test-filmeditor-page.js`
  (headless Chromium PLAYS real generated videos through the real page —
  icon swap, moving playhead, boundary crossing, end stop, split, proxies,
  and the joint discipline: `seeking` events on the VISIBLE element are
  counted and must be ZERO across a swap, a split and a jump — verified
  failing 4 against the pre-fix page, 2-3 visible seeks per short film;
  fixtures must be WebM/VP8 — playwright's Chromium has no H.264/AAC — and
  **must be served with Range support** (`serveMedia`): a plain
  `route.fulfill` leaves `seekable` at [0,0], every seek silently clamps to
  0, and the old green playback tests were measuring exactly that).

### Voice Studio

- **Voice Studio** (`voicelab.js`, `/voice`) — her cloned voices, two hairline
  tabs: TEXT (TTS, stock v2 defaults, no settings by design) and VOICE
  (speech-to-speech on `eleven_multilingual_sts_v2`, which keeps the performance
  and swaps only the voice). Her words stay in the box after a render. **The
  page OWNS its header** (one `.app-header` row, the title centred by
  pagehead) — it carried none while Apple's nav bar had the title, and when
  `.forgeWebToolBar` took that bar away the tool went NAMELESS, showing a bare
  chevron and nothing else (2026-08-27, Sophie: "this header doesn't match the
  app pattern"). There are still no character counts; credits live behind the
  ⓘ on the tab row.
  **THE WORDS BOX EXPANDS (2026-08-27, Sophie: "add an expand text box button
  in the voice studio").** A 26px rounded square inside `#text`'s bottom-right
  corner toggles the SAME textarea open and shut — the Playground's
  `#bigprompt` answer lifted in SHAPE, never a second field to keep in sync.
  **IT FITS THE WORDS, IT IS NOT A FIXED SIZE (2026-08-27, Sophie: "why not
  expand based on text, not static")** — `min-height:24vh` / `max-height:46vh`
  are the floor and the cap, and `fitBig` measures the content into the height
  between them on the tap, on every keystroke and on a resize. The three rules
  behind that (both bounds in CSS, `height:auto` before measuring or the box
  can only grow, the border added back on a `border-box` box) and the reason
  the button never hides itself are written out once, under *THE PROMPT BOX HAS
  A BIGGER-BOX TOGGLE* in the Playground section — read them there before
  touching either copy.
  Four things not to undo: the box reserves that corner with `padding-bottom`
  (or her last line is typed under the button); the toggle clears any
  hand-dragged inline height, since the box is `resize:vertical` and "back to
  small" would otherwise leave it where she dragged it; it is **NOT sticky**
  (the compact box is the page's shape — her WORDS are kept in localStorage,
  the size is not); and it sits **56px in from the right**, not in the exact
  corner, because `/voice` is served `{ pill: true }` and the injected pill
  owns that fixed column — a z-index lift is not the fix, it steals the pill's
  own ▼. Test: `node scripts/test-voicelab-bigbox.js` (the real page headless,
  with the real pill and the iPhone 13's 47px inset simulated).
  **♥ / ✕ ON A TAKE, AND THE TWO FILTERS OVER THEM (2026-08-28, Sophie: "add
  the same playground heart x hide pattern in voice studio").** The
  Playground's pattern brought over whole rather than reinvented: both marks on
  every finished take's meta row, tapping the lit one clears it
  (`POST /api/voicelab/render/:id/vote`, one field on the take's own doc), and
  one segmented box of two filters on the list's header line — ♥ keeps only
  what it names, ✕ drops only what it names, and they stack. Five things not to
  undo:
  - **ONE SETTING ACROSS BOTH TABS** (her call): Text and Voice are two views
    of one state (`voicelab_liked` / `voicelab_hidex`; hide-the-✕'d opens ON
    since 2026-09-14 — the Playground's ✕-filter note has the rule), so `paintFilt`
    repaints every copy. A filter lit on the tab she is not looking at is the
    silent-filter failure this app keeps getting burned by.
  - **THE TWO LIT COLOURS MUST DIFFER** — the heart takes the rose and the ✕
    the quiet grey. They do opposite things, and two rose buttons side by side
    read as two of the same thing (the Playground's own `.xfilt.on`).
  - **A ♥ SYNCS WITH THE ASSETS TAB, BOTH WAYS** (her call: "so the two
    agree") — the take is already filed into `professional-voice-plan-review`,
    so the vote route writes the `forge-asset-votes` doc and the Assets vote
    route calls `voicelab.voteFromAssets` back. One direction only would leave
    a stuck heart on whichever surface she did not tap. Best-effort on both
    sides: the mark she tapped has to land whatever the sync does. **Only a
    TTS take has an Assets record** — `fileTakeToAssets` skips the changer —
    so a changed take's mark lives on its doc alone, honestly.
  - **AN UNFINISHED OR FAILED TAKE WEARS NO MARKS** and hearts-only drops it,
    the Playground's rule for a failed run: there is nothing finished to have
    an opinion about. Hide-the-✕'d only ever drops a ✕, so a failure stays.
  - **A filtered-away card is HIDDEN, never removed** (the poll repaints it in
    place), and an emptied list SAYS why — "Nothing hearted yet" /
    "Everything here is crossed out" — rather than looking like a lost history.
  Test: `node scripts/test-voicelab-votes.js` (the server contract by source,
  then the real page headless with the real pill and the iPhone 13's 47px
  inset; verified failing 3 against the pre-fix page).
  **Every take is kept** —
  the output AND, on the changer, the recording that went in — and each card
  has a ⤓ that downloads it through our own server (`GET /api/voicelab/file/:id`,
  `?src=1` for the source); a Storage url alone only plays inline.
  **A RENDER KILLED BY A DEPLOY IS RECOVERED, NEVER RE-RENDERED (2026-08-27,
  Sophie: "voice studio render killed").** A render is a fire-and-forget job in
  this process, so a deploy that swaps the instance out kills it between
  "ElevenLabs finished" and "we saved it": the doc sits on `rendering` forever
  and the page — which polls every 2s while a take says that — **spins on it
  with nothing on screen ever admitting it is dead**.
  **BUT THE TAKE THIS WAS BUILT ON WAS NEVER KILLED — TWO CHATS GUESSED THE
  SAME WRONG CAUSE ON THE SAME NIGHT (2026-08-27).** Her 4,842-character Max
  take started 8:16pm Pacific, four minutes after #1794's deploy merged, which
  is what made "killed by the deploy" look obvious. Measured on the doc
  afterwards: it finished on its own at 8:28:45pm, `done`, with a url and no
  error — it had taken **735 seconds**, and the identical text re-sent twelve
  minutes later came back in **75**. So ElevenLabs' own latency swings 10x on
  the same input, nothing was orphaned, and no credits were lost.
  **What she was looking at was a working render with no clock on its spinner**
  — a slow one and a dead one were the same picture — so `spinLabel` in
  `public/voice.html` counts the minutes now ("rendering… 4m", and past five
  "· long ones can run past 10m"), and a failed take carries a **Render again**
  button instead of being a retype of 4,842 characters. The recovery below is
  still right and still worth having; it just answers a case that had not
  happened yet. **A deploy four minutes before a symptom is a coincidence
  until the doc says otherwise — read `doneAt` before believing it.**
  **The audio was never lost — ElevenLabs keeps every generation in its own
  history and hands the mp3 back for FREE**, so the sweep fetches what she
  already paid for rather than charging her twice (the Playground's
  banked-sheet call, same shape). Recovery is tried BEFORE anything is marked
  failed; `POST /api/voicelab/render/:id/recover` is the hand crank (`dry:true`
  is free) and `node scripts/recover-voicelab-render.js` (dry by default) runs
  the same code from a container.
  - **The one thing it can get wrong is picking the WRONG take**, and that
    lives in `voicelab-recover.js` alone — pure, no network. She re-renders the
    same words over and over (six "magic pills" takes in ninety seconds), so
    "the right voice at about the right time" is not specific enough. The
    rules: the **request id** (stamped the moment the response HEADERS arrive,
    i.e. before nearly every kill — the one exact key), else the **exact text +
    voice + window** for TTS, else **voice + window** for a conversion **and
    only when exactly one qualifies** — an STS item carries no words to tell
    two apart, and handing her another take's audio under this take's name is
    worse than leaving the card failed. In every case an item sitting nearer to
    ANOTHER of her renders belongs to that one, so a stuck doc can never steal
    the generation a doc that finished normally already used.
  - Test: `node scripts/test-voicelab-recover.js` (her real killed take, the
    six-identical-takes case, and the two refusals).
  **Full details: `docs/modules/audio-and-film.md`.**

### Grab a video

- **Grab a video** (`ytdl.js`, `/api/ytdl`, no page — a chat calls it) — paste a
  YouTube (or Vimeo, or almost anything yt-dlp knows) url, get the file, already
  filed where the tools look. Sophie's ask, Aug 2026: "can u create an endpoint
  so i can give u a youtube url and download it thru here? otherwise i have to
  do it on my computer" — the alternative was a third-party site on her phone,
  which works but leaves the file in Files, needing a second trip to upload it
  into whichever tool wanted it.
  **THE "DATACENTER IPs ARE BOT-BLOCKED" LINE IS WHY NOBODY BUILT THIS, AND IT
  WAS STALE.** Measured 2026-08-23 from a cloud container: yt-dlp read the
  metadata AND pulled a real 3.3MB m4a and a 17MB 720p mp4, first try, no
  cookies. That is the exact shape CLAUDE.md warns about at the top — a dated
  measurement going stale when the environment moves underneath it.
  **BUT "RENDER IS NOT BLOCKED" WAS WRONG, AND IT TOOK THREE TRIES TO SEE IT
  (2026-08-27).** Two successful downloads on 08-23 were read as the endpoint
  working. Measured properly four days later: Render refused **3 of 4** distinct
  videos, on EVERY player client, twice over — including two of Sophie's own
  grabs. A session container got **2 of 3** the same minute, so it is Render's
  IP reputation, not YouTube in general. What made this survive so long is that
  `dQw4w9WgXcQ` — the probe's hardcoded video — is one of the few Render still
  serves, so **`GET /status?probe=1` went green throughout two days of her
  grabs failing. A green probe says ONE video on ONE client works and nothing
  more; never quote it as the endpoint being healthy.**
  **SO THE CONTAINER IS THE FIRST MOVE AND THIS ROUTE IS NOT (Sophie's call,
  2026-08-27: "use container not render for YouTube downloads").** A chat that
  needs a YouTube file runs yt-dlp in its OWN container — fetch
  `yt-dlp_linux` from the GitHub release, pull the file, POST it to
  `/api/drop/upload-file` or `/api/audio/upload-file`, which are the exact two
  routes this module files through, so the result is indistinguishable from a
  grab. Reach for `POST /grab` only when the container is refused too and it is
  worth one more IP; it fails honestly with `blocked:true` in yt-dlp's own
  words. **And the container is only better odds** — measured from one
  2026-08-27, metadata read on 3 of 4 videos and the bytes came down for 1 of 3.
  Both refused → **the desktop queue is still the real fallback.**
  Cookies (`--cookies`) are the documented remedy and need her logged-in
  browser, i.e. the desktop trip this was built to avoid.
  **It costs nothing** — no model call; it is bandwidth and ffmpeg on our own
  box. `POST /grab {url, kind:'audio'|'video', quality?, to?}` returns an id in
  ~0.3s and the work runs behind it (`GET /:id/job` to poll).
  - **It files through the SIBLINGS' OWN ROUTES, never its own copy of them** —
    video to the Dump (`/api/drop/upload-file`, bundle `YouTube`), audio to the
    audio library (`/api/audio/upload-file`, batch `youtube`) — so md5 dedupe,
    the video poster, duration probing and the memo filing each happen once, in
    the place that already knows how. Assembly's "Add from the Dump" and the
    Film Editor read those two libraries already, so a grab is usable the
    moment it lands.
  - **AUDIO DEFAULTS TO `none`, AND THAT IS THE POINT (Aug 2026 v2, Sophie:
    "are you meaning to ask a chat about it?").** This first shipped defaulting
    audio into the audio library with a note saying to pass `to:"none"` for
    music — i.e. a flag someone had to remember, which is not a fix. The audio
    library transcribes everything it receives and files it into her voice-memo
    archive: right for an interview, wrong for a song, and the two are NOT
    tellable apart from the metadata (`categories`/`artist`/`track` all come
    back `NA` on the player client yt-dlp uses here, measured 2026-08-24). So
    the default is the mistake that is cheap to undo — `none` keeps the file
    under `ytdl/` and hands back a url — and a chat grabbing an INTERVIEW asks
    for `to:"audio"` deliberately. The other way round, a music grab nobody
    thought about puts lyrics in among the notes she searches, with no undo
    beyond hunting the memo down.
  - **THE BOT-BLOCK IS PER PLAYER CLIENT — not per IP, and not per video
    (measured 2026-08-27, and this REPLACES the "it is just intermittent
    rate-limiting" reading that stood here for three days).** On ONE box within
    a few seconds, asking for the same video: `default`, `android_vr`,
    `android`, `ios_music` and `android_music` all answered, while `tv`,
    `tv_simply`, `web`, `web_safari`, `web_music`, `ios` and `mweb` were every
    one of them refused. The web/tv clients want a JS challenge the box has no
    runtime for; the android family does not ask.
    **This is why a passing probe proved nothing.** Six real grabs of Sophie's
    on 2026-08-25 failed, four of them bot-blocked, while
    `GET /status?probe=1` answered fine throughout — the probe's video happened
    to be one `default` would still serve. A green probe says that ONE video on
    ONE client works, never that the endpoint works.
    So a refusal now walks the CLIENT ladder first and only then waits, and a
    grab records the `client` that answered. Anything that is not a block (a
    dead url, a private video) still fails at once rather than wasting her
    time.
  - **The 300MB cap is a MEMORY fact, not a preference** — both sibling routes
    sit behind `express.raw`, which buffers the whole body, and the box has
    512MB. Raise `YTDL_MAX_MB` only if that changes.
  - **yt-dlp is fetched at RUNTIME and refreshes weekly**, not pinned at build:
    it is the one dependency that goes stale on someone else's schedule (YouTube
    moves its player and last month's binary stops extracting), so a build-time
    pin is a tool that works until it silently doesn't. `yt-dlp_linux` is
    self-contained — Render needs no Python. A failed refresh keeps the cached
    copy; ffmpeg comes from `ffmpeg-static`, already a dependency.
  - The doc id is `sha1(video|kind|quality)`, so the six spellings of one
    YouTube url (`youtu.be`, `/shorts`, `&t=90`, a playlist tail) are ONE grab
    and asking twice never pays twice. `DELETE /:id` forgets the grab but leaves
    the filed copy alone — it belongs to the Dump now, and quietly pulling a clip
    out of an Assembly would be the worst kind of surprise.
  - Tests: `node scripts/test-ytdl.js` (the url rules, the id, the format
    strings and the block detection — pure, no network) and
    `--live`, which drives the REAL argv all the way to a file on disk and is
    the only honest way to ask whether this box can still reach YouTube.

### WHICH DOOR — the Seedance door history (moved from CLAUDE.md)

Moved verbatim from the CLAUDE.md checklist on 2026-09-14; the standing rule stays there.

**A SEEDANCE JOB WITH NO VIDEO REFERENCE GOES THROUGH OPENROUTER, NOT
APIFRAME (2026-09-08, Sophie: "make a note so any reference w no video uses
open router instead").** **PARKED 2026-09-09 — EVERYTHING GOES THROUGH
APIFRAME WHILE THE 480p MINI DRAFT IS MADE (Sophie: "the answer is APIFRAME
I guess. Let's build the pipeline around that for now").** Two things
decided it the same day: OpenRouter stopped passing on the Mini sale (its
discount reads 0 and today's jobs billed full list) and every other
reseller carries the same face filter, so a film full of person references
has one door anyway. The OpenRouter route, its log and its price reader stay
built; the `/footage` page still sends `door:'openrouter'` and is NOT
changed by this note — flipping it is hers to ask for. The rest of this
paragraph is how the two doors work, kept for when she lifts this. OpenRouter bills ByteDance's list price; the ~5%
top-up fee is paid when credit is BOUGHT, not per job. **SUPERSEDED
2026-09-09 — the "480p Seedance 2.5 is 10.9¢/s all in against APIFRAME's 13¢,
a 4s clip 44¢ against 52¢" figure was list × the fee on the WRONG CANVAS and
is wrong.** The measured formula (Mini renders on the 2.5 canvases, a clip is
24·s + 1 frames, no fee in the shown price, the sale read live off
OpenRouter) is in the Footage bullet under *THE PRICE IS EXACT*.
**BUT BYTEDANCE'S OWN DOOR REFUSES REFERENCE VIDEOS
WITH PEOPLE THAT APIFRAME ACCEPTS (measured 2026-09-08, scene 36a1 of the
ward film):** the two untouched Seedance clips APIFRAME drew that scene from
came back from OpenRouter as `InputVideoSensitiveContentDetected.
PrivacyInformation` — "may contain real person" — before anything drew, while
the three pajama pictures on the same job passed. OpenRouter forwards to
ByteDance directly, so BytePlus direct would refuse the same; APIFRAME is
running with something looser (unmeasured — its own backend or ByteDance's
paid "advanced creation rights"). **MEASURED THE SAME NIGHT ON THE
CHEAPEST MINI JOB (refusals are free, an accepted one ~5¢): a PERSON-FREE
reference video — the socks B-roll, a Seedance output — PASSED and drew
(6.5¢), and an AI-GENERATED face STILL (a frame of the Mini clip itself) was
REFUSED (`InputImageSensitiveContentDetected.PrivacyInformation`).** So the
line is the PERSON, not the video.
**BUT THE FILTER IS PER MODEL, NOT PER DOOR, AND THAT RETIRES "BYTEPLUS DIRECT
WOULD REFUSE THE SAME" ABOVE (measured 2026-09-12 on her own two jobs).** The
SAME photoreal AI-made still — the priest-uniform Sophie png, a face, plainly
photographic — was **refused on 2.0** (`InputImageSensitiveContentDetected.
PrivacyInformation`, "may contain real person", free, before drawing) and
**accepted and drawn on 2.5, twice**, through the identical OpenRouter door
minutes apart. Across all 8 of her OpenRouter jobs carrying an image
reference, **6 drew and 2 were refused**, and the split is the MODEL every
time. So "OpenRouter refuses a photoreal face" is wrong as it was written
here: 2.5's input gate is looser than 2.0's, and a doubtful face is worth one
free 2.5 attempt before assuming a door is closed. What is NOT known is
whether 2.5's gate is merely looser or genuinely probabilistic — ByteDance's
own filters are documented as probabilistic rather than binary, so two
acceptances are not a guarantee. The refusal is free either way, so try it.
The older reading below stands for 2.0 and for reference VIDEOS:
- **text, pictures, audio, and person-free videos → OpenRouter**: `POST
  /api/openrouter/video` (`openrouter.js`) takes the APIFRAME route's exact
  body (`prompt, model?, duration, resolution, aspectRatio, generateAudio,
  referenceImageUrls, referenceVideoUrls, referenceAudioUrls, chat, scene,
  title, session`), answers 202 `{jobId, poll, sent}` — `sent` is the
  literal body OpenRouter received, the read-back her rule asks for — poll
  `GET /api/openrouter/video-job/:id`, and **files the SAME
  `forge-video-jobs` log** stamped `provider:'openrouter'`, so `GET
  /api/apiframe/video-log` reads both doors. `GET /api/openrouter/credits`
  is the balance in dollars. From a container with no server:
  `scripts/openrouter-video.js`.
- **any reference with a FACE or a PERSON in it, still or video → APIFRAME.**
  ByteDance's refusal is free and comes back before drawing as 400
  `{refusal:'content'}` with a `hint` naming APIFRAME — so sending a doubtful
  job to OpenRouter first costs nothing. **AN ILLUSTRATED FACE PASSES
  (measured the same night, Sophie: "would it take an illustration face?
  make varying degrees"): three Sandy-mirror ink-and-wash portraits — the
  loosest, a finished painting, the most rendered — each sent as the only
  reference, all three accepted and drawn (5.4¢ each, Mini 1:1), while the
  photoreal frame of a Seedance clip was refused.** So the line is
  PHOTOREAL: a drawn face rides, a photographic one (real or generated) does
  not. Two things about the drawn face: it also sets the LOOK of the clip
  (the loosest reference drew an illustrated clip, the most rendered a
  photoreal one), and the watercolor parents were refused on both doors
  earlier — a drawn face is likelier to pass, not certain to; the refusal is
  free, so try it. **AND A REAL PHOTO WITH ONLY THE EYES BLURRED PASSES
  (measured the same night, Sophie: "blue just the eyes / real still"):**
  Mayra's real portrait was refused whole, and the identical photo with one
  soft-blurred band over the eyes (`sharp` extract → blur(14) → composite,
  everything else untouched) was accepted and drawn (job
  `aY9LbIGMe9T5lEcA984a`, 5.4¢, Mini 1:1). So the filter is an EYES check,
  not a face check — the mouth, the hair, the skin all rode through. It
  drew O'Hara, not her, because the prompt describes O'Hara; a likeness
  from a real photo needs the "the woman in [Image1]" wording and is
  untested. **THE STILL TRICK DOES NOT CARRY TO VIDEO (same night, Sophie:
  "also try blur eyes in a movie"):** the scale audition clip with every
  face's eyes blurred on every frame (YuNet face landmarks → a Gaussian band
  over the eyes, `blur-eyes-video.py`) was still refused,
  `InputVideoSensitiveContentDetected.PrivacyInformation`. So a video is
  screened for a PERSON, not a face; a person video goes through APIFRAME
  whatever is done to its eyes. **And the likeness half is measured too:**
  card 45a's words with "Mayra is the woman in [Image1]" over the
  eyes-blurred photo drew HER (job `OudXGDf91uEk1um3pZUt`, Mini 3:4, 5.6¢) —
  the eyes are the filter's key and not the model's; the likeness rides on
  the rest of the face. Mini has no 2:3; its portrait shapes are 3:4 and 9:16.
  **AND A HARD BLACK BAR PASSES THE INPUT FILTER TOO — BUT A FAMOUS FACE
  THEN HITS A SECOND GATE ON THE OUTPUT (measured 2026-09-09, Sophie: "i
  wanna test black bar over danielle radcliffe eyes").** A press photo of
  Daniel Radcliffe, whole, was refused at validation like every real photo
  (`InputImageSensitiveContentDetected.PrivacyInformation`, free, in twelve
  seconds); the identical photo with a solid black rectangle over both eyes
  (PIL, nothing else touched) was **ACCEPTED and drew for a full minute**,
  then died at the far end with a refusal nothing here had seen before:
  `status:'failed'`, *"the output video may be related to copyright
  restrictions"* (job `3SL74kD3vCOePxCzjgh4`, Mini 480p 3:4 4s, the "the man
  in [Image1]" wording). So the bar defeats the eyes check exactly as the
  blur does — **and there are TWO filters, not one**: an INPUT check that
  reads the reference's eyes, and an OUTPUT check on the drawn video that the
  Mayra rounds never reached. No `generation_id` record exists for the failed
  job, so it reads as unbilled; the shared key had another chat's batch
  running, so the charge could not be isolated exactly. **Which half of that
  photo tripped the output gate is UNMEASURED** — Radcliffe's own likeness,
  or the branded premiere step-and-repeat filling the background. The cheap
  next test is the same bar on a tight crop of the face with no backdrop in
  frame: it still fails on copyright → the likeness; it draws → the
  backdrop. **MEASURED THE SAME HOUR AND IT IS THE FACE:** the identical bar
  on a tight crop of his face with the branded backdrop cropped OUT was
  accepted, drew for a full minute, and failed with the same copyright line
  (job `YMyKELvY54v87oTEhVG8`). So the output gate is reading HIM, not the
  step-and-repeat behind him. **WHY IT EXISTS, from the public record:**
  Seedance 2.0 took a Disney cease-and-desist on 2026-02-13 ("a virtual
  smash-and-grab") with Paramount Skydance, Netflix, Warner Bros. Discovery,
  Sony and Universal behind it, and ByteDance said on 02-15 it would stop
  generating realistic human faces and IP-protected characters — this gate is
  that promise. Three things worth knowing before designing around it: every
  published guide documents the INPUT face filter and barely mentions an
  output check, and the output-copyright error they DO document is about
  AUDIO (we sent `generate_audio:false`, so that reading is ruled out here);
  the filters are described as PROBABILISTIC rather than binary, so one job
  is not a measurement and a near-threshold input can pass once and fail
  next; and a failed generation is not billed, which matches our own two
  blocked jobs leaving no `generation_id` record. **WHERE THE LINE SITS
  BETWEEN FAMOUS AND NOT IS UNMEASURED AND IS THE OBVIOUS NEXT PASS** (Sophie's
  own idea, 2026-09-09: "you could use progressively less famous people to
  see where the bar is") — nobody has published one. Both ends are already
  on file: Radcliffe blocked, Mayra drawn. Hold the bar constant on every
  rung, since it is what reaches the output gate at all.
- **WHY APIFRAME IS LOOSER, from ByteDance's own docs:** a face is only ever
  allowed as a `asset://` from its trusted asset library — a VIRTUAL portrait
  (a drawn or AI-made character that "must not resemble any real human
  person", uploaded once under a signed commitment letter) or a REAL person
  who face-verifies on their phone, every upload face-matched to that check.
  Both need a BytePlus account with BUSINESS verification (a corporate
  registration certificate); the entry tier is free (50 assets), the paid
  tiers $1,400/mo and up. The ChatGPT-character workflow is exactly the
  virtual-portrait door. NOT BUILT — hers to decide (Cod God Inc?).
- **OTHER RESELLERS CARRY THE SAME FACE FILTER — RESEARCHED 2026-09-09
  (Sophie: "research other platforms like OpenArt and Atlas Cloud and see if
  they have the same restrictions as OpenRouter").** The face check runs
  INSIDE ByteDance's model service, so every door that forwards to
  Volcengine/BytePlus gets the identical `PrivacyInformation` refusal: Atlas
  Cloud, fal, Kie, WaveSpeed, PiAPI (standard mode), OpenArt, Higgsfield,
  Dreamina. Read off the vendors' own pages, not guides: **Atlas Cloud's June
  blog says "supports realistic human faces … does not have this
  limitation", and its CURRENT model FAQ says the opposite** ("Can I upload a
  real person's face photo? No"), with the Mini page naming "the restriction
  on uploading real human faces" across the family — the marketing line is
  stale, the FAQ is live. OpenArt's own pages say nothing either way; every
  third-party guide lists it among the standard-model doors. Kie's
  "realistic human support" means GENERATED humans. **The doors that do take
  a real photo are the ones with their own consent layer or a different
  backend**: Runway's Seedance 2.0 (its API is documented as having no
  real-face input filter and lighter moderation — Runway's ToS still bans
  public figures and non-consenting people and it monitors output), PiAPI's
  "Less Restriction" mode (consented images), HeyGen (a verified digital
  twin of YOURSELF, her own face only), EvoLink (after verification), and
  the official Volcengine liveness route above. **Reddit is unreadable from
  this container by every door tried (2026-09-09: reddit.com answers a block
  page, the pullpush archive refuses automated readers, the redlib mirrors
  are down) and the web searches surfaced no thread** — so whether Atlas
  Cloud quietly accepts a real face in practice, the way APIFRAME does, is
  UNMEASURED beyond its own FAQ saying no. The only honest test is one 5¢
  Mini job there with the eyes-blurred photo, which needs an account. **THE
  DOOR IS BUILT FOR THAT TEST (2026-09-09, her API reference):
  `atlascloud.js` at `/api/atlascloud` — the same body and the same
  `forge-video-jobs` log as the other two doors, `provider:'atlascloud'`,
  `ATLASCLOUD_API_KEY` set on Render by API (live on the next deploy).
  **MEASURED THE SAME NIGHT — ATLAS TAKES A PERSON VIDEO (Sophie: "try the
  hardest thing first · try the video reference with a person"):** the
  O'Hara stretcher clip, three people in frame, the very clip OpenRouter
  refused, went through as the only reference on Mini · 4s · 480p · 16:9
  and DREW HER — accepted on the POST, done in 80s, 864x496 (job
  `2b0b451548d84902988d01faf8bbcf99`). So Atlas is a second door for a
  person reference, and **the 80% Mini sale is REAL**: its own `GET /models`
  says Mini is 1.1¢/s (list 5.6¢) — 4.4¢ for that clip against ~16¢ on
  APIFRAME — 2.5 13.4¢/s, 2.0 9¢/s, Fast 2.7¢/s; `footage.js` reads it live
  (`atlasPrices()`). **AND A REAL UNTOUCHED PHOTO PASSES — Mayra's real
  portrait, the one OpenRouter refused whole, drew her near-exactly (job
  `1341e19bf73f44bd9e038c9b15c35286`, ~4¢); a reference image is not even
  billed as tokens (a reference video is). Radcliffe is refused on the POST,
  free, as COPYRIGHT — with the black bar too: Atlas's gate is a famous-face
  check that sees through the bar, not a real-person check.** So Atlas takes
  every person reference the film has except a public figure. **AND FAST'S OUTPUT GATE FIRES ON A PLAIN TEXT PROMPT (measured
  2026-09-09, Sophie: "go on the fast vs mini dialogue test"):** the same
  4s · 480p · 16:9 dialogue prompt — a woman at a kitchen table speaking one
  line to camera, NO reference of any kind — was refused TWICE on 2.0 Fast
  with the copyright line (`error_code 1012004`, `price "0"`, ~110s each,
  unbilled) and drawn once on Mini (job `0fae510554ad4dbea977d4484990f716`,
  ~4¢). So the output gate is per MODEL and probabilistic, and Fast is the
  strict one; a plain prompt is not safe from it. Page: "Dialogue test — 2.0
  Fast vs Mini" in this chat's Compare tab. The console is
  the only billing read (no API), and Atlas's slot word is `video 1` /
  `image 1`. **AND ATLAS IS THE ONE DOOR THAT HANDS BACK A LAST FRAME —
  `return_last_frame` works there, is FREE, and beats an ffmpeg decode
  (measured 2026-09-09; a no-op on OpenRouter, measured the day before).** A
  job sent `returnLastFrame: true` answers a second output, `…_last-frame.png`,
  billed at the clip's own token price to the token — and against the decoded
  final frame it is 1.18x sharper with **118x the horizontal chroma detail**,
  i.e. rendered before the h264 encode rather than pulled out of it. That is
  the shot-to-shot chaining tool this film keeps needing. Mirrored to Storage
  and filed on the log as `lastFrame`. **ON FOR EVERY FOOTAGE JOB SINCE
  2026-09-10 (Sophie: "on")** — the page asks for it on the Atlas door alone
  (OpenRouter's flag is a no-op and APIFRAME builds its own body) and the card
  carries it. **AND SINCE 2026-09-11 IT IS ON THE CLIP'S OWN CARD, WHICH IS THE
  ONLY PLACE SHE CAN REACH ONE (Sophie: "how do i get these last frames").**
  It was being baked and banked on every Atlas job and the page drew it
  NOWHERE: the only door it ever had was the RECENT drawer, and she took the
  outputs out of there the same day it shipped ("recents is recent UPLOADED"),
  so for a day every clip carried a picture with no way to see it — the "?"
  card still pointed at the drawer, which is how it stayed invisible. Now it is
  a small tile in the card's own picture row, **beside the references rather
  than under them** (her word: "next to the references" — one grid, so it takes
  the next free column and the card is no taller); tapping it opens it big in
  the clip's own player, with a **save** that goes to Photos through the same
  three-path ladder the clip's does. Its label says **`last frame · whole
  clip`** on a TRIMMED clip, because the frame is the end of what the DOOR drew
  and not the end of the part she kept — the one thing worth knowing before
  chaining off it. A clip that went out through another door has none and shows
  no tile at all (the Assets tab's silence rule). **CHAINING FROM IT IS STILL
  SAVE-AND-RE-ATTACH — there is no "use this as a reference" button, and that
  is hers to ask for.** Off by default still for any other caller:
  `returnLastFrame: true` is what asks. Full numbers:
  *`return_last_frame`* in `docs/modules/audio-and-film.md`; test
  `node scripts/test-atlas-lastframe.js`. **AND IT WAS THE FOOTAGE PAGE'S ONLY DOOR
  FROM THAT EVENING TO 2026-09-11 (Sophie: "make atlas the default and only
  route through footage")** — it rode for an afternoon as its own "2.0 Mini ·
  Atlas" row, then every 2.x row carried an Atlas id and the page pinned
  `door:'atlascloud'`. **SUPERSEDED 2026-09-11 by "choose cheapest"**: auto
  ranks the three doors by what the tap really costs, which keeps Mini and
  Fast on Atlas (its 80%/70% sale) and moves 2.0 and 2.5 to OpenRouter (only
  20% off there) — so a 2.0 or 2.5 clip gets NO last frame, since that rides
  on Atlas alone. Full note: *ATLAS CLOUD — THE THIRD DOOR* in
  `docs/modules/audio-and-film.md`.
  The "go" rule applies word for word.** Likeliest
  reading of APIFRAME's looseness is a Runway-style backend rather than a
  ByteDance key — unmeasured; APIFRAME calls itself an "official partner"
  and says nothing about faces. Whether any of those doors also skip the
  OUTPUT copyright gate (the Radcliffe failure) is unmeasured everywhere.
  **PRICED THE SAME DAY (Sophie: "check on the pricing compared to
  OpenRouter, APIFRAME and ByteDance itself"), one 4s 480p 3:4 clip, no
  reference video, off each vendor's own price page:** BytePlus direct and
  OpenRouter share ByteDance's per-token list (OpenRouter's `orTok` IS the
  SKU) — Mini 14¢ · Fast 17¢ · 2.0 28¢ · 2.5 ~43¢ (2.0/Fast/2.5 canvases
  unmeasured) — **but OpenRouter is NOT the same price: its card fee is 5.5%
  ($0.80 minimum) on every top-up, 5% by crypto, so a job costs list × 1.055
  (Sophie's correction, 2026-09-09; this line first said "~5%" and "the same
  list").** Measured the same hour: OpenRouter's `pricing.discount` on every
  Seedance model reads **0**, and both of the day's `/footage` Mini jobs
  billed $0.1396 — full list. **Atlas Cloud's "-80%" Mini banner is
  UNVERIFIED and probably stale**: its own deal pages date the Seedance sale
  window to "May 7, 2026, 23:59 UTC" and "June 15", its June Mini post says
  $0.056/s with no sale, and its lowest-price page stacks a TOP-UP bonus
  (up to +30% credit at $50,000) into the headline. At its undiscounted
  $0.056/s Atlas is 22¢ for the 4s Mini clip — DEARER than OpenRouter — and
  only 4.4¢ if the banner is real; a real charge needs an account and is
  hers. Same face filter either way. APIFRAME: Mini ~16¢ · Fast 28¢
  · 2.0 32¢ · 2.5 52¢. The doors that take a real photo are all dearer:
  PiAPI less-restriction Mini 31¢ · 2.0 44¢ · 2.5 66¢ (a +10% markup, AND
  the face still has to go through its asset library with the person
  verified — the official route with a fee on it, not a loose door); EvoLink
  2.0 37¢ · Fast 30¢ (no Mini); Runway Mini 64¢ (16¢/s with a 64-credit
  minimum) · 2.0 $1.44 · 2.5 80¢ minimum (20¢/s plus 10¢ per second of input
  video). So APIFRAME stays the cheapest door for a reference with a person
  in it by 2-4x; for a person-free job OpenRouter at list + 5.5% is the
  measured floor, and Atlas Cloud only beats it if its banner discount is
  real.
The "go" rule above applies to both doors word for word. A no-video job
sent to APIFRAME is not wrong, it is 16% dearer. Full note: *OpenRouter for
Seedance* in `docs/modules/audio-and-film.md`.
