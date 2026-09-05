#!/usr/bin/env node
// The research alone, as a Compare page (Sophie: "i already wrote the
// commercial. i just want the research"). Dry by default; --go posts.
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'christmas-pagan-commercial';
const GO = process.argv.includes('--go');
const V = process.argv.includes('--version') ? process.argv[process.argv.indexOf('--version') + 1] : '1';
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// [id, headline, detail, source]
const safe = [
  ['yule', 'Yule is a real pagan midwinter feast, and the word survived.', 'Bede (c. 725) says the pagan Anglo-Saxons called December and January Giuli (Yule) and began their year on Dec 25, “the day on which we now celebrate the birth of the Lord.” The night before they called Modranecht, Mothers’ Night. An Old English text from the 800s calls Dec 25 “the first day of Yule.”', 'Bede, De temporum ratione ch. 15'],
  ['hakon', 'A king moved Yule onto Christmas by law and made ale mandatory.', 'Hákon the Good of Norway (reigned c. 934–961), a Christian convert: “made a law that the festival of Yule should begin at the same time as Christian people held it, and that every man, under penalty, should brew a meal of malt into ale, and therewith keep the Yule holy as long as it lasted.” Before him Yule began on midwinter night and ran three days.', 'Heimskringla, Hákon the Good’s saga ch. 13'],
  ['gregory', 'A pope told his missionaries: keep the temples, keep the feasts.', 'Gregory the Great to Mellitus, AD 601, on converting the English: do not destroy the pagan temples, sprinkle them with holy water, put altars and relics in, so the people keep coming to the places they know. Since they are used to slaughtering oxen to their gods, let them keep killing and feasting on the saints’ days, “so that while some gratifications are outwardly permitted them, they may the more easily consent to the inward consolations.”', 'Bede, Ecclesiastical History I.30'],
  ['misrule', 'Medieval Christmas was twelve days of drinking and misrule.', 'Feasting, heavy drinking, a Lord of Misrule (often the poorest man in the parish, waited on by the rich), and wassailing: the poor going door to door demanding drink and food from the rich, sometimes violently. Ronald Hutton, the leading historian of British seasonal custom, traces wassailing and the blessing of crops and fruit trees to pre-Christian practice.', 'Hutton, Stations of the Sun'],
  ['puritans', 'The Puritans banned Christmas as pagan revelry.', 'England under Cromwell from 1647. Massachusetts Bay Colony 1659–1681: a five-shilling fine for anyone “observing any such day as Christmas or the like, either by forbearing of labor, feasting, or any other way.” Their reasons: no scripture for it, and the drunken door-to-door custom.', 'Massachusetts General Court, 1659'],
  ['victorians', 'The Christmas we have was built between 1823 and 1931.', '1823: Clement Clarke Moore’s A Visit from St. Nicholas invents the sleigh, the eight reindeer and their names, and the chimney. 1843: Dickens’s A Christmas Carol. 1848: the Illustrated London News prints Victoria, Albert and the children around a table-top tree; Britain and then America copy it. 1863 on: Thomas Nast’s cartoons fix Santa’s beard, belly and North Pole. 1931: Haddon Sundblom’s Coca-Cola paintings settle the red suit, black boots and belt.', 'Ashmolean; HowStuffWorks; Castleton'],
  ['mistletoe', 'Kissing under the mistletoe is from the 1780s.', 'A 1719 apothecary treatise on mistletoe’s uses mentions no kissing. The first record is George Colman’s 1784 comic opera Two to One. Pliny’s druids cutting mistletoe with golden sickles are real, but nothing connects them to midwinter or to kissing.', 'Live Science; History for Atheists'],
  ['tree', 'The indoor Christmas tree is medieval German and Christian.', '1300s Rhineland forestry rules limiting fir-cutting at Christmas; decorated trees in Baltic town squares by the 1500s; the Paradise tree of the medieval Adam-and-Eve plays. Evergreens in midwinter are a general human habit across many cultures, not one specific rite that was taken.', 'Live Science'],
];
const careful = [
  ['sol', '“December 25 was picked to cover a pagan sun festival.”', 'The Sol Invictus feast on Dec 25 is first attested in 354 AD. Christian writers were already naming Dec 25 around 235 (Hippolytus), and the likeliest reason is arithmetic: conception at the spring equinox, March 25, plus nine months. Some scholars think the Romans put their feast on the Christian date. Wording that holds up: “the date landed in the darkest week of the year, where every people already kept a fire.”', 'Hijmans; Biblical Archaeology Society'],
  ['odin', '“Santa is Odin.”', 'Odin has a beard and one skaldic poem calls him Jólnir, the Yule one. That is the whole case. No gifts to children, no red, no chimneys. The reindeer are Moore, 1823. Usable only as “some say.”', 'History for Atheists'],
  ['log', '“The yule log is pagan.”', 'Origin genuinely unknown. Medieval, Roman, Germanic, Slavic and Albanian candidates. “Nobody knows where the yule log came from” is the honest line.', 'Wikipedia, Yule log'],
  ['solstice', '“Yule was the solstice.”', 'Bede puts the pagan new year on Dec 25, four days after the astronomical solstice, which in his Julian calendar was reckoned as Dec 25 anyway. Norse midwinter night was later, mid-January by most readings. “The dark of the year” is safe; an exact solstice date is not.', 'Bede; Heimskringla'],
];
const dont = [
  ['saturnalia', 'Christmas is Saturnalia.', 'Saturnalia was Dec 17, stretched at most to Dec 23. Never the 25th.'],
  ['druid', 'Mistletoe kissing is a druid rite.', 'First record 1784, a comic opera.'],
  ['idol', 'The tree is a pagan idol the church stole.', 'Medieval German, Christian, and in the newspaper in 1848.'],
  ['horse', 'Santa’s reindeer are Odin’s eight-legged horse.', 'The reindeer are a New York poem from 1823.'],
];
const timeline = [
  ['c. 235', 'Hippolytus names Dec 25 as the birth date'], ['354', 'First record of a Dec 25 feast of Sol Invictus, and of Christmas on Dec 25 in Rome'],
  ['601', 'Gregory’s letter: keep the temples, keep the feasts'], ['c. 725', 'Bede writes down Yule and Mothers’ Night'],
  ['c. 940', 'Hákon moves Yule to Dec 25, ale by law'], ['1300s', 'Rhineland fir-cutting rules at Christmas'],
  ['1647 · 1659', 'Christmas banned in England, then Massachusetts'], ['1681', 'Massachusetts repeals the ban'],
  ['1784', 'First mistletoe kiss, in a comic opera'], ['1823', 'The reindeer'], ['1843', 'A Christmas Carol'],
  ['1848', 'The royal tree in the newspaper'], ['1863', 'Nast’s Santa'], ['1931', 'Coca-Cola’s red suit'],
];
const sources = [
  ['History for Atheists — Pagan Christmas, Again', 'https://historyforatheists.com/2024/12/pagan-christmas-again/'],
  ['Live Science — 3 traditions that may have pagan roots, 4 that don’t', 'https://www.livescience.com/archaeology/3-christmas-traditions-that-may-have-pagan-roots-and-4-that-probably-dont'],
  ['Biblical Archaeology Society — How December 25 became Christmas', 'https://www.biblicalarchaeology.org/daily/people-cultures-in-the-bible/jesus-historical-jesus/how-december-25-became-christmas/'],
  ['Heimskringla — Hákon the Good’s saga', 'https://en.wikisource.org/wiki/Heimskringla/Hakon_the_Good%27s_Saga'],
  ['Medievalists.net — A tale of two Yules', 'https://www.medievalists.net/2020/12/medieval-yule/'],
  ['Gregory to Mellitus, 601 (Oxford Cult of Saints)', 'https://portal.sds.ox.ac.uk/articles/online_resource/E06424_A_letter_of_Pope_Gregory_the_Great_Register_11_56_of_601_to_Mellitus_abbot_among_the_Franks_then_on_his_way_to_join_Augustine_in_Britain_gives_detailed_instructions_regarding_the_re-consecration_of_pagan_temples_in_southern_Britain_t/13903076'],
  ['The Conversation — Why the Puritans cracked down on Christmas', 'https://theconversation.com/why-the-puritans-cracked-down-on-celebrating-christmas-151359'],
  ['Mass Moments — Christmas celebration outlawed', 'https://www.massmoments.org/moment-details/christmas-celebration-outlawed.html'],
  ['Harvard Gazette — the sordid tales of Christmas past', 'https://news.harvard.edu/gazette/story/2023/12/historian-shares-the-sordid-tales-of-christmas-past/'],
  ['Ashmolean — The Victorians at Christmas', 'https://www.ashmolean.org/article/victorians-and-christmas'],
  ['David Castleton — Did Coca-Cola invent Santa?', 'https://www.davidcastleton.net/old-father-christmas-coca-cola-history-santa-claus/'],
];

