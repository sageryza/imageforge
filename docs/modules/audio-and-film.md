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
    after a plain remux) explains APIFRAME's own trim refusals but NOT this:
    the signed, untouched clips were refused here.
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
  - **`return_last_frame` DOES NOTHING — measured 2026-09-09, do not wire it.**
    Mini's model card lists it as an allowed passthrough, and a job sent with
    `return_last_frame: true` is ACCEPTED (202, no shape error) — but the
    completed job answers one `unsigned_urls` entry and `content?index=1`
    replies `Video index 1 out of range (1 videos available)`. Nothing extra
    comes back anywhere in the response. So it is a no-op on this door and
    wiring it would ship a dead flag. **ffmpeg is the way to get a last
    frame**, and two things are worth knowing when you do: the video is
    `yuv420p`, so a decoded frame already has a quarter of the colour detail,
    and the LAST frame specifically is a **P-frame, never a keyframe** (read
    off a real clip) — the end of a prediction chain at the tail where the
    encoder spends fewest bits, i.e. the worst frame in the file to lift. Fine
    for looking at; it compounds if you chain clips by feeding each last frame
    in as the next first frame. Cost of finding this out: one 5.6¢ probe (the
    first attempt failed free on the random audio-copyright filter).
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
  - **FEATURES ON EVERY SEEDANCE 2.x THAT NOTHING HERE USES YET** (off the
    served model cards, `GET /api/openrouter/models`): **`first_frame` /
    `last_frame` keyframes** — APIFRAME's route already wires them
    (`imageUrl` → `start_image`, `endImageUrl` → `end_image`), the OpenRouter
    route deliberately does not, and forcing a clip to END on the next clip's
    first frame is the continuity tool this film keeps needing;
    **`return_last_frame`** (a Mini passthrough) hands the last frame back so
    the next clip can start exactly there; **`camera_fixed`** (`cameraFixed`
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
    **THE FOOTAGE PAGE'S ONLY DOOR, AND THE AUTO DEFAULT (2026-09-09,
    Sophie, the same evening: "make atlas the default and only route through
    footage").** It rode for an afternoon as its own model row ("2.0 Mini ·
    Atlas", her "did you add it to the footage tile?") beside the OpenRouter
    Mini; by the evening the two measurements above — a person video and a
    real photo both pass, a famous face is refused free — plus the real 80%
    Mini sale made it the door. So: every 2.x row in footage.js's `MODELS`
    carries an Atlas id (`atlas`) and Atlas's LIST rate per second
    (`atlasCents`: Mini 5.6¢ · Fast 9¢ · 2.0 11.2¢ · 2.5 16.7¢, off its own
    `GET /models` `price.origin`; 2.0 at 1080p is unpriced there and null);
    the page pins `door:'atlascloud'` on every job, its model list is the
    rows Atlas carries (1.5 Pro stays off), its "?" card names Atlas and
    quotes NO balance (Atlas has none to read — the console is the only
    billing read), and its sale line reads `atlasPays` ("2.0 Mini is 80% off
    right now" while Atlas charges 20% of list). `doorFor`'s AUTO order is
    Atlas first with APIFRAME as the content-refusal fallback (a famous face
    — `startJob` re-sends there with a note saying so), OpenRouter for a
    shape Atlas does not price, APIFRAME last; a PINNED Atlas door never
    falls back, so the page's refusal is a measurement she reads, with its
    own line ("a famous face in a reference; a chat can try this one through
    APIFRAME"). **The price is EXACT on Atlas with no reference video** —
    it bills per second, so the live rate × seconds is the bill — and
    "about" with one (the one job measured ~19% more) or when the live read
    failed and the list rate stands in. With no key set the page answers a
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
    describing them or uploading references").** `footage.js` +
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
