# Dating book — "The Sophie Experiment" project archive

Durable home for Sophie's dating-memoir project, so any Claude session can pick
it up. Assembled July 2026 from Sophie's planning docs and prior Claude chats.

**Start with [`THE-SOPHIE-EXPERIMENT.md`](./THE-SOPHIE-EXPERIMENT.md)** — the
distilled brief (structure, illustration style + prompt formulas, essays,
infographics, timelines, design system, tone). Then
[`OPEN-QUESTIONS.md`](./OPEN-QUESTIONS.md) for live decisions.

## Contents
- `THE-SOPHIE-EXPERIMENT.md` — the project brief / source of truth.
- `OPEN-QUESTIONS.md` — unresolved choices (title, tone, hero+3 vs 3-only, …).
- `reference/` — Sophie's own artifacts, kept verbatim:
  - `book-skeleton-outline.md` — her master structure doc (title, page types,
    essay list, infographic list, 50-date tracker).
  - `layout-mockup.html` — her date-spread layout (portrait + 3 drawings + data).
  - `scene-timelines.html` — the per-date segmented scene-timeline design.
  - `scene-timeline-breakdowns.md` — scene lists per date (batch 1: Griffin–Jake).
  - `chart-ideas-ryan.html` — per-date bespoke "useless but funny" infographics.
  - `hero-comparison.html` — hero-image style comparison tool (the
    "pen and ink + watercolor washes" formula lives here).
  - `moments-v3.js` — the `/api/generate/moments` endpoint (small-drawing prompt).
- `previews/` — rendered PNGs of the above + two hero-style example illustrations
  (`hero-style-example-*.webp`) generated July 2026 to confirm the style.
- `raw-transcripts/` — the full prior Claude chat transcripts (Feb 2026 Sophie
  Experiment sessions + Feb chart-ideas chat). Primary source; noisy JSON, but
  greppable and preserved so nothing is lost.

## Key facts (quick)
- Model: `sageryza/watercolordrawings` LoRA, trigger `wtr` (ImageForge).
- Hero style: `Pen and ink illustration with watercolor washes. <scene>. Muted
  watercolor palette, delicate ink work`.
- Small drawings: `Soft watercolor illustration of <subject>, minimal
  background, gentle muted palette`. **Never append "lots of empty white space"**
  (it breaks the style).
- Type: EB Garamond + DM Sans. Square coffee-table format. No pills.
- Dates source: Notion "date book (pdx)" + "…part 2".
