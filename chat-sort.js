// chat-sort.js — chats file THEMSELVES into her category folders.
//
// Sophie, 2026-08-15: "right now I've been manually sorting all my chats, but
// I just realized that they could sort themselves in the chats app and that
// could be like a start of turn or end of turn activity. right now I have lots
// of different categories. one is called Meta, which is about chats issues —
// this one would be a Meta chat because we're trying to solve issues within
// the chats app."
//
// WHY THE SERVER DOES IT AND NOT THE CHAT. Her sentence says "start of turn or
// end of turn", which reads as the chat posting its own category the way it
// posts its status card. That is exactly the design that has already failed
// here twice, and it is measured, not guessed: **15 of 224 chats had ever
// posted an Update card**, which is why the Questions button was built DERIVED
// instead of filed. A chat-declared category would be empty for 93% of her
// chats for the same reason, and the ones it missed would be the sleeping ones
// she most wants sorted. So this reads the thread the feed ALREADY stores and
// decides server-side, at the end of a turn — the moment she named, reached
// through the door every chat already walks through (POST /api/chatfeed), with
// nothing to install and nothing for a chat to remember.
//
// THREE RULES, and they are all about not taking something away from her:
//
//   1. HER FILING IS FINAL. `catBy` records who filed a chat. Anything filed
//      from the app is hers (the default — her phone caches the page for days,
//      so a provenance flag only a NEW build sends would mark her own filing
//      as automatic; the safe direction is that everything is hers unless the
//      sorter says otherwise). The sorter only ever writes into an empty
//      field or over its OWN earlier answer, so one tap from her locks a chat
//      forever.
//   2. NONE IS A REAL ANSWER. Filing takes a chat OFF her main list, so a
//      wrong file HIDES something. An unfiled chat costs her nothing. The
//      model is told to answer none whenever it isn't clear, and none does not
//      lock anything — the chat is simply looked at again tomorrow.
//   3. NEVER INVENT A FOLDER. The vocabulary is hers, read live off the
//      registry, and the answer must be one of her names or none. A new folder
//      is a thing she makes.
//
// THE VOCABULARY IS TAUGHT BY HER OWN FILING. Each folder is described to the
// model by the chats she has already put in it (measured 2026-08-15: 96 chats
// filed across 9 folders), so it learns "witch" and "meta" the way she uses
// them rather than the way the words sound — and a folder she invents next
// month starts working as soon as she files two chats into it, with no code
// change and nothing to describe.
//
// TWO OF HER FOLDERS ARE OFF LIMITS. "look at" and "come back to" say WHEN she
// wants something, not what it is. Nothing outside her head can know that a
// chat is one she means to come back to, and guessing would bury real work in
// a to-do folder. The sorter never files into them; she still can.

// The question detector is shared with the Questions button, so a chat asking
// her something reads the same to both surfaces.
const { sentences } = require('./questions');

// Her WHEN folders — see above. Matched case-insensitively.
const TRIAGE = ['look at', 'come back to'];

// A chat needs enough thread to be about something. Under this the honest
// answer is almost always none, so the call is not worth making.
const MIN_MESSAGES = 3;

// How long an unsorted chat rests before it is looked at again. A chat that
// answers none does so because it is thin or genuinely miscellaneous; asking
// again at the end of its every turn would bill her for the same no all day.
const RETRY_MS = 24 * 60 * 60 * 1000;

