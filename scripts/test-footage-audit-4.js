#!/usr/bin/env node
/* THE THREE AUDIT FINDINGS THAT COST MONEY OR DRAW THE WRONG CLIP
   (2026-09-14, Sophie: "what's next" — the top three of the nineteen the
   2026-09-13 audits named and left).

     1. `POST /api/cast/plan` PLANNED OVER THE RAW STRIP. A keyframe takes no
        slot (footage.js's `slotsOf` skips it), so every slot after a marked
        picture was numbered one too high and the line a chat got back named a
        picture that is not there. The clip still draws. The page had learned
        this the hard way and kept the whole rule to itself.
     2. A RENAMED WARDROBE LOOK KEY RODE NOTHING, SILENTLY, and left a literal
        `{2}` in the prompt — a patient with no pajamas and nothing on screen
        saying so.
     3. `doorTakes` DID NOT MODEL ATLAS'S OWN CAPS (9 pictures, 3 videos, 3
        audios, audio never alone), and AUTO ranks Atlas FIRST for Mini and
        Fast on its sale — so a ten-picture job went to the one door that must
        refuse it and the page offered no other.

   NOTHING HERE SENDS ANYTHING — every check is a pure build or a source pin.
   Run: node scripts/test-footage-audit-4.js */
'use strict';
const path = require('path');
const fs = require('fs');
const CL = require('../cast-line');
const F = require('../footage');

const fails = []; let pass = 0;
const ok = (what, cond) => {
  let v;
  try { v = typeof cond === 'function' ? cond() : cond; } catch (e) { v = false; }
  if (v) pass += 1; else fails.push(what);
};

// A SHIM so the pre-fix run COUNTS rather than crashing on the first line —
// `planMarked` does not exist there, and a crashed run is no evidence at all.
const marked = (o) => (typeof CL.planMarked === 'function' ? CL.planMarked(o)
  : { refs: [], line: '', missing: [], unresolved: [], marks: [] });

const A = 'https://x/a.png', B = 'https://x/b.png', C = 'https://x/c.png';
const V = 'https://x/v.mp4', S = 'https://x/s.m4a';

