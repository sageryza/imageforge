#!/usr/bin/env node
/* THE FIRST FRAME (and the optional last frame) THROUGH ALL THREE DOORS
   (2026-09-11) — so the last frame of one clip can be pinned as the frame the
   next one starts on, which is the continuity tool this draft keeps needing.

   Every door takes the SAME two fields, `firstFrameUrl` / `lastFrameUrl`, and
   maps them onto whatever it calls them on the wire. The three shapes are
   read off each vendor's own docs and are DIFFERENT enough that a shared
   field name is the only thing keeping one body reaching three doors:

     Atlas Cloud   a SEPARATE model id — `…/image-to-video` beside
                   `…/reference-to-video` — taking `image` (required) and an
                   optional `last_image`, and NO reference lists at all.
     OpenRouter    `frame_images: [{ type:'image_url', image_url:{url},
                   frame_type:'first_frame'|'last_frame' }]`. Its own guide:
                   "If both fields are provided, `frame_images` takes
                   precedence and the request is treated as image-to-video" —
                   i.e. `input_references` is DROPPED with nothing saying so.
     APIFRAME      `start_image` / `end_image` beside the reference lists,
                   exactly as it always has. Whether ByteDance honours both
                   together is UNMEASURED; nothing about how it is sent moved.

   So the two silent-drop cases are REFUSED at the door rather than half-sent,
   and `doorFor` only ever ranks doors that can take the job's shape.

   NOTHING HERE SENDS ANYTHING — every check is a pure build of a request body.

   Run: node scripts/test-video-keyframes.js */
'use strict';
const A = require('../atlascloud');
const O = require('../openrouter');
const F = require('../footage');
const AF = require('../apiframe');
const videoLog = require('../video-log');

const fails = []; let pass = 0;
// A condition may be handed over as a THUNK — against the code before this
// pass, `body.frame_images[0]` does not merely read false, it throws, and a
// crashed run is no count at all.
const ok = (what, cond) => {
  let v;
  try { v = typeof cond === 'function' ? cond() : cond; } catch (e) { v = false; }
  if (v) pass += 1; else fails.push(what);
};

const FIRST = 'https://storage.googleapis.com/x/atlascloud-lastframe/a_last-frame.png';
const LAST = 'https://storage.googleapis.com/x/b.png';
const REF = 'https://storage.googleapis.com/x/ref.png';
const base = { prompt: 'she walks out of the office, camera at eye level', duration: 4, resolution: '480p', aspectRatio: '16:9' };

