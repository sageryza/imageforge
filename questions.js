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
// SHE FLAGS A QUESTION WITH THE WORD "QUESTION" — NOTHING ELSE REACHES THE TAB
// (2026-08-23, Sophie: "get rid of the directions for chats to bold question
// answers. it ONLY applies if i use the word question in my text eg i have a
// question, or my question is: or 'quick question' etc. THEN it's bolded and
// put in the questions tab").
//
// This is the third shape of the same feature, and the first one that asks HER
// instead of guessing. The detector below was tuned twice against her real
// threads and still could not tell a question from a dictated aside: the first
// pass produced 466 rows she looked at and said "most of them aren't even
// questions", and the wh-word and code-fragment rules further down are what was
// left after cutting the worst of them. The reason is structural, not a tuning
// miss — **she dictates**, so her questions carry no question mark and her
// statements open with auxiliaries, and no heuristic separates "Can you make
// the dashes pink" from "Can't wait to see it" reliably enough for a list she
// trusts. One word from her settles it for free, and she is already saying it.
//
// So `findQuestions` returns NOTHING at all unless her message carries the word
// `question` (`flagsQuestion`). Inside a flagged message the old sentence-level
// heuristics still pick which sentence is the ask — a false positive there
// costs one extra row in a message that really was about a question, which is a
// different order of problem from filing her whole transcript.
//
// AND THE FLAG IS WHAT BRINGS THE BOLD ECHO BACK. A blanket "repeat her
// question verbatim in bold" rule shipped for one day (2026-08-14→15) and
// Sophie retired it: chats answered her question first AND echoed the bold
// block, so every reply said the same thing twice, and the verbatim echo of her
// dictation read as clutter. It is worth its space again now, because it fires
// only on the handful of messages she deliberately marked — and the block is
// what gives THIS file the exact answer to file, instead of the reply's opening
// paragraph and a hope (`boldBlocks`/`matchBlock`, which stay the first source
// `answerFor` tries).
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
// `my question is` was in this list and had to come out, because on an UNGATED
// list a framing phrase that can also be spoken ABOUT a question is not a
// signal: her message describing this very feature said "my question is
// repeated verbatim and bold" and it lit up the first row of the first list.
// It lives in `ASKING` now instead — that runs only inside a message she
// deliberately marked, where the same phrase means what it says.
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

// ---- Her flag ---------------------------------------------------------------
// THE GATE IS THE WORD ITSELF, not a phrase list. Her sentence was "if i use the
// word question in my text", and the three shapes she gave — "i have a
// question", "my question is:", "quick question" — are examples of saying it,
// not a vocabulary to match. A phrase list would silently drop the fourth way
// she says it, and the failure would be invisible: a question she marked simply
// never appears, with nothing on screen admitting why.
//
// The cost is the other direction, and it is worth naming: a message ABOUT
// questions trips it — this feature's own conversation would. That is one stray
// row in a message that really was about a question, and an unanswered one is
// never listed anyway (`answeredOnly`).
const FLAG = /\bquestions?\b/i;
function flagsQuestion(text) {
  return FLAG.test(String(text || ''));
}

// The asking phrases, used ONLY to decide WHICH sentence of a flagged message is
// the ask — never to decide whether the message counts. They exist because her
// commonest shape carries no other signal at all: "quick question, can you make
// the dashes pink" has no mark and opens on a noun, so every heuristic below
// misses it.
const ASKING = /\b(?:i\s+(?:have|had|got)\s+(?:a|an|another|one|two|three|some|a\s+few|a\s+couple(?:\s+of)?)?\s*\w*\s*questions?|my\s+questions?\s+(?:is|are)|(?:quick|dumb|small|silly|random|serious|last|final|one\s+more|another)\s+questions?|questions?\s+for\s+(?:you|u)|questions?\s*[:—-])/i;

// Is the ask IN the framing sentence, or is the framing a sentence of its own?
// "my question is whether the tabs should be pink" carries it; "I have a
// question." does not, and filing that as a row would put a heading in her list
// where the question belongs. Three words after the phrase is the floor — the
// same shape of floor `looksTyped` uses, for the same reason.
function carriesAsk(s) {
  const m = ASKING.exec(s);
  if (!m) return false;
  const rest = s.slice(m.index + m[0].length);
  return rest.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length >= 3;
}

