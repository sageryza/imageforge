// THE WHOLE PROMPT IS STORED, WHEREVER AN IMAGE IS MADE (2026-08-24, Sophie:
// "yes make it store the whole prompt. this is a hard rule. anytime an image
// is made ANYWHERE the whole prompt shud be stored").
//
// Why it needed saying: nearly every surface here wraps her words in a style
// prefix and a suffix before sending them, and until now only the TYPED words
// were persisted. So the exact text that drew a picture existed for the length
// of one request and was then gone — which is why Meta Assets could show a
// picture's style LABEL but never its style PROMPT, and why the house
// exact-prompt rule ("never paraphrase; if the exact text is not on hand, file
// nothing") had nothing to file for anything the app made itself.
//
// ONE builder, so no surface hand-rolls the seam. The style half marks where
// her words go with [content] — the convention the Assets PROMPT overlay has
// always documented — so the two halves together reconstruct the whole thing
// and a reader can see what was added around her.
//
//   promptRecord({ prefix, content, suffix })        → builds the full text
//   promptRecord({ full, content, prefix, suffix })  → `full` is what was SENT
//
// Pass `full` whenever the caller already assembled the string it handed the
// model: a rebuilt one could differ by a space and the whole point is that
// this field is the literal text. Everything is optional — a surface with no
// style wrapper (Freeform) files a full prompt and an EMPTY style half, which
// is the honest answer rather than an invented one.

// Generous, because truncating "the whole prompt" would defeat the rule. Real
// prompts run a few hundred to ~2000 characters; a Firestore document may hold
// a megabyte, so this costs nothing and cannot silently clip a long one.
const CAP = 6000;

const clean = (v) => String(v == null ? '' : v).trim();
const cut = (v) => clean(v).slice(0, CAP);

// The seam marker, as the PROMPT overlay documents it.
const CONTENT_MARK = '[content]';

function joinParts(parts) {
  return parts.filter(Boolean).join('\n\n');
}

/**
 * @returns {{fullPrompt:string, promptStyle:string, promptContent:string}}
 *   Fields are omitted-as-empty rather than guessed. Spread the result onto a
 *   creation doc with `Object.assign(doc, promptFields(rec))` — see
 *   `promptFields` below, which drops the empty ones so nothing writes "".
 */
function promptRecord({ prefix, content, suffix, full } = {}) {
  const pre = clean(prefix);
  const suf = clean(suffix);
  const body = clean(content);
  // The literal sent text wins; only rebuild when the caller has no copy.
  const whole = clean(full) || joinParts([pre, body, suf]);
  // No wrapper means no style half. An empty string here is the truthful
  // answer for a verbatim surface, and it is what keeps the overlay's STYLE
  // button hidden rather than showing a reconstruction.
  const style = (pre || suf) ? joinParts([pre, CONTENT_MARK, suf]) : '';
  return { fullPrompt: cut(whole), promptStyle: cut(style), promptContent: cut(body) };
}

/** The same, with empty fields dropped — ready to Object.assign onto a doc. */
function promptFields(argsOrRecord) {
  const r = (argsOrRecord && argsOrRecord.fullPrompt !== undefined)
    ? argsOrRecord : promptRecord(argsOrRecord);
  const out = {};
  if (r.fullPrompt) out.fullPrompt = r.fullPrompt;
  if (r.promptStyle) out.promptStyle = r.promptStyle;
  if (r.promptContent) out.promptContent = r.promptContent;
  return out;
}

module.exports = { promptRecord, promptFields, CONTENT_MARK, CAP };