// ── ATLAS CLOUD ─────────────────────────────────────────────────────────
{
  const r = A.buildRequest({ ...base, model: 'mini', firstFrameUrl: FIRST });
  ok('atlas: a first frame swaps the model id to image-to-video',
    r.model === 'bytedance/seedance-2.0-mini/image-to-video' && r.body.model === r.model);
  ok('atlas: the first frame is `image` on the wire', r.body.image === FIRST);
  ok('atlas: no `last_image` when she named no last frame', !('last_image' in r.body));
  ok('atlas: and no reference lists ride with it', !('reference_images' in r.body) && !('reference_videos' in r.body));
  ok('atlas: the LOG keeps one vocabulary — start_image on params', r.params.start_image === FIRST && !r.params.end_image);
  // the rest of the body is untouched by a keyframe
  ok('atlas: seconds, size, shape, sound and seed are what they always were',
    r.body.duration === 4 && r.body.resolution === '480p' && r.body.ratio === '16:9'
    && r.body.generate_audio === true && Number.isFinite(r.body.seed));

  const both = A.buildRequest({ ...base, model: 'mini', firstFrameUrl: FIRST, lastFrameUrl: LAST });
  ok('atlas: a last frame beside it is `last_image`', both.body.image === FIRST && both.body.last_image === LAST);
  ok('atlas: and both are on the log as start_image / end_image', both.params.start_image === FIRST && both.params.end_image === LAST);

  // THE TWO REFUSALS — never a silent drop
  const withRefs = A.buildRequest({ ...base, model: 'mini', firstFrameUrl: FIRST, referenceImageUrls: [REF] });
  ok('atlas: a first frame WITH references is refused, not sent with one half dropped',
    /first frame OR references/.test(withRefs.error || '') && !withRefs.body);
  ok('atlas: and the refusal names APIFRAME, the door that takes both', /APIFRAME/.test(withRefs.error || ''));
  const vidRefs = A.buildRequest({ ...base, model: 'mini', firstFrameUrl: FIRST, referenceVideoUrls: ['https://x/c.mp4'] });
  ok('atlas: a reference VIDEO beside a first frame is refused too', Boolean(vidRefs.error) && !vidRefs.body);
  const lastOnly = A.buildRequest({ ...base, model: 'mini', lastFrameUrl: LAST });
  ok('atlas: a last frame with no first frame is refused — `image` is required there',
    /needs a FIRST frame/.test(lastOnly.error || '') && !lastOnly.body);

  ok('atlas: a url that is not https is refused rather than sent',
    Boolean(A.buildRequest({ ...base, model: 'mini', firstFrameUrl: 'ref.png' }).error));
  // WAN's image-to-video sibling is unmeasured on this door
  ok('atlas: a keyframe on Wan 3.0 is refused rather than sent under an unread key',
    /Wan 3\.0/.test(A.buildRequest({ ...base, model: 'wan-3.0', firstFrameUrl: FIRST }).error || ''));
  // an image-to-video id with nothing to start from is a shape error, not a draw
  ok('atlas: an image-to-video id with no first frame is refused',
    /needs a firstFrameUrl/.test(A.buildRequest({ ...base, model: 'bytedance/seedance-2.5/image-to-video' }).error || ''));
  ok('atlas: imageToVideoOf swaps only the tail, and only on a reference-to-video id',
    typeof A.imageToVideoOf === 'function'
    && A.imageToVideoOf('bytedance/seedance-2.5/reference-to-video') === 'bytedance/seedance-2.5/image-to-video'
    && A.imageToVideoOf('bytedance/seedance-2.5/image-to-video') === 'bytedance/seedance-2.5/image-to-video');

  // NOTHING WITHOUT A KEYFRAME MOVED — the reference-to-video body is the one
  // it always was, byte for byte apart from the seed it mints per call.
  const plain = A.buildRequest({ ...base, model: 'mini', referenceImageUrls: [REF], seed: 7 });
  ok('atlas: a job with no keyframe is untouched — same id, same reference list',
    plain.model === A.DEFAULT_MODEL && plain.body.reference_images[0] === REF
    && !('image' in plain.body) && !('last_image' in plain.body) && !plain.params.start_image);
}

