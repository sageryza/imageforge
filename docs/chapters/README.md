# Chapters in a long chat — the proposal (Aug 2026)

Sophie, 2026-08-20: *"I wanna add chapters … for really long chats and make it
so that at the top it says **long chat:** and then show if there's multiple
topics and a link to get to the first message of each topic, just put a
coloured block to mark the beginning."* Her examples: the moon milk chat
("which started with moon milk and then became Jonas and various other
stories") and the dating book chat ("which turned into writing the whole chat
app").

**Nothing here is built yet — this is the proposal she asked to review first.**
Two Compare pages are in the `chat-chapters-feature` chat's Compare tab.

## What already exists

`POST /api/chatfeed/chapters { chat, chapters:[{title, at}] }` has shipped:
it stores the list on the registry doc and `chapterPlan()` in `chats.html`
draws a hairline heading in the thread where the chapter changes. Exactly ONE
chat carries chapters today — `deck-factory-movies` ("Moon milk experiments"),
six of them, from when she first asked.

What her new ask ADDS is the row at the top of the thread (`long chat:` + a
jump link per topic) and the coloured block that ties the row to the marker
down the thread.

## The measurements behind the plan (2026-08-20, live feed)

- 9,269 messages across 361 chats that have ever posted. Median 9 per chat.
- 14 chats have 100+ messages; 7 have 200+.
- **19 chats** pass "100+ messages, or 60+ over a week or more".
- Of those, **12 also turned** (three or more distinct topics) and are the
  ones proposed for chapters. `character-sheet-portraits` (206) and
  `instant-voice-clones` (108) are long and never turned — one job, batch
  after batch — so they get nothing.
- **The dating book chat has only 45 turns in the feed.** Its first stored
  message is 2026-07-15 and is already about the auto-filer: the dating-book
  half predates the hook lifting turns, so it was never posted. Chapters there
  can only mark what the app holds.

## The files

- `chapter-plan.json` — the validated plan, one entry per chat. Every boundary
  was checked against the real thread: no chapter starts after its chat's
  first message (which would leave orphan messages with no heading), and the
  message count each boundary produces is recorded as `n`.
- `blocks-page-v1.html` — the design mock posted as the second Compare page.
- `../../scripts/apply-chapters.js` — posts the plan once she approves.
  `--dry-run` first, `--chat <slug>` for one.

## Open questions on the two pages

1. **Which way does a jump land?** The thread paints newest-first, so a
   chapter's block starts at the top with its NEWEST message. Recommendation:
   land on the heading (top of the block), matching the thread's direction.
2. **Does the in-thread marker keep its title?** "Just a coloured block" is
   quietest but needs the legend page she anticipated; block + title needs no
   legend at all.
3. **What does a colour mean?** By POSITION (it just matches the row at the
   top, nothing to learn) or by KIND (build / experiment / story / research —
   the four colours already in the chapters artifacts, and the reason for a
   legend page).