// ---- WHEN A FILED CHAT IS LOOKED AT AGAIN (Aug 2026, Sophie) ---------------
// "I don't know how often a chat would need to be refiled once it's filed — if
// anything maybe it could ask again if a new branch has started or some other
// intermittent action."
//
// A NEW BRANCH IS NOT THE SIGNAL, and it is worth saying why: a chat's identity
// here is its SESSION, not its branch (see resolveChat) — a session that owns a
// chat posts there forever, whatever its branch says today. So "a new branch"
// either means the same chat carrying on under a renamed branch (nothing has
// changed) or a brand-new session, which is a brand-new unfiled chat anyway.
//
// What actually goes stale is a chat filed EARLY. Three messages in, a thread
// looks like whatever it opened with; two hundred messages later it can be a
// different project entirely — and the sorter's own first answer is the one
// most likely to be wrong, because it was made on the least material. So the
// signal is GROWTH: a chat is looked at again once it has roughly tripled in
// length since it was filed, with a floor so a 3-message chat doesn't re-ask at
// 9. That makes re-checks frequent exactly where the risk is (thin early
// filings) and rare where it isn't (a chat filed with real material behind it).
//
// A WRAP-UP also reopens the question once, whenever it lands: it is the best
// description of the chat that will ever exist, and it means the work is done.
//
// Only the sorter's OWN answers are ever revisited — her filing is final,
// always. And a re-check that comes back "none" LEAVES THE EXISTING FOLDER
// ALONE (see sortChat): unsure is a reason not to move a chat, never a reason
// to unfile one she may have been finding there for weeks.
const RESORT_GROWTH = 3;                          // × its length when filed
const RESORT_MIN_NEW = 20;                        // …and at least this many more
const RESORT_REST_MS = 7 * 24 * 60 * 60 * 1000;   // never more often than weekly

// The `filedAt` a live sort writes when she has never spoken in the chat: a
// stamp older than anything, so the chat is in its folder AND on the main list
// (see filedStamp). Deliberately visible in the data rather than a magic empty
// — a MISSING filedAt means "not filed" and would make the chat vanish.
const BEFORE_EVERYTHING = '1970-01-01T00:00:00.000Z';

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
const isTriage = (c) => TRIAGE.includes(norm(c));

/**
 * The folders the sorter may choose from: the names she has made (`__settings`
 * .categories) plus any name in use on a chat, minus the triage pair.
 *
 * Read live rather than hard-coded, because `CAT_SEEDS` in chats.html is only
 * the two she started with and she has nine now.
 */
function sortableCategories(settings, chats) {
  const out = [];
  const add = (c) => {
    const v = String(c || '').trim();
    if (!v || isTriage(v)) return;
    if (!out.some((x) => norm(x) === norm(v))) out.push(v);
  };
  ((settings && settings.categories) || []).forEach(add);
  Object.keys(chats || {}).forEach((n) => add((chats[n] || {}).category));
  return out;
}

/**
 * What each folder MEANS, in her own filing: up to `per` chat names she has
 * put there herself.
 *
 * Only chats SHE filed teach the vocabulary (`catBy !== 'auto'`). Feeding the
 * sorter's own answers back in would let one early mistake become the
 * definition of a folder — the model would see it as an example and file more
 * like it, and nothing would ever pull it back.
 */
function examplesFor(chats, cats, per = 8) {
  const out = {};
  cats.forEach((c) => { out[c] = []; });
  Object.keys(chats || {}).forEach((n) => {
    const reg = chats[n] || {};
    if (!reg.category || reg.catBy === 'auto' || reg.deletedAt) return;
    const hit = cats.find((c) => norm(c) === norm(reg.category));
    if (!hit || out[hit].length >= per) return;
    out[hit].push(String(reg.displayName || n).slice(0, 60));
  });
  return out;
}

/**
 * Is this chat the sorter's business right now?
 *
 * Pure, and every no is named, so a chat that never gets sorted can be asked
 * why in one call instead of guessed at.
 */