// ── OPENROUTER ──────────────────────────────────────────────────────────
{
  const r = O.buildRequest({ ...base, model: 'bytedance/seedance-2.0-mini', firstFrameUrl: FIRST });
  ok('openrouter: the first frame rides `frame_images`', () => Array.isArray(r.body.frame_images) && r.body.frame_images.length === 1);
  ok('openrouter: the entry is the guide\'s own shape — type, image_url.url, frame_type',
    () => { const e = r.body.frame_images[0]; return e.type === 'image_url' && e.image_url && e.image_url.url === FIRST && e.frame_type === 'first_frame'; });
  ok('openrouter: and no input_references beside it', !('input_references' in r.body));
  ok('openrouter: the LOG keeps one vocabulary — start_image on params', r.params.start_image === FIRST);

  const both = O.buildRequest({ ...base, model: 'bytedance/seedance-2.0-mini', firstFrameUrl: FIRST, lastFrameUrl: LAST });
  ok('openrouter: first then last, in the order they read',
    () => both.body.frame_images.map((e) => e.frame_type).join(',') === 'first_frame,last_frame'
    && both.body.frame_images[1].image_url.url === LAST);
  ok('openrouter: both are on the log', both.params.start_image === FIRST && both.params.end_image === LAST);

  // THE SILENT DROP THE GUIDE DOCUMENTS — refused here instead
  const withRefs = O.buildRequest({ ...base, model: 'bytedance/seedance-2.0-mini', firstFrameUrl: FIRST, referenceImageUrls: [REF] });
  ok('openrouter: frame_images WITH input_references is refused — it would drop the references silently',
    /never both/.test(withRefs.error || '') && !withRefs.body);
  ok('openrouter: and the refusal says so in those words', /silently/.test(withRefs.error || ''));
  ok('openrouter: a non-https keyframe is refused', Boolean(O.buildRequest({ ...base, model: 'bytedance/seedance-2.0-mini', firstFrameUrl: 'x.png' }).error));
  // A LAST FRAME ALONE IS ACCEPTED HERE AND IS UNMEASURED — the guide places
  // no such restriction, and the honest answer is to send what she asked for
  // rather than invent a rule Atlas happens to have.
  const lastOnly = O.buildRequest({ ...base, model: 'bytedance/seedance-2.0-mini', lastFrameUrl: LAST });
  ok('openrouter: a last frame alone is sent as asked (unmeasured, not refused)',
    () => lastOnly.body && lastOnly.body.frame_images.length === 1 && lastOnly.body.frame_images[0].frame_type === 'last_frame');

  const plain = O.buildRequest({ ...base, model: 'bytedance/seedance-2.0-mini', referenceImageUrls: [REF] });
  ok('openrouter: a job with no keyframe is untouched',
    !('frame_images' in plain.body) && plain.body.input_references[0].image_url.url === REF && !plain.params.start_image);
}

// ── APIFRAME ────────────────────────────────────────────────────────────
{
  // its route reads the SHARED names now, and its own two still work
  const fn = AF.seedanceVideo.toString();
  ok('apiframe: `firstFrameUrl` / `lastFrameUrl` are read beside `imageUrl` / `endImageUrl`',
    /opts\.firstFrameUrl \|\| opts\.imageUrl/.test(fn) && /opts\.lastFrameUrl \|\| opts\.endImageUrl/.test(fn));
  ok('apiframe: they still land on start_image / end_image', /params\.start_image = first/.test(fn) && /params\.end_image = last/.test(fn));
  ok('apiframe: the reference lists are still built beside them — it is the one door that takes both',
    /reference_image_urls/.test(fn));
}

// ── THE LOG — the exact-prompt rule, both frames on file ────────────────
{
  const doc = videoLog.sentRecord({ jobId: 'j1', prompt: 'p', model: 'm',
    params: { start_image: FIRST, end_image: LAST, reference_image_urls: [REF] } });
  ok('the log files both keyframes under the ONE vocabulary every door writes',
    doc.references.startImage === FIRST && doc.references.endImage === LAST && doc.references.images[0] === REF);
  ok('and the exact params ride the doc as they were sent', doc.params.start_image === FIRST && doc.params.end_image === LAST);
}