// Every question in one of her messages, verbatim — her words, untouched, which
// is the point ("my question is repeated verbatim and bold").
function findQuestions(text) {
  if (!flagsQuestion(text)) return [];      // she did not mark this one
  const ss = sentences(text);
  const out = [];
  const add = (s) => {
    const t = String(s || '').trim();
    if (t && looksTyped(t) && out.indexOf(t) < 0) out.push(t);
  };
  ss.forEach((s, i) => {
    if (ASKING.test(s)) {
      // Bare framing ("I have a question." / "Quick question.") hands the row to
      // the sentence AFTER it, whatever that sentence looks like — she has just
      // said in her own words that what follows is a question, and that beats
      // any test this file could run on it.
      if (carriesAsk(s)) add(s);
      else if (ss[i + 1] && !ASKING.test(ss[i + 1])) add(ss[i + 1]);
      return;
    }
    if (isQuestion(s)) add(s);
  });
  return out.slice(0, 8);
}

// ---- Pairing a question with its answer -----------------------------------
// A reply written to the house rule repeats each FLAGGED question on its own
// line in bold and answers underneath. Pull those out as (heading, body) pairs;
// the body runs to the next bold-only line. This is the first source
// `answerFor` tries, and since Aug 2026 it is the one a chat is asked to
// produce — but it stays OPTIONAL in code: a reply that answered plainly still
// files its opening, so a chat on an older rule never leaves a row blank.
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
//
// IT MUST LAND SINGULAR AND PLURAL ON THE SAME ROOT (2026-08-23, found on a
// live row): the old version stripped "es" whole, so her "images" became
// `imag` while the reply's "image" stayed `image`, and "sizes"/`siz` never met
// "size"/`size` — two real hits lost on the exact paragraph that answered her.
// So: -ies → y, then -ing/-ed, then a single plural -s, then a trailing silent
// -e — applied to BOTH sides by the same function, so "image(s)" → `imag` and
// "size(s)" → `siz` whichever form each side used. The roots are ugly and that
// is fine; they are compared, never shown.
function stem(w) {
  let t = w.replace(/ies$/, 'y');
  if (t.length > 4) t = t.replace(/(ing|ed)$/, '');
  if (t.length > 3 && /[^s]s$/.test(t)) t = t.slice(0, -1);
  if (t.length > 3 && t.endsWith('e')) t = t.slice(0, -1);
  return t;
}
// A SHORT TOKEN WITH A DIGIT IN IT IS KEPT (2026-08-23): "2k", "4k" and their
// kind are the most load-bearing words in her size/version questions, and the
// three-letter floor was throwing them away — the question "are 2k and 4k the
// only sizes" lost its two most distinctive words before scoring began.
function tokens(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => (w.length > 2 || (w.length === 2 && /\d/.test(w))) && !STOP.has(w))
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

