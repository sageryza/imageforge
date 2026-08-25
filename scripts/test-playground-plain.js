#!/usr/bin/env node
/**
 * The plain ChatGPT tile — her words, no reference image (Aug 2026, Sophie:
 * "add one more endpoint option to the playground, which is called ChatGPT …
 * the ChatGPT new one will have no reference image", and in the same breath
 * "change the one that's called ChatGPT right now to make it be called Sandy
 * mirror").
 *
 * The thing worth pinning is not the label — it is that a style with NO images
 * to attach must go to /v1/images/generations. `openaiImageEditRefs` posts a
 * multipart form with zero `image[]` parts, which is a malformed EDIT request,
 * and a wrong endpoint here would look exactly like a flaky model: her prompt
 * goes out, nothing comes back, the run says failed.
 *
 * PURE — no network, no server boot. It reads the real files.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fail = 0;
function ok(cond, what) {
  console.log((cond ? '  ok   ' : '  FAIL ') + what);
  if (!cond) fail++;
}

// The style literal as the server really declares it — evaluated, never
// regexed, for the reason test-playground-port.js learned the hard way: a
// regex over the block matches the COMMENTS above it and reports a rule the
// sent prompt does not have.
function styleObj(id) {
  const i = serverSrc.indexOf('\n  ' + id + ': {');
  if (i < 0) return null;
  const b = serverSrc.slice(i + ('\n  ' + id + ': ').length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');
  // `evan` writes `refFiles: [PL_GPT.refFile]`, so the const it leans on has to
  // exist while the literal is evaluated. Nothing here reads a VALUE off it that
  // this test asserts on — only that the array is non-empty.
  const PL_GPT = { refFile: 'sage-sandy-mirror.png', prefix: '', characterLine: '' };
  return eval('(' + lit + ')');            // eslint-disable-line no-eval
}

console.log('the two labels');
const evan = styleObj('evan');
const plain = styleObj('plain');
ok(!!plain, 'PL_GPT_STYLES.plain exists');
ok(evan && evan.label === 'Sandy mirror',
  'the reference-attaching tile is called "Sandy mirror" (was ChatGPT)');
ok(plain && plain.label === 'ChatGPT', 'and the reference-less one is called "ChatGPT"');
// The KEY is what every run doc, deep link and localStorage override stores.
// Renaming it would orphan all of them, so the rename must be label-only.
ok(/\n {2}evan: \{/.test(serverSrc), 'the key stays `evan` — a rename would orphan every stored run');
ok(/gptStyle: 'evan'/.test(pageSrc), "and the page's chatgpt tile still points at it");

console.log('plain sends her words and nothing else');
ok(plain && !(plain.refFiles || []).length && !(plain.storageRefs || []).length,
  'no reference images at all');
ok(plain && !plain.prefix && !plain.suffix, 'no baked prefix and no baked tail');
ok(plain && plain.noCharacter === true,
  'no Sophie character card — hers is a style reference by another name');
ok(plain && typeof plain.photoLine === 'string' && plain.photoLine.length > 0,
  'it owns a photo line of its own');
ok(plain && !/style reference/i.test(plain.photoLine),
  'which does NOT point at a style reference — on this tile there is none');

console.log('no images to attach → the OTHER endpoint');
// The job builds `refs` (style refs, then the Sophie card, then her photo) and
// must pick the endpoint off that array's LENGTH, not off the style id — a
// plain run carrying her uploaded photo has an image and belongs on edits.
const job = serverSrc.slice(serverSrc.indexOf('async function runPromptLabGptJob'));
const body = job.slice(0, job.indexOf('\nasync function '));
ok(/refs\.length[\s\S]{0,400}openaiImageEditRefs/.test(body),
  'the endpoint is chosen by refs.length');
ok(/:\s*await openaiImage\(\{/.test(body),
  'and the empty case goes to openaiImage (/v1/images/generations)');
ok(/moderation: 'low'/.test(body),
  "the generations call sends moderation:'low' like every edit here");
ok(/output_format: 'webp'/.test(body), 'and asks for webp, so the bytes below are unchanged');
// The house rule that cost a batch of originals once already.
ok(!/output_compression/.test(body), 'and NO output_compression — a generation call is never lossy');
// PL_GPT.res goes up to 2336x3504, where a medium render runs past the 150s
// OPENAI_IMAGE_TIMEOUTS allows medium. openaiImage takes an override for it.
ok(/openaiImage\(body, retries = 2, timeoutOverride = 0\)/.test(serverSrc),
  'openaiImage takes a timeout override');
ok(/\}, 2, 300000\);/.test(body), 'and the Playground passes one — big canvases outrun the table');

console.log('the photo line is per style, and disclosed');
ok(/const photoLine = st\.photoLine \? ` \$\{st\.photoLine\}` : PL_GPT\.photoLine;/.test(serverSrc),
  "a style's own photo line wins, with a space added because it carries none");
ok(/photoLine: st\.photoLine \|\| '',/.test(serverSrc),
  'GET /styles serves it, so the Prompt panel prints what is really sent');
ok(/p\.baked && p\.baked\.photoLine/.test(pageSrc),
  'and the page reads the per-style one before the house one');
// Same contract every baked string here keeps: the page owns no copy.
ok(pageSrc.indexOf('photo reference: use it for the') < 0,
  'promptlab.html holds NO copy of the photo line');

console.log(fail ? '\n' + fail + ' FAILED' : '\nall pass');
process.exit(fail ? 1 : 0);