function shouldAutoSort(reg, { now = Date.now(), messages = 0, enabled = true } = {}) {
  const r = reg || {};
  if (!enabled) return { sort: false, why: 'off' };
  if (r.deletedAt) return { sort: false, why: 'deleted' };
  // An archived chat is finished; she has already read it and moved on. Sorting
  // it spends money on a row she is not looking at.
  if (r.archived) return { sort: false, why: 'archived' };
  // SHE SAID LEAVE IT UNFILED — and that is a decision, not an absence (Aug
  // 2026, with the review page's picker: "leave unfiled" is one of her three
  // answers). Without this the sorter would look at the chat again tomorrow
  // and file it anyway, which is rule 1 broken in the one direction the
  // `category` field cannot record — an empty folder looks identical to never
  // having been asked.
  if (r.catNone) return { sort: false, why: 'hers-unfiled' };
  if (r.category) {
    if (r.catBy !== 'auto') return { sort: false, why: 'hers' };  // rule 1 — one tap locks it
    // Its own earlier answer, revisited — see the RESORT_* block above. The
    // rest period is checked FIRST and reads only the registry, so the caller
    // can ask this question before paying for a thread read: an auto-filed
    // chat costs nothing at all on the six days a week it is resting.
    const wrapped = Boolean(r.wrapUpAt && r.catSortedAt && r.wrapUpAt > r.catSortedAt);
    const sortedAt = Date.parse(r.catSortedAt || '');
    const rested = isNaN(sortedAt) || now - sortedAt >= RESORT_REST_MS;
    if (!rested && !wrapped) return { sort: false, why: 'already-sorted' };
    if (wrapped) return { sort: true, why: 'wrapped-up' };
    const was = Number(r.catMsgs) || 0;
    const grew = messages >= Math.max(was * RESORT_GROWTH, was + RESORT_MIN_NEW);
    return grew ? { sort: true, why: 're-sort' } : { sort: false, why: 'not-grown' };
  }
  if (messages < MIN_MESSAGES) return { sort: false, why: 'too-thin' };
  const tried = Date.parse(r.catTriedAt || '');
  if (!isNaN(tried) && now - tried < RETRY_MS) return { sort: false, why: 'cooling-off' };
  return { sort: true, why: 'sortable' };
}

/**
 * The `filedAt` stamp for a LIVE sort — and the whole reason auto-sorting does
 * not swallow the answer it was triggered by.
 *
 * `filedAt` is what the app's pop-out reads: a chat rejoins the main list when
 * a reply lands AFTER it ("it's been a problem when chats are in stories and
 * they don't pop out back into the main list when they're done"). A sort runs
 * at the end of a turn, so stamping NOW would mean the chat filed itself the
 * instant it finished answering her and dropped off the list she reads. So it
 * is stamped at HER last message instead — "filed as of when she last spoke" —
 * and the reply that just landed pops it straight back out. She sees the
 * answer on her main list exactly as before, and the folder gains a member.
 *
 * A BACKFILL passes its own stamp (now) on purpose: those are old chats she
 * would have filed by hand, and filing by hand means "out of my way today".
 */
function filedStamp(reg) {
  const r = reg || {};
  return r.lastHerAt || BEFORE_EVERYTHING;
}

// The thread, cheaply. The OPENING says what the chat is for and the CLOSING
// says what it became — the long middle is the work, which costs tokens
// without moving the answer. Same shape as the archive summary's digest, so a
// 300-message chat bills like a short one.
function digestOf(msgs, { head = 2, tail = 4, per = 400, cap = 4000 } = {}) {
  const list = (msgs || []).map((m) => (m.from === 'sophie' ? 'Sophie: ' : 'Chat: ')
    + String((m && m.text) || '').replace(/\s+/g, ' ').slice(0, per)).filter((s) => s.length > 8);
  const a = list.slice(0, head);
  const b = list.length > head ? list.slice(-tail) : [];
  return (a.join('\n\n') + (b.length ? '\n\n[…]\n\n' + b.join('\n\n') : '')).slice(0, cap);
}

