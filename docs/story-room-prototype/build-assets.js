// Per-image records for the Story Room prototype. The v3/v4 pages showed the
// same pictures TWICE — once as "versions", once as a style-grouped grid — and
// Sophie rightly asked what the difference was. There isn't one: version and
// style are two groupings of ONE set, so this emits one list per story where
// every picture carries both, plus everything the lightbox needs (its label,
// its model·quality caption, both halves of its prompt, and which chat owns
// its vote).
const fs = require('fs');
const DIR = '/tmp/claude-0/-home-user/325c7255-228d-5203-a13e-ed0471f9b1db/scratchpad/survey';
const J = (f) => JSON.parse(fs.readFileSync(DIR + '/' + f, 'utf8'));

function styleOf(a) {
  const p = ((a.promptStyle || '') + ' ' + (a.prompt || '')).toLowerCase();
  const u = (a.url || '').toLowerCase();
  if (a._lesson) return 'lessons';
  if (/evan-film-style|scanned ink-and-watercolor|datescan0013|chatgpt watercolor|wc-story|watercolor/.test(p)) return 'watercolor';
  if (/witch-school\/refs\/style-|house-pastel|pastel \(house\)|pastel/.test(p)) return 'pastel';
  if (/movie-style|colored pencil|dream machine/.test(p)) return 'pencil';
  if (/nde-panels|nde-anim/.test(u)) return 'pencil';
  if (/nde-styles\/pastel/.test(u)) return 'pastel';
  if (/witch-school\/(assets|webp)/.test(u)) return 'lessons';
  if (/story-shorts|witch-shorts/.test(u)) return 'pastel';
  if (/hospital-film|scratchpad\/art/.test(u)) return 'watercolor';
  return 'unsorted';
}

const chatAssets = (slug) => { try { return (J('assets-' + slug + '.json').assets || []).map((a) => ({ ...a, _chat: slug })); } catch (e) { return []; } };
const stories = J('stories2.json').projects;
const story = (id) => stories.find((s) => s.id === id) || {};
const cards = (id, src) => (story(id).beats || []).flatMap((b) => (b.cards || [])
  .filter((c) => c.url).map((c) => ({ url: c.url, description: c.label || '', _src: src })));
const padArt = (p, src) => (p.beats || []).flatMap((b) => []
  .concat(b.url ? [{ url: b.url, description: (b.text || '').split('\n')[0].slice(0, 70), _src: src }] : [])
  .concat((b.imageHistory || []).map((h) => ({ url: typeof h === 'string' ? h : h.url, description: 'an earlier version of that beat', _src: src }))))
  .filter((x) => x.url);
const padVoice = (p) => (p.beats || []).flatMap((b) => (b.voiceUrl ? [{ label: (b.text || 'beat').split('\n')[0].slice(0, 48), url: b.voiceUrl }] : []));
const vo = (id, label) => { const v = story(id).voiceover || {}; return v.url ? [{ label, url: v.url }] : []; };
const tag = (list, src) => list.map((a) => ({ ...a, _src: a._src || src }));

const padA = J('pad-B0Zx9pfAmdL7QDXUsAmH.json');
const padB = J('pad-pad.json');
const DF = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/';

const A = {};
const put = (id, art, voice) => { A[id] = { art: art.filter((x) => x && x.url), voice: voice || [] }; };

put('hospital', tag(chatAssets('hospital-story-images'), 'the hospital chat'), []);
put('meteorite', tag(chatAssets('meteorite-story-room'), 'the meteorite chat').concat(cards('songs-aug-2', 'the shelf story')),
  vo('songs-aug-2', 'The whole story, your voice'));
put('evan', padArt(padA, 'the pad')
  .concat(cards('evan', 'the shelf story'))
  .concat(tag(chatAssets('oven-story-illustrations'), 'the phone-call set'))
  .concat(tag(chatAssets('chatgpt-image-style-reference').filter((a) => /evan|girl character/i.test(a.description || '')), 'the style experiments')),
  padVoice(padA).concat(vo('evan', 'The whole story, your voice')));
put('tolle', tag(chatAssets('mason-output'), 'the tol chat').concat(tag(chatAssets('video-search-jesus-rules'), 'the Rules chat')), []);
put('settheory', padArt(padB, 'the pad'), padVoice(padB));
put('destiny', tag(chatAssets('new-house-story-illustrations'), 'the pastel short').concat(cards('controlling-my-own-destiny', 'the shelf story')),
  vo('controlling-my-own-destiny', 'The whole story, your voice'));
put('bath', tag(chatAssets('bath-thought-experiment'), 'the bath chat'), vo('i-ve-been-thinking-about-how-we-re', 'The whole story, your voice'));
put('soul', tag(chatAssets('soul-movie-concept'), 'the soul chat'), vo('soul-leaves-the-body-while-you-sleep-dre', 'The whole story, your voice'));
put('charlie', cards('charlie', 'the shelf story'), vo('charlie', 'The whole story, your voice'));
put('moonmilk', cards('moon-milk', 'the shelf story'), []);
put('jonas', cards('jonas-cookie-crumbs', 'the shelf story'), []);
put('spell', cards('spellcasting', 'the shelf story'), vo('spellcasting', 'The whole story, your voice'));
put('shame', cards('shame', 'the shelf story'), vo('shame', 'The whole story, your voice'));
put('hp', [], vo('lessons-from-harry-potter', 'The whole story, your voice'));
put('mason', tag(chatAssets('mason-noise-art-images'), 'the noise-art chat')
  .concat(tag(chatAssets('nde-precision-cutting-doc').filter((a) => /art-mason/.test(a.url || '')), 'the Viking chat')), []);
