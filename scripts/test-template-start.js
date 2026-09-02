#!/usr/bin/env node
/* `start` on a stock template page (2026-08-31, Sophie: "tinder version" of a
   comparison already posted as groups). A page carries BOTH views, so the
   template only ever chose the OPENING one — and a grid could never open on
   the swipe half, which is exactly a spread deck. Pure: validate + render,
   no network. */
const t = require('../page-templates');
const groups = { groups: [{ label: 'a snake', items: [
  { label: 'low', img: 'https://x/1.webp' }, { label: 'medium', img: 'https://x/2.webp' }] }] };
const items = { items: [{ label: 'one', img: 'https://x/1.webp' }] };
const fails = [];
const ok = (name, cond) => { if (!cond) fails.push(name); };

// 1 — the field validates through, both spellings, and nothing else does
ok('grid takes start:swipe', t.validateTemplate('grid', { ...groups, start: 'swipe' }).data.start === 'swipe');
ok('deck takes start:compare', t.validateTemplate('deck', { ...items, start: 'compare' }).data.start === 'compare');
ok('a bogus start is dropped', t.validateTemplate('grid', { ...groups, start: 'sideways' }).data.start === undefined);
ok('no start stays absent', t.validateTemplate('grid', groups).data.start === undefined);

// 2 — the RENDER opens where it is told, and the defaults are untouched:
// nothing already posted may move, which is the whole reason it is opt-in
const html = (template, data) => t.renderTemplatePage({ template, title: 'T', chat: 'c', sheet: 's',
  data: t.validateTemplate(template, data).data });
ok('grid+swipe opens on the deck', /start: 'swipe'/.test(html('grid', { ...groups, start: 'swipe' })));
ok('grid alone still opens on compare', /start: 'compare'/.test(html('grid', groups)));
ok('deck alone still opens on swipe', /start: 'swipe'/.test(html('deck', items)));
ok('deck+compare opens on compare', /start: 'compare'/.test(html('deck', { ...items, start: 'compare' })));

// 3 — a grid's groups are what become the SPREAD cards, so the swipe half of
// a start:swipe page really has something two-up to show
const rendered = html('grid', { ...groups, start: 'swipe' });
ok('the groups ride the payload', /"groups"/.test(rendered) && /a snake/.test(rendered));

console.log(fails.length ? 'FAIL: ' + fails.join(' · ') : 'ok — ' + 9 + ' checks');
process.exit(fails.length ? 1 : 0);
