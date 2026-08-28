// Push gate — WHICH finished reply is worth a buzz (Aug 2026, Sophie: "Deck
// Factory notifies me with the push notification whenever I send a message. I
// don't need a notification when I send a message. I need a notification when
// they respond to my message").
//
// Until now every finished reply pushed, debounced to one per chat per 10
// minutes and one globally per 60s. That is "a chat said something", not "a
// chat answered me", and three real shapes buzz her at the wrong moment:
//
//   1. A CATCH-UP POST. The hook's final pass runs on Stop *and* on
//      UserPromptSubmit, and it posts every turn not yet in its posted-set —
//      so a reply that Stop failed to post lands the instant she hits send on
//      her next message. Server-side that is an ordinary finished reply and it
//      pushed. From her phone it is a buzz one second after she sent.
//   2. A QUEUED MESSAGE. Messaging a chat that is mid-turn queues her words;
//      the turn already running finishes seconds later and pushes. It is a
//      real reply, but not to the message she just sent.
//   3. A CHAT GRINDING ON ITS OWN. Twenty parallel sessions, each finishing
//      turns nobody asked for — with a 60s global spacing, whichever one
//      lands next after she sends is the buzz she gets.
//
// The gate makes her sentence true by construction: a push needs HER to have
// spoken since the last one, and needs the reply to have been WRITTEN AFTER
// she spoke. A reply whose text predates her message cannot be an answer to
// it — that one comparison kills (1) and (2), and the "since the last push"
// half kills (3).
//
// Two deliberate non-rules:
//   • NO TIME DEBOUNCE. The old per-chat 10 minutes was the only thing
//     standing between her and a drumroll when every reply pushed; now her own
//     message is the gate, so each message she sends can produce at most one
//     buzz, from the chat she sent it to. Measured against her real threads
//     the debounce actively broke what she is asking for — she messaged
//     `update-tab-messaging` at 2:07 pm and again at 2:11 pm, and a 10-minute
//     window swallows the answer to the second one.
//   • A CHAT THAT HAS NEVER LIFTED ONE OF HER MESSAGES IS NOT SILENCED.
//     `lastHerAt` is stamped by POST /reply, which is where BOTH doors arrive
//     (the hook lifting her words out of the Claude app, and the Chats app's
//     own reply box) — but a session on an old enough hook may never post her
//     messages at all, and there is no way to tell that apart from a chat she
//     has simply never written to. Those keep the old behaviour rather than
//     going quiet, because a missed buzz is worse than a stray one.
//
// Pure, no I/O — everything it needs already sits on the chat's registry doc.
// Timestamps are ISO strings, which compare lexicographically in the same
// order they compare chronologically, so no parsing is needed anywhere here.

// ── THE BELL — which chats are allowed to buzz at all (Aug 2026, Sophie: "add
// a little bell next to the star that I can click in… this will enable
// notifications for this chat, and un-click and it will turn them off — only
// the ones I clicked the bell on will notify me").
//
// The gate above answers "is this reply the ANSWER to her?"; the bell answers
// "does she want this chat on her lock screen at all?", and it is the coarser
// question, so it is asked first. It is a WHITELIST: `notify` is absent on
// every chat until she taps the bell, and absent means silent. That is her
// sentence read literally, and it is also the safe direction — a chat that
// forgets to pass the flag goes quiet rather than buzzing her.
//
// One field on the registry doc, like `starred` and `bookmarked`, so it rides
// the feed read the app already makes and costs nothing extra.
/**
 * @param {object} reg the chat's registry doc (or `{}` for a chat with none)
 * @returns {boolean} whether this chat is allowed to send a push at all
 */
function chatNotifies(reg) {
  return !!(reg && reg.notify === true);
}

/**
 * @param {object} o
 * @param {boolean} o.working      the post is a live draft, not a finished reply
 * @param {string}  o.replyCreated the reply's own `created` (when its text
 *                                 first landed — the draft's stamp on a turn
 *                                 that drafted, the reply's own otherwise)
 * @param {string}  o.lastHerAt    registry: her newest message's send time
 * @param {string}  o.pushedAt     registry: when this chat last pushed
 * @returns {{push: boolean, why: string}} `why` names the rule, for tests and logs
 */
function shouldPushReply({ working, replyCreated, lastHerAt, pushedAt } = {}) {
  if (working) return { push: false, why: 'draft' };
  // Never heard from her in this chat → the gate has nothing to judge, so it
  // gets out of the way (see the second non-rule above).
  if (!lastHerAt) return { push: true, why: 'no-message-on-file' };
  // She has not spoken since the last buzz — this chat is working on its own.
  if (pushedAt && !(lastHerAt > pushedAt)) return { push: false, why: 'already-answered' };
  // The reply was written before she spoke, so it cannot be an answer to her:
  // a catch-up post, or the turn that was already running when she sent.
  if (!replyCreated || replyCreated < lastHerAt) return { push: false, why: 'predates-her-message' };
  return { push: true, why: 'answers-her' };
}

