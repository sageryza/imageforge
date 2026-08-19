// Questions — Sophie's questions, lifted out of a chat's thread and paired
// with the answer that came back (Aug 2026, her ask: "sometimes I ask questions
// to chat and then it's hard to find the answer cause it's buried under other
// stuff").
//
// THIS IS DERIVED, NOT FILED, AND THAT IS THE WHOLE DESIGN. Every other card in
// this app has to be POSTed by the chat that owns it, and the measurements say
// what that costs: 15 of 224 chats had ever written an Update card, 73 of 88
// archived chats showed nothing but a name. A Questions list built the same way
// would be empty for the same reason. The feed already stores her messages
// verbatim (`from:'sophie'`) and every reply beside them, so nothing needs to be
// remembered by anybody — this reads what is already there, works retroactively
// over the whole history, and cannot go stale.
//
// THE ANSWER IS THE REPLY'S OPENING — its TLDR, else its first paragraph. The
// house rules (TLDR first; answer her questions first, once; short by default)
// are what make that the right text. There WAS a companion writing rule here
// for one day — repeat her question verbatim in bold, answer underneath, so
// this file could extract the exact block — and Sophie retired it 2026-08-15:
// chats answered first AND echoed the bold block, so every reply said the same
// thing twice, and the verbatim echo read as clutter. The bold-block path below
// (`boldBlocks`/`matchBlock`) is KEPT: it still gives the day-old replies that
// carry blocks their exact answers, and a reply that naturally structures
// itself that way still benefits. It must never go back to being REQUIRED.
//
// Pure functions only (no Firestore, no network) so the whole thing is testable:
// `node scripts/test-questions.js`.

// ---- Sentence splitting ---------------------------------------------------
// Her messages are VOICE-TO-TEXT — she never types — so they arrive as long
// runs with light punctuation and no formatting. Split on line breaks first,
// then on sentence enders, keeping the ender attached so `?` survives to the
// test below.
function sentences(text) {
  const out = [];
  String(text || '').split(/\n+/).forEach((line) => {
    const parts = line.match(/[^.!?]+[.!?]*/g) || [];
    parts.forEach((p) => {
      const s = p.trim();
      if (s) out.push(s);
    });
  });
  return out;
}

