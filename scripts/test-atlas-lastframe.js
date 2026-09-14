'use strict';
// test-atlas-lastframe.js — the `return_last_frame` wiring on the Atlas door.
// Pure: no network, no key. Pins the two things a wrong wiring gets wrong —
// the flag defaulting ON (which would change every existing caller's answer)
// and the PNG being told apart by POSITION rather than by NAME.
const atlas = require('../atlascloud.js');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

// --- the flag ---
const base = { prompt: 'a paper cup on a windowsill' };
const off = atlas.buildRequest(base);
ok(off.body.return_last_frame === false, 'default is OFF — an existing caller\'s answer cannot change');
ok(off.params.return_last_frame === false, 'the log records the flag either way');
const on = atlas.buildRequest({ ...base, returnLastFrame: true });
ok(on.body.return_last_frame === true, 'returnLastFrame:true reaches Atlas\'s body');
ok(on.params.return_last_frame === true, 'and is recorded on the log\'s params');

// --- the split, which is the half that can hand back the wrong file ---
const SIG = '?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=AK%2F20260909%2Ftos%2Frequest';
const mp4 = 'https://cdn.example/dir/0217889962.mp4' + SIG;
const png = 'https://cdn.example/dir/0217889962_last-frame.png' + SIG;

let s = atlas.splitOutputs([mp4, png]);
ok(s.video === mp4 && s.lastFrame === png, 'clip first, frame second — both found');
s = atlas.splitOutputs([png, mp4]);
ok(s.video === mp4 && s.lastFrame === png, 'REVERSED order still resolves by name, not position');
s = atlas.splitOutputs([mp4]);
ok(s.video === mp4 && s.lastFrame === null, 'flag off — one output, no frame invented');
s = atlas.splitOutputs([]);
ok(s.video === null && s.lastFrame === null, 'no outputs is not a crash');
s = atlas.splitOutputs(null);
ok(s.video === null && s.lastFrame === null, 'a null outputs field is not a crash');
// the trap this rule exists for: the SIGNED url carries ".mp4" and ".png"
// inside its own query, so a bare /\.png/ test matches the clip's url too.
ok(/\.png/.test(mp4 + '&x=a.png') === true, '(the trap) a naive .png test matches a signed clip url');
s = atlas.splitOutputs([mp4 + '&next=a_last-frame.png', png]);
ok(s.video === mp4 + '&next=a_last-frame.png' && s.lastFrame === png,
   'a query string that mentions the frame does not make the clip a frame');
s = atlas.splitOutputs(['https://cdn.example/x_last-frame.jpg' + SIG]);
ok(s.lastFrame !== null && s.video === null, 'a jpg frame is a frame, and is not mistaken for the clip');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