// ── A CHAT BELLS ITSELF WHEN IT IS BLOCKED ON HER (2026-08-28, Sophie: "can u
// make chats bell themselves based on importance").
//
// The bell is a whitelist she taps, and that is what keeps 260 live chats off
// her lock screen. The gap it leaves is the one case where the chat, not she,
// knows something matters: it has stopped and is WAITING ON HER. Measured that
// day: 48 chats set a `need` in two days and only 6 of them were belled — 42
// asks she could only find by opening the app.
//
// TWO THINGS THIS DELIBERATELY IS NOT:
//   • NOT A FLIP OF HER BELL. A self-set bell sticks (only she turns one off),
//     so every chat that ever had one important moment would be belled
//     forever and the whitelist would quietly become everything. Importance
//     is a property of the MOMENT, not of the chat, so this escalates ONE
//     reply and changes no stored flag of hers.
//   • NOT "a need exists". A chat re-states its need at the end of every turn,
//     so that would buzz her on a loop for one ask. The trigger is the need
//     CHANGING — one buzz per distinct ask — which is why /status stamps
//     `needSetAt` only when the text differs and this compares it against
//     `needPushedAt`.
//
// It also skips the answers-her test on purpose: a chat that hit a blocker
// working on its own is exactly the case that test exists to silence, and
// exactly the case she wants to hear about.
/**
 * @param {object} reg the chat's registry doc
 * @returns {boolean} whether this reply carries a new ask worth a buzz
 */
function needEscalates(reg) {
  const r = reg || {};
  if (!r.statusNeed || !String(r.statusNeed).trim()) return false;
  if (!r.needSetAt) return false;                       // never stamped a change
  return !r.needPushedAt || r.needSetAt > r.needPushedAt;
}

// ── WHAT THE BANNER SAYS (2026-08-28, Sophie: "and notification more
// informative").
//
// It used to be the chat's name over the reply's TLDR, and on a deliverable
// the words "New deliverable" over a title with the chat name trailing after
// an em dash — so the one fact she needs first (WHICH chat) was in a different
// place depending on which door rang, and nothing said what kind of arrival it
// was. One shape now: the CHAT is always the title, and the body leads with
// the kind. An ask leads with "Needs you", which is the one banner worth
// stopping for.
const KINDS = { video: 'film', audio: 'audio', page: 'page', link: 'link' };
/**
 * @param {string} kind 'need' | 'answer' | 'page' | 'video' | 'audio' | 'link'
 * @param {object} o {chatName, need, tldr, text, title}
 * @returns {{title: string, body: string}} ready to send (caller caps length)
 */
function pushAlert(kind, o) {
  const d = o || {};
  const name = plain(d.chatName) || 'Deck Factory';
  if (kind === 'need') return { title: name, body: 'Needs you · ' + plain(d.need) };
  if (kind === 'answer') return { title: name, body: pushBody(d.text, d.tldr) };
  const word = KINDS[kind] || 'deliverable';
  return { title: name, body: 'New ' + word + ' · ' + plain(d.title) };
}

// ── What the buzz SAYS ──────────────────────────────────────────────────────
// A push whose body is HER OWN WORDS reads as "you sent a message" no matter
// how right its timing is — found live 2026-08-15 from her screenshot, and it
// is the whole reason she reported this. Two house rules collided:
//
//   • *Answering a question* says a reply OPENS with her question repeated
//     verbatim in bold, on its own line, with the answer underneath.
//   • The push body was `tldr || the reply's first non-empty line`.
//
// So every answer to a question buzzed her with her own sentence — asterisks
// and all, because nothing stripped the markdown either.
//
// THE FIRST OF THOSE RULES NOW FIRES ONLY WHEN SHE MARKS A QUESTION WITH THE
// WORD "QUESTION" (2026-08-23) — which makes this skip MORE load-bearing, not
// less: the replies that still open with a bold echo are exactly the ones
// answering something she asked, i.e. the ones most worth buzzing about.
//
// The fix is structural rather than stored: a line that is ENTIRELY bold is
// exactly the shape that rule produces, so leading lines of that shape are
// skipped. It deliberately does NOT skip `**TLDR** — …`, which has ordinary
// text after the bold and is a real opening line. Comparing against her
// message text instead was the other option and was rejected: it would mean
// carrying a few hundred characters of every chat's newest message on the
// registry doc, which rides the feed read to her phone 276 chats at a time.
const BOLD_LINE = /^\s*\*\*(.+?)\*\*\s*$/;
// Markdown a lock-screen banner should never show. Emphasis, headings, quote
// marks, inline code, and a link reduced to its text.
function plain(s) {
  return String(s == null ? '' : s)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .replace(/^\s{0,3}(#{1,6}|>)\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The one line of the reply worth putting on her lock screen.
 * @param {string} text the finished reply
 * @param {string} tldr the TLDR the hook lifted, when it found one
 * @returns {string} plain text, ready to send (caller still caps the length)
 */
function pushBody(text, tldr) {
  const t = plain(tldr);
  if (t) return t;
  const lines = String(text || '').split('\n').filter((l) => l.trim());
  const said = lines.find((l) => !BOLD_LINE.test(l));
  // Every line entirely bold → nothing else to say, so say the first one
  // rather than sending an empty banner.
  return plain(said || lines[0] || '');
}

module.exports = { shouldPushReply, chatNotifies, needEscalates, pushAlert, pushBody, _plain: plain };
