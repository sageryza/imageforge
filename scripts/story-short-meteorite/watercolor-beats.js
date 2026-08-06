// "The meteorite" — watercolor prompts (Playground ChatGPT style), Aug 2026.
// Sophie's ask: image prompts for the meteorite story she narrated, to be made
// in the ChatGPT watercolor style and eventually animated. Same 12 beats and
// beat ORDER as beats.js (the narration supercut is already cut to those spans,
// so this art lines up with the existing audio); the spans themselves live in
// beats.js only — this file is the PROMPTS.
//
// Style rules (docs/evan-film-style.md — do not re-derive):
// - Prompts are PURE CONTENT. No watercolor/ink/palette words — the attached
//   style ref (refs/evan-film-style.png) carries the entire look; written
//   style blocks were tested and rejected.
// - Run in the Playground, ChatGPT style, quality medium, 2:3 (1024x1536).
// - "Sophie" in a prompt + the Sophie character toggle ON draws her from
//   refs/sophie-character.png.
// - The ex-boyfriend has NO card yet, so his look rides as the same written
//   description (BOY) in every prompt he appears in — the movies pipeline's
//   character-continuity-tokens technique. Once Sophie hearts a reference
//   render, bank it (like refs/evan-character.png) and later renders can
//   attach it instead.
// - `dream` = an optional second panel per Sophie's literal→metaphorical pair
//   formula (docs/movies/sophies-movie-pipeline.md): same people, same moment,
//   only the world transformed; the animation goes BETWEEN panel A and B.
// - Motion notes are SCENE-DRIVEN (the README rule) — no house motion default.

module.exports.BOY =
  'a tall young man with short dark brown hair in a grey crewneck sweatshirt';

module.exports.CHARACTER_REFS = {
  sophie: {
    label: 'Sophie — character reference (Sophie toggle ON)',
    prompt:
      'Sophie stands facing the viewer on a plain pale background, full body ' +
      'from head to toe, relaxed, hands at her sides, with a small smile — a ' +
      'clean simple character portrait with nothing else in the scene.',
  },
  boy: {
    label: 'The boy — character reference (Sophie toggle OFF)',
    prompt:
      'A character portrait of a tall young man in his late twenties with ' +
      'short dark brown hair, standing on a plain pale background, full body ' +
      'from head to toe, facing the viewer. He wears a grey crewneck ' +
      'sweatshirt, dark jeans and white sneakers, hands in his pockets, chin ' +
      'slightly up, with a confident, slightly smug expression. Nothing else ' +
      'in the scene.',
  },
};

