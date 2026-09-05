#!/usr/bin/env node
// Builds the "Christmas commercial" Compare page from the scripts in
// research-and-scripts.md (kept here as data so a v2 is a re-run) and POSTs it
// into the christmas-pagan-commercial chat. Dry by default; --go posts.
//   node docs/christmas-commercial/post-page.js [--go] [--version 1]
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'christmas-pagan-commercial';
const args = process.argv.slice(2);
const GO = args.includes('--go');
const V = args.includes('--version') ? args[args.indexOf('--version') + 1] : '1';
const SHEET = `xmas-spots-v${V}`;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// A beat: [time, picture, lines...]. lines starting with '>' are VO / dialogue,
// 'SUPER:' is on-screen text. extra:true = surplus, marked so she can cut it.
const spots = [
  { id: 'a', name: 'A · Older than the name', sub: 'Slow, quiet, cinematic. A montage of the season as it is, then back through the layers to the oldest one. One voice, unhurried. The pick to make first.',
    beats: [
      [':00–:08', 'A window at dusk, snow, a lit tree inside.', '> "Every year, without being asked, we bring a tree into the house."'],
      [':08–:16', 'A fire being lit. Hands. A table being set for too many.', '> "We light fires. We gather in the dark. We cook more than we need, and we give things away."'],
      [':16–:22', 'Black. One word of type at a time.', '> "We call it Christmas. It has had other names."'],
      [':22–:32', 'Older footage: a long night, a horn of ale, a fire in a wood.', '> "In the north it was Yule. Three nights at the bottom of the year. A fire, ale, and one night kept for the mothers."'],
      [':32–:42', 'A crown. A letter with a seal. A church door.', '> "A king moved it onto the twenty-fifth. A pope told his missionaries to keep the temples, keep the feasts, and change the name on the door."'],
      [':42–:50', 'A padlock. Then a Victorian parlour, a red coat on a hook.', '> "It was banned for being what it was. Then it was rebuilt, piece by piece, and sold back to us."'],
      [':50–:58', 'Back to the first window. The family inside, the candles.', '> "And still, every year, without being asked, we do the oldest thing there is. We make light in the dark, and we stay together until it comes back."'],
      [':58–:60', 'Black.', 'SUPER: Christmas is the newest name for the oldest thing we do.', 'SUPER: Secretly a Witch.'],
      ['extra', '', '> "The date was chosen by arithmetic. It landed in the darkest week of the year, where every people on earth already kept a fire."'],
      ['extra', '', '> "The reindeer are from a poem. The tree is from a newspaper. The red suit is from an advertisement. The fire is from before anyone was writing anything down."'],
      ['extra', '', '> "Nobody knows where the yule log came from. That is how old it is."'],
    ], cut30: ':00–:08 · :16–:22 · :22–:32 · :50–:58 · :58–:60' },
  { id: 'b', name: 'B · Mothers’ Night', sub: 'One documented fact carried by one image. Women, a kitchen, the longest night of the year. Close and warm. No montage.',
    beats: [
      [':00–:10', 'A kitchen at night. Three generations of women. Steam, candles, the window black.', '> "The longest night of the year has a name older than Christmas."'],
      [':10–:20', 'The oldest woman lights a candle. The youngest watches her hands.', '> "Thirteen hundred years ago a monk wrote it down. The people of this island began their year on the twenty-fifth of December, with a night they kept for the mothers."'],
      [':20–:30', 'The table. Food passed. Nobody hurrying.', '> "Mothers’ Night. Before the saints, before the carols, before anything was sold. A fire, a meal, and the women who kept the year turning."'],
      [':30–:42', 'The tree in the next room, lit, half out of focus. The women still at the table.', '> "The name changed. The date stayed. The night is still the night."'],
      [':42–:52', 'The youngest woman blows out the candle. Dark. Then, outside the window, the first grey of morning.', '> "The light comes back because they waited for it."'],
      [':52–:60', 'Black.', 'SUPER: Mothers’ Night. December 24.', 'SUPER: Secretly a Witch.'],
      ['extra', '', '> "Bede did not approve of it. He wrote it down anyway. That is why we have it."'],
      ['extra', '', '> "Every culture that has ever lived through a winter has a night like this one."'],
      ['extra', '', 'OPTION · closing line instead: SUPER: The oldest night of the year is yours.'],
    ], cut30: ':00–:10 · :10–:20 · :42–:52 · :52–:60' },
  { id: 'c', name: 'C · The parts', sub: 'Hands only, overhead, a wooden table. Each tradition is set down with its date. Straight, museum-quiet. The last thing on the table is what has no date.',
    beats: [
      [':00–:08', 'A sprig of mistletoe set down. A small card beside it: 1784.', '> "The kiss under the mistletoe. Seventeen eighty-four."'],
      [':08–:16', 'A tin reindeer. Card: 1823.', '> "The eight reindeer, and their names. Eighteen twenty-three."'],
      [':16–:24', 'A glass bauble. Card: 1848.', '> "The tree in the house. Eighteen forty-eight."'],
      [':24–:32', 'A red felt hat. Card: 1931.', '> "The red suit. Nineteen thirty-one."'],
      [':32–:40', 'A folded letter. Card: 601.', '> "Keep the temples. Keep the feasts. Change the name. Six hundred and one."'],
      [':40–:50', 'Hands clear the table. Then set down a single candle and light it. No card.', '> "A fire, at the bottom of the year, and people around it."'],
      [':50–:56', 'The candle alone.', '> "No one wrote the date down. They were already doing it."'],
      [':56–:60', 'Black.', 'SUPER: Take the dates away. See what is left.', 'SUPER: Secretly a Witch.'],
      ['extra', '', 'Beat to add · A small wooden crown. Card: 940. > "A king moves the old feast onto the new day, and makes the ale a law. Nine forty."'],
      ['extra', '', 'Beat to add · A padlock. Card: 1659. > "Banned, for being what it was. Sixteen fifty-nine."'],
      ['extra', '', 'Beat to add · A horn cup. Card: 725. > "Yule. Written down by a monk who did not approve. Seven twenty-five."'],
    ], cut30: ':00–:08 · :16–:24 · :24–:32 · :40–:50 · :56–:60' },
  { id: 'd', name: 'D · Keep the feast (:30)', sub: 'The pope’s letter of 601 read plainly over a modern Christmas table. Nothing added to it. The words are the spot.',
    beats: [
      [':00–:06', 'A table being set. Winter light.', '> "In the year six hundred and one, a pope wrote to his missionaries."'],
      [':06–:20', 'The family arriving, coats, the door, the fire.', '> "Do not destroy their temples. Sprinkle them with water and set your altars inside, so the people will go on coming to the places they know."'],
      [':20–:26', 'The table full. Plates passed.', '> "And since they are used to feasting together, let them keep their feasts, in the new name."'],
      [':26–:30', 'Black.', 'SUPER: They kept the feast. So did we.', 'SUPER: Secretly a Witch.'],
      ['extra', '', '> "Fourteen hundred years later, the feast is still the part everyone comes for."'],
      ['extra', '', 'OPTION · a second voice reads the letter in Latin under the English, very low.'],
    ], cut30: 'already :30' },
];

