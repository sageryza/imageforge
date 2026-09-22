#!/usr/bin/env node
// animal-deck.js — the ANIMAL flash-card deck off her Playground runs, and a
// heart breaks every tie (2026-09-22, Sophie: "help make my animal deck ·
// ties break w heart"). Nothing is drawn here: the animals were drawn by her
// in the Playground on the Sandy mirror style (the deck recipe — the same
// style reference every fruit, vegetable and house-plant card wears), most of
// them several times ("lion (full body, from the side)" at medium, again at
// high, "lion" on its own). One card per animal:
//
//   - an ✕ takes a version OUT (a Playground ✕, a ✕ on the pick page, or a ✕
//     in this chat's Assets tab);
//   - ONE ♥ among what is left is the pick;
//   - one version left with no mark is the pick by itself (the fruit deck's
//     "auto pick the single ones", 2026-09-21);
//   - anything else — two or more versions and no heart, or two hearts — is a
//     TIE, and it goes on the pick page for her heart to break;
//   - every version ✕'d is a card with nothing on it: named, never redrawn
//     here (the go rule).
//
// Two pages in the chat: the DECK (a stock grid page, one picture per animal,
// A to Z, the name under it) and the TIES (spreadEach + spreadAll, opening on
// swipe — every version of one animal on one card, a ✕ drops one to the No
// pile). Re-run with --pick <tiesPageId> after she has hearted, and the ties
// she broke move onto the deck. The picks are written to
// scripts/decks/animals-drawn.json in the deck-draw.js record shape, so the
// flash-card composer and a later "draw the missing ones" (a
// scripts/decks/animals.json list) read the same file.
//
//   node scripts/animal-deck.js [--chat animal-deck-heart-tiebreak] [--dry]
//        [--since 2026-09-20] [--pick <tiesPageId>] [--supersede <id,id>]
//
// Free: no model call anywhere. Pure rule in `decide`, pinned by
// scripts/test-animal-deck.js.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const CHAT = flag('chat', 'animal-deck-heart-tiebreak');
const SESSION = flag('session', (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''));
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const SINCE = Date.parse(flag('since', '2026-09-20T00:00:00Z'));
const PICK = flag('pick');
const SUPERSEDE = (flag('supersede', '') || '').split(',').filter(Boolean);
const DRY = args.includes('--dry');
const REC = path.join(__dirname, 'decks', 'animals-drawn.json');
const PAIRS = path.join(__dirname, 'fruit-chart', 'animals-uploaded.json');