module.exports.BEATS = [
  {
    label: 'Meteorite 1 — the confession (I think I cursed my ex)',
    content:
      'Sophie sits cross-legged on her bed at night staring straight at the ' +
      'viewer with wide worried eyes, both hands pressed to her cheeks, like ' +
      'she is confessing to a camera; a few small stars and a tiny crescent ' +
      'moon wobble in the air around her head.',
    motion:
      'Nervous confession energy: she leans in toward the viewer, eyes ' +
      'darting quickly side to side, pressing her hands harder into her ' +
      'cheeks while the stars around her head jitter and tremble.',
  },
  {
    label: 'Meteorite 2 — the $10,000 meteorite in its case',
    content:
      'Sophie holds up a small clear display case with a dark grey lumpy ' +
      'meteorite inside, speckled with tiny glinting metallic flecks, ' +
      'presenting it to the viewer with both hands and raised eyebrows like ' +
      'it is proof; a few small sparkles float around the case.',
    motion:
      'A slow dramatic camera push-in toward the display case as she raises ' +
      'it higher, the metallic flecks flaring one by one like a jewel under ' +
      'lights.',
    dream: {
      content:
        'The same small dark grey lumpy meteorite, huge in the frame, ' +
        'tumbling alone through deep dark space with tiny stars all around ' +
        'and a thin bright streak of light trailing behind it.',
      animate:
        'A→B: the display case and Sophie\'s hands dissolve away as the ' +
        'camera closes on the rock until it is falling through space.',
    },
  },
  {
    label: 'Meteorite 3 — the witchcraft business (retired voodoo dolls)',
    content:
      'Sophie stands proudly behind a small market stall of witchy goods — ' +
      'potion bottles, a crystal ball, a stack of tarot cards — while on a ' +
      'shelf behind her a row of small stitched voodoo dolls sits with one ' +
      'tipped over into a wastebasket.',
    motion:
      'Busy shopkeeper pride: she sweeps one arm across the stall presenting ' +
      'her goods, the tarot cards fan out and flutter, and the tipped voodoo ' +
      'doll drops the rest of the way into the wastebasket.',
  },
  {
    label: 'Meteorite 4 — pins into his stomach, from bed',
    content:
      'Sophie lies in bed at night under a pale quilt with her eyes open, ' +
      'and above her floats one large round thought bubble showing the ' +
      'simple dark silhouette of a man with long sewing pins angled toward ' +
      'his stomach.',
    motion:
      'Menace building: the thought bubble swells larger and looms over the ' +
      'bed as the pins drive into the silhouette one after another, and her ' +
      'hands slowly clench the quilt.',
    dream: {
      content:
        'Inside the vision: a vast dark empty space where a huge simple ' +
        'silhouette of a man floats with long sewing pins driving toward his ' +
        'stomach from every direction, while far below in one corner of the ' +
        'darkness tiny Sophie lies in her small bed, watching.',
      animate:
        'A→B: the camera rises into the thought bubble until its inside ' +
        'becomes the whole frame and the bedroom is gone.',
    },
  },
  {
    label: 'Meteorite 5 — the vow: if this is real, I want to know',
    content:
      'Sophie sits up cross-legged on her bed at night with one hand raised ' +
      'like she is swearing a solemn oath, her face serious, a ring of small ' +
      'stars circling her raised hand.',
    motion:
      'A vow being sealed: the ring of stars snaps into a fast spin around ' +
      'her raised hand, flares bright, then locks still all at once as her ' +
      'jaw sets with resolve.',
  },
  {
    label: 'Meteorite 6 — he shows up with stomach pain',
    content:
      'Sophie holds her front door open with one eyebrow raised while her ' +
      'ex-boyfriend — a tall young man with short dark brown hair in a grey ' +
      'crewneck sweatshirt — stands hunched in the doorway clutching his ' +
      'stomach, his face miserable.',
    motion:
      'A wave of pain hits him: he doubles over clutching his stomach and ' +
      'staggers a half step against the doorframe, while she coolly raises ' +
      'her eyebrow and holds the door.',
  },
  {
    label: "Meteorite 7 — the skeptic (none of that's real, babe)",
    content:
      'Sophie\'s ex-boyfriend — a tall young man with short dark brown hair ' +
      'in a grey crewneck sweatshirt — stands with his arms crossed and chin ' +
      'up, dismissive, surrounded by floating doodles of an atom, a beaker ' +
      'and a magnet, while on the other side of the scene a small witch hat ' +
      'and a crystal ball float near Sophie, who watches him flatly.',
    motion:
      'Dismissive lecture energy: he swats the witch hat out of the air with ' +
      'the back of his hand so it tumbles, the science doodles wobbling ' +
      'smugly on their orbits around him.',
  },
  {
    label: 'Meteorite 8 — the meteorite instead of escrow',
    content:
      'At a small table, Sophie\'s ex-boyfriend — a tall young man with ' +
      'short dark brown hair in a grey crewneck sweatshirt — pushes the ' +
      'meteorite in its clear display case across the table toward Sophie ' +
      'with both hands; a small tied money bag sits ignored at the edge of ' +
      'the table; Sophie stands with her arms crossed, unimpressed.',
    motion:
      'The bargain: he shoves the case across the table so it slides and ' +
      'stops right in front of her, sparkles scattering off it — and she ' +
      'does not move at all, arms crossed.',
  },
  {
    label: 'Meteorite 9 — the rat under the table (he was lying)',
    content:
      'Sophie and her ex-boyfriend — a tall young man with short dark brown ' +
      'hair in a grey crewneck sweatshirt — sit across from each other at a ' +
      'small restaurant table at night; under the table a little grey rat ' +
      'looks up knowingly; he looks away sweating while Sophie leans in, ' +
      'staring at him.',
    motion:
      'Comic reveal timing: the rat pops up taller and its whiskers twitch ' +
      'rapidly, a fat sweat drop falls off his face as he looks away, and ' +
      'she leans in sharply, unblinking.',
  },
  {
    label: 'Meteorite 10 — the mobius strip ritual',
    content:
      'Four friends sit in a circle on a living room rug at night with lit ' +
      'candles, each holding up a twisted white paper loop; Sophie sits ' +
      'among them, and in the center of the circle the meteorite sits in its ' +
      'clear case, glowing faintly.',
    motion:
      'Ceremony rising: all the candle flames leap tall at the same moment, ' +
      'the friends turn their paper loops in unison, and the glow around the ' +
      'meteorite surges outward in a slow ring.',
  },
  {
    label: 'Meteorite 11 — the gibberish blessing song',
    content:
      'Sophie sits on her bed at night singing with her eyes closed, ' +
      'colorful music notes floating up from her mouth, while her ' +
      'ex-boyfriend — a tall young man with short dark brown hair in a grey ' +
      'crewneck sweatshirt — lies curled up beside her crying big tears into ' +
      'a pillow.',
    motion:
      'Emotional swell: the music notes pour out faster and rise in a ' +
      'widening spiral, his shoulders heave with sobs, and one big tear ' +
      'splashes onto the pillow.',
    dream: {
      content:
        'The same bed now floating in open night sky among stars, Sophie ' +
        'still singing with her eyes closed, the colorful music notes ' +
        'spiraling up and becoming constellations, her ex-boyfriend — a ' +
        'tall young man with short dark brown hair in a grey crewneck ' +
        'sweatshirt — still curled up beside her, crying.',
      animate:
        'A→B: the bedroom walls drift away and stars fade in around the bed ' +
        'while the song keeps going — same people, same moment, only the ' +
        'world changed.',
    },
  },
  {
    label: 'Meteorite 12 — "what did it mean?"',
    content:
      'Sophie\'s ex-boyfriend — a tall young man with short dark brown hair ' +
      'in a grey crewneck sweatshirt — lies in bed rolled over to face ' +
      'Sophie with puffy eyes and a baffled expression; above Sophie floats ' +
      'a small thought bubble containing only colorful meaningless squiggles ' +
      'as she shrugs with a tiny smile.',
    motion:
      'Deadpan punchline: everything holds perfectly still for a beat — then ' +
      'only the squiggles in the thought bubble scramble wildly while he ' +
      'blinks, and she gives one small shrug.',
  },
];