const card = ([id, h, d, s], cls) => `<div class="card f ${cls}" data-item="${id}"><h3>${esc(h)}</h3><p>${esc(d)}</p>${s ? `<p class="mini src">${esc(s)}</p>` : ''}</div>\n`;
let body = '<h2>Safe to say</h2>\n' + safe.map(f => card(f, 'ok')).join('');
body += '<h2>Say carefully</h2>\n' + careful.map(f => card(f, 'hm')).join('');
body += '<h2>Don’t say</h2>\n' + dont.map(f => card(f, 'no')).join('');
body += '<h2>Timeline</h2>\n<div class="card"><table class="tl">' + timeline.map(([y, w]) => `<tr><td class="y">${esc(y)}</td><td>${esc(w)}</td></tr>`).join('') + '</table></div>\n';
body += '<h2>Sources</h2>\n<div class="card">' + sources.map(([t, u]) => `<p class="mini"><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></p>`).join('') + '</div>\n';

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Christmas research v${V} — what holds up</title>
<link rel="stylesheet" href="/compare.css">
<style>
h2 { margin-top: 28px; }
.f { padding: 12px 14px; margin: 8px 0; border-left: 3px solid var(--line, #ddd6c8); }
.f.ok { border-left-color: var(--green, #5d7a4a); }
.f.hm { border-left-color: var(--gold, #a27a2b); }
.f.no { border-left-color: var(--rose, #b05a5a); }
.f h3 { font-size: 18px; margin: 0 0 4px; }
.f p { margin: 4px 0; font-size: 15px; }
.src { margin-top: 6px !important; }
.tl { border-collapse: collapse; width: 100%; }
.tl td { padding: 4px 0; vertical-align: top; font-size: 15px; border-bottom: 1px solid var(--line, #ddd6c8); }
.tl .y { width: 84px; color: var(--ink2); white-space: nowrap; padding-right: 10px; }
</style>
<div class="wrap">
<h1>Christmas research v${V} — what holds up</h1>
${body}</div>
<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify('xmas-research-v' + V)} });
  window.__compareHelp({ html: ${JSON.stringify('<b>Three tiers.</b> Green: documented, dated, safe to put in a commercial. Gold: true-ish, hedge the wording. Rose: the popular claims historians have taken apart. Each fact has a + for a note. The popular “Christmas is Saturnalia” story is mostly wrong; the honest story is that Christmas has a real pagan floor (Yule, Mothers’ Night, a king’s ale law, a pope keeping the feasts) and nearly everything that feels ancient on top of it was built between 1784 and 1931.')} });
})();
</script>
`;
if (!GO) { process.stdout.write(html); process.exit(0); }
fetch(`${BASE}/api/chatfeed/page`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat: CHAT, title: `Christmas research v${V} — what holds up`, html }) })
  .then(r => r.json()).then(j => console.log(JSON.stringify(j)));