// WITHOUT A QUESTION MARK, ONLY AN AUXILIARY COUNTS — never a wh-word
// (measured 2026-08-14 against 466 real derived questions, after Sophie:
// "most of them aren't even questions"). English inverts the auxiliary only to
// ask, so "Can you make the dashes pink", "do we have a synchronicity lesson"
// and "Are there some I can't see" are all questions with no mark on them. A
// wh-word at the start of an unmarked sentence is usually a RELATIVE CLAUSE,
// and in her dictated transcripts that is exactly what it was: "which I could
// illustrate, like, a pretty big spider creeping up onto this" and "Which he
// goaded himself into, but, um…" both landed in her list as questions. A real
// wh-question still arrives through the question-mark path, which is where 339
// of those 466 came from.
const LEAD = /^(can|could|should|would|do|does|did|is|are)(?![\w'’])/i;
// The case that made this necessary: "I'm wondering if this should be part of
// the message or should be filed separately" — a real question with no question
// mark anywhere in it (her own words, 2026-08-14).
// `my question is` was in this list and had to come out: her message ABOUT this
// feature contained "my question is repeated verbatim and bold", which is her
// describing the format, not asking anything — and it lit up the very first
// sentence of the very first message the list was built from. A framing phrase
// that can also be spoken about a question is not a signal.
const WONDER = /\b(i'?m wondering|i wonder|wondering (?:if|whether|about)|curious (?:if|whether|about)|can you tell me|do you know|any chance)\b/i;

// A QUESTION MARK IS NOT ENOUGH ON ITS OWN. Her messages sometimes carry
// pasted code and quoted spec, and a naive split turned those into "questions"
// reading `?`, `char ?`, `, imageHistory?` and "}`; page api() helper
// auto-injects `pad` into bodies / ?" — eight of them under one answer in the
// Story Room chat (measured 2026-08-14). A question she would recognise as
// hers is a sentence: several words, opening with a word.
const MIN_WORDS = 4;
function looksTyped(s) {
  if (/[`{}=<>|]|\]\(/.test(s)) return false;         // code, markdown links
  if (/^[^A-Za-z"'“]/.test(s)) return false;          // starts with punctuation
  // Words, not tokens: `textContent = on ?` is four things separated by spaces
  // and none of it is a sentence. (That one survived the first pass of this
  // filter and showed up in her list.)
  return s.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length >= MIN_WORDS;
}

function isQuestion(s) {
  const t = String(s || '').trim();
  if (!t || !looksTyped(t)) return false;
  if (/\?\s*$/.test(t)) return true;              // the easy, reliable case
  if (WONDER.test(t)) return true;
  // An auxiliary opening with no question mark. The word floor is already in
  // looksTyped, and it is what keeps "Should be fine." out.
  if (LEAD.test(t)) return true;
  return false;
}

// Every question in one of her messages, verbatim — her words, untouched, which
// is the point ("my question is repeated verbatim and bold").
function findQuestions(text) {
  return sentences(text).filter(isQuestion).map((s) => s.trim()).slice(0, 8);
}

// ---- Pairing a question with its answer -----------------------------------
// A reply written to the house rule opens each answer with the question itself
// on its own line in bold. Pull those out as (heading, body) pairs; the body
// runs to the next bold-only line.
function boldBlocks(reply) {
  const lines = String(reply || '').split('\n');
  const blocks = [];
  let cur = null;
  lines.forEach((line) => {
    const m = line.match(/^\s*\*\*(.+?)\*\*\s*$/);
    if (m) {
      if (cur) blocks.push(cur);
      cur = { q: m[1].trim(), body: [] };
      return;
    }
    if (cur) cur.body.push(line);
  });
  if (cur) blocks.push(cur);
  return blocks.map((b) => ({ q: b.q, body: b.body.join('\n').trim() }))
    .filter((b) => b.body);
}

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'do', 'does', 'did', 'to', 'of', 'in', 'on',
  'it', 'this', 'that', 'and', 'or', 'be', 'i', 'you', 'we', 'my', 'me', 'so', 'if', 'for']);
// A CRUDE STEM, because the exact word rarely survives the round trip: she
// asked "can you make sure you're POSTING the chats up" and the answer says
// "no turn from this repo has ever POSTED". Unstemmed those share nothing, and
// that question scored zero against its own answer — which is how the ten-row
// collapse first kept a transcript fragment instead of the real ask.
function stem(w) {
  return w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, (m, _g, i) => (i >= 3 ? '' : m));
}
function tokens(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem);
}

// Which bold block answers THIS question. Token overlap rather than an exact
// match, because a reply may tidy her dictation ("cause" → "because") while
// still being the same question.
function matchBlock(blocks, question) {
  const qt = tokens(question);
  if (!qt.length) return null;
  let best = null;
  let bestScore = 0;
  blocks.forEach((b) => {
    const bt = new Set(tokens(b.q));
    if (!bt.size) return;
    let hit = 0;
    qt.forEach((w) => { if (bt.has(w)) hit++; });
    const score = hit / qt.length;
    if (score > bestScore) { bestScore = score; best = b; }
  });
  return bestScore >= 0.5 ? best : null;
}

// The first real paragraph of a reply — the last-resort answer when a chat
// wrote neither a bold question block nor a TLDR.
function firstPara(reply) {
  const t = String(reply || '').trim();
  if (!t) return '';
  const para = t.split(/\n\s*\n/)[0] || '';
  return para.replace(/^\s*(tldr|tl;dr)\s*[:—-]\s*/i, '').trim();
}

// An ORPHANED BOLD MARKER (measured 2026-08-14 against her real threads): five
// of the eight answers derived from the fruit-chart chat opened with a literal
// "** — ", because the stored TLDR had lost the words its opening `**` belonged
// to. Unmatched, it renders as two asterisks sitting in front of the answer.
function tidy(s) {
  const t = String(s || '').trim();
  const marks = (t.match(/\*\*/g) || []).length;
  return marks % 2 === 1 ? t.replace(/^\*\*\s*/, '') : t;
}

const ANSWER_CAP = 1200;
function answerFor(reply, tldr, question) {
  const block = matchBlock(boldBlocks(reply), question);
  const raw = tidy((block && block.body) || String(tldr || '').trim() || firstPara(reply));
  return raw.length > ANSWER_CAP ? raw.slice(0, ANSWER_CAP).trim() + '…' : raw;
}

// ---- One answer, one row --------------------------------------------------
// SHE SENDS SEVERAL MESSAGES BEFORE A REPLY LANDS, and every question in that
// run pairs with the same reply. Where that reply has no bold question blocks
// there is only ONE answer to give, so the list showed it over and over —
// measured 2026-08-14: 88 replies were answering more than one question with
// identical text, and those groups alone occupied 267 of the 466 rows. Sophie:
// "all of these questions have the same answer". The worst was ten rows of the
// same paragraph.
//
// So a repeated answer keeps ONE question: the one the answer is most plausibly
// about, by token overlap. On the ten-row group that picked "can you make sure
// you're posting the chats up?" out of nine transcript fragments, which is
// exactly the question that answer was written for.
//
// A reply written to the house rule is untouched by this — each bold block is a
// DIFFERENT answer, so every question keeps its own row.
function collapseSharedAnswers(list) {
  const keep = new Set();
  const groups = new Map();
  list.forEach((q, i) => {
    const key = (q.replyId || '#' + q.at) + ' ' + q.answer;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  groups.forEach((idxs) => {
    if (idxs.length === 1) { keep.add(idxs[0]); return; }
    let best = idxs[0];
    let bestScore = -1;
    idxs.forEach((i) => {
      const q = list[i];
      const at = new Set(tokens(q.answer));
      const qt = tokens(q.question);
      const score = qt.length ? qt.filter((w) => at.has(w)).length / qt.length : 0;
      // Ties go to the question asked LAST before the reply — the operative ask
      // when nothing in the answer distinguishes them.
      if (score > bestScore || (score === bestScore && (list[i].at || '') > (list[best].at || ''))) {
        bestScore = score; best = i;
      }
    });
    keep.add(best);
  });
  return list.filter((_, i) => keep.has(i));
}

// ---- The list -------------------------------------------------------------
// `messages` = one chat's thread in any order; each { id, from, text, tldr,
// created, working }. Her message is `from:'sophie'`; the answer is the next
// message that isn't hers. A live draft (`working`) is still the same doc that
// becomes the finished reply, so it is used as-is — the list simply improves
// when the turn lands.
function buildQuestions(messages) {
  const list = (messages || []).slice().sort((a, b) => (
    (a.created || '') < (b.created || '') ? -1 : (a.created || '') > (b.created || '') ? 1 : 0
  ));
  const out = [];
  list.forEach((m, i) => {
    if ((m.from || '') !== 'sophie') return;
    const qs = findQuestions(m.text);
    if (!qs.length) return;
    let reply = null;
    for (let j = i + 1; j < list.length; j++) {
      if ((list[j].from || '') !== 'sophie') { reply = list[j]; break; }
    }
    qs.forEach((q) => {
      out.push({
        id: m.id || '',
        replyId: (reply && reply.id) || '',
        at: m.created || '',
        answeredAt: (reply && reply.created) || '',
        question: q,
        // No reply yet = an open question, and it belongs in the list saying so
        // rather than being hidden until someone answers.
        answer: reply ? answerFor(reply.text, reply.tldr, q) : '',
      });
    });
  });
  // Newest first — the same order the thread reads in.
  return collapseSharedAnswers(out.reverse());
}

// AN UNANSWERED QUESTION IS NOT SHOWN (Sophie, 2026-08-14: "it shouldn't have
// questions that haven't been answered yet"). She opens the list to FIND an
// answer, so a row with nothing under it is only ever in the way — and the
// commonest one is the question in the message she has just sent, which she
// does not need reminding of. `buildQuestions` still returns them, because
// "which of my questions went unanswered" is a real thing to want later; the
// filter is what the route applies on the way out.
function answeredOnly(list) {
  return (list || []).filter((q) => q && q.answer);
}

module.exports = { sentences, isQuestion, findQuestions, boldBlocks, matchBlock, answerFor,
  collapseSharedAnswers, buildQuestions, answeredOnly };
