// A freeform run orphaned by a deploy used to sit on `drawing` forever, and the
// page polls exactly that — so the card spun with nothing admitting it was dead
// (found live 2026-08-28: a square run stuck two hours, which read as freeform
// not doing squares). stuckPatch is the whole rule; it is pure so it can be
// driven with no Firestore.
const { stuckPatch, STUCK_MS, SIZES } = require('../freeform');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const NOW = 1787900000000;
const old = NOW - STUCK_MS - 1000;
const fresh = NOW - 60 * 1000;

console.log('stuck runs');
ok('a fresh drawing run is left alone',
  stuckPatch({ status: 'drawing', createdAt: fresh, images: [] }, NOW) === null);
ok('an old drawing run with no images fails',
  (stuckPatch({ status: 'drawing', createdAt: old, images: [] }, NOW) || {}).status === 'failed');
ok('and says why',
  /restarted mid-draw/.test((stuckPatch({ status: 'drawing', createdAt: old }, NOW) || {}).error || ''));
ok('an old run that landed images is DONE, not failed',
  (stuckPatch({ status: 'ready', createdAt: old, images: ['u'] }, NOW) || {}).status === 'done');
ok('a finished run is never touched',
  stuckPatch({ status: 'done', createdAt: old, images: ['u'] }, NOW) === null);
ok('a failed run is never re-stamped',
  stuckPatch({ status: 'failed', createdAt: old, images: [] }, NOW) === null);
ok('every patch carries finishedAt',
  typeof (stuckPatch({ status: 'drawing', createdAt: old }, NOW) || {}).finishedAt === 'number');
ok('a run with no createdAt is treated as old, not immortal',
  (stuckPatch({ status: 'drawing' }, NOW) || {}).status === 'failed');
ok('the window is well past a real draw (30-90s)', STUCK_MS >= 5 * 60 * 1000);

console.log('sizes');
ok('square is offered', SIZES.square === '1024x1024');
ok('portrait is offered', SIZES.portrait === '1024x1536');
ok('landscape is offered', SIZES.landscape === '1536x1024');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
