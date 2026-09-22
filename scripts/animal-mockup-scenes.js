#!/usr/bin/env node
// animal-mockup-scenes.js — the creative product shots, each on ITS OWN set of
// hearted cards (2026-09-22, Sophie: "think of creative product shots" · "try
// the creative ones · new cards"). For every scene in the list: download the
// picked animals' pictures, compose them as print cards (flashcard-compose.py,
// Lemon Hand caps), and hand the folder to animal-mockup.js for one take.
//
//   node scripts/animal-mockup-scenes.js [--only toddler,gift] [--dry]
//
// NEVER run without her go. One take a scene, ~5-6¢ each.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const ONLY = (flag('only', '') || '').split(',').filter(Boolean);
const DRY = args.includes('--dry');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(process.env.CLAUDE_SCRATCH || '/tmp', 'animal-scenes');

const SCENES = [
  { key: 'toddler', cards: ['giraffe', 'elephant', 'lion', 'zebra', 'monkey'], title: 'a toddler reaching for the giraffe',
    scene: 'a toddler\'s hand reaching for the giraffe card on a soft nursery rug, the other cards scattered loosely around it, warm window light, shallow depth of field' },
  { key: 'gift', cards: ['fox', 'bear', 'owl'], title: 'three cards in a gift box strap',
    scene: 'three of the cards tucked under the linen ribbon of a small kraft-paper gift box on a linen tablecloth, soft daylight' },
  // lay: the cards are seen flat and straight on, so the real fronts are laid over the drawn ones at one size (animal-mockup.js --lay);
  // a card held up in perspective (the toddler, the zoo) is left as the model drew it
  { key: 'string', lay: true, cards: ['duck', 'swan', 'flamingo', 'peacock', 'penguin', 'hen'], title: 'clipped to a string on a nursery wall',
    // "zoom out" (her note on the first take): the whole string and the room around it
    scene: 'a wide shot of a nursery wall with the cards clipped by small wooden clothespins to a length of twine strung across it, the string and a good deal of wall and room around it in frame, the cards small in the picture, morning light, seen straight on' },
  { key: 'kitchen', cards: ['cat', 'dog', 'pig', 'cow'], title: 'a parent and child at the kitchen table',  // "parent", her note on the list
    scene: 'a parent and a small child at a kitchen table, the child holding up the cat card between them, the other cards on the table, morning light, faces softly out of focus' },
  { key: 'pocket', cards: ['squirrel', 'raccoon', 'mouse', 'deer'], title: 'spilling from a denim jacket pocket',
    scene: 'the cards spilling out of the chest pocket of a denim jacket draped over a wooden chair, indoor daylight' },
  { key: 'zoo', cards: ['elephant'], title: 'held up at the zoo',  // the elephant, as she wrote it
    scene: 'a child\'s hand holding the elephant card up in front of an elephant enclosure at the zoo, the real elephant blurred in the background, bright day' },
  { key: 'bookmark', cards: ['sheep'], title: 'a bookmark in a picture book',
    scene: 'the card poking out of the pages of a closed children\'s picture book on a bedside table, a small lamp lit beside it' },
];

const recs = JSON.parse(fs.readFileSync(path.join(__dirname, 'decks', 'animals-hearts.json'), 'utf8'));
(async () => {
  for (const sc of SCENES) {
    if (ONLY.length && !ONLY.includes(sc.key)) continue;
    const picks = sc.cards.map((n) => recs.find((r) => r.name === n)).filter(Boolean);
    if (picks.length !== sc.cards.length) console.log(`  ${sc.key}: missing ${sc.cards.filter((n) => !recs.find((r) => r.name === n)).join(', ')}`);
    const dir = path.join(OUT, sc.key); fs.mkdirSync(path.join(dir, 'full'), { recursive: true });
    const lines = ['Name | file'];
    for (const r of picks) { const fn = `${r.id}.webp`; const p = path.join(dir, 'full', fn); if (!fs.existsSync(p)) fs.writeFileSync(p, Buffer.from(await (await fetch(r.full)).arrayBuffer())); lines.push(`${r.name} | ${fn}`); }
    fs.writeFileSync(path.join(dir, 'cards.txt'), lines.join('\n'));
    execFileSync('python3', [path.join(__dirname, 'flashcard-compose.py'), path.join(dir, 'cards.txt'), '--src', path.join(dir, 'full'), '--full', path.join(dir, 'full'), '--font', path.join(ROOT, 'public', 'fonts', 'lemon-hand.ttf'), '--caps', '--size', '52', '--track', '0.24', '--out', path.join(dir, 'deck')], { stdio: 'ignore' });
    console.log(`\n== ${sc.key}: ${picks.map((r) => r.name).join(', ')}`);
    const a = ['scripts/animal-mockup.js', '--fronts', path.join(dir, 'deck', 'fronts'), '--out', path.join(dir, 'run'), '--scene', sc.scene, '--title', sc.title, ...(sc.lay ? ['--lay'] : []), ...(DRY ? ['--dry'] : [])];
    execFileSync('node', a, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CLAUDE_SCRATCH: OUT } });
  }
})().catch((e) => { console.error(e); process.exit(1); });
