// "The meteorite" — watercolor prompts (Playground ChatGPT style), v2 Aug 2026.
// v1 was staged too close to the pastel short and drew the ex-boyfriend wrong;
// Sophie asked for a full rewrite (Aug 2026): the watercolor reference has a
// totally different feeling, so these are re-imagined as diary-drawing moments
// — intimate framing, real rooms, humor from body language — not the pastel
// cartoon re-worded. Same 12 beats and beat ORDER as beats.js (the narration
// supercut is already cut to those spans, so the art lines up with the
// existing audio); the spans themselves live in beats.js only.
//
// The ex-boyfriend, per Sophie: BLONDE hair, ROUND GLASSES, average build
// ("not skinny... just normal"), smug — but he also gets scared. The pale
// blue button-up + dark trousers are Claude's continuity pick (she gave no
// wardrobe) — flagged to her, swap on request.
//
// Style rules (docs/evan-film-style.md — do not re-derive):
// - Prompts are PURE CONTENT. No watercolor/ink/palette words — the attached
//   style ref (refs/evan-film-style.png) carries the entire look; written
//   style blocks were tested and rejected.
// - Run in the Playground, ChatGPT style, quality medium, 2:3 (1024x1536).
// - "Sophie" in a prompt + the Sophie character toggle ON draws her from
//   refs/sophie-character.png.
// - The ex-boyfriend has NO card yet, so his look rides as the same written
//   description (BOY) in every prompt he appears in. Once Sophie hearts a
//   reference render, bank it (like refs/evan-character.png) and later
//   renders can attach it instead.
// - `dream` = an optional second panel per Sophie's literal→metaphorical pair
//   formula (docs/movies/sophies-movie-pipeline.md): same people, same moment,
//   only the world transformed; the animation goes BETWEEN panel A and B.
// - Motion notes are SCENE-DRIVEN (the README rule) — no house motion default.

module.exports.BOY =
  'a young man with short blonde hair, round glasses and an average build, ' +
  'in a pale blue button-up shirt';

module.exports.CHARACTER_REFS = {
  sophie: {
    label: 'Sophie — character reference (Sophie toggle ON)',
    prompt:
      'Sophie stands facing the viewer on a plain pale background, full body ' +
      'from head to toe, hands loose at her sides, with a small knowing ' +
      'smile — a clean simple character study with nothing else in the scene.',
  },
  boy: {
    label: 'The boy — character reference (Sophie toggle OFF)',
    prompt:
      'A character study of a young man in his late twenties standing on a ' +
      'plain pale background, full body from head to toe, facing the viewer: ' +
      'short blonde hair, round glasses, an average build — not skinny — ' +
      'wearing a pale blue button-up shirt and dark trousers, hands in his ' +
      'pockets, with a slightly smug expression. Nothing else in the scene.',
    scaredPrompt:
      'A character study of the same young man — short blonde hair, round ' +
      'glasses, an average build, pale blue button-up shirt and dark ' +
      'trousers — standing on a plain pale background, shoulders raised, ' +
      'hands half lifted, eyes wide behind his glasses, scared. Nothing ' +
      'else in the scene.',
  },
};

