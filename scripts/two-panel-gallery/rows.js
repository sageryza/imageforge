/* Two-panel animation gallery — the curated row list.
 *
 * `move` is MEASURED, not remembered: every clip was decoded to 4fps
 * greyscale and scored on the mean absolute pixel difference between its
 * FIRST and LAST frame — "how far the picture travelled". Same scale for
 * every row, so the numbers are comparable across the four projects.
 * The measuring script is `motion.js` next to this file.
 *
 * `motion` is the prompt sent to wan, VERBATIM or null. Null means the run
 * happened in a session scratchpad that was wiped and the exact text is gone
 * — the house rule is to file nothing rather than reconstruct it, so the row
 * says so instead of guessing.
 */
// The Darius clips were never saved on their own — these are cut back out of
// the two stitched films (measured 768x1152, i.e. the 480p pass upscaled), so
// each one slows toward the end and holds, the way the film plays it.
const DAR_CHIPS = ['gpt-image-2 · medium', 'wan 480p draft', 'cut back out of the film'];
const EXILE_CHIPS = ['gpt-image-2 · medium', 'wan 480p draft', 'motion prompt on file'];

const STILL = {
  caughtHigh: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/hospital-film/pairs/pair-caught-high.png',
  caughtMed: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/hospital-film/pairs/pair-caught.png',
  candy: 'https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786075740419-o3jl6f.png',
  wilt: 'https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786075740419-hwh93m.png',
  flowers: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/hospital-film/pairs/pair-flowers.png',
  detector: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/hospital-film/pairs/pair-detector.png',
  metStart1: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/story-shorts/songs-aug-2/panel-1.webp',
  metEnd1: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/story-shorts/songs-aug-2/pair-1-end.webp',
  metStart7: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/story-shorts/songs-aug-2/panel-7.webp',
  metEnd7: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/story-shorts/songs-aug-2/pair-7-end.webp',
};

// The hospital pair pages all went through the same wrapper; kept once.
const HOSP_STYLE = 'gpt-image-2 EDITS, 1536x1024. Attached: refs/sage-sandy-mirror.png '
  + '(then still named refs/evan-film-style.png) + hospital-film/gB-med.png. Sent verbatim as:\n\n'
  + 'Use only the style of the attached style reference and ignore its content — do not copy '
  + 'anything depicted in it. You can choose your own colors rather than copying the colors of '
  + 'the style reference. Use the second attached image as a character reference. Whenever the '
  + 'prompt mentions the girl, draw her as that girl.\n\n[content]\n\nDo not include any text in the image.';

const MET_STYLE = 'gpt-image-2 EDITS, 1024x1536, quality medium. Attached: the START panel FIRST, '
  + 'then witch-school/refs/sophie-snake.png + sophie-animals.png as style refs. Sent verbatim as:\n\n'
  + 'The FIRST attached image is the exact scene to continue — keep the SAME characters, faces, '
  + 'outfits, setting, composition, linework and flat pastel palette. The other attached images '
  + 'are style references only. Draw the SAME scene a moment LATER: [content] Vertical 2:3 '
  + 'portrait composition. Absolutely no text, no words, no letters, no numbers, no captions.';

