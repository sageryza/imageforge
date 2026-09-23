#!/usr/bin/env node
/**
 * test-playground-pnt.js — PNT is on the Playground picker (2026-09-23,
 * Sophie: "add replicate pnt to playground"), on the WTR recipe.
 *
 * Source pins, no network: the page's STYLES row, the server's MODELS row it
 * points at, the PL_LORA row that labels it in the feed and the search, and
 * the rule that a price is MEASURED or absent — never typed in.
 *
 *   node scripts/test-playground-pnt.js
 */
const fs = require('fs');
const path = require('path');
let fails = 0;
function ok(c, msg) { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; }

const pageSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'promptlab.html'), 'utf8');
const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// The page's own STYLES table, evaluated (test-playground-canvas-pin's read).
const tbl = pageSrc.slice(pageSrc.indexOf('\n  var STYLES = {'));
const STYLES = eval('(' + tbl.slice(tbl.indexOf('{'), tbl.indexOf('\n  };') + 4) + ')'); // eslint-disable-line no-eval
const P = STYLES.painterly;
ok(P, 'STYLES has a `painterly` row');
ok(P && P.engine === 'replicate', 'it is a Replicate LoRA');
ok(P && P.model === 'sageryza/paint', 'its model is sageryza/paint');
ok(P && P.trigger === 'pnt', 'its trigger is pnt');
ok(P && P.label === 'PNT', 'its label is PNT');
ok(P && P.suffix === STYLES.watercolor.suffix, 'same page-level tail as WTR');
ok(Object.keys(STYLES).filter((k) => STYLES[k].engine === 'replicate').length === 2,
  'exactly two LoRAs on the picker (WTR, PNT)');

// The server row the page's model id lands on.
ok(/id: 'sageryza\/paint', version: '[0-9a-f]{64}', name: 'Painterly', trigger: 'pnt'/.test(serverSrc),
  'MODELS.replicate has sageryza/paint with trigger pnt');

// The PL_LORA row: labels the style, prices it only when measured.
const loraStart = serverSrc.indexOf('const PL_LORA = {');
const loraSrc = serverSrc.slice(loraStart, serverSrc.indexOf('\n};', loraStart) + 3);
const rowM = loraSrc.match(/'sageryza\/paint': \{([^}]*)\}/);
ok(rowM, 'PL_LORA has a sageryza/paint row');
ok(rowM && /label: 'PNT'/.test(rowM[1]), 'the row labels it PNT');
ok(rowM && /steps: 28, outputs: 1/.test(rowM[1]), 'the row names the Playground shape (28 steps, 1 output)');
const cents = rowM && rowM[1].match(/cents: ([\d.]+)/);
const measured = rowM && /measured: '\d{4}-\d{2}-\d{2}'/.test(rowM[1]);
ok(!cents || measured, 'a price on the row carries its measured date — never typed in');

// The page prints nothing for a row with no `cents`.
ok(/typeof m\.cents === 'number'\) \? m\.cents : null/.test(pageSrc),
  'the page prices a LoRA only from a served `cents`');

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