const help = `<b>What this is.</b> Four straight commercial scripts for Christmas as a rebuilt holiday with a pagan floor under it, written for Secretly a Witch. Each beat has a + for a note (“cut”, “keep”, a rewrite). Grey <i>extra</i> beats are surplus on purpose.<br><br>
<b>Safe to say:</b> Yule is a real pagan midwinter feast (Bede, c. 725: the pagan year began Dec 25, with Mothers’ Night the night before). A Norse king, Hákon the Good, moved Yule onto Christmas by law and made brewing ale mandatory. Pope Gregory, 601: keep the pagan temples, keep the animal feasts. The Puritans banned Christmas 1659–1681, five-shilling fine. Reindeer 1823 (a poem), Dickens 1843, the tree in the newspaper 1848, the red suit Coca-Cola 1931. Mistletoe kissing: a 1784 comic opera.<br><br>
<b>Say carefully:</b> “Dec 25 covers a sun festival” (the sun feast is dated after the Christian one). “Santa is Odin” (one poem, a beard).<br><br>
<b>Don’t say:</b> Saturnalia (Dec 17–23, wrong week). Druid mistletoe. The tree as a stolen idol.`;

let body = '';
for (const s of spots) {
  body += `<h2 id="${s.id}">${esc(s.name)}</h2>\n<p class="mini">${esc(s.sub)}</p>\n`;
  s.beats.forEach((b, i) => {
    const [t, pic, ...lines] = b;
    const extra = t === 'extra';
    const id = `${s.id}-${i + 1}`;
    body += `<div class="card beat${extra ? ' extra' : ''}" data-item="${id}">\n`;
    body += `<div class="bt">${extra ? '<span class="chip">extra</span>' : `<span class="tc">${esc(t)}</span>`}${pic ? `<span class="pic">${esc(pic)}</span>` : ''}</div>\n`;
    for (const l of lines) {
      if (l.startsWith('> ')) body += `<p class="vo">${esc(l.slice(2))}</p>\n`;
      else if (l.startsWith('SUPER:')) body += `<p class="sup">SUPER · ${esc(l.slice(6).trim())}</p>\n`;
      else if (l.startsWith('OPTION')) body += `<p class="opt">${esc(l)}</p>\n`;
      else body += `<p class="dl">${esc(l)}</p>\n`;
    }
    body += `</div>\n`;
  });
  body += `<p class="mini cut30">:30 cut · ${esc(s.cut30)}</p>\n`;
}

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Christmas commercial v${V} — four spots</title>
<link rel="stylesheet" href="/compare.css">
<style>
h2 { margin-top: 30px; }
.beat { padding: 10px 12px; margin: 8px 0; }
.beat.extra { background: transparent; border: 1px dashed var(--line, #ddd6c8); }
.bt { display: flex; gap: 10px; align-items: baseline; margin-bottom: 4px; }
.tc { font-size: 12px; color: var(--ink2); letter-spacing: .04em; white-space: nowrap; }
.pic { font-size: 14px; color: var(--ink2); }
.vo { margin: 4px 0; font-style: italic; }
.dl { margin: 3px 0; }
.sup { margin: 6px 0 0; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); }
.opt { margin: 4px 0 0; font-size: 13px; color: var(--gold, #a27a2b); }
.cut30 { margin: 6px 0 0; }
</style>
<div class="wrap">
<h1>Christmas commercial v${V} — four spots</h1>
${body}</div>
<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
  window.__compareHelp({ html: ${JSON.stringify(help)} });
})();
</script>
`;

if (!GO) { process.stdout.write(html); process.exit(0); }
fetch(`${BASE}/api/chatfeed/page`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat: CHAT, title: `Christmas commercial v${V} — four spots`, html }) })
  .then(r => r.json()).then(j => console.log(JSON.stringify(j, null, 1)));
