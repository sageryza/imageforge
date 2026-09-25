#!/usr/bin/env node
// WAITING — the screen that says what the "N changes waiting" push is about
// (2026-09-14, Sophie: "shud go to a screen that says what the unmerged
// changes are · each chat contributes").
//
// The load-bearing thing here is the JOIN: a commit reaches the chat that
// wrote it only through the attribution trailer its squash message carries,
// and a drifted trailer format would not break anything visibly — the page
// would simply file every change under "not traced to a chat" and nobody
// would notice. So the trailer is parsed out of REAL commit messages from
// this repo's own history, not a hand-written fixture of what one looks like.
//
// Run: node scripts/test-waiting.js
'use strict';
const { execFileSync } = require('child_process');
const W = require('../waiting');

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

console.log('waiting: one commit → one row');
{
  const c = {
    sha: 'b26523773d0f82b785265fae81923028526521c9',
    commit: {
      message: 'Instagram: the house reel on the Witch tab [skip render] (#2424)\n\n' +
        'Body text.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n' +
        'Claude-Session: https://claude.ai/code/session_01SgNmBN4Panb3mRmSyr1Amx\n',
      committer: { date: '2026-09-14T18:00:00Z' },
    },
  };
  const r = W.parseCommit(c);
  ok('the PR number comes off the squash title', r.pr === 2424, r);
  ok('the session id is bare (no session_ prefix)', r.session === '01SgNmBN4Panb3mRmSyr1Amx', r.session);
  ok('the title loses the PR number and [skip render]',
    r.title === 'Instagram: the house reel on the Witch tab', r.title);
  ok('the date rides along', r.at === '2026-09-14T18:00:00Z', r.at);
}

console.log('waiting: the shapes that are NOT the ordinary one');
{
  // A title that mentions another PR mid-sentence — the merge's own number is
  // the LAST one, and taking the first would link her at the wrong PR.
  const two = W.parseCommit({ sha: 'a'.repeat(40), commit: { message: 'Undo (#2048) properly (#2050)', committer: { date: '' } } });
  ok('the LAST (#n) is the merge, not the first', two.pr === 2050, two);
  // A commit with no trailer at all — a merge from her Mac, a revert.
  const bare = W.parseCommit({ sha: 'b'.repeat(40), commit: { message: 'Fix the thing', committer: { date: '' } } });
  ok('no trailer is no session, never a guess', bare.session === '' && bare.pr === 0, bare);
  ok('and it still has a title to show', bare.title === 'Fix the thing', bare.title);
  // A multi-commit squash carries the trailer several times, same chat.
  const many = W.parseCommit({ sha: 'c'.repeat(40), commit: { message:
    'Thing (#1)\n\n* a\nClaude-Session: https://claude.ai/code/session_AAAAAAAAAAAAAAAAAAAA\n' +
    '* b\nClaude-Session: https://claude.ai/code/session_AAAAAAAAAAAAAAAAAAAA\n', committer: { date: '' } } });
  ok('a repeated trailer is one chat', many.session === 'AAAAAAAAAAAAAAAAAAAA', many.session);
}

console.log('waiting: the trailer parses out of THIS repo\'s real commits');
{
  // The measurement, not a fixture: read the last 40 real merges to main and
  // count how many reach a session. If the attribution format ever moves, this
  // is the test that says so — the page would otherwise just quietly empty out.
  let log = '';
  try {
    log = execFileSync('git', ['log', 'origin/main', '-40', '--format=%H%x00%B%x01'],
      { cwd: __dirname + '/..', encoding: 'utf8' });
  } catch (e) { log = ''; }
  if (!log) { console.log('  --   skipped (no origin/main in this checkout)'); }
  else {
    const rows = log.split('\x01').filter((s) => s.trim()).map((s) => {
      const [sha, message] = s.replace(/^\s+/, '').split('\x00');
      return W.parseCommit({ sha, commit: { message, committer: { date: '' } } });
    });
    const withSid = rows.filter((r) => r.session).length;
    const withPr = rows.filter((r) => r.pr).length;
    ok('most real merges carry a session trailer', withSid >= rows.length * 0.6,
      { of: rows.length, withSid });
    ok('most real merges carry a PR number', withPr >= rows.length * 0.6,
      { of: rows.length, withPr });
    ok('every one of them has a title left after cleaning',
      rows.every((r) => r.title.length > 0), rows.filter((r) => !r.title).slice(0, 3));
  }
}