// ── 1. A KEYFRAME TAKES NO SLOT, AND THE PLAN HAS TO KNOW ────────────────
{
  // sophie: a clip and one still. `{1}` is the clip, `{2}` the still.
  const ent = { slug: 'sophie', name: 'sophie', looks: [{ key: 'pj',
    line: 'sophie is the woman in {1}. she wears the pajamas in {2}.',
    refs: [{ url: V, kind: 'video' }, { url: B }] }] };
  const look = ent.looks[0];

  // A is already in the strip AND is marked as the first frame, so it takes
  // no slot: the pajama still lands on [Image1], not [Image2].
  const raw = CL.plan({ refs: [{ url: A }], entry: ent, look });
  ok('the RAW plan is the bug — it numbers the marked picture a slot',
    /\[Image2\]/.test(raw.line));
  const p = marked({ refs: [{ url: A }], entry: ent, look, first: A });
  ok('planMarked numbers the slots the way `slotsOf` really will',
    () => p.line === 'sophie is the woman in [Video1]. she wears the pajamas in [Image1].');
  ok('and it agrees with footage.js, which is the door', () => {
    const j = F.buildJob({ prompt: 'p', model: 'mini', refs: p.refs, firstFrameUrl: A });
    const slotOf = (u) => (j.refs.find((r) => r.url === u) || {}).slot;
    return slotOf(B) === '[Image1]' && slotOf(V) === '[Video1]' && slotOf(A) === '';
  });

  // THE MARKS COME BACK, or the answer deletes them from the strip
  ok('the marked picture is still in the strip it answers',
    () => p.refs.some((r) => r.url === A));
  ok('and it is where it was', () => p.refs[0].url === A);

  // A LOOK THAT OWNS A MARKED PICTURE DOES NOT ATTACH IT TWICE
  const owns = { slug: 'sophie', name: 'sophie', looks: [{ key: 'pj',
    line: 'sophie is in {1} and {2}.', refs: [{ url: A }, { url: B }] }] };
  const q = marked({ refs: [{ url: A }], entry: owns, look: owns.looks[0], first: A });
  ok('a look that owns the marked picture attaches it once',
    () => q.refs.filter((r) => r.url === A).length === 1);
  ok('and its `{n}` names the END rather than a slot',
    () => /the first frame/.test(q.line) && !/\{2\}/.test(q.line));
  ok('a last frame names the last frame', () => {
    const r = marked({ refs: [{ url: A }], entry: owns, look: owns.looks[0], last: A });
    return /the last frame/.test(r.line);
  });

  // NOTHING WITHOUT A MARK MOVED — `planMarked` IS `plan` there
  const none = marked({ refs: [{ url: A }], entry: ent, look });
  ok('with no mark the answer is `plan`\'s own, byte for byte',
    () => none.line === raw.line && none.refs.map((r) => r.url).join() === raw.refs.map((r) => r.url).join());
  ok('and it carries the marks list only when there are marks',
    () => !none.marks && p.marks.length === 1 && p.marks[0].role === 'first');

  // THE ROUTE — one rule, two callers
  const cast = fs.readFileSync(path.join(__dirname, '..', 'cast.js'), 'utf8');
  ok('cast.js plans through planMarked', /castLine\.planMarked\(\{ refs: b\.refs/.test(cast));
  ok('and takes the marks under either spelling',
    /b\.first \|\| b\.firstFrameUrl/.test(cast) && /b\.last \|\| b\.lastFrameUrl/.test(cast));
}

// ── 2. A WARDROBE THAT DOES NOT RESOLVE IS NAMED ─────────────────────────
{
  const pj = { slug: 'blue-pajamas', name: 'the blue pajamas',
    looks: [{ key: 'headoff', refs: [{ url: C }] }, { key: 'sophie', refs: [{ url: B }] }] };
  const ent = { slug: 'mayra', name: 'mayra', looks: [{ key: 'ward',
    line: 'mayra is the woman in {1}. she wears the pajamas in {2}.',
    refs: [{ url: V, kind: 'video' }], wear: ['blue-pajamas:sophie'] }] };
  const byslug = { 'blue-pajamas': pj, mayra: ent };

  const good = CL.plan({ refs: [], entry: ent, look: ent.looks[0], byslug });
  ok('the wardrobe rides and the line resolves whole',
    good.line === 'mayra is the woman in [Video1]. she wears the pajamas in [Image1].');
  ok('and nothing is reported missing', () => !good.missing.length && !good.unresolved.length);

  // the look key is RENAMED under it — `sophie` is now `sophie-3`
  const renamed = { ...pj, looks: [pj.looks[0], { key: 'sophie-3', refs: [{ url: B }] }] };
  const bad = CL.plan({ refs: [], entry: ent, look: ent.looks[0], byslug: { ...byslug, 'blue-pajamas': renamed } });
  ok('a renamed look key leaves the `{2}` standing, as it always did',
    /\{2\}/.test(bad.line));
  ok('AND IT IS NAMED — the spec and why',
    () => bad.missing.length === 1 && bad.missing[0].wear === 'blue-pajamas:sophie'
    && /no such look/.test(bad.missing[0].why));
  ok('and the token is answered too', () => bad.unresolved.join() === '{2}');
  ok('a wardrobe slug that does not exist at all is named',
    () => CL.plan({ refs: [], entry: ent, look: ent.looks[0], byslug: { mayra: ent } })
      .missing[0].why === 'no such wardrobe');
  ok('a wardrobe with nothing on it is named', () => {
    // an UNNAMED wear spec takes the outfit's first look, so an empty outfit
    // is the "nothing on it" branch rather than "no such look"
    const e2 = { ...ent, looks: [{ ...ent.looks[0], wear: ['blue-pajamas'] }] };
    return CL.plan({ refs: [], entry: e2, look: e2.looks[0],
      byslug: { ...byslug, 'blue-pajamas': { slug: 'blue-pajamas', looks: [] } } })
      .missing[0].why === 'nothing on it';
  });
  ok('an unnamed wear spec still takes the outfit\'s FIRST look, as it always did',
    () => {
      const e2 = { ...ent, looks: [{ ...ent.looks[0], wear: ['blue-pajamas'] }] };
      const r = CL.plan({ refs: [], entry: e2, look: e2.looks[0], byslug });
      return r.line === 'mayra is the woman in [Video1]. she wears the pajamas in [Image1].'
        && !r.missing.length;
    });

  // THE SEND IS REFUSED rather than drawing around the token
  const j = F.buildJob({ prompt: bad.line, model: 'mini', refs: [{ url: V, kind: 'video' }] });
  ok('a `{n}` left in the prompt REFUSES the job, free, before anything draws',
    /\{2\}/.test(j.error || '') && !j.body);
  ok('and the refusal says what to do', /Re-tap the character/.test(j.error || ''));
  ok('a prompt with no token builds exactly as it always did',
    () => Boolean(F.buildJob({ prompt: good.line, model: 'mini', refs: [{ url: V, kind: 'video' }] }).body));
  ok('every distinct token is named once',
    /\{2\} \{4\}/.test(F.buildJob({ prompt: 'a {2} b {4} c {2}', model: 'mini' }).error || ''));

  // and the page says it in the ONE toast the tap raises
  const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'footage.html'), 'utf8');
  ok('the page names it on the attach', /function castWarn\(p\)/.test(page));
  ok('and it rides the one toast rather than a second call that would overwrite it',
    /said \+= castWarn\(p\);\n  toast\(said\);/.test(page));
}

