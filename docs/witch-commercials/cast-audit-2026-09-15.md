# Witch commercials — who is in them (audit, 2026-09-15)

Read off the live footage log (`GET /api/footage/jobs?project=secretly-a-witch`,
**167 clips**, 152 done / 15 failed, 17 sub-folders) and the 22 sketch scripts
in `docs/witch-sketches/`. Nothing here was invented: every count is measured
and every reference is a url already in the Dump or on the clip log.

The page Sophie reads: **Witch commercials — the cast v1**, in the
`witch-commercial-characters` chat's Compare tab (sheet `witch-cast-v1`).

## The headline

**The `secretly-a-witch` cast shelf is EMPTY.** `GET /api/cast/films` says
0 people, 0 wardrobe, 0 settings — against the ward's 15 / 2 / 3 — while 167
clips have been drawn under that project. So every witch clip has hunted its
references down by hand, which is exactly the hunt `cast.js` was built to end
(2026-09-11).

## The roster, measured

Folders by size, with her own votes:

| folder | clips | ♥ | ✕ |
|---|---|---|---|
| doctor | 34 | 7 | 13 |
| (unfoldered) | 24 | 1 | 13 |
| school-lecture | 20 | 2 | 6 |
| normal-girl | 14 | 0 | 4 |
| travel-kit | 12 | 2 | 6 |
| home-away | 11 | 2 | 3 |
| b-roll | 9 | 2 | 0 |
| packing-orders | 7 | 1 | 5 |
| influencer | 7 | 2 | 1 |
| its-sophie | 7 | 3 | 4 |
| tree-stolen | 6 | 0 | 2 |
| garage · christmas | 4 each | 0 / 1 | 0 / 3 |
| pill | 3 | 0 | 1 |
| salem · huge-kit | 2 each | 2 / 0 | 0 / 0 |
| not-always-a-witch | 1 | 0 | 0 |

### People, likeliest first

1. **Sophie, present day** — the lead of nearly every spot, and she has
   **FOUR different faces in circulation** (counted 2026-09-15 by reading every
   done clip's poster; the page is *Witch commercials — the four Sophies v1*,
   sheet `witch-sophies-v1`):
   - *the chapel still* `drops/_/c05681dba6f480257652d8d89fc5c577.png`
     (short red bob, black high-collar dress) — 29 clips, the most-used.
   - *the tweed still* `drops/_/2d6c34a1f060aa68f2ca5042dc382ce4.png`
     (long wavy brown hair, tweed dress, leather handbag) — 19 clips.
   - *the short curls* — a brunette with a short curly bob who exists only
     inside the two Atlas clips (`1789064628044-1o7jq9.mp4`,
     `1789012214490-cl9isx.mp4`); the whole 34-clip doctor run hangs off her,
     and she is ALSO the woman in the hearted packing-orders clip — 36 clips,
     ♥11 ✕11, no still anywhere.
   - *the hotel one* — a fourth woman entirely, long dark straight hair, in the
     two travel-kit clips whose ONLY reference is the kit itself. Nobody was
     attached, so the model invented her — and the invented one is hearted.
   Looks in use: street/plainclothes, the tweed walk ("It's Sophie" ♥), herb
   picking (influencer ♥), packing orders in the garage ♥, the airport line,
   the hotel room ♥, the tea-dregs afternoon (home away ♥).