put('lessons', tag(chatAssets('deck-factory-story-room').map((a) => ({ ...a, _lesson: 1 })), 'the Imprint chat'),
  [['Animal Magic', 'animal-magic.m4a'], ['OCD & Witchcraft', 'ocd-witchcraft.m4a'], ['Art Is Forgiving', 'art-is-forgiving.m4a'],
   ['For the Hate of the Game', 'hate-of-the-game.m4a'], ['My Experiment with Manifestation', 'manifestation-experiment.m4a'],
   ['Instrumentalism, Part I', 'instrumentalism-1.m4a'], ['ADHD & Autism', 'adhd-autism.m4a'],
   ['God Only Works in Mysterious Ways', 'mysterious-ways.m4a'], ['II. The Pattern Collector', 'pattern-collector.m4a']]
    .map(([label, f]) => ({ label, url: DF + 'lessons-voices/' + f })));
put('astro', tag(chatAssets('new-session-b974aa'), 'the astrology chat'), []);

// NDE montages
const chene = chatAssets('anthony-chene-nde-pipeline');
const NDE = { proof: 'proof/p02-penny.webp', realer: 'realer.webp', telepathy: 'telepathy.webp', lifereview: 'life-review.webp',
  colors: 'colors.webp', music: 'music.webp', universal: 'universal.webp', welcomed: 'welcomed.webp',
  notmybody: 'not-my-body.webp', grass: 'grass.webp' };
const SUP = { realer: 'realer-than-real.mp3', telepathy: 'telepathy-audio-tight.mp3', lifereview: 'life-review.mp3',
  colors: 'colors-audio.mp3', music: 'music-sound.mp3', universal: 'universal-knowledge.mp3',
  welcomed: 'welcomed-home.mp3', notmybody: 'not-my-body.mp3', grass: 'grass.mp3' };
Object.keys(NDE).forEach((k) => {
  const rx = k === 'proof' ? /nde-panels\/proof\// : new RegExp('nde-panels/' + NDE[k].replace('.webp', ''));
  let art = tag(chene.filter((a) => rx.test(a.url || '')), 'the colored-pencil panels');
  if (k === 'proof') {
    art = art.concat(['p01-plate', 'p02-penny', 'p03-darius', 'p04-hensley', 'p05-tricia', 'p06-landon',
      'p07-malcolm', 'p08-nancy', 'p09-pegi', 'p10-peter', 'p11-treadmill', 'p12-chene']
      .map((n) => ({ url: DF + 'nde-panels/proof/' + n + '.webp', description: n.slice(4).replace(/-/g, ' '), _src: 'the colored-pencil panels' })))
      .concat(tag(chene.filter((a) => /nde-styles\/pastel\//.test(a.url || '')), 'the pastel version (scrapped)'));
  }
  if (k === 'realer') art = art.concat(tag(chene.filter((a) => /pastel-realer/.test(a.url || '')), 'the pastel version (scrapped)'));
  if (k === 'telepathy') art = art.concat(tag(chene.filter((a) => /pastel-telepathy/.test(a.url || '')), 'the pastel version (scrapped)'));
  art.push({ url: DF + 'nde-panels/' + NDE[k], description: 'the montage illustration', _src: 'the colored-pencil panels' });
  put(k, art, SUP[k] ? [{ label: 'The finished audio cut', url: DF + 'nde-supercuts/' + SUP[k] }] : []);
});
put('deceased', [], []);
put('supercuts', tag(chene.filter((a) => /nde-panels\/(?!proof)/.test(a.url || '')), 'one per montage'),
  Object.keys(SUP).map((k) => ({ label: k, url: DF + 'nde-supercuts/' + SUP[k] })));

// emit: one list per story, deduped, each picture carrying everything
const OUT = {};
Object.entries(A).forEach(([id, v]) => {
  const seen = new Set(); const imgs = [];
  v.art.forEach((a) => {
    if (!a.url || seen.has(a.url)) return; seen.add(a.url);
    imgs.push({
      u: a.url,
      t: a.thumb || '',
      d: (a.description || '').slice(0, 120),
      c: (a.prompt || '').slice(0, 60),          // the model · quality caption
      ps: (a.promptStyle || '').slice(0, 1200),
      pc: (a.promptContent || '').slice(0, 1200),
      s: styleOf(a),
      src: a._src || 'elsewhere',
      chat: a._chat || '',
      v: a.vote || '',
    });
  });
  OUT[id] = { n: imgs.length, imgs, voice: v.voice };
});
fs.writeFileSync(DIR + '/assets2.json', JSON.stringify(OUT));
Object.entries(OUT).forEach(([id, v]) => {
  const st = {}; const sr = {};
  v.imgs.forEach((i) => { st[i.s] = (st[i.s] || 0) + 1; sr[i.src] = (sr[i.src] || 0) + 1; });
  console.log(id.padEnd(12), String(v.n).padStart(4), 'imgs  styles:', Object.entries(st).map((x) => x.join(':')).join(' '),
    ' sources:', Object.keys(sr).length);
});
