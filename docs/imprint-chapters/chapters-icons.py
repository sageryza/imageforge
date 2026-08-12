"""The chapter → pastel-sheet icon map. ONE copy, shared by
build-chapters.py and build-hers2.py so the two artifacts can never wear
different drawings for the same chapter."""
# ── one icon per chapter (Sophie, Aug 2026: "the icons you picked for each one
# not Snake for all of them — use all the icons you made, that's why you made
# them"). Chapter number → the lesson-sheet icon that belongs to it: the icon
# for the lesson that chapter MADE where there is one, else the icon whose
# drawing says what the chapter was. All 21 are used exactly once; the 7
# chapters with no icon keep the plain coloured dot rather than repeating one.
ICON = {
    2: 'li-03-two-questions-not-one',           # overlapping circles, one shared shape
    3: 'li-08-astrology',                       # the lesson it made
    4: 'li-01-adhd-autism',
    5: 'li-02-general-dysphoria',
    6: 'li-10-animal-magic',                    # the snake — the whole set at once
    7: 'li-11-ocd-witchcraft',
    8: 'li-04-inside-outside-thoughts',
    9: 'li-05-the-metaphor-machine',
    10: 'li-17-i-actions-intentions',           # the open eye — reading people
    11: 'li-16-valued-customer',
    12: 'li-18-ii-the-pattern-collector',       # the matchbox — the queue
    13: 'li-07-art-is-forgiving',               # brush and blob — the palette test
    14: 'li-06-where-do-you-crop-art',
    15: 'li-20-my-experiment-with-manifesta',   # hand reaching — notes and votes
    16: 'li-09-instrumentalism-part-i',         # the key — Imprint, the shapes
    17: 'li-19-iii-expert-mode',                # magnifying glass — the exact prompt
    18: 'li-21-in-case-you-re-curious-part-',   # mortar and pestle — the hub
    19: 'li-12-god-only-works-in-mysterious',   # constellation — only the truth
    20: 'li-13-synthetic-learning-syndrome',    # doughnut on a stick — the variant
    21: 'li-14-for-the-hate-of-the-game',       # the die — which model
    22: 'li-15-what-do-you-want-to-wake-up-',   # bed and sunrise — the Test Station
}