module.exports.PAIRS = [
  {
    id: 'caught',
    media: 'hosp-pair-caught-high',
    still: STILL.caughtHigh,
    stillLabel: 'two panels',
    clipLabel: 'the clip',
    title: 'Caught — out of push-up position and into bed',
    move: 48.41,
    chips: ['gpt-image-2 · high', 'wan 720p', '~25¢ + ~16¢'],
    her: '"the thing where I get up and go into my bed, that\'s something that actually happened"',
    quality: 'high',
    style: HOSP_STYLE,
    content: 'A comic page of exactly two rectangular panels side by side, each panel fully enclosed by a hand-drawn black ink rectangle border, with a clean white gutter between them. Both panels show the same dark hospital room at night from the same camera position: a bed on the right, moonlight through the window, a door on the left. Left panel: the girl holds a frozen push-up position in the middle of the floor, the door closed. Right panel: the same room seconds later — the girl is in the bed with the covers pulled up to her chin, eyes wide open, and the silhouette of a Black nurse in dark teal scrubs stands in the now-open doorway.',
    motion: null,
    alsoPlay: [
      { media: 'hosp-pair-caught-720', label: '720p, medium page', move: 43.33 },
      { media: 'hosp-pair-caught', label: '480p draft', move: 42.90 },
    ],
  },
  {
    id: 'candy',
    media: 'hosp-pair-candy-720',
    still: STILL.candy,
    stillLabel: 'two panels',
    clipLabel: 'the clip',
    title: 'The bad dream combusts into candy',
    move: 116.77,
    chips: ['gpt-image-2 · medium', 'wan 720p', '~6¢ + ~16¢'],
    her: 'The biggest picture-change in the whole archive — nearly 2× the next one.',
    quality: 'medium',
    style: HOSP_STYLE,
    content: 'A comic page of exactly two rectangular panels side by side, each panel fully enclosed by a hand-drawn black ink rectangle border, with a clean white gutter between them. Both panels show the same scene from the same camera position: the girl small in the corner of a hospital dayroom. Left panel: an enormous dark storm cloud fills the room above her, pressing down, the girl shrinking beneath it. Right panel: the same scene an instant later — the cloud has exploded into hundreds of falling pastel candy squares raining down around the astonished girl, the darkness gone.',
    motion: null,
    alsoPlay: [{ media: 'hosp-pair-candy', label: '480p draft', move: 119.06 }],
  },
  {
    id: 'wilt',
    media: 'hosp-pair-wilt-720',
    still: STILL.wilt,
    stillLabel: 'two panels',
    clipLabel: 'the clip',
    title: 'The room wilts',
    move: 58.36,
    chips: ['gpt-image-2 · medium', 'wan 720p', '~6¢ + ~16¢'],
    her: 'Nothing but the room changes — no body moves at all, and it still reads as motion.',
    quality: 'medium',
    style: HOSP_STYLE,
    content: 'A comic page of exactly two rectangular panels side by side, each panel fully enclosed by a hand-drawn black ink rectangle border, with a clean white gutter between them. Both panels show the same hospital room from the same camera position: one bare low wooden bed, a window, a door. Left panel: the room is ordinary and rigid, everything straight and clinical. Right panel: the same room has wilted like a dying flower — the walls sag and droop inward, the doorframe slumps, curls of paint peel like petals, the bed bows in the middle.',
    motion: null,
    alsoPlay: [{ media: 'hosp-pair-wilt', label: '480p draft', move: 52.07 }],
  },
  {
    id: 'flowers',
    media: 'hosp-pair-flowers-720',
    still: STILL.flowers,
    stillLabel: 'two panels',
    clipLabel: 'the clip',
    title: 'Flowers bloom out of her head',
    move: 51.72,
    chips: ['gpt-image-2 · medium', 'wan 720p', '~6¢ + ~16¢'],
    her: 'Moves beautifully — and it is the one you later ruled out as a thought, not an event.',
    quality: 'medium',
    style: HOSP_STYLE,
    content: 'A comic page of exactly two rectangular panels side by side, each panel fully enclosed by a hand-drawn black ink rectangle border, with a clean white gutter between them. Both panels show the same scene from the same camera position: the girl from the shoulders up under a warm shower, steam around her. Left panel: her eyes are closed, water running down, everything quiet. Right panel: the same scene a moment later — huge red and pink flowers are blooming explosively out of the top of her head, petals unfurling upward through the falling water and steam.',
    motion: null,
    alsoPlay: [{ media: 'hosp-pair-flowers', label: '480p draft', move: 46.27 }],
  },
  {
    id: 'met1',
    media: 'met-pair-1',
    still: STILL.metStart1,
    end: STILL.metEnd1,
    title: 'The meteorite, raised',
    move: 31.03,
    chips: ['gpt-image-2 · medium', 'wan 720p, 121 frames', 'never judged'],
    her: 'Five days before the hospital round — the same mechanism, and you never saw the result.',
    quality: 'medium',
    style: MET_STYLE,
    content: 'the woman now holds the display case raised high toward the viewer at the top of her lift, arms extended, the glinting flecks and pastel sparkles flared bigger and brighter around the case.',
    startContent: 'The woman holds up a small clear display case with a dark grey lumpy meteorite inside, speckled with tiny glinting flecks, presenting it to the viewer with both hands; small pastel sparkles float around the case.',
    motion: 'She lifts the display case higher toward the viewer in one smooth continuous motion, the sparkles flaring brighter as it rises. Flat pastel illustration style with bold black ink outlines on a white background.',
  },
  {
    id: 'met7',
    media: 'met-pair-7',
    still: STILL.metStart7,
    end: STILL.metEnd7,
    title: 'The bargain — the case slides across the table',
    move: 25.11,
    chips: ['gpt-image-2 · medium', 'wan 720p, 121 frames', 'never judged'],
    her: 'One object crossing the frame while both people hold still.',
    quality: 'medium',
    style: MET_STYLE,
    content: "the meteorite case has finished sliding and now sits at the woman's edge of the table directly in front of her, the man leaned back with his hands withdrawn, the small tied money bag still ignored at the table edge, the woman unmoved with her arms crossed.",
    startContent: 'At a small table, the man pushes the meteorite in its clear case across toward the woman with both hands; a small tied money bag sits ignored at the edge of the table; the woman stands with her arms crossed, unimpressed.',
    motion: 'He pushes the meteorite case in one continuous slide across the table until it stops in front of the woman, then draws his hands back; she stays motionless with her arms crossed. Flat pastel illustration style with bold black ink outlines on a white background.',
  },
];

