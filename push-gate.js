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

module.exports = { shouldPushReply };
