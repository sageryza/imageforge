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
// The companion half is a WRITING rule in CLAUDE.md: a reply repeats her
// question verbatim in bold with the answer plainly underneath. That is what
// makes the pairing below exact rather than a guess — without it we fall back to
// the TLDR, which by house rule already answers the question first.
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

// A lead word only counts at the START of a sentence, and never as its
// contraction: "Can't wait" and "Should be fine" are not questions, "Can you
// build it" and "Should we do the blue one" are. The lookahead kills the
// apostrophe forms; the word-count floor below kills the short assertions that
// happen to open with one of these words.
const LEAD = /^(what|why|how|when|where|who|which|whose|can|could|should|would|do|does|did|is|are)(?![\w'’])/i;
// The case that made this necessary: "I'm wondering if this should be part of
// the message or should be filed separately" — a real question with no question
// mark anywhere in it (her own words, 2026-08-14).
// `my question is` was in this list and had to come out: her message ABOUT this
// feature contained "my question is repeated verbatim and bold", which is her
// describing the format, not asking anything — and it lit up the very first
// sentence of the very first message the list was built from. A framing phrase
// that can also be spoken about a question is not a signal.
const WONDER = /\b(i'?m wondering|i wonder|wondering (?:if|whether|about)|curious (?:if|whether|about)|can you tell me|do you know|any chance)\b/i;

function isQuestion(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  if (/\?\s*$/.test(t)) return true;              // the easy, reliable case
  if (WONDER.test(t)) return true;
  // A lead word with no question mark needs some length behind it, or every
  // "Should be fine." lands in her list as a question she never asked.
  if (LEAD.test(t) && t.split(/\s+/).length >= 4) return true;
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
function tokens(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
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
  return out.reverse();
}

module.exports = { sentences, isQuestion, findQuestions, boldBlocks, matchBlock, answerFor, buildQuestions };