// ── 3. ATLAS'S OWN CAPS ──────────────────────────────────────────────────
{
  const shape = (o) => ({ hasFirstFrame: false, hasLastFrame: false, hasRefs: true, ...o });
  ok('nine pictures is Atlas\'s limit and it takes them',
    F.doorTakes('atlascloud', shape({ images: 9 })));
  ok('ten is one too many', !F.doorTakes('atlascloud', shape({ images: 10 })));
  ok('three videos ride, four do not',
    F.doorTakes('atlascloud', shape({ videos: 3 })) && !F.doorTakes('atlascloud', shape({ videos: 4 })));
  ok('three audios ride, four do not',
    F.doorTakes('atlascloud', shape({ audios: 3, images: 1 })) && !F.doorTakes('atlascloud', shape({ audios: 4, images: 1 })));
  ok('audio alone is refused — Atlas needs a picture or a video beside it',
    !F.doorTakes('atlascloud', shape({ audios: 1 })));
  ok('audio with a picture is fine', F.doorTakes('atlascloud', shape({ audios: 1, images: 1 })));
  ok('the caps are ATLAS\'S ALONE — the other two doors are unmeasured and unmodelled',
    F.doorTakes('openrouter', shape({ images: 20 })) && F.doorTakes('apiframe', shape({ images: 20 })));
  ok('a shape that says no counts behaves exactly as before — never refuse a door for a cap nobody can see',
    F.doorTakes('atlascloud', { hasFirstFrame: false, hasLastFrame: false, hasRefs: true }));
  ok('and the numbers are atlascloud.js\'s own', () => {
    const a = fs.readFileSync(path.join(__dirname, '..', 'atlascloud.js'), 'utf8');
    const m = a.match(/const MAX_IMAGES = (\d+), MAX_VIDEOS = (\d+), MAX_AUDIOS = (\d+);/);
    return m && Number(m[1]) === F.ATLAS_CAPS.image && Number(m[2]) === F.ATLAS_CAPS.video
      && Number(m[3]) === F.ATLAS_CAPS.audio;
  });

  // THE RANKING. Atlas wins Mini in real life on its 80% sale, which is what
  // made this cost her money — but the sale is READ LIVE off Atlas and nothing
  // here touches the network, so the assertion is that Atlas is IN the
  // ranking at nine and OUT of it at ten, never which door is cheapest today.
  const cfg = { openrouter: true, apiframe: true, atlascloud: true };
  const ask = (o) => F.doorFor({ model: 'mini', door: 'auto', resolution: '480p', ratio: '16:9', seconds: 4,
    hasRefs: true, ...o }, cfg);
  const ranked = (d) => (d.ranked || []).map((r) => r.door);
  ok('nine pictures leave Atlas in the ranking', ranked(ask({ images: 9 })).includes('atlascloud'));
  ok('TEN TAKE IT OUT rather than sending the job to the one door that must refuse it', () => {
    const d = ask({ images: 10 });
    return !d.error && d.door !== 'atlascloud' && !ranked(d).includes('atlascloud');
  });
  ok('atlas alone with ten pictures is a refusal, not a send', () => {
    const d = F.doorFor({ model: 'mini', door: 'auto', resolution: '480p', ratio: '16:9', seconds: 4,
      hasRefs: true, images: 10 }, { atlascloud: true });
    return /at most 9 reference images/.test(d.error || '') && !d.door;
  });
  ok('a pinned Atlas door says the CAP, not "not configured"',
    /at most 9 reference images/.test(F.doorFor({ model: 'mini', door: 'atlascloud', resolution: '480p',
      ratio: '16:9', seconds: 4, hasRefs: true, images: 10 }, cfg).error || ''));
  ok('and with Atlas the only door open the refusal names the cap and what to change', () => {
    const d = F.doorFor({ model: 'mini', door: 'auto', resolution: '480p', ratio: '16:9', seconds: 4,
      hasRefs: true, audios: 1 }, { atlascloud: true });
    return /needs at least one reference image or video/.test(d.error || '') && /Take one off/.test(d.error || '');
  });

  // THE PRICE SHE READS IS THE DOOR THE TAP WILL GET
  ok('the estimate never quotes Atlas for a job Atlas must refuse', () => {
    const ten = F.estimate({ model: 'mini', resolution: '480p', ratio: '16:9', seconds: 4, hasRefs: true, images: 10 }, cfg);
    const alone = F.estimate({ model: 'mini', resolution: '480p', ratio: '16:9', seconds: 4, hasRefs: true, images: 10 }, { atlascloud: true });
    return ten.door !== 'atlascloud' && ten.cents > 0 && /at most 9 reference images/.test(alone.error || '');
  });
  const src = fs.readFileSync(path.join(__dirname, '..', 'footage.js'), 'utf8');
  ok('the /estimate route reads the counts off the query',
    /images: q\.imgs, videos: q\.vids, audios: q\.auds/.test(src));
  ok('and startJob counts the PLAIN strip, a keyframe never among them',
    /const plain = refs\.filter\(\(r\) => !r\.role\);/.test(src)
    && /images: plain\.filter\(\(r\) => r\.kind === 'image'\)\.length/.test(src));
  const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'footage.html'), 'utf8');
  ok('and the page sends them, so the price line is the real door',
    /'&imgs=' \+ nOf\('image'\) \+ '&vids=' \+ nOf\('video'\) \+ '&auds=' \+ nOf\('audio'\)/.test(page));

  // a cap refusal is a SHAPE refusal — never offered back to the same door
  ok('a cap refusal is stamped as a shape refusal',
    /shape\.hasLastFrame \|\| atlasCapRefusal\(shape\)\) \? 'shape'/.test(src));
}

console.log(`FOOTAGE AUDIT 4 — ${pass} passed${fails.length ? `, ${fails.length} FAILED` : ''}`);
fails.forEach((f) => console.log('  ✗ ' + f));
process.exit(fails.length ? 1 : 0);