console.log('waiting: an open PR reads the trailer out of its BODY');
{
  const p = W.parsePull({ number: 2431, title: 'Waiting screen (#2431)', draft: true,
    body: 'What it does.\n\n🤖 Generated with Claude Code\n\nhttps://claude.ai/code/session_01VnoXkA7zhaszb6ME3ABj8M\n',
    updated_at: '2026-09-15T01:00:00Z' });
  ok('the number is the PR\'s own field', p.pr === 2431, p);
  ok('the session comes off the body link', p.session === '01VnoXkA7zhaszb6ME3ABj8M', p.session);
  ok('a draft says so', p.draft === true, p);
}

console.log('waiting: the registry join');
{
  const chats = {
    'witch-reels-final': { sessionId: '01SgNmBN4Panb3mRmSyr1Amx', displayName: 'witch reels' },
    'ward-film': { url: 'https://claude.ai/code/session_01FYAp1PBet3yomhBBGtQtbZ' },
    'old-name': { sessionId: '01FYAp1PBet3yomhBBGtQtbZ', movedTo: 'ward-film' },
    'no-session': { displayName: 'nothing to join on' },
  };
  const ix = W.sidIndex(chats);
  ok('a chat is found by its guarded sessionId', ix.get('01SgNmBN4Panb3mRmSyr1Amx') === 'witch-reels-final');
  ok('…and by its Open-button url when the field predates sessionId',
    ix.get('01FYAp1PBet3yomhBBGtQtbZ') === 'ward-film', [...ix]);
  ok('a tombstone is never the answer', ![...ix.values()].includes('old-name'), [...ix]);
  ok('a chat with no session is simply absent', ix.size === 2, [...ix]);
}

console.log('waiting: grouping');
{
  const chats = {
    a: { sessionId: 'S'.repeat(20), displayName: 'Footage' },
    b: { sessionId: 'T'.repeat(20) },
  };
  const rows = [
    { sha: '1'.repeat(40), title: 'older a', pr: 1, session: 'S'.repeat(20), at: '2026-09-13T00:00:00Z' },
    { sha: '2'.repeat(40), title: 'newer a', pr: 2, session: 'S'.repeat(20), at: '2026-09-14T00:00:00Z' },
    { sha: '3'.repeat(40), title: 'b', pr: 3, session: 'T'.repeat(20), at: '2026-09-15T00:00:00Z' },
    { sha: '4'.repeat(40), title: 'nobody', pr: 4, session: '', at: '2026-09-15T12:00:00Z' },
  ];
  const g = W.groupRows(rows, chats, { 'pr-2': { line: 'the star sends ticked blocks' } });
  ok('one group per chat', g.length === 3, g.map((x) => x.chat));
  ok('the newest chat leads', g[0].chat === 'b', g.map((x) => x.chat));
  ok('a chat with no display name falls back to its slug', g[0].name === 'b', g[0]);
  ok('the unclaimed pile is LAST however recent it is',
    g[g.length - 1].chat === '' && g[g.length - 1].items.length === 1, g[g.length - 1]);
  ok('nothing is dropped', g.reduce((n, x) => n + x.items.length, 0) === rows.length);
  const a = g.find((x) => x.chat === 'a');
  ok('a chat\'s changes are newest first', a.items[0].title === 'newer a', a.items.map((i) => i.title));
  ok('a chat\'s own line rides on the change it named',
    a.items[0].line === 'the star sends ticked blocks' && !a.items[1].line, a.items);
  ok('the display name is what the group is called', a.name === 'Footage', a.name);
}

