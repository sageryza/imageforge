# Sorting / replying to Alibaba messages with Claude — what exists (researched 2026-09-02)

Sophie asked: "is there a service or tool to sort alibaba messages and or reply to them w claude".

**Short answer: no. Nothing off the shelf reads an Alibaba inbox, sorts it, and drafts
replies with Claude.** Everything found is either outbound-only, canned-text-only, or
Alibaba's own AI aimed at a different job. This doc is the measured state so a later chat
does not re-run the same searches.

## What was searched (2026-09-02)

Chrome Web Store, Zapier's directory, the Alibaba Open Platform docs, the MCP server
listings, and the seller/buyer help centres.

## What actually exists

### Outbound only — sends inquiries, never reads the inbox
- **AliSourcing AI** (Chrome extension). Auto-fills Alibaba inquiry forms and Trade
  Messenger dialogs, queues suppliers, fires the outreach. Optional Gemini vision to find
  chat elements on the page. **Confirmed by reading its store listing: it does not read or
  sort existing inbox messages.** Also brand new and effectively unused — version 1.0.2,
  August 2026, **3 users, no ratings**. Not something to build a workflow on.
- **Accio — Alibaba.com AI Agent** (Alibaba's own). A *sourcing* assistant: find verified
  suppliers, validate products, from text/image/voice. Nothing to do with the message
  centre.

### Alibaba's own message tools — canned, and seller-side
- **Automatic Response.** A reply you write once, sent automatically to a **first-time**
  inquiry, and only to a buyer you have had no contact with in the past 30 days. Fixed
  text, not a model. Seller side.
- **Message Center** (message.alibaba.com) and **TradeManager** — the inbox and the IM
  client. No AI, no export, no rules engine beyond read/unread.
- Alibaba is pushing sellers hard on **response speed** (store scoring weighs reply time,
  sub-30-second replies are said to gain ranking), which is why the third-party
  auto-responder market exists at all — all of it seller-side and template-based.

### The official API
- `openapi.alibaba.com` — the Alibaba.com Open API, ~20+ endpoints, product and order data
  for ERP sync. **The endpoint list answered 503 on 2026-09-02, so a messaging endpoint
  could not be confirmed either way** — but nothing in the surrounding docs, the developer
  portal index, or any third-party write-up mentions one. It is also an approved-app
  programme, not a key you generate. Treat "there is a messages API" as unproven, not
  ruled out; re-check the endpoint list when it is up.
- **Alibaba Cloud's** APIs and MCP servers (ECS, MNS, Direct Mail, ChatApp/WhatsApp) are a
  completely different product from Alibaba.com the marketplace. Searching "Alibaba API"
  drowns in these. They cannot see her inbox.

### No integration layer
- **No Zapier app for Alibaba.com messages.** No trigger, no action.
- **No MCP server for Alibaba.com.** The Alibaba MCP servers that exist are all Alibaba
  Cloud infrastructure ones.

### What sourcing people actually do
Keep a Google Sheet beside the inbox tracking each supplier's status, samples and quotes,
because the message centre cannot. That is the documented state of the art.

## So the roads open to us

1. **Paste / forward, and a chat does the work.** Zero build. She sends a batch of message
   text and a chat sorts it into piles and drafts a reply per thread. Cheapest by far and
   works today.
2. **A Deck Factory tool.** She pastes or forwards a batch; the server sorts into piles
   (real supplier · needs a quote · spam · ignore) and drafts a reply per thread, reviewed
   in the deck/grid template she already uses, tap to copy the reply back into Alibaba.
   Fits how she reads (phone) and where she already reviews everything.
3. **The email route — needs one measurement first.** Alibaba emails a notification on a
   new message. **Whether that email carries the message BODY or only "you have a new
   message, log in" was not settled by research and has to be read off one real email.**
   If the body is there, a Gmail filter forwarding into an endpoint gives an automatic
   inbox with no pasting at all. If it is not, road 3 collapses into road 2.
4. **A browser extension in her logged-in session.** The only way to reply *inside*
   Alibaba automatically. Desktop-only, and she is almost never at her desktop — bad fit,
   and auto-replying from a logged-in session is also the shape of thing accounts get
   flagged for.

**Nothing here should be built before she says which side she is on** (buyer sourcing, or
seller answering inquiries) — Automatic Response and the whole auto-responder market are
seller-only, and the sorting problem is a buyer problem.

## Sources
- AliSourcing AI: https://chromewebstore.google.com/detail/alisourcing-ai-%E2%80%94-alibaba/bkedbfacikcdjeepeobedmfcgaoagahi
- Accio: https://chromewebstore.google.com/detail/accio-alibabacom-ai-agent/kfjbdipldkbfpmmdpcpdoghkbmbeegob
- Automatic Response: https://us.alibaba.com/blog/efficient-communication-alibaba-automatic-response
- Message Center: https://activities.alibaba.com/alibaba/messagecenterversion3.php
- TradeManager: https://activity.alibaba.com/ggs/TradeManager.html
- Open API reference (503 on 2026-09-02): https://openapi.alibaba.com/doc/api.htm
- The spreadsheet workaround: https://medium.com/@cituation/improve-your-supplier-communications-on-alibaba-f763354d9dfd

## What was built (2026-09-02, same day) — the sorting half

She is the **buyer** ("i need help sorting various quotations from different
vendors"), and she will **not** be screenshotting quotes ("whoa i'm not
screenshot king") — so the door IN is still open; the sorting itself is built
and proven:

- **`alibaba-quotes.js`** — `extractQuote` reads ONE quote (a screenshot OR
  pasted text) into one fixed shape with `claude-opus-5` (only what the quote
  says, nulls never guesses, plus `flags`, `missing` and a draft `reply`);
  `rankQuotes` (pure) ranks by unit price at her quantity, landed per unit when
  shipping was priced, unknowns last, lower MOQ breaking a tie; `buildDeck`
  (pure) makes the stock `deck` template — a ranking card first, one card per
  vendor with the draft reply as the caption.
- **`scripts/alibaba-quotes.js`** — the CLI: `--album` (a Dump album),
  `--image`, `--text` (blocks separated by `---`), `--qty`, `--product`,
  `--chat`, `--out`/`--from` (save / re-post free), `--dry`. ~3¢ a quote.
- **`scripts/test-alibaba-quotes.js`** — 25 pure checks through the REAL
  `validateTemplate`; `--live` renders `scripts/fixtures/alibaba-quote.html`
  and reads it for real. **Measured 2026-09-02: every number exact** (three
  tiers, MOQ 300, lead 15 days as the upper bound of 12-15, DHL $58, sample
  $45, the PayPal surcharge and the excluded mold fee as flags, a usable
  reply).

**The open half is how her quotes reach it without screenshots.** Candidates,
none measured yet: (1) copy-paste — long-press a message in the Alibaba app,
Copy, paste into the chat (the module already takes text); (2) if the quotes
came through an **RFQ**, Alibaba's own RFQ page already compares them side by
side (rfq.alibaba.com) — worth asking before building anything; (3) the
notification email, IF it carries the message body (still unmeasured — read
one real email). Nothing more gets built until she says which shape the
quotes are in.
