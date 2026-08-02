// "The meteorite" (Story Room project songs-aug-2) — the beat script.
// Sophie's 17-minute voice memo is a ramble with restarts and tangents; these
// SPANS are the exact words kept, verbatim from her recording (the precise
// cutter locates each span in the real audio and cuts only those words).
// A beat = one pastel panel + its spans joined with a short breath of silence.
module.exports.PROJECT = 'songs-aug-2';
module.exports.CHAT = 'meteorite-story-room';
module.exports.OUT = process.env.METEORITE_OUT || '/tmp/claude-0/-home-user/4654c26e-d883-5858-92ae-555fda127217/scratchpad/meteorite';
module.exports.VO_URL = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/story/vo-songs-aug-2-1785632953139-2ggnv6.m4a';

module.exports.BEATS = [
  {
    label: 'Meteorite 1 — the confession (I think I cursed my ex)',
    spans: [
      "Guys, I think I, like, cursed my ex-boyfriend, um, and I'm actually really scared",
    ],
    content: 'The woman stares straight at the viewer with wide, worried eyes, both hands pressed to her cheeks, while small lilac stars and a tiny crescent moon wobble in the air around her head.',
    motion: 'The small stars and the crescent moon wobble and drift gently around her head while she blinks, her worried eyes glancing left and right.',
  },
  {
    label: 'Meteorite 2 — the $10,000 meteorite in its case',
    spans: [
      "I have this meteorite, it's right here, okay, and he gave it to me after I cursed him",
      "so this is a $10,000 meteorite, I know that sounds weird and, like, a scam, but, like, he was really rich, um, he was a, like, trust fund baby",
    ],
    content: 'The woman holds up a small clear display case with a dark grey lumpy meteorite inside, speckled with tiny glinting flecks, presenting it to the viewer with both hands; small pastel sparkles float around the case.',
    motion: 'The pastel sparkles drift slowly around the case, the glinting flecks on the meteorite twinkle, and she tilts the case slightly as she presents it.',
  },
  {
    label: 'Meteorite 3 — the witchcraft business (retired voodoo dolls)',
    spans: [
      "I've never done a spell before, but I am a witch, like, I have a witchcraft business",
      "that's literally my main source of income",
      "I actually used to sell voodoo dolls, but I stopped because I, like, was getting all this bad energy",
    ],
    content: 'The woman stands proudly behind a little market stall of witchy goods with potion bottles, a crystal ball and a stack of tarot cards, while behind her a shelf holds a row of small stitched voodoo dolls, one tipped over into a wastebasket.',
    motion: 'Soft candle-like light flickers over the stall, the tarot cards ruffle slightly, and the tipped voodoo doll rocks gently in the wastebasket while she smiles.',
  },
  {
    label: 'Meteorite 4 — pins into his stomach, from bed',
    spans: [
      "I had been in my bed and I had been thinking, like, how much I hated him, and, like, I just kept getting this image of, like, him with, like, pins, like, going into his stomach",
    ],
    content: 'The woman lies in bed at night under a pale quilt with her eyes open, and above her floats one large round thought bubble showing a simple silhouette of a man with long sewing pins angled toward his stomach.',
    motion: 'The thought bubble bobs gently above her, the pins inside it slide slowly closer to the silhouette, and her eyes widen slightly.',
  },
  {
    label: 'Meteorite 5 — the vow: if this is real, I want to know',
    spans: [
      "I didn't just, like, wish that he would, like, have pain, I, like, specifically was, like, I don't believe this is real, so, like, if this is real, then I want to, like, know about it",
    ],
    content: 'The woman sits up cross-legged on her bed at night, one hand raised like she is making a solemn vow, a ring of small stars circling her raised hand, her face serious.',
    motion: 'The ring of small stars rotates slowly around her raised hand, each star twinkling in turn, while she breathes calmly and steadily.',
  },
  {
    label: 'Meteorite 6 — he shows up with stomach pain',
    spans: [
      "he showed up at my house two days later",
      "the first thing he said was, like, I'm in pain, like, I have stomach pain, like, I have it every single day",
      "and he thought it was, like, guilt",
    ],
    content: 'A tall young man with short dark brown hair in a grey crewneck sweatshirt stands hunched in a doorway clutching his stomach, his face miserable; the woman holds the door open and looks at him with one eyebrow raised.',
    motion: 'The man sways slightly while clutching his stomach and wincing, and the woman slowly raises her eyebrow further as the door drifts a little wider open.',
  },
  {
    label: "Meteorite 7 — the skeptic (none of that's real, babe)",
    spans: [
      "he did not believe in, like, God, or, like, spirituality, and, like, certainly didn't believe in witchcraft",
      "he was, like, really, like, science-y, and, like, he was, like, no, babe, none of that's real",
    ],
    content: 'The man stands with his arms crossed and chin up, dismissive, surrounded by floating doodles of an atom, a beaker and a magnet, while a small witch hat and a crystal ball float near the woman on the other side of the scene, being waved away.',
    motion: 'The atom, beaker and magnet doodles orbit slowly around the man while he waves one hand dismissively, and the witch hat and crystal ball bob away toward the woman.',
  },
  {
    label: 'Meteorite 8 — the meteorite instead of escrow',
    spans: [
      "I'll forgive you, but you just need to go tell your brother that you were lying about me",
      "let's put, like, $5,000 in escrow, because, like, I have $5,000, he has $5,000, that's fine",
      "but he's, like, no, that's so embarrassing, like, instead I'm going to give you this meteorite",
    ],
    content: 'At a small table, the man pushes the meteorite in its clear case across toward the woman with both hands; a small tied money bag sits ignored at the edge of the table; the woman stands with her arms crossed, unimpressed.',
    motion: 'The man slides the meteorite case slowly across the table toward her, the sparkles around it drifting, while she taps her fingers on her crossed arms.',
  },
  {
    label: 'Meteorite 9 — the rat under the table (he was lying)',
    spans: [
      "there was, like, a rat under the table, and I was, like, oh my god, like, is he lying, and, like, he was fucking lying, yeah, of course he was",
      "so he's, like, okay, I didn't actually do it, and then that's when he started, like, crying",
    ],
    content: 'The woman and the man sit across from each other at a small restaurant table at night; under the table a little grey rat looks up knowingly; the man looks away sweating while the woman leans in, staring at him.',
    motion: 'The little rat sniffs and looks up, a single sweat drop slides down the man\'s face as he looks away, and the woman leans in slowly without blinking.',
  },
  {
    label: 'Meteorite 10 — the mobius strip ritual',
    spans: [
      "so then all my friends came over, and we did, like, a ritual",
      "and we made, like, mobius strips",
      "this was my friend Mason's idea, because he, like, loves rituals",
    ],
    content: 'Four friends sit in a circle on a living room rug at night with lit candles, each holding up a twisted white paper loop, and in the center of the circle the meteorite sits in its clear case, glowing faintly.',
    motion: 'The candle flames flicker softly, the twisted paper loops sway gently in the friends\' hands, and the faint glow around the meteorite pulses brighter and dimmer.',
  },
  {
    label: 'Meteorite 11 — the gibberish blessing song',
    spans: [
      "I need to, like, imbue him with empathy",
      "I started singing him this song that I made up",
      "and then he, like, started bawling",
    ],
    content: 'The woman sits on her bed at night singing with her eyes closed, colorful pastel music notes floating up from her mouth, while the man lies curled up beside her crying big cartoon tears into a pillow.',
    motion: 'The pastel music notes float steadily up from her mouth and drift apart, while the man\'s shoulders shake with soft sobs and big tears roll down.',
  },
  {
    label: 'Meteorite 12 — "what did it mean?"',
    spans: [
      "he, like, rolled over, and he's, like, what did it mean? And I was, like, it was gibberish",
    ],
    content: 'The man lies in bed rolled over to face the woman with puffy eyes and a baffled expression; above the woman floats a small thought bubble containing only colorful meaningless squiggles, and she shrugs with a tiny smile.',
    motion: 'The squiggles inside the thought bubble slowly writhe and rearrange themselves, he blinks with puffy eyes, and she gives a small shrug and a tiny smile.',
  },
];
