// Extract the shared "Our dream journal" Google Doc into archive entries.
//
// 131 dated entries, Jan 2023 -> Nov 2024, newest first. It was a SHARED
// journal — several people wrote their own dreams into it and no entry carries
// an author — so every entry is imported tagged "author uncertain" rather than
// claimed as Sophie's. Entries that talk about "Sage" in the third person are
// definitely someone else's and say so.
//
// Input: the raw tool-result JSON ({fileContent}) saved when the doc was read.
//   node collect-drive-journal.mjs <path-to-json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2];
const OUT = path.join(HERE, 'source-drive-journal.json');
const DOC_URL = 'https://docs.google.com/document/d/1ApZpQHJjPsHPBVi_uY7CmfwjuhGlne6SKEYG8yOoJdA/edit';

// The doc's own span: created 2023-01-17, last written 2024-11-02.
const NEWEST = { y: 2024, m: 11 };
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const text = JSON.parse(fs.readFileSync(SRC, 'utf8')).fileContent;
const lines = text.split('\n');
const entries = [];
let cur = null;
for (const raw of lines) {
  const l = raw.trim();
  const m = /^\*\*(.+?)\*\*$/.exec(l);
  if (m) { cur = { date: m.group ? m.group(1) : m[1], body: [] }; entries.push(cur); }
  else if (cur && l) cur.body.push(l);
}

// Entries run newest-first for the first stretch, so walk down and step the
// year back whenever the month rises again (Nov -> Aug is the same year;
// Jan -> Dec crossed one). But the TAIL of the doc is genuinely out of order —
// "June 17th" is followed by "June 21st", then "November 26th" — so the walk
// stops being trustworthy there. Past that point no year is claimed at all;
// those entries keep their written date and go in as undated, because a year
// derived from a broken sequence would be invented, not read.
const ORDERED_THROUGH = 119;
let y = NEWEST.y, prevM = NEWEST.m;
const out = [];
for (const e of entries) {
  const mm = /^([A-Za-z]+)/.exec(e.date);
  const dd = /(\d{1,2})/.exec(e.date);
  const mi = mm ? MONTHS.indexOf(mm[1].slice(0, 3).toLowerCase()) + 1 : 0;
  const ordered = out.length < ORDERED_THROUGH;
  if (ordered) {
    if (mi && mi > prevM) y -= 1;            // month went up while going back in time
    if (mi) prevM = mi;
  }
  const body = e.body.join('\n\n').trim();
  if (!body) continue;
  const p2 = (n) => String(n).padStart(2, '0');
  // third-person "Sage" means the writer is not Sophie
  const notHers = /\bSage\b/.test(body);
  out.push({
    source: 'shared dream journal',
    id: 'gdoc-shared-' + out.length.toString().padStart(3, '0'),
    sort: ordered && mi ? `${y}-${p2(mi)}-${p2(dd ? Number(dd[1]) : 1)}` : null,
    display: ordered && mi ? `${e.date.trim()}, ${y}` : `${e.date.trim()} — year unknown`,
    dateUncertain: !ordered || !mi || !dd,
    dateNote: ordered ? null : 'this stretch of the journal is out of order, so the year cannot be read from it',
    authorUncertain: !notHers,
    notHers,
    title: null,
    text: body,
    url: DOC_URL,
  });
}
out.sort((a, b) => String(a.sort || '9999').localeCompare(String(b.sort || '9999')));
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('entries:', out.length);
console.log('  definitely someone else (mentions Sage in 3rd person):', out.filter(e => e.notHers).length);
console.log('  author uncertain:', out.filter(e => e.authorUncertain).length);
const dated = out.filter(e => e.sort);
console.log('  dated:', dated.length, '| no year claimed:', out.length - dated.length);
console.log('  range:', dated[0].display, '->', dated[dated.length - 1].display);
const yrs = {};
dated.forEach(e => { yrs[e.sort.slice(0, 4)] = (yrs[e.sort.slice(0, 4)] || 0) + 1; });
console.log('  by year:', JSON.stringify(yrs));