// WHICH RUNS ARE ANIMALS. A prompt is an animal when its subject — lowercase,
// the parenthetical shot note and anything after a comma dropped, a leading
// article dropped — is a word on this list or an alias of one. Anything else
// in the window (crystals, a pothos, a jar of heads) is skipped and NAMED in
// the dry run, never silently. Two drawings of one animal under two names are
// one card: "tabby cat" and "cat" are the cat, "mare" and "horse" the horse,
// "black bear" the bear, a "spotted cow" the cow. Lamb and sheep stay two
// cards — she drew them as two.
const ALIASES = {
  'tabby cat': 'cat', 'mare': 'horse', 'black bear': 'bear',
  'spotted cow': 'cow', 'black and white spotted cow': 'cow',
  // the long names (2026-09-22, "hippo?" — she had drawn "hippopotamus")
  'hippopotamus': 'hippo', 'rhinoceros': 'rhino', 'chimpanzee': 'monkey', 'bunny': 'rabbit',
  'grizzly bear': 'bear', 'brown bear': 'bear', 'polar bear': 'polar bear', 'red fox': 'fox',
  'grey wolf': 'wolf', 'gray wolf': 'wolf', 'house cat': 'cat', 'kitten': 'cat', 'puppy': 'dog',
  // "snowy owl is just owl" (2026-09-22) — a kind of owl is a version of the owl card
  'snowy owl': 'owl', 'barn owl': 'owl', 'great horned owl': 'owl',
  // "stallion is horse" (2026-09-22) — the sexes and the young ride as versions
  'sea horse': 'seahorse', 'stallion': 'horse', 'foal': 'horse', 'pony': 'horse', 'colt': 'horse', 'filly': 'horse',
  'ewe': 'sheep', 'ram': 'sheep', 'billy goat': 'goat', 'nanny goat': 'goat', 'kid goat': 'goat',
  'bull': 'cow', 'calf': 'cow', 'heifer': 'cow', 'boar': 'pig', 'sow': 'pig', 'piglet': 'pig',
  'doe': 'deer', 'stag': 'deer', 'buck': 'deer', 'fawn': 'deer', 'lioness': 'lion', 'tigress': 'tiger',
  'drake': 'duck', 'duckling': 'duck', 'gosling': 'goose', 'gander': 'goose', 'cygnet': 'swan',
  'chick': 'chicken', 'cub': 'bear', 'bear cub': 'bear', 'joey': 'kangaroo', 'tomcat': 'cat',
};
const ANIMALS = new Set([
  'lamb', 'cat', 'gecko', 'lizard', 'wolf', 'sheep', 'lion', 'puma', 'panther', 'raccoon',
  'owl', 'horse', 'tiger', 'leopard', 'hyena', 'coyote', 'cow', 'flamingo', 'ostrich', 'frog',
  'emu', 'peacock', 'elephant', 'bear', 'zebra', 'cheetah', 'rhino', 'monkey', 'blue jay',
  'blackbird', 'hare', 'robin', 'fox', 'deer', 'rabbit', 'giraffe', 'hippo', 'gorilla',
  'kangaroo', 'koala', 'panda', 'penguin', 'seal', 'otter', 'beaver', 'moose', 'bison', 'camel',
  'goat', 'pig', 'donkey', 'duck', 'goose', 'swan', 'turkey', 'chicken', 'rooster', 'hen',
  'crow', 'sparrow', 'eagle', 'hawk', 'parrot', 'toucan', 'pelican', 'heron', 'turtle',
  'tortoise', 'snake', 'crocodile', 'alligator', 'iguana', 'chameleon', 'squirrel', 'chipmunk',
  'mouse', 'rat', 'hedgehog', 'bat', 'skunk', 'badger', 'mole', 'dog', 'jaguar', 'lynx',
  'bobcat', 'meerkat', 'sloth', 'armadillo', 'anteater', 'llama', 'alpaca', 'ram', 'bull', 'ox',
  'yak', 'walrus', 'whale', 'dolphin', 'shark', 'octopus', 'crab', 'lobster', 'jellyfish',
  'starfish', 'seahorse', 'fish', 'salmon', 'trout', 'toad', 'salamander', 'newt', 'polar bear',
  'orangutan', 'lemur', 'wombat', 'platypus', 'ferret', 'weasel', 'porcupine', 'antelope',
  'gazelle', 'elk', 'reindeer', 'buffalo', 'boar', 'warthog', 'hummingbird', 'woodpecker',
  'stork', 'crane', 'vulture', 'falcon', 'magpie', 'pigeon', 'dove', 'puffin', 'kiwi',
  'cockatoo', 'macaw', 'bee', 'butterfly', 'ladybug', 'ant', 'spider', 'snail', 'ray',
  'stingray', 'manatee', 'narwhal', 'sea lion', 'clownfish', 'goldfish', 'koi', 'eel', 'squid',
  'cobra', 'python', 'viper', 'rattlesnake', 'boa', 'komodo dragon', 'axolotl', 'scorpion',
  'moth', 'dragonfly', 'grasshopper', 'cricket', 'beetle', 'worm', 'caterpillar', 'wasp',
  'hornet', 'mosquito', 'fly', 'flea', 'tick', 'calf', 'foal', 'piglet', 'kid', 'duckling',
  'gosling', 'chick', 'cub', 'joey', 'fawn', 'pony', 'mule', 'zebu', 'ibex', 'chamois',
  'wildebeest', 'okapi', 'tapir', 'capybara', 'guinea pig', 'hamster', 'gerbil', 'chinchilla',
  'opossum', 'possum', 'raccoon dog', 'wolverine', 'marten', 'mink', 'stoat', 'ermine',
  'ocelot', 'serval', 'caracal', 'cougar', 'mountain lion', 'snow leopard', 'clouded leopard',
  'jackal', 'dingo', 'arctic fox', 'fennec fox', 'sun bear', 'sloth bear', 'spectacled bear',
  'giant panda', 'red panda', 'sea otter', 'river otter', 'muskrat', 'nutria', 'vole',
  'lemming', 'shrew', 'echidna', 'cassowary', 'rhea', 'albatross', 'gull', 'seagull', 'tern',
  'petrel', 'cormorant', 'gannet', 'booby', 'frigatebird', 'spoonbill', 'ibis', 'egret',
  'mallard', 'teal', 'loon', 'grebe', 'coot', 'moorhen', 'rail', 'crake', 'bustard', 'pheasant',
  'grouse', 'quail', 'partridge', 'peafowl', 'guineafowl', 'cuckoo', 'roadrunner', 'nightjar',
  'swift', 'kingfisher', 'bee-eater', 'hoopoe', 'hornbill', 'parakeet', 'budgie', 'lovebird',
  'kite', 'osprey', 'condor', 'buzzard', 'harrier', 'kestrel', 'raven', 'jay', 'jackdaw',
  'rook', 'starling', 'mynah', 'oriole', 'thrush', 'nightingale', 'wren', 'finch', 'goldfinch',
  'canary', 'cardinal', 'bunting', 'warbler', 'tit', 'chickadee', 'nuthatch', 'treecreeper',
  'lark', 'pipit', 'wagtail', 'swallow', 'martin']);