console.log('waiting: a filed line can also be keyed by sha');
{
  const rows = [{ sha: 'abcdef1234567890', title: 't', pr: 0, session: '', at: '' }];
  const g = W.groupRows(rows, {}, { 'sha-abcdef123456': { line: 'said in her words' } });
  ok('a change with no PR is reached by its sha', g[0].items[0].line === 'said in her words', g[0].items[0]);
}

// ── THE DEPLOY LOG — what rode in each of the last five ──────────────────────
// (2026-09-16, Sophie: "can i have collapsed rows under, up to five, showing
// what rode in the last 5 deployed".)
//
// The run boundaries are the whole of it, and getting one wrong is INVISIBLE
// on the page: a row that swallows a neighbour's changes looks exactly like a
// busy deploy. So they are asserted commit by commit.
console.log('waiting: the last five deploys, and what rode in each');
{
  // main, newest first: d, c, b, a. Deploys at c and a.
  const mk = (sha, n) => ({ sha, title: 'change ' + n, pr: n, session: '', at: '2026-09-1' + n + 'T00:00:00Z' });
  const commits = [mk('dddd', 4), mk('cccc', 3), mk('bbbb', 2), mk('aaaa', 1)];
  const deploys = [{ sha: 'cccc', at: '2026-09-13T01:00:00Z' }, { sha: 'aaaa', at: '2026-09-11T01:00:00Z' }];
  const runs = W.deployRuns(deploys, commits, {}, {}, 5);
  ok('one row per deploy it can place', runs.length === 1, runs.length);
  // `cccc` shipped cccc and bbbb — NOT dddd (merged after it, still waiting)
  // and NOT aaaa (the deploy before it already had that one).
  const rode = runs[0].groups.flatMap((g) => g.items.map((i) => i.sha));
  ok('the run is this deploy down to the one before it', String(rode) === 'cccc,bbbb', rode);
  ok('the count says the same thing', runs[0].n === 2, runs[0].n);
  ok('a commit merged AFTER the deploy did not ride in it', !rode.includes('dddd'), rode);
  ok('nor one the previous deploy already shipped', !rode.includes('aaaa'), rode);
  ok('the row is stamped with when it went live, not when the commit landed',
    runs[0].at === '2026-09-13T01:00:00Z', runs[0].at);
  // The OLDEST deploy has no older one to bound it. Claiming the rest of the
  // window rode in it would be a lie, so it is dropped — which is why the
  // route asks for SIX and shows five.
  ok('a run with no floor is dropped, never guessed',
    W.deployRuns([{ sha: 'aaaa', at: 'x' }], commits, {}, {}, 5).length === 0);
  // A deploy older than the 100 commits we read cannot be placed at all.
  ok('a deploy outside the window is skipped, and the ones inside still show',
    W.deployRuns([{ sha: 'zzzz', at: 'z' }, { sha: 'cccc', at: 'y' }, { sha: 'aaaa', at: 'x' }],
      commits, {}, {}, 5).map((r) => r.sha).join() === 'cccc');
  ok('never more than asked for',
    W.deployRuns([{ sha: 'dddd', at: 'd' }, { sha: 'cccc', at: 'c' }, { sha: 'bbbb', at: 'b' }, { sha: 'aaaa', at: 'a' }],
      commits, {}, {}, 2).length === 2);
  // It groups by chat exactly as the pile above does — one renderer, so a
  // change reads the same either side of going live.
  ok('the changes are grouped by chat', Array.isArray(runs[0].groups) && !!runs[0].groups[0].items);
}

