#!/usr/bin/env node
// The friends audience + dream teams rule (THE DIAL in dreamapp.js), pure —
// no network, no Firestore. friendsReaches/canRead are the whole feature:
// who a ☾ friends night reaches is decided here and nowhere else.
//
//   node scripts/test-dreamapp-teams.js
const path = require('path');
const { friendsReaches, canRead } = require(path.join(__dirname, '..', 'dreamapp'));

const fails = [];
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) fails.push(name);
};

// Two teams the VIEWER belongs to. In "night shift" the author routes
// friends-posts in; in "book club" they turned it off; "elsewhere" is a team
// the viewer is not in, so it never even reaches the check.
const team = (name, members) => ({ id: name, name, members });
const m = (uid, friendsToo) => ({ uid, name: uid, joinedAt: 'x', friendsToo });

const nightShift = team('night shift', [m('sophie', true), m('penny', true)]);
const bookClub = team('book club', [m('sophie', true), m('theo', false)]);

check('reaches a teammate when the author routed friends-posts in',
  friendsReaches('penny', [nightShift]) === true);
check('does NOT reach a teammate when the author turned the team off',
  friendsReaches('theo', [bookClub]) === false);
check('does not reach someone sharing no team with the author',
  friendsReaches('marisol', [nightShift, bookClub]) === false);
check('one shared routed team is enough, whatever the others say',
  friendsReaches('sophie', [bookClub, nightShift]) === true);
check('no teams, no reach', friendsReaches('penny', []) === false);
check('a legacy member entry with no flag counts as routed in',
  friendsReaches('jude', [team('t', [{ uid: 'jude', name: 'jude' }, m('sophie', true)])]) === true);

// canRead: the per-dream-doc gate the feed and readableDream share.
check('an everyone dream is readable by anyone',
  canRead({ uid: 'penny', audience: 'everyone' }, 'stranger', []) === true);
check('a legacy dream with no audience field is everyone’s',
  canRead({ uid: 'penny' }, 'stranger', []) === true);
check('your own friends dream is always yours',
  canRead({ uid: 'sophie', audience: 'friends' }, 'sophie', []) === true);
check('a friends dream is readable through a routed shared team',
  canRead({ uid: 'penny', audience: 'friends' }, 'sophie', [nightShift]) === true);
check('and unreadable without one',
  canRead({ uid: 'penny', audience: 'friends' }, 'sophie', [bookClub]) === false);

console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
