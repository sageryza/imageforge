'use strict';
// video-refusals.js — EVERY REFUSAL A SEEDANCE DOOR HAS SENT BACK, IN ONE
// TABLE, EACH WITH A LINE IN HER WORDS (2026-09-10, Sophie: "check for other
// refusal reasons, make sure they're documented and called out").
//
// Measured that day over all 238 jobs on the log (48 Atlas, 45 APIFRAME, 145
// OpenRouter) plus a read of every Atlas prediction record. The three doors
// forward to the same ByteDance model service, so the SAME refusals arrive
// through each, worded slightly differently; this file matches the text (and
// Atlas's `error_code` where it sends one) and answers { kind, line, free }:
//
//   kind  'shape'   the request itself — a limit, a wrong parameter. Free,
//                   refused at validation, and sending it to another door
//                   changes nothing: fix the request.
//         'content' an INPUT gate — a reference with a real/famous person in
//                   it. Free (before drawing). Atlas takes a real person and
//                   refuses only a famous face; APIFRAME takes what Atlas
//                   refuses (see CLAUDE.md). This is the one kind a door
//                   falls back on.
//         'output'  an OUTPUT gate — the clip (or its sound) was DRAWN and
//                   then blocked. Unbilled everywhere it has been measured
//                   (`price:"0"`, no generation_id), but it cost the wait.
//                   Probabilistic: the same words drew on the next try more
//                   than once (Fast is the strict model; Mini drew what Fast
//                   refused). Re-send, soften, or change the model.
//         'down'    the door itself did not answer. Nothing sent or charged.
//         'other'   a refusal nothing here has seen — the raw text is shown
//                   whole so it can be added to this table.
//   free  true when the refusal is known not to bill; null when unmeasured.
//
// The lines are what the footage card paints ABOVE the raw text, and what a
// send answers as `why` when a door refuses on the POST. Add a row the first
// time a new reason lands; never reword a matched pattern without checking
// the fixtures in scripts/test-video-refusals.js.

// Atlas's own cap on the combined length of every reference VIDEO on a job
// (error 1013030, measured 2026-09-10: two 12-15s clips → refused in 1.6s).
// ByteDance's rule by the look of it, UNMEASURED on the other two doors.
const REF_VIDEO_TOTAL_MAX = 15.2;

