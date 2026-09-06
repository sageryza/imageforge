#!/usr/bin/env node
// THE STORY ROOM'S TYPED CAST — the server half, pure (2026-09-06, Sophie:
// "also add the character description feature as an option that's not
// character image, like playground. u can copy the code").
//   1. artPrompt writes the clause sheetGrid.castBlock(cast, true) writes —
//      the ONE builder — as its own paragraph after the head, on watercolor
//      and on a recipe style;
//   2. an EMPTY cast writes NOTHING: the prompt is byte-for-byte what the pad
//      always sent (her rule);
//   3. castOf keeps the Playground's caps and shape;
//   4. source pins: POST /cast exists and bumps no updatedAt, /generate hands
//      pad.cast to the draw, readPad returns it, the page loads the served
//      /sheet-grid.js and leaves /cast out of dirtySinceFilm, and the
//      generator matches the built page.
//   node scripts/test-scratchpad-cast.js
const fs = require('fs');
const path = require('path');
const { artPrompt, castOf } = require('../scratchpad.js');
const sheetGrid = require('../sheet-grid');

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (cond || extra === undefined ? '' : '  — ' + JSON.stringify(extra)));
  if (!cond) fails++;
}

const cast = [{ name: 'Nicholas', description: 'long beard, glasses, all black' }, { name: '', description: 'a nurse in green' }];
const clause = sheetGrid.castBlock(cast, true);

// 1. the clause, in place
const wc = artPrompt({ recipe: null, prompt: 'the ER at night', character: true, cline: '', cast });
ok('watercolor: the clause is sheetGrid.castBlock(cast, true), verbatim', wc.castTxt === clause && wc.full.includes(clause));
ok('watercolor: head sentence, blank line, clause, blank line, her words', wc.full.endsWith('\n\n' + clause + '\n\nthe ER at night'));
ok('watercolor: the head handed to the gallery carries the clause', wc.head.endsWith('\n\n' + clause));
ok('watercolor: the clause is read back out of the filed head', JSON.stringify(sheetGrid.castParse(wc.head)) === JSON.stringify(sheetGrid.castRows(cast)));
const rc = artPrompt({ recipe: { prefix: 'PREFIX.', suffix: 'SUFFIX.' }, prompt: 'the ER at night', character: false, cline: ' The last attached image is Nicholas.', cast });
ok('recipe style: prefix, clause, words, suffix + character line', rc.full === 'PREFIX.\n\n' + clause + '\n\nthe ER at night\n\nSUFFIX. The last attached image is Nicholas.', rc.full);
ok('recipe style: the clause is its own paragraph after the prefix', rc.head === 'PREFIX.\n\n' + clause);

// 2. an empty cast writes nothing
const none = artPrompt({ recipe: null, prompt: 'the ER at night', character: true, cline: '', cast: [] });
ok('empty cast: no clause at all', none.castTxt === '' && !none.full.includes('Character 1'));
ok('empty cast: watercolor prompt is exactly head + blank line + words', /^[^\n]+\n\nthe ER at night$/.test(none.full), none.full);
const blank = artPrompt({ recipe: null, prompt: 'x', character: false, cline: '', cast: [{ name: '  ', description: '' }] });
ok('a row of only whitespace is not a character', blank.castTxt === '' && blank.full === artPrompt({ recipe: null, prompt: 'x', character: false, cline: '', cast: undefined }).full);
const r0 = artPrompt({ recipe: { prefix: 'P', suffix: 'S' }, prompt: 'x', character: false, cline: '', cast: null });
ok('empty cast on a recipe style: P, words, S — byte-for-byte the old shape', r0.full === 'P\n\nx\n\nS', r0.full);

// 3. castOf — the Playground's caps and shape
ok('castOf trims and drops empty rows', JSON.stringify(castOf([{ name: ' Mo ', description: ' tall ' }, { name: '', description: ' ' }, null])) === JSON.stringify([{ name: 'Mo', description: 'tall' }]));
ok('castOf caps at 12 rows', castOf(Array.from({ length: 20 }, (_, i) => ({ name: 'c' + i, description: 'd' }))).length === 12);
const long = castOf([{ name: 'n'.repeat(100), description: 'd'.repeat(500) }])[0];
ok('castOf caps a name at 60 and a description at 300', long.name.length === 60 && long.description.length === 300);
ok('castOf on nothing is []', JSON.stringify(castOf(undefined)) === '[]');

// 4. source pins
const srv = fs.readFileSync(path.join(__dirname, '..', 'scratchpad.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'scratchpad.html'), 'utf8');
const gen = fs.readFileSync(path.join(__dirname, 'gen-scratchpad.py'), 'utf8');
const castRoute = srv.slice(srv.indexOf("router.post('/cast'"), srv.indexOf("router.post('/cast'") + 400);
ok('POST /cast exists', srv.includes("router.post('/cast'"));
ok('POST /cast writes `cast` alone with merge and NO updatedAt', /set\(\{ cast \}, \{ merge: true \}\)/.test(castRoute) && !/updatedAt/.test(castRoute));
ok('POST /cast goes through castOf (the caps, the shape)', /castOf\(req\.body\.cast\)/.test(castRoute));
ok('/generate hands pad.cast to the draw', /runArtJob\(pid, id, \{[^}]*cast: pad\.cast/.test(srv));
ok('runArtJob builds the prompt through artPrompt', /artPrompt\(\{ recipe, prompt, character, cline, cast: castRows \}\)/.test(srv));
ok('readPad returns the cast', /cast: castOf\(v\.cast\)/.test(srv));
ok('the clause is never written in scratchpad.js', !/Named characters in this picture/.test(srv));
ok('the page loads the served /sheet-grid.js', page.includes('<script src="/sheet-grid.js"></script>'));
ok('the page prints the clause via window.__sheetGrid.castBlock', /window\.__sheetGrid&&window\.__sheetGrid\.castBlock/.test(page));
ok('the page never writes the clause itself', !/Named characters in this picture/.test(page));
ok("the page's api() leaves /cast out of dirtySinceFilm", /p!=='\/cast'\) dirtySinceFilm=true/.test(page));
ok('the page carries the two tabs and the rows', page.includes('id="chartabs"') && page.includes('id="chardesc"') && page.includes('id="castrows"'));
ok('the boxes ship empty (placeholders only name the field)', /nm\.placeholder='Name'/.test(page) && /ds\.placeholder='Description'/.test(page) && !/placeholder='(Name|Description)[^']/.test(page));
ok('generator matches the built page', gen.includes("api('/cast'") && page.includes("api('/cast'"));

console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
