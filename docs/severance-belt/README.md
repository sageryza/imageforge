# Her scenes — the belt (severance-api-multiple-frames)

`her-scenes-the-belt-v3.html` is the page posted 2026-09-08 (id
`yvLzYzgH2Cx9h9zgs2hE`, superseding v2 `WwxZVtbu2GhVi2L0XXGr`). Built from v2
by the page-stress-testing chat at Sophie's ask: "make the preamble w
references etc its own separate collapsible text block".

What changed against v2:
- Each card's setup (who is in which reference, the setting, "what came
  before") is its own folded block above **your words**, saved under
  `<scene>.pre`; the scene stays under `<scene>.p`. **The chat that sends a
  scene joins the two** (`pre + "\n\n" + p`) — v2 had everything under `.p`.
- Her saved edits are LOADED BACK on open (v2 saved them and never read them,
  so a reopen showed the original text). Sheet `belt-md`, chat
  `severance-api-multiple-frames`.
- Her card-4 edit (`md-32b.p`, 1,046 chars, carrying her own "what came
  before") was split on the server into `md-32b.pre` + `md-32b.p` the same
  hour; `belt-md-verdict-before-split-2026-09-08.json` is the verdict doc as it
  stood before that write, verbatim.
- Every card carries the setup fold, empty where the file had none, so a "what came before" can be added on any scene.
- `.card{min-width:0}` — the flex trap that let compare.js's chapter bar widen
  card 1 in WebKit (#2185).

`POST /page` warns about "a prose block between the title and the first
picture": that is her scene text in the first card's box read as an
explanation — the page's shape, not a kit rule it skipped.