// ---- IS THIS CHAT FINISHED? (Aug 2026, Sophie) -----------------------------
// "I'm wondering if it would be easy to flag which ones should be archived —
// based on whether there was a feature that was built that was basically
// complete, or if we were in the middle of something. Things to look for would
// be if there was something that simply couldn't be done for whatever reason,
// or if there was a question I just forgot to answer."
//
// Two halves, and only one of them is a judgment:
//
//   THE QUESTION SHE FORGOT TO ANSWER IS DERIVED, NOT GUESSED. `buildQuestions`
//   already pairs every question in a thread with the reply that followed it,
//   over the WHOLE conversation — so an unanswered one is a fact about the
//   transcript, not a model's impression of it. Same choice the archive
//   summary made for the same reason, and it is what keeps this flag honest:
//   "needs you" only ever names a question that provably went unanswered.
//
//   WHETHER THE WORK LANDED is a judgment, so the model makes it: done (the
//   thing was built and works), mid (stopped in the middle), or blocked
//   (something could not be done and the chat stopped there).
//
// An open question OUTRANKS everything — a finished feature with a question of
// hers hanging in it is not a chat to archive, it is a chat to answer. That is
// the case she named first, so it wins.
//
// NOTHING HERE ARCHIVES ANYTHING. She asked to be shown which ones, and
// archiving is hers to do — a wrong archive puts real work behind a pile she
// does not read.
function archiveHint({ state, pendingAsk = '' } = {}) {
  if (pendingAsk) return 'needs you';
  if (state === 'done') return 'archive';
  if (state === 'blocked') return 'dead end';
  return 'keep';
}

/**
 * The question SHE forgot to answer — the chat asked her something and she
 * never came back.
 *
 * THE FIRST VERSION HAD THIS BACKWARDS and the measurement is what caught it:
 * it looked for questions of HERS with no reply (`buildQuestions`, `!q.answer`)
 * and flagged **0 of 86 chats**, because a chat always answers — that pairing
 * can only ever come up empty on a live thread. Her sentence is the other
 * direction: "if there was a question I just forgot to answer" is the chat
 * waiting on HER, which is exactly why such a chat is not finished.
 *
 * It stays DERIVED rather than judged, because the proof is structural: her
 * answer would be a message from her AFTER the question, so a question in the
 * thread's LAST message with nothing behind it is unanswered by construction.
 *
 * Only the CLOSING section of that message is searched — `tail` is the offset
 * of the turn's last tool call, so text[tail…] is the rundown a chat writes at
 * the end, which is where it actually asks her something. Prose in the middle
 * of a work narration is full of rhetorical questions, and reading those would
 * flag half her chats as owing her an answer.
 *
 * AND IT REQUIRES A LITERAL "?", which `isQuestion` deliberately does not.
 * That detector is tuned for HER — she dictates and her questions often carry
 * no question mark at all — so it leans on a leading auxiliary, and "Did all
 * the work here." trips it. A chat writes markdown and always punctuates, so
 * the mark is free here and it is what separates a real ask from a sentence
 * that merely opens with "did".
 */