function subjectOf(prompt) {
  let s = String(prompt || '').toLowerCase().replace(/\([^)]*\)/g, ' ').split(',')[0].trim();
  s = s.replace(/^(a|an|the)\s+/, '').replace(/\s+/g, ' ').trim();
  if (ALIASES[s]) return ALIASES[s];
  return ANIMALS.has(s) ? s : null;
}

// THE RULE, pure. versions: [{id, mark: 'like'|'dislike'|null}]. Answers
// { pick, tie:[…], out:[…], empty } — exactly one of pick / tie / empty.
function decide(versions) {
  const out = versions.filter((v) => v.mark === 'dislike');
  const alive = versions.filter((v) => v.mark !== 'dislike');
  const hearts = alive.filter((v) => v.mark === 'like');
  if (hearts.length === 1) return { pick: hearts[0], out, tie: [] };
  if (!hearts.length && alive.length === 1) return { pick: alive[0], out, tie: [], auto: true };
  if (!alive.length) return { pick: null, out, tie: [], empty: true };
  return { pick: null, out, tie: alive, twoHearts: hearts.length > 1 };
}
// A HEART ON THE TIES PAGE OR IN THE ASSETS TAB IS HER NEWER WORD (2026-09-22,
// "rhino has a heart" — both rhino runs wore a Playground ♥ from different
// days, she hearted ONE on the ties surface, and the deck still called it two
// hearts). When any version of an animal carries a ♥ made where the tie is
// being broken, the other versions' Playground-only hearts stand down; a ✕
// anywhere still stands.
function settle(versions) {
  const fresh = versions.some((v) => v.mark === 'like' && v.markFrom);
  if (!fresh) return versions;
  return versions.map((v) => (v.mark === 'like' && !v.markFrom ? { ...v, mark: null, stoodDown: true } : v));
}
module.exports = { decide, settle, subjectOf, ALIASES, ANIMALS };
if (require.main !== module) return;

const get = async (u) => (await fetch(u)).json();
const post = (u, body) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const slug = (s) => s.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tierOf = (r) => ({ '1k': '1K', '2k': '2K', '4k': '4K' }[String(r.res || '').toLowerCase()] || (r.size === '4K' ? '4K' : '1K'));

async function playgroundRuns() {
  const runs = [];
  let before = 0;
  for (let i = 0; i < 40; i++) {
    const d = await get(`${BASE}/api/promptlab?limit=100&kind=single${before ? `&before=${before}` : ''}`);
    const page = d.runs || [];
    if (!page.length) break;
    runs.push(...page);
    before = page[page.length - 1].createdAt;
    if (!before || before < SINCE || !d.more) break;
  }
  return runs.filter((r) => r.createdAt >= SINCE && r.status === 'done' && r.engine === 'gptimage' && r.gptStyle === 'evan' && (r.images || [])[0]);
}

