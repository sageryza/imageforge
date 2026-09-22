# Protection & Cleansing — the rewrite

Sophie: "Rewrite the Witch School 'Protection' lesson (PROTECT_CARDS in
public/witch.html) so it reads better — same subject, same number of cards or
more, kicker/heading/body per card."

Twelve cards where the live lesson has ten. The subject, the order of ideas and
the two-letter prefix (`pc-`) are unchanged; two cards are new — the scratched
protection marks (5) and the salted-water wash split out of the smoke card (9),
so each cleanser gets its own picture. Both need art before wiring; the rest
can reuse the existing `pc-01` … `pc-10` illustrations where the subject still
matches (see the map at the bottom). Text only — nothing in `witch.html` was
touched and no art was drawn.

What changed against the live cards, in short: the welcome card now opens the
way the other lessons do ("one small idea at a time"); the house cleanse names
its intention before its steps; the bar-lowering and pronouncement lines are
gone ("a well-warded home is simply a place your shoulders drop", "air and sea,
doing the laundry", "a broom sweeps energy, not just dust"); every card carries
a real, checkable specific (Blagrave 1671, the 2004 Greenwich bottle, Knole
1606, Highland saining, the morijio cone); and the After card points at the
next rungs instead of tea.

---

## The cards

### 1 · Protection & Cleansing — Start at the door
Before anyone wrote a love spell or a money charm, someone salted a doorstep.
Protection is the oldest magic in every tradition, and most of it rests on one
plain idea: **guard the openings, keep the inside clear.** We'll walk it one
small idea at a time — the thresholds, then the four old tools, then a cleanse
you can do tonight.

### 2 · The idea — Guard the thresholds
Folk magic treats a house the way it treats a body: whatever comes in, comes in
through an opening. The Romans gave the doorway its own god, **Janus**, with a
face for each direction of the crossing. Doors, windows, the hearth and its
chimney — every old charm gathers at those points, because a warded crossing
wards the whole room behind it.

### 3 · The purifier — Salt
Salt preserves, salt cleans, salt draws water out of whatever it touches, and
the craft has always read those three as one power. Outside restaurants in
Japan a small white cone of salt, **morijio**, still sits beside the door. At
home: a thin line across the threshold, a pinch in each corner, or a small bowl
left out to take up what feels heavy — emptied outside, never into your own bin.

### 4 · The steadier — Iron
Cold iron is the oldest guard against the fairy folk and the ill-wisher alike,
and the **horseshoe** is that charm hiding in plain sight. John Aubrey, walking
London in the 1680s, found them nailed to threshold after threshold. Hang yours
points up to hold the luck in — or points down, as other counties insist, so it
pours over everyone who walks under. Both camps are sure.

### 5 · The mark — The daisy wheel
Look closely at an old beam or a fireplace surround and you may find a
six-petalled flower scratched into the wood with a compass: the **daisy wheel**,
the commonest protection mark in Britain. The room built at Knole for James I
in 1606, months after the Gunpowder Plot, has thirteen of them cut into one
beam. The old belief: an evil thing that finds a line must follow it, and a line
with no end holds it forever.

### 6 · The trap — The witch bottle
A real charm, dug up under old thresholds by the hundred. Joseph Blagrave wrote
the recipe down in 1671: the householder's urine, stoppered in a bottle with
three nails or pins and a little salt. One found in Greenwich in 2004 still held
its cork — inside were twelve nails, eight bent pins, hair, fingernail clippings
and a leather heart pierced through. A **witch bottle** works as a decoy: ill
will aimed at you finds your likeness first, and stays caught.

### 7 · The sweep — The broom
A **besom** does two jobs. In use it sweeps a room's staleness out with its
dust — always toward the door and over the threshold, and in Hoodoo from the
back of the house to the front. Hung over the door between sweeps it stands
guard. The old folk kept rules for it, too: never sweep after dark, and never
carry an old broom into a new house.

### 8 · The cleanser — Smoke
In the Highlands the New Year began with **saining**: juniper branches set alight
and carried through every room until the household coughed, then every door and
window thrown open to the cold morning air. Rosemary was burned the same way in
sickrooms across Europe. The smoke carries the heaviness; the open window is
where it goes.

### 9 · The cleanser — Salted water
The other cleansing stream is the wash. Dissolve a pinch of salt in a bowl of
water and wipe it along the sills and door frames, or sprinkle it into the
corners — the Hoodoo floor wash and the church's holy water are the same gesture
in two vocabularies. Work from the back of the house toward the front door,
and pour what is left outside.

### 10 · The practice — A house cleanse
A cleanse is for a change you can feel: after an argument that hung in the
room, after someone difficult has gone, the first night in a new place. Say
what it is for. Then open the windows first, so the heaviness has a way out.
Sweep toward the door. Carry smoke into the corners — corners hold the most.
Wipe the sills with salted water. Close up, light one candle, and say aloud that
it is done — the old house charms all end with the **words spoken out loud**.

### 11 · On your person — Little armor
Protection travels. A pinch of salt and a sprig of rosemary in a small cloth bag
in your pocket; an old key worn on a cord; the blue glass **nazar** eye that has
hung in Mediterranean doorways for three thousand years; a cross of rowan twigs
tied with red thread, the Highland charm for a byre door. Small, quiet and
yours.

### 12 · After — Tonight
Pick one: a bowl of salt by the door, or windows open and a sweep toward the
threshold. Say what it is for before you begin. That is your first ward — the
witch bottle is the next rung, and the Altar lesson shows where a house's
guards live once you have more than one. ✦

---

## Paste-ready (apostrophes escaped for the single-quoted JS strings)

`img` ids: `pc-01`–`pc-04` map to the same subjects as today (welcome,
thresholds, salt, iron); `pc-05` is NEW (the daisy wheel); the old `pc-05`
(witch bottle) becomes card 6, old `pc-06` (broom) card 7, old `pc-07` (smoke)
card 8; `pc-09` salted water is NEW; old `pc-08` (house cleanse) is card 10,
old `pc-09` (little armor) card 11, old `pc-10` (after) card 12. Two new
pictures to draw, ten to keep. `bg` hexes come off the illustrations, so the
new ones are left blank here.

```js
const PROTECT_CARDS = [
  { img: 'pc-01', bg: '#fefbf6', kicker: 'Protection & Cleansing', h: 'Start at the door', body: 'Before anyone wrote a love spell or a money charm, someone salted a doorstep. Protection is the oldest magic in every tradition, and most of it rests on one plain idea: <b>guard the openings, keep the inside clear.</b> We\'ll walk it one small idea at a time — the thresholds, then the four old tools, then a cleanse you can do tonight.' },
  { img: 'pc-02', bg: '#fef9f3', kicker: 'The idea', h: 'Guard the thresholds', body: 'Folk magic treats a house the way it treats a body: whatever comes in, comes in through an opening. The Romans gave the doorway its own god, <b>Janus</b>, with a face for each direction of the crossing. Doors, windows, the hearth and its chimney — every old charm gathers at those points, because a warded crossing wards the whole room behind it.' },
  { img: 'pc-03', bg: '#fdf9f3', kicker: 'The purifier', h: 'Salt', body: 'Salt preserves, salt cleans, salt draws water out of whatever it touches, and the craft has always read those three as one power. Outside restaurants in Japan a small white cone of salt, <b>morijio</b>, still sits beside the door. At home: a thin line across the threshold, a pinch in each corner, or a small bowl left out to take up what feels heavy — emptied outside, never into your own bin.' },
  { img: 'pc-04', bg: '#fcf9f6', kicker: 'The steadier', h: 'Iron', body: 'Cold iron is the oldest guard against the fairy folk and the ill-wisher alike, and the <b>horseshoe</b> is that charm hiding in plain sight. John Aubrey, walking London in the 1680s, found them nailed to threshold after threshold. Hang yours points up to hold the luck in — or points down, as other counties insist, so it pours over everyone who walks under. Both camps are sure.' },
  { img: 'pc-11', bg: '', kicker: 'The mark', h: 'The daisy wheel', body: 'Look closely at an old beam or a fireplace surround and you may find a six-petalled flower scratched into the wood with a compass: the <b>daisy wheel</b>, the commonest protection mark in Britain. The room built at Knole for James I in 1606, months after the Gunpowder Plot, has thirteen of them cut into one beam. The old belief: an evil thing that finds a line must follow it, and a line with no end holds it forever.' },
  { img: 'pc-05', bg: '#fdf8f0', kicker: 'The trap', h: 'The witch bottle', body: 'A real charm, dug up under old thresholds by the hundred. Joseph Blagrave wrote the recipe down in 1671: the householder\'s urine, stoppered in a bottle with three nails or pins and a little salt. One found in Greenwich in 2004 still held its cork — inside were twelve nails, eight bent pins, hair, fingernail clippings and a leather heart pierced through. A <b>witch bottle</b> works as a decoy: ill will aimed at you finds your likeness first, and stays caught.' },
  { img: 'pc-06', bg: '#fdf8f1', kicker: 'The sweep', h: 'The broom', body: 'A <b>besom</b> does two jobs. In use it sweeps a room\'s staleness out with its dust — always toward the door and over the threshold, and in Hoodoo from the back of the house to the front. Hung over the door between sweeps it stands guard. The old folk kept rules for it, too: never sweep after dark, and never carry an old broom into a new house.' },
  { img: 'pc-07', bg: '#fdf7f0', kicker: 'The cleanser', h: 'Smoke', body: 'In the Highlands the New Year began with <b>saining</b>: juniper branches set alight and carried through every room until the household coughed, then every door and window thrown open to the cold morning air. Rosemary was burned the same way in sickrooms across Europe. The smoke carries the heaviness; the open window is where it goes.' },
  { img: 'pc-12', bg: '', kicker: 'The cleanser', h: 'Salted water', body: 'The other cleansing stream is the wash. Dissolve a pinch of salt in a bowl of water and wipe it along the sills and door frames, or sprinkle it into the corners — the Hoodoo floor wash and the church\'s holy water are the same gesture in two vocabularies. Work from the back of the house toward the front door, and pour what is left outside.' },
  { img: 'pc-08', bg: '#fefaf3', kicker: 'The practice', h: 'A house cleanse', body: 'A cleanse is for a change you can feel: after an argument that hung in the room, after someone difficult has gone, the first night in a new place. Say what it is for. Then open the windows first, so the heaviness has a way out. Sweep toward the door. Carry smoke into the corners — corners hold the most. Wipe the sills with salted water. Close up, light one candle, and say aloud that it is done — the old house charms all end with the <b>words spoken out loud</b>.' },
  { img: 'pc-09', bg: '#fefbf7', kicker: 'On your person', h: 'Little armor', body: 'Protection travels. A pinch of salt and a sprig of rosemary in a small cloth bag in your pocket; an old key worn on a cord; the blue glass <b>nazar</b> eye that has hung in Mediterranean doorways for three thousand years; a cross of rowan twigs tied with red thread, the Highland charm for a byre door. Small, quiet and yours.' },
  { img: 'pc-10', bg: '#fefbf5', kicker: 'After', h: 'Tonight', body: 'Pick one: a bowl of salt by the door, or windows open and a sweep toward the threshold. Say what it is for before you begin. That is your first ward — the witch bottle is the next rung, and the Altar lesson shows where a house\'s guards live once you have more than one. ✦' },
];
```

## Sources checked (not for the cards — for the record)

- Greenwich witch bottle, 2004, and Blagrave's 1671 recipe: Historic England,
  "The Mysterious Case of the Witch Bottle"; Archaeology Magazine, "Opening a
  Witch Bottle".
- Knole's 1606 marks and the daisy wheel: National Trust, "Witchmarks at
  Knole"; Archaeology Magazine, Nov 2014.
- Highland saining with juniper: F. Marian McNeill, *The Silver Bough* vol. 3,
  via the Wikipedia "Saining" entry.
- Aubrey on horseshoes: *Remaines of Gentilisme and Judaisme* (1686–87).