// One drawing + a written motion line. `assetLabel` finds the still (and its
// filed prompt) in that chat's Assets tab, so nothing here is retyped.
module.exports.SINGLES = [
  { id: 's-thoughtforms', media: 'dar-heart-8c-thoughtforms', chat: 'darius-interview-videos', chips: DAR_CHIPS,
    assetLabel: 'Heart film 8c', title: 'Thought forms over a crowded street', move: 48.01,
    her: 'Your note on this one: "720 P".' },
  { id: 's-spectrum', media: 'dar-heart-1a-spectrum', chat: 'darius-interview-videos', chips: DAR_CHIPS,
    assetLabel: 'Heart film 1a', title: 'The spectrum, and the one lit slice', move: 38.56,
    her: 'The slice opens into a shaft of light — a frame transforming, from one drawing.' },
  { id: 's-soncamp', media: 'dar-proof-5b-soncamp', chat: 'darius-interview-videos', chips: DAR_CHIPS,
    assetLabel: 'Proof film 5b', title: 'Her son between the tents', move: 38.16,
    her: 'Your note: "a nice image, but there needs to be something about that."' },
  { id: 's-wetstreet', media: 'dar-heart-5c-wetstreet', chat: 'darius-interview-videos', chips: DAR_CHIPS,
    assetLabel: 'Heart film 5c', title: 'Floating in a wet night street', move: 36.55,
    her: 'Your note: make him slightly transparent whenever he is out of his body.' },
  { id: 's-f41', media: 'single-f41', chat: 'hospital-story-images',
    assetLabel: 'the theft (shot 41)', title: 'The theft — hiding the scissors', move: 35.61,
    her: 'Your note: "this is good, but it looks like she\'s still holding scissors in her hand at the end."' },
  { id: 's-kellyabove', media: 'dar-proof-5a-kellyabove', chat: 'darius-interview-videos', chips: DAR_CHIPS,
    assetLabel: 'Proof film 5a', title: 'Kelly above the camp at dusk', move: 35.44 },
  { id: 's-livingroom', media: 'dar-heart-6b-livingroom', chat: 'darius-interview-videos', chips: DAR_CHIPS,
    assetLabel: 'Heart film 6b', title: 'The living room with everything invisible made visible', move: 34.08,
    her: 'You hearted this one and asked for it at 720p.' },
  { id: 's-f07', media: 'single-f07', chat: 'hospital-story-images',
    assetLabel: 'rolled cuffs (shot 7)', title: 'The nurse rolls up her cuffs', move: 30.93,
    her: 'The shot you said never needed two drawings — and it doesn\'t.' },
  { id: 's-readboard', media: 'dar-proof-2b-readboard', chat: 'darius-interview-videos', chips: DAR_CHIPS,
    assetLabel: 'Proof film 2b', title: 'Out of the body, reading the number off the board', move: 26.45 },
  { id: 's-exile08', media: 'exile-v1-08-you-taught-them-too-much', chat: 'dolores-cannon-memo-illustrations', chips: EXILE_CHIPS,
    assetLabel: 'The Exile 08/16', title: 'The Exile — "you taught them too much"', move: 24.35,
    her: 'The strongest of the sixteen grasshopper clips.' },
];

module.exports.DUDS = [
  { id: 'd-detector', media: 'hosp-pair-detector', still: STILL.detector,
    stillLabel: 'two panels', clipLabel: 'the clip',
    title: 'Fire detector — the first pair round', move: 30.67, pair: true,
    her: '"You picked clips that have almost no movement between them." The pixels move; the STORY doesn\'t — a hand finishing a chore.',
    style: HOSP_STYLE,
    content: 'A comic page of exactly two rectangular panels side by side, each panel fully enclosed by a hand-drawn black ink rectangle border, with a clean white gutter between them. Both panels show the same scene from the same camera position: the girl standing on a chair in a hospital room, reaching up toward the white ceiling. Left panel: the girl reaches up holding a small handmade fire detector made from an upside-down jello cup and masking tape, about to place it next to the real round fire detector on the ceiling. Right panel: the same scene a few seconds later — the handmade detector is taped to the ceiling right beside the real one, and the girl presses the last piece of masking tape flat.',
    motion: null },
  { id: 'd-84', media: 'dar-proof-4c-eightyfour', chat: 'darius-interview-videos', chips: DAR_CHIPS,
    assetLabel: 'Proof film 4c', title: 'Eighty-four people saying the same thing', move: 1.11,
    her: 'You caught this by eye: "didn\'t seem to move at all or very much." Measured, it is the deadest clip on file.' },
  { id: 'd-whiteboards', media: 'dar-proof-3a-whiteboards', chat: 'darius-interview-videos', chips: DAR_CHIPS,
    assetLabel: 'Proof film 3a', title: 'Five whiteboards, five days running', move: 4.23,
    her: 'Your note: "the whiteboards turned into paper fluttering in the wind."' },
  { id: 'd-nothing', media: 'exile-v1-14-nothing-to-do', chat: 'dolores-cannon-memo-illustrations', chips: EXILE_CHIPS,
    assetLabel: 'The Exile 14/16', title: 'The Exile — "there\'s nothing to do"', move: 2.62 },
  { id: 'd-vehicle', media: 'exile-v1-11-the-vehicle', chat: 'dolores-cannon-memo-illustrations', chips: EXILE_CHIPS,
    assetLabel: 'The Exile 11/16', title: 'The Exile — "it\'s beautiful, but I can\'t go back"', move: 2.46 },
];
