// project-words.js — WHICH PROJECT A CHAT BELONGS TO, derived from its name.
//
// (2026-09-02, Sophie: "i'd like it so projects could auto group themselves,
// like all the triset chats, grouped in reverse chronological order, so i can
// go back and see all the triset chats from a single icon button on that chat
// page header".)
//
// Loaded by the server (chat-sort.js offers the model the same vocabulary, so
// a project the sorter files is spelled the way the page already groups) AND
// served to public/chats.html at /project-words.js — the pause-plan.js
// pattern — so the button in a thread's header and the page behind it read
// ONE rule. It costs nothing: no model call, no request, the registry the
// page already holds.
//
// WHY THE SLUG'S FIRST WORD, MEASURED. The harness names a chat's branch from
// her first message, SUBJECT FIRST — measured over her 788 live chats the day
// this was built: `story-…` leads 42 of them, `playground-…` 37, `voice-…` 23,
// `deck-…` 22, `dream-…` 21, `triset-…` 4, `triangle-…` 6. A raw token count
// is far noisier (`button` 30, `new` 25, `ui` 17 — words about the SHAPE of a
// chat, not what it is on), so a project word is a word that LEADS at least
// two slugs, minus the handful of verbs and fillers the harness sometimes
// leads with instead ("remove-…", "missing-…", "weird-…"). A chat then
// belongs to every project word its slug or her display name carries, in slug
// order, so `triangle-playground-style` is a triangle chat first and a
// playground chat second — the page shows both and lets her pick.
//
// A FILED PROJECT WINS. `project` on the registry doc — written by the
// auto-sorter reading the thread (chat-sort.js), or by hand — leads the list,
// which is what reaches the chats whose slug says nothing (`chat-9cac7ca2`,
// `new-session-56f2b0`: 29 of the 788) and the ones renamed since ("Similitude"
// is the game the triset chats are about). The word rule is the floor every
// chat gets for free; the filed word is the top-up.
//
// PLURALS FOLD: `panels`/`panel`, `reels`/`reel`, `chats`/`chat` are one
// project each (measured: both spellings lead slugs). The folded key is what
// groups; the page prints whichever spelling leads more.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__projectWords = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  // A slug the hook invented because it could not name the chat — it says
  // nothing about the work, so it neither leads a vocabulary nor joins one.
  var FALLBACK = /^(chat-[0-9a-f]{6,}|new-session(-[0-9a-z]{4,})?|session|untitled|chat)$/;
  // A session-id tail (`-01k54v`, `-sessio`) or a bare number carries no word.
  var NOISE = /^(\d+|[0-9a-z]*\d[0-9a-z]*|sessio|v\d*)$/;
  // The words the harness leads a slug with that name WHAT WAS DONE or how,
  // not what it was done TO. Measured off the live slugs; each one leads at
  // least one chat and none of them is a thing she would call a project.
  var STOP = ('new add remove missing weird update updates auto multi max instant '
    + 'concise archived hidden verify delete find ex third manual newest test probe '
    + 'more collapsible hairline fix fixes fixing bug bugs bugfix make improve change '
    + 'move get set put the a an my i and of to in on for with is it app tool tools '
    + 'page button ui ux tab tabs issue issues feature question quick help why what '
    + 'something things all last recent daily double separate two three one').split(' ');
  var MIN_LEAD = 2;      // a word must lead this many slugs to be a project
  var MIN_JOIN = 3;      // …and this many for a chat to join it on a LATER word
  var MIN_GROUP = 2;     // a project of one chat is not a group

  function fold(w) {
    // panels → panel, reels → reel, chats → chat; status/canvas/witchcraft stay
    if (w.length > 3 && /s$/.test(w) && !/(ss|us|is|as|os)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function words(s) {
    return String(s == null ? '' : s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }
  function isFallbackSlug(slug) { return FALLBACK.test(String(slug || '')); }
  function usable(w) {
    return w.length >= 2 && !NOISE.test(w) && STOP.indexOf(w) < 0 && STOP.indexOf(fold(w)) < 0;
  }
  // The chat's words in order — the slug's first (subject first), then her
  // display name's — each folded, deduped, and only the ones that could ever
  // be a project. A fallback slug contributes nothing; her name still can.
  function tokens(slug, reg) {
    var out = [], seen = {};
    var src = (isFallbackSlug(slug) ? [] : words(slug)).concat(words(reg && reg.displayName));
    src.forEach(function (w) {
      if (!usable(w)) return;
      var k = fold(w);
      if (seen[k]) return;
      seen[k] = 1; out.push(k);
    });
    return out;
  }
  function leadOf(slug) {
    if (isFallbackSlug(slug)) return '';
    var w = words(slug)[0] || '';
    return usable(w) ? fold(w) : '';
  }
  function filedOf(reg) {
    var p = reg && reg.project;
    if (!p) return '';
    var t = words(p).filter(usable).map(fold);
    return t.join(' ');   // a two-word project ("story room") is one key
  }
  function live(reg) { return !(reg && (reg.deletedAt || reg.movedTo)); }

  /**
   * The vocabulary: { key: { lead, spell, filed } } over every live chat.
   * `lead` = how many slugs it leads; `spell` = the spelling that leads most
   * (what the page prints); `filed` = how many docs carry it as `project`.
   * A key is a PROJECT WORD when it leads >= MIN_LEAD slugs or is filed on
   * any doc — the second is what lets a name the sorter chose group at all.
   */
  function vocab(chats) {
    var v = {}, spell = {};
    Object.keys(chats || {}).forEach(function (slug) {
      var reg = chats[slug] || {};
      if (!live(reg)) return;
      var w = leadOf(slug);
      if (w) {
        v[w] = v[w] || { lead: 0, filed: 0, spell: w };
        v[w].lead++;
        var raw = words(slug)[0];
        spell[w] = spell[w] || {}; spell[w][raw] = (spell[w][raw] || 0) + 1;
      }
      var f = filedOf(reg);
      if (f) { v[f] = v[f] || { lead: 0, filed: 0, spell: f }; v[f].filed++; }
    });
    Object.keys(v).forEach(function (k) {
      if (spell[k]) {
        v[k].spell = Object.keys(spell[k]).sort(function (a, b) { return spell[k][b] - spell[k][a]; })[0];
      }
      v[k].project = v[k].lead >= MIN_LEAD || v[k].filed > 0;
    });
    return v;
  }
  function isProject(v, k) { return !!(v && v[k] && v[k].project); }
  // A word that is not the chat's OWN lead joins only a well-established
  // project — `triset-chat-triangle-border` is a triset chat; a mid-slug
  // "chat" or "style" must not make it a member of a two-chat group it has
  // nothing to do with. A filed project is always established.
  function joins(v, k) { return !!(v && v[k] && v[k].project && (v[k].lead >= MIN_JOIN || v[k].filed > 0)); }

  /**
   * Every project this chat belongs to, most specific first: the FILED one,
   * then the project words in its slug (subject first), then her name's.
   */
  function projectsOf(slug, reg, v) {
    var out = [], f = filedOf(reg), lead = leadOf(slug);
    if (f && isProject(v, f)) out.push(f);
    tokens(slug, reg).forEach(function (k) {
      if (out.indexOf(k) > -1) return;
      if (k === lead ? isProject(v, k) : joins(v, k)) out.push(k);
    });
    return out;
  }
  // The chats in a project — unordered; the page sorts newest-first the way
  // it sorts every pile. Archived chats are IN: "go back and see all the
  // triset chats" is exactly the history the archive holds. The trash is not.
  function groupFor(key, chats, v) {
    v = v || vocab(chats);
    return Object.keys(chats || {}).filter(function (slug) {
      var reg = chats[slug] || {};
      return live(reg) && projectsOf(slug, reg, v).indexOf(key) > -1;
    });
  }
  // What the button in a chat's header needs: its projects, each with its
  // group size, only those with a real group behind them.
  function projectsWithGroups(slug, chats, v) {
    v = v || vocab(chats);
    return projectsOf(slug, chats[slug] || {}, v).map(function (k) {
      return { key: k, label: (v[k] && v[k].spell) || k, chats: groupFor(k, chats, v) };
    }).filter(function (p) { return p.chats.length >= MIN_GROUP; });
  }
  // The names the sorter is offered, most used first — its vocabulary hint,
  // never a limit (a project she has not started yet is a name it may coin).
  function knownProjects(chats, v) {
    v = v || vocab(chats);
    return Object.keys(v).filter(function (k) { return v[k].project; })
      .sort(function (a, b) { return (v[b].lead + v[b].filed) - (v[a].lead + v[a].filed) || a.localeCompare(b); })
      .map(function (k) { return v[k].spell || k; });
  }
  // A model's answer → a project key, or '' for none. Folded like everything
  // else so "Playground" / "playground chats" / "the Playground" are one.
  function keyOf(answer) {
    var s = String(answer == null ? '' : answer).trim().toLowerCase();
    if (!s || s === 'none' || s === 'null' || s === 'n/a') return '';
    var t = words(s).filter(usable).map(fold).slice(0, 2);
    return t.join(' ');
  }

  return {
    FALLBACK: FALLBACK, STOP: STOP, MIN_LEAD: MIN_LEAD, MIN_JOIN: MIN_JOIN, MIN_GROUP: MIN_GROUP,
    fold: fold, words: words, tokens: tokens, leadOf: leadOf, filedOf: filedOf,
    isFallbackSlug: isFallbackSlug, vocab: vocab, isProject: isProject,
    projectsOf: projectsOf, groupFor: groupFor, projectsWithGroups: projectsWithGroups,
    knownProjects: knownProjects, keyOf: keyOf,
  };
}));