// THE DEPLOY BUTTON'S STATE (2026-09-16). The button is not drawn without a
// key, so `key` is what stands between her and a dead control; `cooling` is
// what a second tap is refused with.
console.log('waiting: the deploy button knows whether it can work');
{
  const had = process.env.RENDER_API_KEY, hadH = process.env.RENDER_DEPLOY_HOOK;
  delete process.env.RENDER_API_KEY; delete process.env.RENDER_DEPLOY_HOOK;
  ok('nothing on the server → the page is told so', W.deployState().key === false);
  ok('…and there is no door to walk through', W.deployDoor() === null);

  process.env.RENDER_API_KEY = 'rnd_x';
  ok('the account key works as the fallback', W.deployState().how === 'key');

  // THE HOOK IS PREFERRED, and that is the point: this page is open, so the
  // secret behind its button should be the one that can only deploy THIS
  // service — never the account-wide key, which could also delete her
  // services.
  process.env.RENDER_DEPLOY_HOOK = 'https://api.render.com/deploy/srv-abc?key=zzz';
  ok('a deploy hook wins over the account key', W.deployState().how === 'hook');
  ok('…and it is the url that is POSTed', W.deployDoor().url.includes('srv-abc'));

  // A hook is a URL this server will POST to on a stranger's tap, so it is
  // checked against Render's own host rather than trusted because it is in
  // the env. A typo'd or pasted-wrong value must not turn the button into a
  // POST at somebody else's box.
  process.env.RENDER_DEPLOY_HOOK = 'https://evil.example/deploy/srv-abc';
  ok('a hook that is not Render\'s is ignored, not POSTed to',
    W.deployState().how === 'key', W.deployState());
  process.env.RENDER_DEPLOY_HOOK = 'http://api.render.com/deploy/x';
  ok('…nor a plain-http one', W.deployState().how === 'key', W.deployState());

  ok('nothing fired yet → no cooldown', W.deployState().cooling === 0, W.deployState());
  ok('the cooldown is five minutes', W.COOL_MS === 5 * 60 * 1000, W.COOL_MS);
  if (had === undefined) delete process.env.RENDER_API_KEY; else process.env.RENDER_API_KEY = had;
  if (hadH === undefined) delete process.env.RENDER_DEPLOY_HOOK; else process.env.RENDER_DEPLOY_HOOK = hadH;
}

// ── "WAITING TO DEPLOY" MEANS CHANGES THAT WOULD CHANGE SOMETHING FOR HER ──
// (2026-09-25, Sophie: "why are things like compare page need to be deployed"
// · "only have the 'waiting to deploy' mean changes that would change
// something for me".) The rule is the file list, and the one failure it must
// not have is filing a served change as bookkeeping — so an unlisted folder is
// LIVE, and a commit whose files could not be read is counted with hers.
console.log('waiting: what a commit changes for her');
{
  const k = W.kindOfFiles;
  ok('a Compare page\'s template + its test + the doc note is the record',
    k(['docs/pattern/pattern.tpl.html', 'docs/pattern/VERSIONS', 'scripts/test-pattern.js', 'docs/modules/pictures.md']) === 'record');
  ok('a docs-only merge is the record', k(['docs/modules/audio-and-film.md', 'CLAUDE.md']) === 'record');
  ok('a script and its fixtures are the record', k(['scripts/card-pattern.js', 'scripts/patterns/batch.json']) === 'record');
  ok('a page she opens is live', k(['public/footage.html', 'scripts/test-footage-watch.js']) === 'live');
  ok('a root module is live', k(['search-grammar.js', 'scripts/test-search-grammar.js']) === 'live');
  ok('render.yaml / package.json are live', k(['render.yaml']) === 'live' && k(['package.json']) === 'live');
  ok('a folder nobody listed is LIVE, never quietly filed away', k(['newthing/whatever.txt']) === 'live');
  ok('mixed docs + public is live (the public half is what she sees)',
    k(['docs/modules/inbox-and-misc.md', 'public/dump.html']) === 'live');
  ok('iOS only is a build, not a deploy', k(['ios/ImageForge/DumpView.swift', 'docs/x.md']) === 'ios');
  ok('iOS + a served page is live', k(['ios/ImageForge/ChatFeedView.swift', 'public/chats.html']) === 'live');
  ok('GitHub\'s own shape ({filename}) is read too', k([{ filename: 'public/a.html', status: 'modified' }]) === 'live');
  ok('no files → unknown, never a guess', k([]) === 'unknown' && k(null) === 'unknown');
}

