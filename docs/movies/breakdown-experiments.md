# Breakdown-model experiments — TODO

Ideas to try on the films/movies scene-breakdown call, logged here so any chat
picks them up. Not started unless marked done.

## High-temperature 4o / 4.1, one call vs three calls (not started)
Sophie's idea (2026-07-21), from the "Controlling My Own Destiny" films run.

Run the breakdown on `gpt-4o` and `gpt-4.1` at a HIGH temperature (not the
current 0.7) to see what "weird"/unexpected scene choices come out — wilder
shot ideas, transitions, and the kind of movie it invents — compared to the
current gpt-5.6-sol low-reasoning call (see `movies.js`'s
`FILMS_BREAKDOWN_MODEL`/`FILMS_BREAKDOWN_EFFORT`).

Two call shapes to compare against each other AND against the current
single-call breakdown:
1. **One call for everything** — same shape as today: one prompt that returns
   all scenes, all transitions (cut/morph/dream), and all the shot choices at
   once.
2. **Three separate calls** — split the same decisions into three prompts
   (e.g. one for the scene/shot list, one for transitions between them, one
   for the kind of movie/visual direction overall) and see whether separating
   the decisions produces better or just differently-weird results than one
   call juggling everything together.

Compare the same way the mini-vs-Sol breakdown was compared: a side-by-side
page (posted to the chat's Compare tab) with each variant's scenes, prompts,
and transitions in matched rows, plus a couple of rendered images (climax +
best character scene) per variant so the difference is visible, not just
textual.
