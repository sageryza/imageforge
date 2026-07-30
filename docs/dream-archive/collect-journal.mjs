// Pull the dream-banded entries out of the scanned-journal timeline.
//
// Source of truth: memory-library-react/public/timeline/index.html — the
// deployed copy, post-#245 recategorisation. (The ios-journal copy is stale,
// though its dream band happens to be identical.)
//
// The entries carry NO year — only "Aug 11". Sophie confirmed the journals run
// February 2024 → July 2025, and the band wraps Dec→Jan exactly once, so the
// year comes from which side of that wrap a page falls on. Every date is still
// marked uncertain: no entry states its own year, so these are placed, not read.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = '/home/user/memory-library-react/public/timeline/index.html';
const OUT = path.join(HERE, 'source-journal.json');

// The one Dec→Jan turnover sits between page 632 (Dec 21) and page 710 (Jan 15).
const WRAP_PAGE = 669;
const YEAR_BEFORE = 2024, YEAR_AFTER = 2025;
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const html = fs.readFileSync(SRC, 'utf8');
const start = html.indexOf('const sections=[');
if (start < 0) throw new Error('sections array not found');
// Scan string-aware: the entry text contains stray brackets and apostrophes,
// so a naive bracket count ends the array in the middle of a sentence.
const open = html.indexOf('[', start);
let depth = 0, end = -1, quote = null;
for (let i = open; i < html.length; i++) {
  const c = html[i];
  if (quote) {
    if (c === '\\') { i++; continue; }
    if (c === quote) quote = null;
    continue;
  }
  if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
  if (c === '[') depth++;
  else if (c === ']' && --depth === 0) { end = i + 1; break; }
}
if (end < 0) throw new Error('unterminated sections array');
// It is valid JavaScript, so let JS parse it rather than regexing quotes.
const entries = new Function('return ' + html.slice(open, end))();

const dreams = entries.filter(e => e && e.type === 'dreams').map(e => {
  const raw = String(e.date || '').trim();
  const year = e.page < WRAP_PAGE ? YEAR_BEFORE : YEAR_AFTER;
  const m = /^([A-Za-z]{3,})\.?\s*(\d{1,2})?$/.exec(raw);
  const month = m ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1 : 0;
  const day = m && m[2] ? Number(m[2]) : null;
  const p2 = n => String(n).padStart(2, '0');
  return {
    source: 'journal',
    id: 'jrnl-p' + String(e.page).padStart(4, '0'),
    page: e.page,
    dateRaw: raw || null,
    // day defaults to the 1st for ORDERING only; never shown as fact
    sort: month ? `${year}-${p2(month)}-${p2(day || 1)}` : `${year}-00-00`,
    display: (m && day ? `${m[1]} ${day}, ${year}` : month ? `${m[1]} ${year}` : `${year}`),
    dateUncertain: true,               // no year exists in the data, anywhere
    dayUncertain: !day,                // e.g. the month-only "June" entry
    title: null,                        // journal dreams are untitled
    text: String(e.text || ''),
    incomplete: /\(missing/.test(String(e.text || '')),
    illustration: null,
    audio: null,
  };
}).sort((a, b) => a.sort.localeCompare(b.sort) || a.page - b.page);

fs.writeFileSync(OUT, JSON.stringify(dreams, null, 1));
console.log('journal dreams:', dreams.length);
console.log('  month-only (no day):', dreams.filter(d => d.dayUncertain).length);
console.log('  flagged incomplete in their own text:', dreams.filter(d => d.incomplete).length);
console.log('  range:', dreams[0].display, '->', dreams[dreams.length - 1].display);
console.log('  pages:', dreams[0].page, '->', dreams[dreams.length - 1].page);