// THE ANSWER CAN LIVE ANYWHERE IN THE REPLY — score every paragraph against
// the question and take the one that talks about it (2026-08-23, Sophie,
// looking at a row that opened on progress lines: "did u check the answer? it
// didn't actually answer the question. ull have to be smarter about this whole
// thing").
//
// The row that earned this: her "are 2k and 4k the only sizes or are there in
// between sizes" was answered with the reply's opening — "Now the size tiers
// on the server:" — while the reply's FIFTH paragraph literally begins "**2K
// and 4K are not the only sizes — it's continuous.**" The opening-only
// fallback assumed the answer-first house rule always holds; on a working
// turn's reply it often doesn't, and no amount of reading FORWARD from the top
// fixes an answer that lives in the middle.
//
// So this is `matchBlock` without the bold requirement: split the reply into
// paragraphs, count how many of the question's own content words each one
// carries, and hand back the best — the TLDR competes as a candidate too, so
// a summary that really is the answer still wins. Free, derived, no model
// call, exactly like everything else in this file.
//
// THE GUARDS ARE WHAT KEEP IT HONEST:
//   • at least 3 DISTINCT question words must hit — two shared words is a
//     coincidence ("answer" + "question" appear together in half her threads),
//     three is the paragraph being about her subject;
//   • the score's denominator is capped at 8, because her dictated questions
//     run long ("if I were to print one of the normal images at the original
//     size 1500 or whatever, let's say I printed it on legalize paper, how
//     soft would it be") and an uncapped fraction buries a real 4-word match
//     under 13 words of framing;
//   • a winner ending in a colon pulls the next paragraph up with it — the
//     same lead-in rule `firstPara` follows;
//   • below the bar it returns null and the old chain (tldr → opening) runs
//     unchanged, so nothing already right moves.
const PARA_MIN_HITS = 3;
const PARA_DENOM_CAP = 8;
function bestParagraph(reply, tldr, question) {
  const qt = Array.from(new Set(tokens(question)));
  if (qt.length < PARA_MIN_HITS) return null;
  const paras = String(reply || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const cands = [];
  const t = String(tldr || '').trim();
  if (t) cands.push({ text: t, i: -1 });
  paras.forEach((p, i) => cands.push({ text: p, i }));
  let best = null;
  let bestScore = 0;
  cands.forEach((c) => {
    const pt = new Set(tokens(c.text));
    let hit = 0;
    qt.forEach((w) => { if (pt.has(w)) hit++; });
    if (hit < PARA_MIN_HITS) return;
    const score = hit / Math.min(qt.length, PARA_DENOM_CAP);
    // Ties keep the EARLIEST candidate — the answer-first rule as a tiebreak.
    if (score > bestScore) { bestScore = score; best = c; }
  });
  if (!best || bestScore < 0.5) return null;
  if (best.i >= 0 && /:\s*$/.test(best.text) && paras[best.i + 1]) {
    return best.text + '\n\n' + paras[best.i + 1];
  }
  return best.text;
}

// The opening of a reply — the last-resort answer when a chat wrote neither a
// bold question block nor a TLDR nor any paragraph that scores against the
// question.
//
// A PARAGRAPH ENDING IN A COLON IS AN INTRODUCTION, NOT AN ANSWER, so it keeps
// reading (found live 2026-08-23 in her Questions tab, two of the three rows on
// one chat). Both failures were the same shape:
//
//   "…The bigger one I skipped is the difference between **ChatGPT the app**
//    and what we call:"                     ← the whole row, ending on a colon
//   "Now the size tiers on the server:"     ← a mid-turn progress line
//
// The answer in each case was in the paragraph the colon was introducing, and
// stopping at the first paragraph threw it away — so the row read as a fragment
// that answered nothing. Neither reply carried a TLDR, which is what put this
// path in play at all.
//
// IT ONLY EVER READS FURTHER — it never DROPS a paragraph. A leading progress
// line and a real lead-in ("Two things:") are the same shape, and no honest
// test tells them apart; keeping both is noisy in one case and correct in the
// other, where dropping is wrong in one and right in the other. THREE is the
// stop, so a reply that is nothing but colon-ended headings cannot swallow
// itself whole.
//
// Going forward this path matters less, not more: a question SHE marked gets a
// bold echo (see the header), and `matchBlock` hands back the exact answer
// before this ever runs. It is the fallback for the replies already on file and
// for a chat that answered plainly.
const LEAD_IN = /:\s*$/;
const MAX_PARAS = 3;
function firstPara(reply) {
  const t = String(reply || '').trim();
  if (!t) return '';
  const paras = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < paras.length && out.length < MAX_PARAS; i++) {
    out.push(paras[i]);
    if (!LEAD_IN.test(paras[i])) break;
  }
  return out.join('\n\n').replace(/^\s*(tldr|tl;dr)\s*[:—-]\s*/i, '').trim();
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
// The chain, most specific first: the bold block a reply wrote for THIS
// question → the paragraph that scores against it (`bestParagraph` — the TLDR
// competes inside that) → the TLDR → the reply's opening.
function answerFor(reply, tldr, question) {
  const block = matchBlock(boldBlocks(reply), question);
  const raw = tidy((block && block.body)
    || bestParagraph(reply, tldr, question)
    || String(tldr || '').trim()
    || firstPara(reply));
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
//
// A message she never flagged contributes nothing (see `flagsQuestion`), so
// this runs over the whole history and answers "the questions I MARKED" rather
// than "every sentence that parsed like one". Nothing was migrated: the list is
// derived on every read, so the change reaches every chat's whole past at once.
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

module.exports = { sentences, isQuestion, flagsQuestion, findQuestions, boldBlocks, matchBlock,
  bestParagraph, answerFor, collapseSharedAnswers, buildQuestions, answeredOnly };
