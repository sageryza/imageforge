'use strict';
/*
 * playground-port.js — WHICH Playground tile a filed image should re-run on,
 * and whether that answer is KNOWN or a GUESS (Aug 2026, Sophie).
 *
 * The Assets / Meta Assets lightbox offers "open in the Playground" for any
 * image whose exact prompt is on file. It carries the CONTENT half plus a
 * style tile — and the tile decides which reference image and which baked
 * style prompt the re-run gets. So picking the wrong tile silently swaps the
 * reference out from under her, and nothing on screen said so.
 *
 * TWO ANSWERS, NEVER ONE (her ask: "some sort of indicator saying whether
 * it's using the reference and prompt or not"):
 *   matched:true  — the filed style half NAMES this tile's own reference file
 *                   (or its LoRA trigger). The re-run carries the same
 *                   reference and the same style prompt the picture was made
 *                   with. This is the only case that may claim that.
 *   matched:false — nothing identified it. The prompt still lands, on the
 *                   default tile, and the page says the reference is not the
 *                   one behind this picture. A confident wrong label here is
 *                   worse than an honest "unknown" — the same rule the
 *                   MODEL · QUALITY captions follow.
 *
 * TWO KINDS OF EVIDENCE, AND NEITHER IS A VIBE.
 *   `refs`     — the reference FILENAME, as the style half names it. Every
 *                name this repo has ever attached is listed, OLD NAMES
 *                INCLUDED: renaming a ref never rewrites the thousands of
 *                style halves already filed, so `movie-style.jpg` (174
 *                mentions live, 2026-08-20) has to keep resolving to the
 *                dream ref it was renamed from.
 *   `prefixes` — a verbatim fragment of the tile's OWN baked style prompt.
 *                Measured 2026-08-20: 29 real Pastel runs and 8 real Hoonies
 *                runs quote their prefix word for word and name no file at
 *                all, so filename-only evidence dropped them on the fallback.
 *                A tile's own sent text is not a guess about the tile.
 * Counts in the comments are from that day's sweep of all 3,791 portable
 * rows; they are the reason each alias is here. What is NOT evidence: loose
 * words. The old router read `/watercolor/` and sent 224 pictures to the WTR
 * LoRA whose prompts merely said "muted watercolor wash" — a different
 * engine entirely.
 *
 * Pure and browser-safe: served to the page as /playground-port.js and
 * require()d by scripts/test-playground-port.js. No DOM, no network.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ForgePlaygroundPort = api;
}(typeof self !== 'undefined' ? self : this, function () {

  // Keys are promptlab.html's STYLES keys — NOT labels, and NOT server.js's
  // gptStyle ids (`chatgpt` here is `evan` there). scripts/test-playground-port.js
  // pins them against the real page and the real server table.
  const PORT_STYLES = [
    {
      key: 'watercolor', label: 'WTR',
      // The one Replicate LoRA — no reference image and no baked prefix, so
      // its trigger word is what identifies it.
      triggers: [/\bwtr\b/],
      refs: [], prefixes: [],
    },
    {
      key: 'chatgpt', label: 'Sandy mirror',
      // sage sandy mirror. Old names: evan-film-style.png (121), and her own
      // scan filename datescan0013 (64), which chats quote as the source.
      // The label was "ChatGPT" until Aug 2026; the KEY is unchanged, because
      // it is what the page's STYLES and every deep link already say.
      refs: ['sage-sandy-mirror.png', 'evan-film-style.png', 'datescan0013.png'],
      prefixes: ['use only the style of the attached style reference and ignore its content'],
    },
    {
      key: 'dreamy', label: 'Dreamy',
      // dream mystery — her "1000 Dreams Per Night" diary-comic page. Old
      // name movie-style.jpg (174) still outnumbers the current one (84).
      refs: ['dream-mystery.jpg', 'movie-style.jpg'],
      // Verbatim from PL_GPT_STYLES.dreamy.prefix. Her 2026-08-22 rewrite
      // shortened it to "copy its drawing style" and dropped the linework /
      // hand-drawn texture / muted palette list this used to quote, so the
      // fragment stopped matching — kept short on purpose now, since it is the
      // half of the sentence her wording has held through every revision.
      prefixes: ['copy its drawing style but do NOT copy its content'],
    },
    {
      key: 'triangle', label: 'Triangle',
      // The Triset game's triangular cards, and the Playground tile that
      // draws them (2026-08-31). It attaches the SAME reference file as
      // Dreamy, so a filename can never tell the two apart — the evidence is
      // the equilateral clause the tile swaps into the tail, and it is quoted
      // long on purpose: longest evidence wins, and it has to out-reach
      // Dreamy's own fragment above, which every triangle card also carries.
      // Verbatim from triangle-clause.js (the one copy server.js swaps in);
      // scripts/test-playground-port.js pins it against that file.
      refs: [],
      prefixes: ['EQUILATERAL TRIANGLE-SHAPED CARD, all three sides exactly the same length'],
    },
    {
      key: 'pastel', label: 'Pastel',
      // sophie snake / sophie animals. Old names style-1.png / style-2.png,
      // which is why the witch-school/ path is kept on the alias: hoonies'
      // refs are ALSO called style-N.png, under hoonies/.
      // The path-qualified aliases carry NO extension on purpose: chats write
      // the pair as `witch-school/refs/style-1+2` (29 rows), which no
      // `.png` alias can ever match.
      refs: ['sophie-snake.png', 'sophie-animals.png',
        'witch-school/refs/style-1', 'witch-school/refs/style-2'],
      prefixes: ['only as a style reference for the linework'],
    },
    {
      key: 'scarry', label: 'Scarry',
      refs: ['richard-scarry-1.png', 'richard-scarry-2.png', 'richard-scarry-3.png'],
      prefixes: ['the two attached style reference images'],
    },
    {
      key: 'hoonies', label: 'Hoonies',
      // NOT the retired `sageryza/hoonie` Replicate LoRA (trigger HOONIE) —
      // that is a different engine, and a picture it drew is honestly unknown
      // here rather than routed onto this tile.
      refs: ['hoonies/refs/style-1', 'hoonies/refs/style-2',
        'hoonies/refs/style-3', 'hoonies/refs/style-4'],
      prefixes: ['copy their drawing style, not their content'],
    },
    {
      key: 'plain', label: 'ChatGPT',
      // THE ONE TILE WITH NO EVIDENCE, AND THAT IS HONEST — not an oversight.
      // A plain-ChatGPT picture is her words sent alone: no reference filename
      // to name, no baked prefix to quote, no trigger word. There is by
      // definition nothing on the record that says a picture came from here, so
      // one never routes onto this tile — it exists so the three style tables
      // stay in step, and so a picture ported here by hand has somewhere to
      // land. `evidence:false` is the deliberate opt-out the test reads; do NOT
      // invent a fragment to make it look identifiable.
      refs: [], prefixes: [], evidence: false,
    },
  ];

  // The tile an unidentified image lands on. Its prompt is hers either way;
  // only the reference is wrong, and `matched:false` is what says so.
  const FALLBACK = 'chatgpt';

  const norm = (s) => String(s == null ? '' : s).toLowerCase();

  /**
   * Which tile made this picture?
   * `promptStyle` = the filed style half, `caption` = the MODEL · QUALITY tag.
   * → { style, matched, label, by } — `by` names the evidence, for the test
   * and for anyone debugging a wrong route.
   *
   * Longest evidence wins, so `hoonies/refs/style-1` beats anything shorter
   * that also appears in the same string.
   */
  function matchStyle(promptStyle, caption) {
    const hay = norm(promptStyle) + ' ' + norm(caption);
    // Longest evidence wins, across BOTH kinds. That is what keeps the
    // ambiguous stems apart: `hoonies/refs/style-1` and
    // `witch-school/refs/style-1` both end in the same six characters, and
    // only the directory tells them apart — so a shorter alias must never be
    // able to claim a string a longer one also matches.
    let best = null;
    PORT_STYLES.forEach((st) => {
      [].concat(st.refs || [], st.prefixes || []).forEach((sig) => {
        if (hay.indexOf(norm(sig)) < 0) return;
        if (!best || sig.length > best.by.length) best = { st, by: sig };
      });
    });
    if (best) return { style: best.st.key, matched: true, label: best.st.label, by: best.by };
    // Nothing named. A LoRA attaches no reference and bakes no prefix, so its
    // trigger word is all there is — asked last, because it is one word and
    // the weakest thing here.
    for (const st of PORT_STYLES) {
      for (const rx of (st.triggers || [])) {
        if (rx.test(hay)) return { style: st.key, matched: true, label: st.label, by: String(rx) };
      }
    }
    const fb = PORT_STYLES.find((s) => s.key === FALLBACK);
    return { style: FALLBACK, matched: false, label: fb.label, by: '' };
  }

  // low | medium | high, when the caption or the style half says so.
  function matchQuality(promptStyle, caption) {
    const m = (norm(promptStyle) + ' ' + norm(caption)).match(/\b(low|medium|high)\b/);
    return m ? m[1] : '';
  }

  return { PORT_STYLES, FALLBACK, matchStyle, matchQuality };
}));
