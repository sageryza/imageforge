# The parent scenes on Seedance 2.0 Mini — shot list, cut points, asset gaps

Built 2026-09-09 in the `mom-character-clip` chat, after the mom (1b) and dad
(take 1) auditions landed and the two of them drew together in one shot.

## Why Mini at all

Mini is ~1.4¢ a second (measured: a 4s 480p clip billed **5.58¢** three times
running through OpenRouter). The whole parent block is ~230 seconds of script,
so **about $3.20 if every clip lands first time**, against roughly $30 for the
same footage on APIFRAME Seedance 2.5.

**The one hard constraint: ByteDance refuses any reference video containing a
person.** So on Mini nobody rides as `[Video1]` — every character needs a
STILL with the eyes covered plus, for anyone who speaks, a VOICE mp3.

Measured this session:
- A photoreal face passes with the eyes **blurred** or under a **black bar**.
  Blur is stochastic — the same blurred pair was refused once and accepted
  twenty minutes later. A refusal costs nothing and comes back before drawing,
  so retry rather than rebuild.
- **Voice references must be mp3.** m4a is refused with
  `the parameter audio format ... is not valid`; mp3 was accepted.
- **Feed the OG stills, never a frame pulled out of a finished clip.** Frames
  cut from 1b and dad take 1 drew a mom whose face had drifted; the og portrait
  and the og hall-walk frame held both likenesses.
- Eye colour is the one thing worth describing, because it is the one thing the
  reference cannot carry — we delete it. Mom: hazel, golden brown near the pupil,
  olive green at the edge (measured off her og portrait). Dad: dark brown (a pick,
  matching what has been drawn so far).

## The cut points

Mini takes 4–15s. The cards are already beats; the 25–30s ones need splitting.
Each cut below falls on a change of speaker.

### 39a — the knock, the stride, the hug (10s)
Already drawn once as `s39a3`. Two clips:
1. **39a-1 · 5s** — the nurse knocks, "Sophie! Your parents are here to see you";
   Sophie's eyes open wide.
2. **39a-2 · 6s** — she comes out sideways, the parents stride at her, "Sophie!",
   the hug.

### 39b — Mommy Daddy, the nurse breaks it up (10s)
3. **39b-1 · 10s** — one clip; her line and the nurse's interruption run together.

### 40a — I got your call (30s)
4. **40a-1 · 6s** — dad: "I got your call, Sophie – you seemed so upset. Your
   mother and I came at once."
5. **40a-2 · 13s** — Sophie: "Oh … Well that was nice of you but you didn't have
   to come … everyone is acting like I'm *crazy*." She lets go of their hands.
6. **40a-3 · 8s** — dad: "You sounded so *upset* when you called … got on a plane
   immediately…"

### 40b — the mother's questions (30s)
7. **40b-1 · 8s** — mom: "Can we see your room? … what kinds of activities do you
   do?" **DRAWN — this is clip 1b, the approved mom.**
8. **40b-2 · 15s** — Sophie's answer, the room, the roast beef, the activities.

### 40c — doesn't sound so bad (25s)
9. **40c-1 · 4s** — mom turns to dad, "Now does it, Steve?" / "I'm not...sure."
   **DRAWN — the two of them together, og refs + voices.**
10. **40c-2 · 7s** — Sophie: "But it's horrible in here…"
11. **40c-3 · 9s** — mom: "That's weird … why don't we ask the doctor!" and the
    stare across the table.

### 41a — very unwell, the scissors (30s)
12. **41a-1 · 5s** — the crowded office, the assistant setting out chairs.
13. **41a-2 · 12s** — the doctor: "Your daughter is very unwell … hid them in a
    drawer in her room."
14. **41a-3 · 13s** — dad: "Sophie is a *very* talented artist" / mom's line /
    "Has she showed you her art website?" / "She has not."

### 41b — the website, Wesleyan (30s)
15. **41b-1 · 9s** — the website, the chewing noises, "she's certainly very
    talented."
16. **41b-2 · 10s** — "Wellesley was it?" / "Wesleyan." / the gesture and the
    shrug.
17. **41b-3 · 11s** — "not possible at this late stage in her illness"; dad
    shifts and the chair heaves.

### 41c — but I like myself (30s)
18. **41c-1 · 10s** — "a better version of herself"; they search her face.
19. **41c-2 · 10s** — "But — I *like* myself," and the painting on the screen.
20. **41c-3 · 10s** — "I want to make art. That's what I *do.* I'm an *artist*."

### 41d — I dropped out to be an artist (25s)
21. **41d-1 · 13s** — "I dropped out of school so I could become an artist …"
22. **41d-2 · 12s** — "your mind's in need of a bit of an adjustment," the glasses,
    the smile.

### 42 — the hallway goodbye (10s)
23. **42-1 · 10s** — Sophie watching them go, the assistant listing things to her
    father, "I think it's best you take any pills they give you."

**23 clips, 21 still to draw, ~215 seconds ≈ $3.00 at Mini's rate.**

## What each clip needs

| who | still | voice mp3 |
|---|---|---|
| the mom | ✅ her og portrait, eyes blurred | ✅ pulled off 1b |
| the dad | ✅ the og hall-walk frame, eyes blurred | ✅ pulled off take 1 |
| Sophie | ✅ `still2b-sophie-close-blur`, `-chair-blur`, `still2a-sophie-chair-wide-blur` | ❌ **missing** |
| Dr. Grayson | ✅ `still-doctor-blur`, `still2b-doctor-chair-blur` | ❌ **missing** |
| the assistant (Anne) | ✅ `still2-assistant-office`, `still2b-assistant-folders-blur` | ❌ **missing** |
| the nurse (39a, 39b) | ❌ **missing** | ❌ **missing** |
| Yolanda (40a, background) | ❌ **missing** | not needed — she does not speak |

The three missing voices can be pulled out of belt clips that already exist
(Sophie speaks in `quest2` / `intakeA3` / `climax1`; the doctor in `doc` and
`office`; the assistant in the office clips) with the same ffmpeg → mp3 →
Storage step the parents' voices used. The nurse needs an audition of her own,
or she rides as words only.

## Filing

Every clip goes to the Dump under **Mom auditions**, pins to the chat as the
newest, and lands on the deliverables list. The prompts are logged by the
OpenRouter route into `forge-video-jobs` the moment they are sent.