console.log('waiting: the pile is sorted, and the count is hers');
{
  const FILES = {
    ['a'.repeat(40)]: ['public/footage.html'],
    ['b'.repeat(40)]: ['docs/pattern/pattern.tpl.html', 'scripts/test-pattern.js'],
    ['c'.repeat(40)]: ['ios/ImageForge/DumpView.swift'],
    // 'd' — the read is refused
  };
  let reads = 0;
  const fakeFetch = async (url) => {
    if (/\/compare\//.test(url)) return { ok: true, json: async () => ({ ahead_by: 4, commits:
      ['a', 'b', 'c', 'd'].map((x, i) => ({ sha: x.repeat(40), commit: { message: x + ' (#' + (i + 1) + ')', committer: { date: '2026-09-2' + i + 'T00:00:00Z' } } })) }) };
    const m = url.match(/\/commits\/([a-f0-9]+)$/);
    if (m) {
      reads++;
      if (!FILES[m[1]]) return { ok: false, status: 403 };
      return { ok: true, json: async () => ({ files: FILES[m[1]].map((f) => ({ filename: f })) }) };
    }
    return { ok: true, json: async () => ([]) };
  };
  W.classify([{ sha: 'a'.repeat(40) }, { sha: 'b'.repeat(40) }, { sha: 'c'.repeat(40) }, { sha: 'd'.repeat(40) }], fakeFetch)
    .then(async (cs) => {
      ok('each commit wears its kind', cs.map((c) => c.kind).join() === 'live,record,ios,unknown', cs.map((c) => c.kind));
      ok('one read per commit', reads === 4, reads);
      const again = await W.classify(cs, fakeFetch);
      ok('a commit is read ONCE EVER — the second pass costs nothing', reads === 5 && again[0].kind === 'live', reads);   // only the refused one is asked again
      const d = await W.build({ fetch: fakeFetch, sha: 'deadbeef', fresh: true });
      ok('ahead is still every commit (the deploy ships them all)', d.ahead === 4, d.ahead);
      ok('forYou counts the live one AND the unread one — never a hidden change', d.forYou === 2, d.forYou);
      const inPile = d.groups.flatMap((g) => g.items.map((i) => i.sha[0]));
      const inQuiet = d.quiet.flatMap((g) => g.items.map((i) => i.sha[0]));
      ok('the pile holds hers', inPile.sort().join() === 'a,d', inPile);
      ok('the rest sit in quiet, kind on each', inQuiet.sort().join() === 'b,c' &&
        d.quiet.flatMap((g) => g.items).every((i) => i.kind === 'record' || i.kind === 'ios'), d.quiet);
      ok('classified says every waiting commit was seen', d.classified === true, d.classified);
      tail();
    });
}

function tail() {
console.log('waiting: readAhead asks GitHub once and orders newest first');
{
  let asked = [];

  const fakeFetch = async (url) => {
    asked.push(url);
    return { ok: true, json: async () => ({ ahead_by: 2, commits: [
      { sha: 'a'.repeat(40), commit: { message: 'first (#1)', committer: { date: '2026-09-14T00:00:00Z' } } },
      { sha: 'b'.repeat(40), commit: { message: 'second (#2)', committer: { date: '2026-09-15T00:00:00Z' } } },
    ] }) };
  };
  W.readAhead(fakeFetch, 'deadbeef').then((r) => {
    ok('one read', asked.length === 1, asked);
    ok('it compares the live commit against main',
      /compare\/deadbeef\.\.\.main$/.test(asked[0]), asked[0]);
    ok('ahead_by is what the push counts too', r.ahead === 2, r.ahead);
    ok('newest first (GitHub answers oldest first)', r.commits[0].pr === 2, r.commits.map((c) => c.pr));
    done();
  });
  function done() {
    console.log(fails ? `\n${fails} FAILED` : '\nall good');
    process.exit(fails ? 1 : 0);
  }
}
}