function pendingAsk(msgs, { fallbackChars = 800 } = {}) {
  const list = msgs || [];
  const last = list[list.length - 1];
  if (!last || last.from === 'sophie') return '';   // she spoke last — nothing owed
  if (last.working) return '';                      // still writing; it hasn't asked yet
  const text = String(last.text || '');
  const t = Number(last.tail);
  const cut = Number.isFinite(t) && t > 0 && t < text.length
    ? t : Math.max(0, text.length - fallbackChars);
  // Split the WHOLE message, then keep the sentences that END at or after the
  // cut — never slice the string itself. `tail` is a raw character offset and
  // lands mid-word ("Re|ady for the next batch?"), and a fragment starting a
  // slice reads to the sentence splitter as its own sentence. Keeping the
  // straddler is deliberate: a sentence that runs across the boundary is part
  // of the closing, not of the work above it.
  let pos = 0;
  const closing = sentences(text).filter((sn) => {
    const at = text.indexOf(sn, pos);
    if (at < 0) return false;
    pos = at + sn.length;
    return pos >= cut;
  });
  const qs = closing.filter((x) => /\?\s*$/.test(x));
  return qs.length ? String(qs[qs.length - 1]).replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

const SORT_SYS = `You file one of Sophie's Claude chats into one of HER OWN folders, or you leave it alone, and you say whether the work in it finished.

Return JSON: {"category": "...", "why": "...", "state": "...", "stateWhy": "..."}

"category": EXACTLY one of the folder names you are given, copied character for character, or "none".
"why": under 90 characters, plain, what the chat is actually about. Never a sales pitch for the folder you picked.
"state": one of "done", "mid", "blocked".
  "done" — what she asked for was built, shipped or settled, and the chat ran out of work rather than stopping.
  "mid" — it stopped in the middle of something: a half-built feature, a plan nobody carried out, work still clearly in flight.
  "blocked" — it stopped because something could not be done: a limit nobody could get past, a tool that does not exist, an approach that failed and was not replaced.
"stateWhy": under 90 characters, what was finished or what it stopped on. Concrete — name the thing, not "the work".

The folders are hers. You are matching a chat to how SHE already uses them — the chats she has filed in each one are the definition, not the words in the name. Never invent a folder, never merge two, never answer with a name that is not on the list.

Answer "none" whenever it is not clear. Filing a chat takes it off the main list where she looks for things, so a wrong folder hides real work, while an unfiled chat costs her nothing and gets looked at again tomorrow. A chat that spans two folders, a chat that is mostly her thinking out loud, a one-off question, a thread too short to have a subject — all "none". Being unsure is the ordinary case, not a failure.`;

/**
 * The call, as text. Split out from the network so the whole decision is
 * testable without a key.
 */
function buildSortPrompt({ name, reg, msgs, cats, examples }) {
  const r = reg || {};
  const ex = examples || {};
  const folders = (cats || []).map((c) => {
    const list = (ex[c] || []).map((n) => '"' + n + '"');
    return '- ' + c + (list.length
      ? ' — she has filed: ' + list.join(', ')
      // A folder with nothing in it is one she has just MADE, on purpose — the
      // first version said "prefer none" here and that is backwards: it would
      // suppress the folder she asked for until something else filled it.
      : ' — (a new folder, nothing filed in it yet — go by the name)');
  }).join('\n');
  const bits = [
    'Chat name: ' + String(r.displayName || name || '').slice(0, 80),
  ];
  // Everything the registry already knows about the chat, free. Her own note
  // is the strongest single signal there is — it is what she calls the thing.
  if (r.sophieNote) bits.push("Sophie's note on it: " + String(r.sophieNote).slice(0, 200));
  if (r.statusDoing) bits.push('What it says it is doing: ' + String(r.statusDoing).slice(0, 200));
  if (r.statusNeed) bits.push('What it says it needs: ' + String(r.statusNeed).slice(0, 200));
  if (r.wrapLine) bits.push('Its wrap-up line: ' + String(r.wrapLine).slice(0, 200));
  const user = 'Sophie\'s folders, and the chats she filed in each:\n' + folders
    + '\n\n---\n\n' + bits.join('\n')
    + '\n\nThe conversation:\n\n' + digestOf(msgs);
  return { system: SORT_SYS, user };
}

/**
 * Read the model's answer back into one of her folder names.
 *
 * Case- and whitespace-tolerant on the way in (the model echoes "Meta" for
 * "meta"), but the value RETURNED is always her spelling, because that string
 * is the key every chip, count and filter on the page joins on.
 */
function pickState(out) {
  const v = norm(out && typeof out === 'object' ? out.state : out);
  return ['done', 'mid', 'blocked'].includes(v) ? v : 'mid';   // unsure = still in flight
}

function pickCategory(out, cats) {
  const raw = norm(out && typeof out === 'object' ? out.category : out);
  if (!raw || raw === 'none' || raw === 'null' || raw === 'unfiled') return '';
  const hit = (cats || []).find((c) => norm(c) === raw);
  return hit || '';                       // rule 3 — anything invented is a no
}

module.exports = {
  TRIAGE, MIN_MESSAGES, RETRY_MS, BEFORE_EVERYTHING, SORT_SYS,
  RESORT_GROWTH, RESORT_MIN_NEW, RESORT_REST_MS,
  sortableCategories, examplesFor, shouldAutoSort, filedStamp, archiveHint, pickState, pendingAsk,
  digestOf, buildSortPrompt, pickCategory,
};
