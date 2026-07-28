# De-APIing the daily astrology: the composed-fragment engine

**Status (2026-07-27): NOT built — decision deferred by Sophie; the daily
astrology reading stays AI-written for now.** This doc records how the
API-free version would work, what it costs to build, and the trade-offs, so
any chat can pick it up when she decides. A working proof-of-concept composer
was run in-session on 2026-07-27 (sample output below).

## Why this is feasible at all

The expensive-*looking* part of the daily reading is already free. `astro.js`
(130 lines over the `astronomia` ephemeris) computes real natal charts and
real daily transits locally — `/api/witch/daily` computes the user's chart,
today's sky, and the tightest transit aspects (`transitAspects()`,
`server.js` ~2386) **before** any AI is involved. The only thing the API call
(gpt-4o, `part:'astro'` and `part:'deep'`) does is turn those computed
positions into prose. Replace the writer, keep the math, and the feature is
deterministic and free per-user forever.

## The design

One committed JSON library + a small composer function. Same architecture as
`witch-tarot-readings.json` (write once with agents, sweep the voice, serve
via a GET, compose client- or server-side).

### Library shape (`witch-astro-fragments.json`, ~700 short passages)

- **Pair passages** — the core. Key `"<transiting planet>-<natal planet>"`
  × 3 aspect tones (`flowing` = sextile/trine, `friction` = square/opposition,
  `charged` = conjunction), 2 variants each. 9 transiting planets (Sun,
  Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto — the
  transiting Moon is covered by the mood line instead) × 11 natal targets
  (10 planets + North Node; add Ascendant rows later for birth-time charts)
  × 3 tones × 2 variants ≈ **594 passages**, each 1–3 sentences grounding the
  pairing in real life (a text, money, sleep, a conversation). Each entry also
  carries a short `do` and `dont` line (feeds `counsel`) and 1-2 `focus`
  phrases (feeds the headline).
- **Aspect clauses** — 5 one-liners ("It's an open door, not a delivery…"),
  appended to the lead passage.
- **Moon-mood lines** — 12 (today's Moon sign; everyone shares this line).
- **Season lines** — 12 (today's Sun sign).
- **Retrograde notes** — ~8 (one per retro-capable planet worth mentioning).
- **Charm pool** — ~40, keyed loosely by Moon sign; **omen pool** — ~60
  `{sign, meaning}` pairs, keyed by the anchor's focus domain.

Authoring plan: same as the tarot corpus shipped in #583 — fan out to
Opus/Sonnet agents with the house voice + the banned-phrasings list from
CLAUDE.md, then an independent sweep. That corpus was ~660 passages; this is
the same order of magnitude.

### Composer (deterministic, ~60 lines)

Inputs are exactly what the AI prompt gets today: today's sky, the natal
chart, `transitAspects()` sorted by orb.

1. **Anchor** = tightest aspect (same rule the AI prompt uses).
2. Lead = pair passage for `anchor.t + '-' + anchor.n`, tone from the aspect,
   variant = `hashStr(dateISO + '|' + uid + '|lead') % variants` (FNV-1a,
   same rotation trick as the tarot corpus — repeats of the same anchor on
   different days read differently).
3. Append the aspect clause; then the Moon-mood line + (season line OR retro
   note, seed-picked).
4. `focus`/headline, `counsel.do`/`dont` from the anchor entry; charm + omens
   from the pools, seed-picked.
5. No birth data → skip pair passage, compose from mood/season/retro +
   invite line (mirrors the current no-chart branch).
6. 13-sign astronomical mode: the sign names arrive already converted
   (`con13()` in server.js); only the sign-keyed pools (moon-mood, season)
   need Ophiuchus entries.

Slots in as a module (`witch-astro-composed.js`) replacing the `openaiChat`
call inside `/api/witch/daily` — request/response shape unchanged, so the
client needs zero changes. Could even run client-side later, but server-side
first keeps the swap surgical. Firestore caching becomes unnecessary for the
composed parts (composition is instant and deterministic).

### The deep page

`part:'deep'` needs its own treatment: either compose it from the anchor's
longer companion passages (adds ~300 passages: one 60-90 word `depth` per
pair × 2 variants — this is what makes the library "full") or drop the deep
page for free users the way the tarot Dive-deeper was replaced by a paid
feature. Decide when the main decision lands.

## Proof-of-concept output (real run, 2026-07-27, Sophie's real chart)

Anchor computed: transiting Mars sextile natal Moon (orb 0.3°); Moon in
Capricorn, Saturn retrograde. Composed result:

> **acting on the feeling**
> Mars is on good terms with your Moon today: for once the thing you feel
> like doing and the thing worth doing are the same thing, and the
> restlessness has somewhere real to go. It's an open door, not a delivery —
> it counts only if you walk through it before the day ends.
> The Moon is in Capricorn, so the day runs on lists and quiet competence;
> feelings keep their coats on until the work is done. Saturn is retrograde —
> an old obligation circles back asking for an actual signature, not a nod.
> *Charm: Write the one thing you want on the back of a receipt and keep it
> in your wallet through tomorrow.*

The AI version for the same chart/day anchored on the same transit (it gets
the same math) — see the session comparison; both were warm and specific,
the AI one stranger ("let the connection open ghosts from its own closet"),
the composed one steadier.

## Trade-offs

- **Cost:** composed = $0 per user per day, forever. AI = one gpt-4o call per
  user per day per part (plus deep), the app's biggest per-user cost now that
  the tarot reading is corpus-based.
- **Voice:** composed is steady and repeatable; AI is freewheeling and
  occasionally brilliant/weird. Fragments can't produce a never-seen sentence.
- **Repetition ceiling:** with 2 variants per pair, a user who gets the same
  anchor two days running sees the other variant, then a repeat. Slow outer
  planets (Saturn+) hold an anchor for weeks — mitigate by preferring the
  tightest *fast*-planet aspect (Sun/Mercury/Venus/Mars) when orbs tie, or by
  3 variants for the slow pairs.
- **Freshness:** the AI reacts to nothing but the chart either way — the
  composed engine loses nothing on personalization; both use the same math.
- **Product options:** (a) full swap — astrology joins tarot as 100% free and
  API-free; (b) two-tier — composed reading free, the AI-written reading
  becomes part of the paid tier next to Ask-the-cards. (b) preserves the
  "strange" voice as a sellable perk and was the direction under discussion.

## Placement math (for reference)

11 bodies × 12 signs = 132 possible placements; any one chart has 11 (12 with
a rising sign, which needs birth time). But the library scales with planet
*pairs* (9 × 11 × 3 tones), not placements — placements only drive the small
sign-keyed pools.