// ── THE DOOR CHOICE — a keyframe narrows the shape, never the price ─────
{
  const three = { openrouter: true, apiframe: true, atlascloud: true };
  const shapeOf = (o) => ({ model: 'mini', door: 'auto', resolution: '480p', ratio: '16:9', seconds: 4, ...o });

  const takes = (d, shape) => (typeof F.doorTakes === 'function' ? F.doorTakes(d, shape) : null);
  ok('doorTakes: a plain job is every door\'s',
    ['openrouter', 'atlascloud', 'apiframe'].every((d) => takes(d, {}) === true));
  ok('doorTakes: a first frame ALONE is every door\'s too',
    ['openrouter', 'atlascloud', 'apiframe'].every((d) => takes(d, { hasFirstFrame: true }) === true));
  ok('doorTakes: a first frame WITH references is APIFRAME\'s alone',
    takes('apiframe', { hasFirstFrame: true, hasRefs: true }) === true
    && takes('atlascloud', { hasFirstFrame: true, hasRefs: true }) === false
    && takes('openrouter', { hasFirstFrame: true, hasRefs: true }) === false);
  ok('doorTakes: a LAST frame on its own is not Atlas\'s — its `image` is required',
    takes('atlascloud', { hasLastFrame: true }) === false
    && takes('openrouter', { hasLastFrame: true }) === true
    && takes('apiframe', { hasLastFrame: true }) === true);

  const withRefs = F.doorFor(shapeOf({ hasFirstFrame: true, hasRefs: true }), three);
  ok('auto with a first frame and references picks APIFRAME and offers no fallback',
    withRefs.door === 'apiframe' && (withRefs.chain || []).length === 0);
  const noAf = F.doorFor(shapeOf({ hasFirstFrame: true, hasRefs: true }), { openrouter: true, atlascloud: true, apiframe: false });
  ok('with APIFRAME shut that job is REFUSED with what to change, not sent to a door that must drop half of it',
    /Take the references off, or take the first frame off/.test(noAf.error || ''));
  const lastOnly = F.doorFor(shapeOf({ hasLastFrame: true }), { atlascloud: true, openrouter: false, apiframe: false });
  ok('a last frame alone with only Atlas open is refused in Atlas\'s own terms',
    /needs a first frame/.test(lastOnly.error || ''));
  const pinned = F.doorFor(shapeOf({ door: 'atlascloud', hasFirstFrame: true, hasRefs: true }), three);
  ok('a PINNED door that cannot take the shape says the shape, never "it does not offer that"',
    /cannot ride one job/.test(pinned.error || ''));
  ok('a pinned APIFRAME takes it', F.doorFor(shapeOf({ door: 'apiframe', hasFirstFrame: true, hasRefs: true }), three).door === 'apiframe');

  // THE PRICE DOES NOT MOVE — Atlas prices image-to-video the same per second
  // as reference-to-video, so only the DOOR is narrowed.
  const plainCents = F.priceOn(F.modelOf('mini'), 'apiframe', { res: '480p', ratio: '16:9', seconds: 4 }).cents;
  const kfEst = F.estimate({ model: 'mini', resolution: '480p', ratio: '16:9', seconds: 4, hasFirstFrame: true, hasRefs: true }, three);
  ok('the estimate answers the door the tap will really go to, at that door\'s ordinary rate',
    kfEst.door === 'apiframe' && kfEst.cents === plainCents);
  ok('an unreachable shape answers the refusal rather than a price', Boolean(F.estimate(
    { model: 'mini', resolution: '480p', ratio: '16:9', seconds: 4, hasFirstFrame: true, hasRefs: true },
    { openrouter: true, atlascloud: true, apiframe: false }).error));
}

// ── buildJob — the keyframe leaves the reference lists, and the slots
//    renumber around it (a keyframe is not something the prompt names) ────
{
  const R = [{ url: 'https://x/a.png', kind: 'image' }, { url: FIRST, kind: 'image' }, { url: 'https://x/c.png', kind: 'image' },
    { url: 'https://x/v.mp4', kind: 'video' }];
  const j = F.buildJob({ prompt: 'p', model: 'mini', seconds: 4, resolution: '480p', ratio: '16:9', refs: R, firstFrameUrl: FIRST });
  ok('buildJob: the marked picture carries a role and takes NO slot',
    () => j.refs[1].role === 'first' && j.refs[1].slot === '');
  ok('buildJob: the pictures after it renumber as if it were not there',
    j.refs[0].slot === '[Image1]' && j.refs[2].slot === '[Image2]' && j.refs[3].slot === '[Video1]');
  ok('buildJob: it is OUT of referenceImageUrls and on the body as firstFrameUrl',
    j.body.referenceImageUrls.join(',') === 'https://x/a.png,https://x/c.png' && j.body.firstFrameUrl === FIRST);
  ok('buildJob: a keyframe not in the strip is still honoured (a chat sending one straight through)',
    () => F.buildJob({ prompt: 'p', model: 'mini', refs: [], firstFrameUrl: FIRST }).body.firstFrameUrl === FIRST);
  ok('buildJob: one picture cannot be both ends',
    /cannot be both/.test(F.buildJob({ prompt: 'p', model: 'mini', refs: R, firstFrameUrl: FIRST, lastFrameUrl: FIRST }).error || ''));
  ok('buildJob: a url that is not https is dropped rather than sent as a frame',
    () => !('firstFrameUrl' in F.buildJob({ prompt: 'p', model: 'mini', refs: [], firstFrameUrl: 'a.png' }).body));
  const none = F.buildJob({ prompt: 'p', model: 'mini', refs: R });
  ok('buildJob: with no keyframe every picture keeps its slot, as it always did',
    none.refs.map((r) => r.slot).join(' ') === '[Image1] [Image2] [Image3] [Video1]'
    && none.body.referenceImageUrls.length === 3 && !('firstFrameUrl' in none.body));
}

