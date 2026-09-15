// md-to-docx — turn one of this repo's script/plan markdown files into a .docx
// she can download and read off her phone.
//
//   npm install docx            (not a repo dependency — install it on demand)
//   node scripts/md-to-docx.js docs/christmas-commercial/SCRIPTS.md out.docx
//
// Written 2026-09-15 for the Christmas commercial scripts (Sophie: "give us a
// doc to download also"). It is deliberately NOT a general markdown parser —
// it handles the shapes our script docs actually use, and three of those
// shapes are the whole reason it exists:
//
//   - a bare `>` between quoted lines is a paragraph break INSIDE one quote,
//     not a line reading ">" (that shipped once and looked like a typo);
//   - a quoted line starting with a SPEAKER LABEL (`LAWYER:`, `SANTA (V.O.):`,
//     `VO:`, `SUPER:`) starts its own paragraph, or the deposition's dialogue
//     runs together into one unreadable block;
//   - a `1. ` line is its own paragraph — joining them turned the whole
//     running order into a single grey slab.
//
// Verify by extracting the text back out rather than by eye — LibreOffice
// cannot open a docx in this sandbox (it fails on a one-paragraph file too),
// so `soffice --convert-to pdf` is not available as a check here.
const fs = require('fs');
const d = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        PageOrientation, LevelFormat, BorderStyle, TabStopType } = d;

const IN = process.argv[2];
const OUT = process.argv[3];
if (!IN || !OUT) { console.error('usage: node scripts/md-to-docx.js <in.md> <out.docx>'); process.exit(2); }
const src = fs.readFileSync(IN, 'utf8');
const SERIF = 'Georgia', SANS = 'Arial';

// inline **bold** / *italic* / `code` -> TextRun[]
function runs(text, base={}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ ...base, text: text.slice(last, m.index) }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ ...base, text: t.slice(2,-2), bold: true }));
    else if (t.startsWith('`')) out.push(new TextRun({ ...base, text: t.slice(1,-1), font: 'Courier New', size: (base.size||22)-2 }));
    else out.push(new TextRun({ ...base, text: t.slice(1,-1), italics: true }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ ...base, text: text.slice(last) }));
  return out.length ? out : [new TextRun({ ...base, text: '' })];
}

const kids = [];
const lines = src.split('\n');

// group consecutive non-blank lines of the same kind into one paragraph
function kindOf(l) {
  if (/^#{1,3} /.test(l)) return 'h';
  if (/^>/.test(l)) return 'q';
  if (/^[-*] /.test(l)) return 'li';
  if (/^\d+\. /.test(l)) return 'ol';
  if (/^---\s*$/.test(l)) return 'hr';
  if (l.trim() === '') return 'blank';
  return 'p';
}

let buf = [], bufKind = null;
function flush() {
  if (!buf.length) return;
  const k = bufKind, text = buf.join(' ').replace(/\s+/g,' ').trim();
  buf = []; bufKind = null;
  if (!text) return;
  if (k === 'h') {
    const lvl = (text.match(/^#+/)||['#'])[0].length;
    const t = text.replace(/^#+\s*/,'');
    if (lvl === 1) {
      kids.push(new Paragraph({ children: runs(t, { font: SERIF, size: 44, bold: true }),
        spacing: { after: 240 }, alignment: AlignmentType.CENTER }));
    } else if (lvl === 2) {
      kids.push(new Paragraph({ children: runs(t.toUpperCase(), { font: SANS, size: 26, bold: true, characterSpacing: 20 }),
        spacing: { before: 400, after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 6, color: '999999' } },
        keepNext: true }));
    } else {
      kids.push(new Paragraph({ children: runs(t, { font: SANS, size: 22, bold: true }),
        spacing: { before: 260, after: 120 }, keepNext: true }));
    }
    return;
  }
  if (k === 'q') {
    const t = text.replace(/^>\s?/,'').replace(/\s*>\s?/g,' ').trim();
    if (!t) return;
    kids.push(new Paragraph({ children: runs(t, { font: SERIF, size: 24 }),
      indent: { left: 720, right: 720 }, spacing: { before: 80, after: 160 },
      border: { left: { style: BorderStyle.SINGLE, size: 10, space: 12, color: 'C0392B' } } }));
    return;
  }
  if (k === 'ol') {
    kids.push(new Paragraph({ children: runs(text, { font: SERIF, size: 22 }),
      indent: { left: 460, hanging: 240 }, spacing: { after: 90 } }));
    return;
  }
  if (k === 'li') {
    const t = text.replace(/^[-*]\s+/,'');
    kids.push(new Paragraph({ children: runs(t, { font: SERIF, size: 22 }),
      bullet: { level: 0 }, spacing: { after: 80 } }));
    return;
  }
  if (k === 'hr') {
    kids.push(new Paragraph({ text: '', spacing: { before: 120, after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 4, color: 'CCCCCC' } } }));
    return;
  }
  kids.push(new Paragraph({ children: runs(text, { font: SERIF, size: 22 }), spacing: { after: 140 } }));
}

for (const raw of lines) {
  const l = raw.replace(/\s+$/,'');
  const k = kindOf(l);
  if (k === 'blank') { flush(); continue; }
  if (k === 'hr') { flush(); buf = ['---']; bufKind = 'hr'; flush(); continue; }
  if (k === 'h') { flush(); buf = [l]; bufKind = 'h'; flush(); continue; }
  if (k === 'li' || k === 'ol') { flush(); buf = [l]; bufKind = k; flush(); continue; }
  if (k === 'q' && /^>\s*$/.test(l)) { flush(); continue; }
  // a speaker label starts its own line in a script
  if (k === 'q' && /^>\s*[A-Z][A-Z0-9 .'\u2019()\/-]*:/.test(l)) { flush(); bufKind = 'q'; buf.push(l); continue; }
  if (bufKind && bufKind !== k) flush();
  bufKind = bufKind || k;
  buf.push(l);
}
flush();

const doc = new Document({
  numbering: { config: [{ reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 240 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 } } },
    children: kids,
  }],
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(OUT, b);
  console.log('wrote', OUT, b.length, 'bytes,', kids.length, 'paragraphs');
});
