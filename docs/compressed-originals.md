# The pictures that were compressed at birth

**Measured 2026-08-19. 978 originals are lossy and cannot be recovered — only
re-drawn, which gives a different picture.** Three Compare pages in the
`dream-feed-image-compression` chat show every one of them.

This is the companion to the fix. PRs #1404 and #1416 removed the lossy
parameters and `scripts/test-no-generation-compression.js` greps the tree so
they cannot come back — but that guard is **static**. It protects the code from
here on and says nothing about the ~21,000 pictures already in Storage,
including ones made by one-off chat scripts that no longer exist in the tree.
`scripts/find-lossy-originals.js` is the other half: it asks the IMAGES.

## What went wrong, in one line

Three different spellings of the same mistake — compressing the ORIGINAL at the
moment it was made, rather than the derived copy a page loads:

- OpenAI `output_compression: 80` on images edits
- Replicate/Flux `output_quality: 80` with `output_format: 'webp'`
- an argument-less sharp webp encode, which quietly defaults to quality 80

In all three the provider (or sharp) encodes lossily **before** the bytes reach
us, so the full-quality version never existed on our side. The rule it collided
with — "never serve a raw generated PNG to a page" — is still correct and is
about **derived display copies** (`scripts/webp-assets.js`, the `thumbs/`
service). Compress the derivative; leave the original alone.

## The measurement

Bits per pixel: `size × 8 ÷ (width × height)`. The dream feed happens to hold
both sides of the fix about an hour apart — same generator, same style, same
prompts — which is what makes the numbers trustworthy:

```
before the fix (webp @ 80)    1.26 – 3.93 bpp     160 –   503 KB
after  the fix (webp @ 100)  10.17 – 13.61 bpp  1,301 – 1,742 KB
a lossless PNG original      11    – 16    bpp
```

The Replicate half was confirmed independently rather than read off the
parameter. Same model, same prompt, **same seed** (Flux is deterministic, so the
pixels are identical and the encode is the only variable):

```
webp @ output_quality 80    143 KB
png (lossless)              683 KB     4.8x
PSNR 40.9 dB · max channel error 28 levels · 1.7% of channels off by >8
```

## Two tests, and the second is what keeps it honest

A small lossy webp is only a problem when it is the **only** copy. A derived
display copy — a `webp/` sibling, a `thumbs/` entry, a 640px poster, a cut
vector cell — is *supposed* to be lossy and its original is safe elsewhere.
Reporting those would bury the real findings, so anything under 1000px on its
long edge, or living in a known-derived folder, is left alone.

**The bpp threshold is a SCREEN, not a verdict.** Bits per pixel measures how
hard the picture was to encode as much as how badly it was encoded, so it only
separates the two populations *within a comparable style*. Flat art is the false
positive: pastel and watercolour originals at quality 100 land at 3.9–5.9 bpp
and are perfectly clean. A first pass cut at 6.0 flagged 2,006 pictures and
roughly half were fine. The cut is **2.5**, and a hit is a list to check —
confirm it against the code that writes that Storage prefix before calling
anything damaged.

## The count

**809 traced to a named lossy call:**

| where | n | engine |
| --- | --- | --- |
| Playground (`promptlab/`) | 277 | gpt-image-2 |
| Playground (`promptlab/`) | 192 | Replicate LoRAs |
| Test Station / house styles (`replicate/`) | 138 | Replicate LoRAs |
| Story shorts (`story-shorts/`) | 110 | gpt-image-2 |
| Style triptych (`style-compare/`) | 48 | gpt-image-2 |
| Story Room beat art (`scratchpad/art/`) | 22 | gpt-image-2 |
| Test Station house styles (`housestyle/`) | 13 | gpt-image-2 |
| Talking zine (`talking/`) | 9 | gpt-image-2 |

**169 more surfaced by the scan afterwards** — `hospital-film/` (71),
`journal-illustrations/` (34), `dream-feed/` pre-fix (14), `style-test/` (12),
`hoonies/` (9), `refs-sheet/` (8), `scarry-ab/` (8), `pipeline-walkthrough/` (5),
`gravity-lock/` (4), `style-grid/` (4).

Clean by contrast, and worth knowing so nobody re-investigates them:
`openai/` (median 914 KB), `dalle/`, `set/`, `fruit/full/`, `hospital-film/`'s
PNG half, `movies/`, `characters/`, `nde-*`.

## Running it

```
node scripts/find-lossy-originals.js                  # every prefix
node scripts/find-lossy-originals.js --prefix promptlab/
node scripts/find-lossy-originals.js --json out.json
```

Read-only, and cheap: it reads the first **64 bytes** of each webp (the RIFF
header carries the dimensions) and never downloads a picture, so a whole-bucket
pass costs kilobytes. Needs `FIREBASE_SERVICE_ACCOUNT` (deckfactory-43176).
