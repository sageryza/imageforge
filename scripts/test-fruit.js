// test-fruit.js — the fruit poll's pure halves, with no network and no Firestore.
//
//   node scripts/test-fruit.js
//
// Covers the two things a bug here would leak into an inbox: the personal link
// (wrong id → somebody fills in somebody else's ballot) and the invite HTML
// (an unescaped name → broken markup in a real email).

const assert = require('assert');
const { buildInvite, personLink } = require('../fruit');

let pass = 0;
function ok(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('fruit poll\n');

ok('personLink carries both ids and url-encodes them', () => {
  const l = personLink('fridge fruit', 'a b/c');
  assert(l.includes('p=fridge%20fruit'), l);
  assert(l.includes('who=a%20b%2Fc'), l);
  assert(l.startsWith('http'), l);
});

ok('the subject greets by name, and stands alone without one', () => {
  assert.strictEqual(buildInvite({ toName: 'Susan', link: 'x' }).subject, "Susan, what's your favorite fruit?");
  assert.strictEqual(buildInvite({ link: 'x' }).subject, "What's your favorite fruit?");
});

ok('the link appears as the button href AND as readable text', () => {
  const { html } = buildInvite({ toName: 'Steve', link: 'https://ex.test/fruit?p=a&who=b' });
  assert(html.includes('href="https://ex.test/fruit?p=a&amp;who=b"'), 'button href');
  assert((html.match(/ex\.test\/fruit/g) || []).length >= 2, 'link is also shown as text');
});

ok('names and notes are escaped — a quote cannot break the markup', () => {
  const { html } = buildInvite({ toName: 'A"><b>x', link: 'x', note: 'hi <script>bad()</script>' });
  assert(!html.includes('<b>x'), 'name escaped');
  assert(!html.includes('<script>bad()'), 'note escaped');
  assert(html.includes('&lt;script&gt;'), 'note kept, as text');
});

ok('a blank line in the note becomes a paragraph, a single one a <br>', () => {
  const { html } = buildInvite({ link: 'x', note: 'one\n\ntwo\nstill two' });
  assert((html.match(/<p style="margin:0 0 16px/g) || []).length === 2, 'two paragraphs');
  assert(html.includes('two<br>still two'), 'soft break kept');
});

ok('no gradients anywhere in the email (house rule)', () => {
  const { html } = buildInvite({ link: 'x' });
  assert(!/gradient/i.test(html), 'gradient found');
});

ok('the default note says what the ask is and how long it takes', () => {
  const { html } = buildInvite({ link: 'x' });
  assert(/fridge/i.test(html) && /minute/i.test(html), 'default copy lost its point');
});

console.log(`\n${pass} passed`);