module.exports.BEATS = [
  {
    label: 'Meteorite 1 — the confession (I think I cursed my ex)',
    content:
      'Sophie sits on the floor at the foot of her bed late at night, ' +
      'hugging a pillow to her chest, looking straight out at the viewer ' +
      'with a guilty, worried face like she is about to admit something; ' +
      'the room is dark around her except one small warm lamp.',
    motion:
      'She glances over her shoulder like someone might hear, then leans in ' +
      'closer to the viewer and squeezes the pillow tighter.',
  },
  {
    label: 'Meteorite 2 — the $10,000 meteorite in its case',
    content:
      'A close view of Sophie\'s two hands holding a small clear display ' +
      'case out toward the viewer, a dark grey lumpy meteorite inside with ' +
      'tiny bright metallic flecks; Sophie\'s face is just above the case, ' +
      'eyebrows raised, daring the viewer not to believe her.',
    motion:
      'She tilts the case slowly left and right so the metal flecks catch ' +
      'the light, then lifts it a little closer to the viewer.',
    dream: {
      content:
        'The same dark grey lumpy meteorite falling through deep black ' +
        'space toward a tiny far-away Earth, a long thin streak of light ' +
        'behind it, its metallic flecks glowing.',
      animate:
        'A→B: her hands and the room fade and the case\'s glass disappears ' +
        'until the rock is falling alone through space.',
    },
  },
  {
    label: 'Meteorite 3 — the witchcraft business (retired voodoo dolls)',
    content:
      'Sophie sits at a cluttered work table packing witchcraft-shop orders ' +
      '— wrapping a crystal in paper, small shipping boxes and stacks of ' +
      'tarot cards around her — while at her feet an open cardboard box ' +
      'stuffed with little stitched voodoo dolls waits to be taped shut and ' +
      'put away.',
    motion:
      'She keeps wrapping, and without looking at it nudges the box of ' +
      'voodoo dolls further under the table with her foot.',
  },
  {
    label: 'Meteorite 4 — pins into his stomach, from bed',
    content:
      'Seen from directly above, Sophie lies in bed at night with the ' +
      'blanket pulled up to her chin and her eyes wide open, and the ' +
      'darkness around the bed is full of long sewing pins drifting slowly ' +
      'toward a faint pale silhouette of a man at the edge of the dark.',
    motion:
      'The pins drift inward a little at a time while her eyes stay fixed ' +
      'open, unblinking.',
    dream: {
      content:
        'The vision fills the whole frame: a pale silhouette of a man ' +
        'floating in darkness while long sewing pins slide slowly into his ' +
        'stomach from every side; far below, at the bottom edge of the ' +
        'dark, one small bed with Sophie in it.',
      animate:
        'A→B: the bedroom darkness swallows the frame until only the ' +
        'vision is left.',
    },
  },
  {
    label: 'Meteorite 5 — the vow: if this is real, I want to know',
    content:
      'Sophie sits up in bed in the middle of the night, blanket pooled ' +
      'around her waist, one hand pressed flat over her chest, chin lifted, ' +
      'speaking up into the dark ceiling like she is addressing someone who ' +
      'might be listening.',
    motion:
      'A slow push-in on her face as her chin lifts and her jaw sets; the ' +
      'dark above her seems to lean down and listen.',
  },
  {
    label: 'Meteorite 6 — he shows up with stomach pain',
    content:
      'Sophie\'s ex-boyfriend — a young man with short blonde hair, round ' +
      'glasses and an average build, in a pale blue button-up shirt — ' +
      'stands on her doorstep bent forward with both arms wrapped around ' +
      'his stomach, his glasses slipping down his nose, his smugness gone ' +
      'grey and scared; Sophie leans on the doorframe with her arms ' +
      'crossed, looking at him sideways.',
    motion:
      'He winces through a wave of pain and grips his stomach tighter, his ' +
      'glasses sliding further down; she just slowly tilts her head.',
  },
  {
    label: "Meteorite 7 — the skeptic (none of that's real, babe)",
    content:
      'Sophie\'s ex-boyfriend — a young man with short blonde hair, round ' +
      'glasses and an average build, in a pale blue button-up shirt — leans ' +
      'back on a couch with one finger raised like a professor, mid-lecture ' +
      'and smug, while Sophie sits at the other end of the couch with her ' +
      'tarot cards spread on the cushion beside her, glaring at him.',
    motion:
      'He rocks back further, very pleased with himself; her eyes narrow ' +
      'and one tarot card flicks between her fingers.',
  },
  {
    label: 'Meteorite 8 — the meteorite instead of escrow',
    content:
      'At Sophie\'s kitchen table, her ex-boyfriend — a young man with ' +
      'short blonde hair, round glasses and an average build, in a pale ' +
      'blue button-up shirt — slides the meteorite in its clear case across ' +
      'the table toward her while avoiding her eyes; Sophie sits with her ' +
      'chin in her hand, unmoved, not touching it.',
    motion:
      'The case slides to a stop in front of her; he glances up hopefully; ' +
      'she does not move, chin still in her hand.',
  },
  {
    label: 'Meteorite 9 — the rat under the table (he was lying)',
    content:
      'Sophie and her ex-boyfriend — a young man with short blonde hair, ' +
      'round glasses and an average build, in a pale blue button-up shirt — ' +
      'sit at a small restaurant table at night; in the shadow under the ' +
      'table a little grey rat has stopped between their feet and is ' +
      'looking straight up at him; above the table he is sweating and ' +
      'looking away from Sophie\'s stare.',
    motion:
      'The rat\'s whiskers twitch; a bead of sweat rolls down his temple; ' +
      'Sophie leans in an inch, unblinking.',
  },
  {
    label: 'Meteorite 10 — the mobius strip ritual',
    content:
      'Sophie and three friends sit close in a circle on a rug at night, ' +
      'their faces lit from below by candles, each holding a twisted white ' +
      'paper loop; in the middle of the circle the meteorite sits on a ' +
      'folded cloth, out of its case; the room around them is dark.',
    motion:
      'The candle flames stretch tall together, shadows climb the walls, ' +
      'and each paper loop turns slowly in their fingers.',
  },
  {
    label: 'Meteorite 11 — the gibberish blessing song',
    content:
      'Sophie kneels on her bed at night, singing with her eyes closed and ' +
      'one hand resting on the shoulder of her ex-boyfriend — a young man ' +
      'with short blonde hair and an average build, his round glasses set ' +
      'on the nightstand — who lies curled on his side in his pale blue ' +
      'button-up shirt, crying into the pillow.',
    motion:
      'Her head sways gently with the song; his shoulders shake harder; ' +
      'one tear runs into the pillow.',
    dream: {
      content:
        'The same bed drifting in a huge open night sky full of stars, ' +
        'Sophie still kneeling and singing with her eyes closed, her hand ' +
        'still on the shoulder of her ex-boyfriend — a young man with ' +
        'short blonde hair and an average build, in a pale blue button-up ' +
        'shirt, his round glasses beside him — while a soft pale ribbon ' +
        'unwinds from her mouth up into the stars.',
      animate:
        'A→B: the bedroom walls thin away and stars come out around the ' +
        'bed while nothing about the two of them changes.',
    },
  },
  {
    label: 'Meteorite 12 — "what did it mean?"',
    content:
      'Sophie\'s ex-boyfriend — a young man with short blonde hair and an ' +
      'average build, in a pale blue button-up shirt, holding his round ' +
      'glasses in one hand, his eyes puffy from crying — has rolled over ' +
      'in bed at night to face Sophie and is asking her something ' +
      'desperately; Sophie looks back at him and shrugs, with a tiny smile.',
    motion:
      'He blinks at her, waiting; she holds the shrug a long beat, and her ' +
      'tiny smile widens just a little.',
  },
];