(async () => {
  const runs = await playgroundRuns();
  const byAnimal = new Map();
  const skipped = new Map();
  const add = (animal, v) => { if (!byAnimal.has(animal)) byAnimal.set(animal, []); byAnimal.get(animal).push(v); };
  for (const r of runs) {
    const a = subjectOf(r.prompt);
    if (!a) { skipped.set(String(r.prompt).slice(0, 60), (skipped.get(String(r.prompt).slice(0, 60)) || 0) + 1); continue; }
    const style = String(r.fullPrompt || '').includes(r.prompt) ? String(r.fullPrompt).replace(r.prompt, '[content]') : '';
    add(a, {
      id: `${slug(a)}--${r.id}`, run: r.id, url: r.images[0], full: r.images[0], prompt: r.prompt,
      fullPrompt: r.fullPrompt || '', style, quality: r.quality || 'medium', size: tierOf(r), at: r.createdAt,
      mark: (r.votes && r.votes['0']) || null, from: 'playground',
    });
  }
  // The bear and the cheetah were ALSO drawn as a two-up 4K landscape sheet,
  // cut apart (animals-draw-pair.js, 2026-09-21) — versions of those two.
  if (fs.existsSync(PAIRS)) {
    for (const p of JSON.parse(fs.readFileSync(PAIRS, 'utf8'))) {
      const a = subjectOf(p.name);
      if (a) add(a, { id: `${slug(a)}--pair-${p.id}`, run: null, url: p.url, full: p.full, prompt: p.name, fullPrompt: '', style: '',
        quality: p.quality || 'medium', size: p.size || '4K', at: 0, mark: null, from: 'two-up sheet' });
    }
  }
  // HER MARKS OFF THE LAST TIES PAGE and off this chat's Assets tab count too
  // (the fruit deck's lesson, 2026-09-21: "i had already picked those · u
  // didn't check"). A page or tab mark wins over the Playground vote on the
  // same picture — the page is where she is breaking the tie.
  const pageMarks = {};
  if (PICK) {
    const v = await get(`${BASE}/api/chatfeed/verdict?chat=${CHAT}&sheet=page-${PICK}`);
    Object.assign(pageMarks, v.items || {});
  }
  const tabMarks = new Map();
  try {
    const a = await get(`${BASE}/api/gallery/assets?chat=${CHAT}&limit=1000`);
    for (const x of a.assets || []) if (x.vote && x.url) tabMarks.set(x.url.split('/').pop(), x.vote);
  } catch (e) { console.log('assets votes unread: ' + e.message); }
  let overrides = 0;
  for (const vs of byAnimal.values()) for (const v of vs) {
    const pm = pageMarks[v.id];
    const tm = tabMarks.get(v.full.split('/').pop());
    const m = pm === true ? 'like' : pm === false ? 'dislike' : tm || null;
    // markFrom is set whenever she marked it HERE, even when it agrees with
    // the Playground — `settle` needs to know which hearts are her newer word.
    if (m) { if (m !== v.mark) overrides++; v.mark = m; v.markFrom = pm != null ? 'ties page' : 'assets tab'; }
  }

  const animals = [...byAnimal.keys()].sort();
  const picks = [], ties = [], empty = [];
  for (const a of animals) {
    const vs = settle(byAnimal.get(a).sort((x, y) => (y.at || 0) - (x.at || 0)));
    const d = decide(vs);
    if (d.pick) picks.push({ animal: a, v: d.pick, auto: d.auto, of: vs.length });
    else if (d.empty) empty.push({ animal: a, of: vs.length });
    else ties.push({ animal: a, vs: d.tie, twoHearts: d.twoHearts, out: d.out.length });
  }
  console.log(`${runs.length} Sandy mirror runs since ${new Date(SINCE).toISOString().slice(0, 10)} · ${animals.length} animals · ${picks.length} picked · ${ties.length} ties · ${empty.length} all ✕'d` + (overrides ? ` · ${overrides} mark(s) off the ties page / Assets tab` : ''));
  for (const p of picks) console.log(`  ✓ ${p.animal.padEnd(12)} ${p.auto ? 'only one drawn' : '♥'}  ${p.v.quality} · ${p.v.size} · ${p.v.prompt}${p.of > 1 ? ` (of ${p.of})` : ''}`);
  for (const t of ties) console.log(`  ? ${t.animal.padEnd(12)} ${t.twoHearts ? 'two hearts' : 'no heart'}: ${t.vs.map((v) => `${v.quality}${v.size !== '1K' ? ' ' + v.size : ''} "${v.prompt}"`).join(' · ')}${t.out ? ` (${t.out} ✕'d)` : ''}`);
  for (const e of empty) console.log(`  ✕ ${e.animal.padEnd(12)} every version ✕'d (${e.of}) — a redraw is hers to ask for`);
  if (skipped.size) console.log('skipped (not an animal): ' + [...skipped].map(([p, n]) => `${p}${n > 1 ? ` x${n}` : ''}`).join(' · '));
  if (DRY) return;

  // The record — the deck-draw.js shape, A to Z, only the decided cards.
  const recs = picks.map((p) => ({ id: slug(p.animal), name: p.animal, url: p.v.url, full: p.v.full, quality: p.v.quality, size: p.v.size,
    scene: p.v.prompt, run: p.v.run, from: p.v.from, by: p.auto ? 'only one' : (p.v.markFrom || 'playground ♥'), at: new Date().toISOString() }));
  fs.mkdirSync(path.dirname(REC), { recursive: true });
  fs.writeFileSync(REC, JSON.stringify(recs, null, 1));

  // Every version on either page is filed into this chat's Assets tab with
  // its name, its caption and its exact prompt split — so a heart or ✕ made
  // in the lightbox lands where the next run reads it.
  const file = async (a, v, what) => {
    const cap = `gpt-image-2 · ${v.quality} · ${v.size}`;
    await post(`${BASE}/api/gallery`, { assetsOnly: true, chat: CHAT, session: SESSION, url: v.full, description: `${a} — ${what} (${v.quality} · ${v.size})`, prompt: cap });
    if (v.fullPrompt) await post(`${BASE}/api/gallery/assets/prompt`, { chat: CHAT, url: v.full, style: v.style, content: v.prompt, full: v.fullPrompt });
  };
  for (const p of picks) await file(p.animal, p.v, 'animal deck');
  for (const t of ties) for (const [i, v] of t.vs.entries()) await file(t.animal, v, `version ${i + 1} of ${t.vs.length}, tie`);

  const item = (v, label) => ({ id: v.id, img: v.url, full: v.full, url: v.full, label, model: 'gpt-image-2', quality: v.quality, size: v.size });
  const deckGroups = picks.map((p) => ({ label: p.animal, items: [item(p.v, `${p.v.quality} · ${p.v.size}${p.auto ? '' : ' · your ♥'}`)] }));
  const deckTitle = `Animal deck — ${picks.length} cards${ties.length ? ` · ${ties.length} ties to break` : ''}${empty.length ? ` · ${empty.length} with nothing on them` : ''}`;
  const deck = await (await post(`${BASE}/api/chatfeed/page`, { chat: CHAT, title: deckTitle, template: 'grid', sheet: 'animal-deck', data: {
    groups: deckGroups,
    help: `One picture per animal, A to Z: the one you hearted in the Playground, or the only one drawn. ${ties.length ? `The ${ties.length} animals with more than one version and no single heart are on the ties page.` : ''}${empty.length ? ` Every version was ✕'d for: ${empty.map((e) => e.animal).join(', ')}.` : ''}`,
  } })).json();
  console.log('deck page', JSON.stringify(deck));
  let tiesPage = null;
  if (ties.length) {
    // The line under a version says only what tells it apart: quality, size,
    // a ♥ she already gave it, the sheet it came off, and the prompt's own
    // words when they were more than the animal's name ("sitting", "mare").
    const extra = (v, a) => { const p = String(v.prompt).toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); return p === a ? '' : ` · ${p}`; };
    const tieGroups = ties.map((t) => ({ label: t.animal, items: t.vs.map((v) => item(v, `${v.quality} · ${v.size}${v.mark === 'like' ? ' · ♥' : ''}${v.from === 'two-up sheet' ? ' · two-up sheet' : extra(v, t.animal)}`)) }));
    tiesPage = await (await post(`${BASE}/api/chatfeed/page`, { chat: CHAT, title: `Animal deck — break the ties: ${ties.length} animals`, template: 'grid', sheet: 'animal-ties', data: {
      groups: tieGroups, spreadEach: true, spreadAll: true, start: 'swipe',
      help: 'Every version of one animal on one card. Heart the one for the deck; an ✕ drops a picture to the No pile. A card with two hearts is still a tie.',
    } })).json();
    console.log('ties page', JSON.stringify(tiesPage));
  }
  for (const id of SUPERSEDE) console.log('superseded', id, (await fetch(`${BASE}/api/chatfeed/page/${id}/supersede`, { method: 'POST' })).status);
  console.log(`\ndeck: ${BASE}/api/chatfeed/page/${deck.id}` + (tiesPage ? `\nties: ${BASE}/api/chatfeed/page/${tiesPage.id}` : ''));
})().catch((e) => { console.error(e); process.exit(1); });