2. **Sophie, younger** (11–22, Catholic school uniform) — 14 clips and
   **0 hearted, 4 rejected**. No reference at all: written out in prose every
   time ("a younger version of [Image1]", "about 22, shorter hair, above her
   shoulders").
3. **The doctor** — tall young man, white coat, condescending. 34 clips, ♥7.
   No still; only the two generated clips above.
4. **The professor** (~40, graying, the Catholic-school film lecture) —
   20 clips, and he is not in frame in either hearted one. No reference.
5. **The nightgown circle** — women in old-fashioned white/cream nightgowns
   dancing round a lit pine. 16 clips across `tree-stolen` and the Christmas
   group, ♥1. **Four photo references exist** and only the 2 Christmas-group
   clips ride them; every `tree-stolen` clip rides nothing.
6. **The gloomy daughter** (~26, white nightgown, Christmas morning) — 6 clips,
   ♥1. Has a reference clip: `drops/_/5cafc3ad24f57547bb70f3fc7ac150f4.mp4`.
7. **The Salem mob and the accused girl** — 2 clips, both ♥, no reference.
8. **Classroom extras** in uniform — recurring across `school-lecture` and
   `normal-girl`.

### What the posters showed about the others (2026-09-15, every finished clip read)

The page: *Witch commercials — everyone but Sophie v1*, sheet
`witch-cast-rest-v1`.

- **The doctor holds.** Across all 34 clips he is the same young man — white
  coat, brown tie, badge — except ONE, where a grey-haired doctor in a blue
  shirt turned up instead (✕). He is the most consistent character in the whole
  project, and he has no still.
- **The professor is two men.** The prompt says "about 40, with graying hair",
  and the clips came back with a young man in an open white shirt in some and
  an elderly white-haired man in others. Nothing on file to hold him.
- **The gloomy daughter is two girls.** The hearted Christmas take is a calm
  girl on the stairs; the other is a wild-haired child in a ruffled nightgown
  (✕). Same line, two people.
- **The class never repeats.** The uniformed extras are drawn fresh each clip,
  including a blonde girl filming herself on a phone who appears once.
- **The film inside the lecture** — veiled old women handing a bowl, and the
  leeching table — is the only place the medieval doctors exist, and it reads
  consistently.
- **The neighbour is a hand.** The only frame of her is a hand knocking on a
  door.

### THE PEOPLE WHO ACTUALLY RIDE A REFERENCE — the whole list

Her ask, 2026-09-15: "ppl i named w references only". Read off every `refs`
array on the 167 clips; page *Witch commercials — the people with a reference
v1*, sheet `witch-refs-v1`. **Six, and that is all of them:**

| who | what carries them | clips |
|---|---|---|
| Sophie | the chapel still `c05681db…png` | 29 |
| Sophie | the tweed still `2d6c34a1…png` | 19 |
| Sophie | the ward's jazz clip `ward-refs/jazz-best4s-…mp4` | 5 |
| the doctor (+ Sophie in frame) | `atlascloud-video/1789064628044-1o7jq9.mp4` | 26 |
| the doctor (+ Sophie in frame) | `atlascloud-video/1789012214490-cl9isx.mp4` | 10 |
| the doctor | `drops/_/882dc8b1…mp4`, the clip she sent in | 1 |
| the gloomy daughter | `drops/_/5cafc3ad…mp4` (her own name on the file) | 5 |
| the other daughter | `drops/_/1f3fd2b0…png` (IMG_0887, the pink nightgown) | 3 |
| the nightgown circle | four photos, `20f4c4cb` · `3901051a` · `dff6d833` · `60c585b5` | 2 |
| the cat | `drops/_/06ab2c45…png`, the illustrated street | 2 |
| the man in the hot tub | `drops/_/e4a9cf70…jpg`, a real photo | 1 ✕ |

Everyone else on the roster above rides NOTHING and is written out in words
every time: the professor, the class, the Salem mob and the accused girl, the
medieval doctors and the leeched woman, the pill-ad cast, the TSA agent, the
neighbour, the boy with the couch, the men with the pickup, the mailman.

### Named in a prompt, never given a face

the TSA agent at the x-ray · the neighbour who knocks · the boy who helps move
the couch · the three men with the pickup who take the tree · the mailman ·
the medieval doctors and the woman with the leeches · the pill-ad announcer
and its "pleasant activities" cast.

### Things that behave like characters (and have real photos)

the travel kit `drops/_/22d0563da74726f1439412a4f8bd5f08.webp` (+ `b1bb8a65…jpg`,
`e3448cc0…jpg`) 18 clips · the huge kit `drops/_/613e82c89aa7274c0d2597829b0362c6.webp`
14 clips · the garage `drops/_/a20fc88040014061efc9fd61f364eee6.png` 4 clips ·
the b-roll set `IMG_0705-0708`.

### Waiting in the sketches (nothing shot yet)

Sophie in all 22 · **Witchcraft OSHA** with the clipboard — three sketches, and
the script itself says "could be a recurring character" · **Dan**, the neighbour
the salt keeps out · **Mom** on the phone (voice) · **the ghost** with the house
rules (unseen) · the crystals on performance review — **Amethyst · Rose Quartz ·
Citrine · Selenite** · **Gerald** · the familiars (the cat, the moth, the elderly
possum, **a worm named Michael**).

## What is wrong, and the fix

- **Four women are being called "sophie", and 6 clips attach two of them in one
  prompt** (3 in `influencer`, 3 in `its-sophie`). Settle one face per look and
  put it on the shelf; that is what a look is for.
- **13 prompts fight a reference with a negation** — "(no handbag)", "(no bag)".
  The 2026-09-11 Wan finding is that a negation does not keep a thing out of a
  clip; only a reference that does not hold it does. **Crop the handbag out
  once** and file the crop as Sophie's street look.
- **Young Sophie is described in prose in every clip she is in** — against the
  never-describe-a-reference rule, and 0 of 4 judged clips were kept. She needs
  one still of her own before more money goes into her.
- **9 clips filed under `secretly-a-witch` belong to another commercial** — the
  ideas-site reel ("i have a lot of ideas", "we have 500 of them", the 12 boxes,
  the mailman). They are in the unfoldered bucket and are a folder move.
- The ward's `ward-refs/jazz-best4s-*.mp4` is borrowed as a reference in
  `packing-orders` — fine, but it means a ward look is drifting into the witch
  film.

## The shelf this audit is asking for

`POST /api/cast/films {slug:'secretly-a-witch'}` already exists (the folder is
listed, order 2, untucked). What it needs is entries — the ward's
`scripts/seed-cast-ward.js` is the precedent, dry by default. Suggested first
pass, `kind` in brackets:

sophie [person] with looks *street*, *packing orders*, *travel*, *the doctor's
office* · sophie-young [person] (no reference yet) · the-doctor [person] ·
the-professor [person] (no reference yet) · the-nightgown-circle [person] ·
the-gloomy-daughter [person] · the-salem-mob [person] · the-travel-kit
[setting] · the-huge-kit [setting] · the-garage [setting] · the-hotel-room
[setting] · the-catholic-classroom [setting].

**Not written yet — hers to say go.** A wrong canonical face on a shelf is
worse than an empty one, and which Sophie is the lead is a decision, not a
measurement.