// ── the card — a clip filed by a chat rebuilds its frames from the log ──
{
  const c = F.cardOf('j1', { model: 'bytedance/seedance-2.0-mini', params: {}, video: 'v.mp4',
    references: { startImage: FIRST, endImage: LAST, images: [REF], videos: [], audio: [] } });
  ok('cardOf: the two keyframes come back off the log with their roles',
    () => c.refs[0].role === 'first' && c.refs[0].url === FIRST && c.refs[1].role === 'last');
  ok('cardOf: and the plain reference still carries its slot', () => c.refs[2].url === REF && c.refs[2].slot === '[Image1]');
}

// ── the send really carries it, through the real startJob ───────────────
(async () => {
  const seen = [];
  const door = (name) => ({ configured: () => true, api: async () => null, pollVideo: async () => null,
    startVideo: async (req, extra) => { seen.push({ name, req, extra }); return { jobId: name + '-1', sent: req, params: { seed: 7 } }; } });
  F.init({ atlascloud: door('atlas'), apiframe: door('apiframe'), openrouter: door('openrouter') });
  await F.startJob({ prompt: 'she walks out', model: 'mini', seconds: 4, resolution: '480p', ratio: '16:9',
    door: 'atlascloud', refs: [{ url: FIRST, kind: 'image' }], firstFrameUrl: FIRST });
  ok('startJob: the door is handed the first frame and NOT the picture as a reference',
    () => seen.length === 1 && seen[0].req.firstFrameUrl === FIRST && (seen[0].req.referenceImageUrls || []).length === 0);
  await F.startJob({ prompt: 'she walks out', model: 'mini', seconds: 4, resolution: '480p', ratio: '16:9',
    refs: [{ url: FIRST, kind: 'image' }, { url: REF, kind: 'image' }], firstFrameUrl: FIRST });
  ok('startJob: a first frame beside a reference goes to APIFRAME, with both',
    () => seen.length === 2 && seen[1].name === 'apiframe' && seen[1].req.firstFrameUrl === FIRST
    && seen[1].req.referenceImageUrls.join(',') === REF);
  // THE WALK ON THE DOC CARRIES THE KEYFRAME, so a refusal that lands on the
  // poll re-sends the SAME job through the next door rather than one with the
  // first frame quietly missing.
  ok('startJob: the walk carries the keyframe, so a re-send is the same job',
    () => ((seen[1].extra || {}).walk || {}).req.firstFrameUrl === FIRST);
  ok('startJob: and the card\'s refs carry the role, so the tile says which end it is',
    () => (seen[1].extra.refs || []).some((r) => r.url === FIRST && r.role === 'first'));
  F.init({ atlascloud: require('../atlascloud'), apiframe: require('../apiframe'), openrouter: require('../openrouter') });

  if (fails.length) { console.log('VIDEO KEYFRAMES — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('VIDEO KEYFRAMES — ' + pass + ' passed');
})();