const ROWS = [
  // ── shape: the request ──────────────────────────────────────────────
  { code: 1013030, re: /Total duration of all reference videos must not exceed/i, kind: 'shape', free: true,
    line: `Your reference videos add up to more than ${REF_VIDEO_TOTAL_MAX} seconds — Atlas's cap for a job. Use one video, or trim them so together they are under it.`,
    seen: 'Atlas 2026-09-10 ×4' },
  { re: /First\/last frame images cannot be combined with reference media/i, kind: 'shape', free: true,
    line: 'Atlas takes a first or last frame ALONE — no reference pictures, videos or audio beside it. Take the references off, or take the frame off (APIFRAME is the one door that takes both).',
    seen: 'Atlas 2026-09-12 (measured on the poll: accepted the POST, refused before drawing, free)' },
  { re: /PixelCountTooSmall|Pixel count must be between/i, kind: 'shape', free: true,
    line: 'A reference video is too small — under ByteDance\'s pixel floor (an iPhone export shrunk on its way out of Photos). The page upscales these by itself now; send it again.',
    seen: 'OpenRouter 2026-09-10 (the floor)' },
  { re: /Duration must be between/i, kind: 'shape', free: true,
    line: 'That length is outside what this model draws — Mini and the 2.x family take 4 to 15 seconds.',
    seen: 'OpenRouter 2026-09-04' },
  { re: /ratio.*not valid.*video extension|video extension/i, kind: 'shape', free: true,
    line: 'With ONE reference video and no picture, ByteDance reads the job as extending that video and refuses a shape (`ratio`) — add a picture, or let the shape follow the video.',
    seen: 'APIFRAME ×2' },
  { re: /aspect ratio to be between 0\.40 and 2\.50|expected the aspect ratio/i, kind: 'shape', free: true,
    line: 'A reference picture is too tall or too wide — ByteDance takes pictures between 2:5 and 5:2. Crop it.',
    seen: 'APIFRAME ×1' },
  // ── content: an input gate, before anything draws ───────────────────
  { re: /InputVideoSensitiveContentDetected|input video .*may contain real person/i, kind: 'content', free: true,
    line: 'A reference VIDEO has a person in it and this door refuses those — refused, nothing drawn or charged. Atlas Cloud takes a person; a chat can send it there.',
    lineFor: (door) => `A reference VIDEO has a person in it and ${doorName(door)} refuse${door ? 'd' : 's'} it — send it through ${elsewhere(door)}.`,
    seen: 'OpenRouter, APIFRAME ×1' },
  { re: /InputImageSensitiveContentDetected|input image .*may contain real person|PrivacyInformation/i, kind: 'content', free: true,
    line: 'A reference PICTURE has a real face in it and this door refuses it — refused, nothing drawn or charged. Atlas Cloud takes a real photo; a chat can send it there.',
    lineFor: (door) => `A reference PICTURE has a real face in it and ${doorName(door)} refuse${door ? 'd' : 's'} it${door === 'apiframe' ? ' after taking the job' : ''} — blur the eyes, or send it through ${elsewhere(door)}.`,
    seen: 'OpenRouter; APIFRAME ×2 on 2.5, 2026-09-11, on the POLL ~10s after the POST was accepted (Atlas drew the same three pictures)' },
  { re: /famous|public figure/i, kind: 'content', free: true,
    line: 'A famous face in a reference — Atlas refuses public figures on the way in. A chat can try this one through APIFRAME.',
    seen: 'Atlas 2026-09-09 (Radcliffe), on the POST' },
  // ── output: drawn, then blocked ─────────────────────────────────────
  { code: 1012004, re: /generated video may be related to copyright|output video may be related to copyright/i, kind: 'output', free: true,
    line: 'The clip was drawn and then blocked as possible copyright — a famous face, or known material the model reached for. Not charged. Try again (this gate is random), soften the prompt, or use Mini rather than Fast.',
    seen: 'Atlas ×2 (Fast, a plain prompt), APIFRAME ×2, OpenRouter ×1' },
  { code: 1012006, re: /generated video may contain sensitive content|output video may contain sensitive/i, kind: 'output', free: true,
    line: 'The clip was drawn and then blocked as sensitive content. Not charged. Soften the prompt or the reference and send again.',
    seen: 'Atlas ×1 2026-09-10' },
  { code: 1012009, re: /generated audio may be related to copyright|output audio may be related to copyright/i, kind: 'output', free: true,
    line: 'The clip drew but its SOUND was blocked as possible copyright — a song, a known voice. Not charged. Send again, or say in the prompt what the sound should be.',
    seen: 'Atlas ×1, APIFRAME ×2' },
  // ── down / other ────────────────────────────────────────────────────
  { re: /Polling timed out|is not answering|no answer in/i, kind: 'down', free: true,
    line: 'The door stopped answering. Nothing was drawn or charged — send it again.',
    seen: 'APIFRAME ×1, Atlas 2026-09-10' },
];

// THE LINE NAMES THE OTHER DOORS, NEVER THE ONE IT IS ON (2026-09-11: an
// APIFRAME card told her to "send it through Atlas or APIFRAME"). `door` is
// the door the job went through; with none the line says "this door".
const DOOR_NAMES = { openrouter: 'OpenRouter', atlascloud: 'Atlas', apiframe: 'APIFRAME' };
const PERSON_DOORS = ['atlascloud', 'apiframe'];   // the doors that take a person at all
function doorName(door) { return DOOR_NAMES[door] || 'this door'; }
function elsewhere(door) {
  const rest = PERSON_DOORS.filter((d) => d !== door).map((d) => DOOR_NAMES[d]);
  return rest.length ? rest.join(' or ') : 'another door';
}

function explain(text, code, door) {
  const t = String(text || '');
  const c = code != null && code !== '' ? Number(code) : null;
  const dr = door && DOOR_NAMES[String(door)] ? String(door) : '';
  for (const r of ROWS) {
    if ((c != null && r.code === c) || r.re.test(t)) return { kind: r.kind, line: r.lineFor ? r.lineFor(dr) : r.line, free: r.free, seen: r.seen };
  }
  if (!t) return null;
  return { kind: 'other', line: '', free: null, seen: '' };
}

// The kind alone — the contract atlascloud.js's refusalKind has always had.
function kindOf(text, code) { const e = explain(text, code); return e ? e.kind : 'other'; }

module.exports = { ROWS, explain, kindOf, REF_VIDEO_TOTAL_MAX };
