#!/usr/bin/env node
// test-animal-deck.js — the animal deck's one rule, pure (2026-09-22, "ties
// break w heart"). No network.
const assert = require('assert');
const { decide, subjectOf } = require('./animal-deck.js');

let n = 0;
const ok = (c, m) => { n++; assert.ok(c, m); };
const V = (id, mark = null) => ({ id, mark });

// one heart wins, whatever else is there
let d = decide([V('a'), V('b', 'like'), V('c', 'dislike')]);
ok(d.pick && d.pick.id === 'b' && !d.auto, 'one ♥ among the living is the pick');
ok(d.out.length === 1 && d.out[0].id === 'c', 'the ✕ is out');
// a lone version picks itself
d = decide([V('a')]);
ok(d.pick && d.pick.id === 'a' && d.auto === true, 'only one drawn → picked by itself');
d = decide([V('a'), V('b', 'dislike')]);
ok(d.pick && d.pick.id === 'a' && d.auto === true, 'one left after an ✕ → picked by itself');
// ties
d = decide([V('a'), V('b')]);
ok(!d.pick && d.tie.length === 2 && !d.twoHearts, 'two unmarked → a tie');
d = decide([V('a', 'like'), V('b', 'like'), V('c')]);
ok(!d.pick && d.tie.length === 3 && d.twoHearts, 'two hearts → still a tie, every living version on the card');
// every version ✕'d
d = decide([V('a', 'dislike'), V('b', 'dislike')]);
ok(!d.pick && d.empty && d.out.length === 2, 'all ✕ → empty, nothing picked');
// a ✕'d heart is not a heart
d = decide([V('a', 'dislike'), V('b')]);
ok(d.pick.id === 'b', 'an ✕ never competes');

// which prompts are animals
ok(subjectOf('lion (full body, from the side)') === 'lion', 'shot note dropped');
ok(subjectOf('tabby cat, sitting') === 'cat', 'alias + trailing clause');
ok(subjectOf('black and white spotted cow (full body, from the side)') === 'cow', 'the cow aliases');
ok(subjectOf('a blue jay') === 'blue jay', 'article dropped, two-word animal');
ok(subjectOf('mare (full body, from the side)') === 'horse', 'mare → horse');
ok(subjectOf('labradorite palm stone') === null, 'a crystal is not an animal');
ok(subjectOf('pothos houseplant') === null, 'a plant is not an animal');
ok(subjectOf('A jar of little heads, knocked over') === null, 'a scene is not an animal');

console.log(`test-animal-deck: ${n} ok`);
