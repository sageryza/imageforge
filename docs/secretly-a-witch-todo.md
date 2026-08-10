# Secretly a Witch — to-do / backlog

A living list of changes for the Secretly a Witch app (web `/witch` + the iOS
shell). Newest ideas at the top; check things off as they ship.

## Open

### Witch School — the ⓘ FAQ on every card, and a chart for the big ones (TODO)
Sophie (2026-08-08): *"a lot of those cards are sort of invitations that cause a
lot of curiosity — they're somewhat vague and point at a whole bank of
knowledge… I almost want an info icon that answers any obvious questions."* Her
worked example was the forensic-laboratory card: it says vaguely what the lab
did, and she wanted more.

**The mechanism is built and two samples are live** — a card carries
`faq: [{ q, a }, …]`, an ⓘ appears by its heading, tapping opens a panel over
the card (`bh-03` and `sy-03`; see the ⓘ FAQ section in
`docs/witch-school-lessons.md`). What is NOT done:
- **FAQs on the rest of the cards.** Her spec for writing them: bullet Q&A,
  ordered by which question a reader hits FIRST, **three each** as the default,
  four or five where the subject earns it, more only if it genuinely needs it.
- **An organizational chart for the cards that point at whole CATEGORIES** of
  knowledge rather than one fact — she flagged that a flat FAQ won't hold those
  and something structured is needed. Undesigned; ask her before building.
- She called this "a lot of extra work to satisfy my curiosity", so it is
  explicitly parked until she has looked at the two samples.

### Witch School — more quizzes, and quizzes with pictures or mechanisms (TODO)
Sophie (2026-08-08), on the Blood/Spit/Hair quiz card: *"the test was unexpected
but very helpful for remembering stuff… maybe there should be more tests
frequently and the tests might be more interesting with pictures or even little
mechanisms."* Two separate asks:
- **More often** — currently one quiz card per lesson at most, and several
  lessons have none. Consider one every few cards rather than one at the end.
- **Richer question types** — the `know` card is text-only multiple choice. The
  `brew` card (Plant Magic / Apothecary) is the existing proof that a *mechanism*
  works as a question: pick the right ingredients, the cauldron fills. Picture
  answers (tap the right image) and other small mechanisms are unbuilt.
Not started; no design agreed.

### Double-link EVERY lesson to the place in the app that uses it (TODO)
Sophie (2026-08-08), when the Synchronicity lesson landed: *"I want to link the
other lessons and other places too — the dreams one should be linked in the
dream area, for example."* A lesson and the feature it explains should reach
each other **both ways**, so someone standing in front of a feature can ask
what it is, and someone finishing a lesson can go and use it.

The Synchronicity lesson is the worked example, and the pattern is two small
pieces:
- **Feature → lesson:** a `.coin-info` circle (the ⓘ, Lucide `info`, 16px,
  `--gold-dim`) sits beside the section's kicker and does
  `go('school'); openLesson('<key>')`. Put it in the header row, never on the
  content itself, and give it `flex: none` so it can't squeeze the kicker into
  a line break.
- **Lesson → feature:** the last card's existing `cta` — `{ label, go, el }`
  to scroll to a section, `{ go: 'book', book: '<sect>' }` for a Book of
  Shadows section, `{ sky: true }` / `{ chart: true }` for the chart.

Most lessons already have the CTA half; almost none have the ⓘ half. Still to
place (feature → lesson):
- **Dream Work** (`dream`) → the dream reader card on Home (`dream-card`).
  Sophie named this one specifically.
- **Tarot 101** (`tarot`) → the Tarot tab's draw controls. (Note `daily-learn`
  on the daily reading already goes the other way to `tarot` — that's the CTA
  half, not the ⓘ.)
- **Astrology Basics** (`astro`) / **Your Sky, Read** (`mysky`) → the daily
  reading + birth-chart cards.
- **Reading Signs** (`signs`) → the Book of Shadows **Signs** section header.
- **Spell Work** (`spell`) → Conjure's spell maker; **Crystals** (`crystal`) →
  wherever crystals surface; **Shadow Work** (`shadow`) → its Book section.
Do them in a batch once Sophie has seen the ⓘ on the coincidence boxes and
confirmed the size/placement reads right on her phone.

### Weave products into every Witch School lesson (proposed placements — Sophie to approve)
Sophie (2026-07-25): at least one shop product per lesson, placed where it
naturally belongs. The mechanism already exists — any lesson card can carry
`cta: { label, product: '<handle>' }` and the button opens the in-app product
sheet over the lesson (shipped with the apothecary lesson). Proposed map
(handle → card placement); Sophie checks this list, then a chat wires the
approved ones in:
- **Spell Work** → `spell-candles-set-of-8-witch-candles-57208` ($4.10) on the
  candle-magic card; alt `book-of-shadows-spellbook-85984`.
- **The Magic of Plants** → `witchy-tea-sampler-tea-box-magical-99976` ($149)
  on pm-10 ("brew one cup of tea slowly — that's a potion"); alt
  `witchy-essential-43160` oils on pm-07 (rose & chamomile).
- **Plant Magic II** → `apothecary-reference-cards-herbal-index-57375` ($20) on
  pa-02 (doctrine of signatures — "read plants like letters").
- **Astrology Basics** → `moon-phase-necklace-witchcraft-necklace-60993` ($15)
  on the moon card (as-05).
- **Dream Work** → `lunar-moth-notebook-book-of-shadows-84709` ($32) as the
  dream journal on the record-your-dreams card. (Swap to the Mugwort Dream Tea
  product when it exists — earlier roadmap note.)
- **Protection & Cleansing** → `black-salt-witchcraft-protection-17337` ($17)
  on the salt/boundary card; alt `token-of-protection-witchcraft-talisman-39649`.
- **Tarot 101** → `tarot-deck-rider-waite-deck-magician-22821` ($12.50) on the
  get-your-first-deck card.
- **Reading Signs** → `magic-of-flower-cards-oracle-deck-33100` ($20) on the
  everyday-oracles card.
- **Divination 101** → `pendulum-board-wooden-engraved-witchcraft-15161`
  ($7.90) on the pendulum card.
- **Crystals** → `crystals-mystery-box-gemstone-blind-box-84247` ($28) on the
  start-your-collection card.
- **Crystal Energy** → `fluorite-wand-point-crystal-mineral-86535` ($17.90) on
  the points/wands card; alt `selenite-moon-crescent-intuitive-47981`.
- **The Traveling Witch** → `travel-witchcraft-kit-travel-altar-kit-39959`
  ($85) on the pack-your-kit card; mention
  `pocket-witchcraft-kit-mini-wiccan-altar-82599` ($12.99) as the light option.
- **Building an Altar** → `triple-moon-altar-table-6` ($26) or
  `triple-moon-pentagram-altar-cloth` ($5.95) on the surface/foundation card.
- **Shadow Work** → `self-love-witchcraft-33995` ($56) on the
  kindness-is-the-container card (sh-09) — gentle fit, not salesy.
- **The Wheel of the Year** → `triple-moon-cast-iron-chime-candle-holder`
  ($5.95) + the spell candles on the sabbat-candle card.
- **The Witch's Apothecary** → DONE (wooden mortar & pestle on ap-08, the
  apothecary box on ap-09).
Rules when wiring: one button per lesson (max two where noted), always on the
card whose content earns it, label speaks like the lesson ("The wooden mortar
& pestle"), never a bare "Buy now".

### Dream Currents — cross-user symbol matching (dreams × synchronicities) (SPEC — approved to build)
Sophie's idea (2026-07-24): broadcast that synchronicity is real — "you dreamed
about a kitten today? So did 5 other people. Small animals are on the rise."
Anonymous by default (the shared data is counts, never text/images/uids), and
maybe never publicly accessible — an in-app whisper, not a feed. Design settled
in chat; ready to build.

- **Four-way pollination — ONE shared pool.** Dreams match dreams OR
  synchronicities; synchronicities match either too. There is no dream pool vs
  sync pool — just *today's pool* of symbol phrases, each entry tagged
  `dream`/`sync` only for flavor in the copy.
- **Emergent matching, NOT a fixed vocabulary.** Never look up predefined
  symbols. Layer 1 logs raw near-verbatim phrases ("three kittens", "a wave
  over the house") into the day's pool. Layer 2, every ~20-30 min (only when
  the pool changed), ONE AI call reads the whole day's phrase list (a few
  hundred strings max — one prompt) and writes the day's **currents**: named
  groupings it discovered, with member phrases + counts — e.g. "small animals —
  kittens ×4, puppies ×2, a hamster". Cross-category groupings are the point
  (puppies + kittens → "small animals"). The model names the current, so the
  poetry comes from the same intelligence that spotted the pattern.
- **Symbol extraction is FREE for dream readings** — the dream-read JSON shape
  (`server.js` `DREAM_READ_SHAPE`) already returns `symbols[]` from the same
  frontier-model call; just log them. Coincidences have no read call — add a
  fire-and-forget extraction beside the draw job (never delays the drawing).
- **NEVER delay the reading (Sophie: those seconds are precious).** The reading
  renders the moment it's ready, untouched. THEN the client asks "any currents
  matching these symbols?" (server fuzzy-matches against current members) and
  the "others are dreaming this too" line fades in beneath. No match / quiet
  day → the line simply never appears (honest silence). Re-check on revisit:
  a morning dream can join a current that formed by evening — that's how
  synchronicity feels in real life.
- **Real science in the background, woo voice up front.** Keep a trailing
  ~30-day baseline per current/symbol; compare today for honest lift. Speak it
  as "kittens are moving through the world today — you're the 8th person
  they've found", never "95% increase". Count **unique accounts** per symbol
  per day, not entries (3 kitten dreams from one person ≠ 3 kitten-visited
  souls).
- **Firestore only — no Supabase.** Clustering symbols (not full texts) keeps
  the day's corpus tiny; this is the pre-aggregated-counter case the
  memory-library TODO said Firestore handles. Embeddings/pgvector only if the
  app ever sees thousands of entries/day.
- **Later follow-up: push notification** — "5 other people dreamed about cats
  today." The clustering job already knows when a current spikes; it pushes
  instead of waiting to be fetched. Needs iOS push infra, so NOT v1.
- **Expectation:** with the current user count the line will rarely fire; the
  feature compounds as the app grows. Quiet is by design.

### "Dream app" — public dream-sharing site (research findings, 2026-07-24)
The banked shared-dream platform (called "Just Dream" above under the paywall
section — that name is a MISNOMER, Sophie 2026-07-24: it has no name yet; say
"Dream app". Name research is a later task — Latin stems, somnus/somnium
territory). What exists and what to reuse:
- **CORRECTION (2026-07-24): the site's home already exists —
  `sageryza/collective-dreams`.** A Next.js 15 + Supabase app (Vercel),
  last touched Sept 2025, that no repo note here knew about. Schema + RLS are
  done and well-shaped: `dreams` / threaded `comments` / `hearts`, anyone-reads
  / only-author-writes policies, anonymity structural ("A dreamer", no
  profiles). Working feed/composer/comments/auth UI (~860 lines). Sophie had
  already set up Supabase and WANTED it — the memory-library TODO's
  "Firebase now, Supabase later" note was written blind and is overruled.
  Build the sharing site THERE; gaps to add: dreams are text-only (no
  image/panel support — biggest gap), no reciprocity gate, no per-panel or
  text-optional publishing, no safety screen on posts, no bridge from the
  witch app. Theme uses gradients — violates the no-gradients rule; restyle.
- **Accounts:** witch users won't need a second account — the witch app
  publishes panels via the imageforge server (verify Firebase sign-in, write
  to Supabase with the service key). True shared accounts across the
  Firebase apps (XI etc.) and this Supabase app = open question, only worth
  deciding if the Dream app becomes a direct sign-in destination. XI growing
  does NOT itself call for Supabase (Firestore fits its patterns).
- The memory app's Group Dream Journal (membry-df528.web.app/dream-journal)
  is TEXT-only private groups — wrong shape to convert; it predates
  illustration.
- **Reuse 1 — the publish gate:** XI's "stories i tell" (`publishMemory` Cloud
  Function, memory-library-react `functions/index.js`) — clients can never
  write the public collection; a server function re-reads, runs a Claude
  safety/PII screen, then copies out. Un-publish, anonymous attribution, and a
  reports collection all shipped. Copy the PATTERN into imageforge; do NOT
  connect to the memory database — the two stay separate (Sophie, 2026-07-24).
- **Reuse 2 — the dream schema:** `src/utils/dreamSchema.js` (structured
  `symbols[]`/`emotions[]` — also feeds Dream Currents above).
- **To reconcile:** witch dreams (`forge-witch-dream-illus`) vs Deck Factory
  dreams (`forge-dreams`) are different collections; a shared library needs
  one shape. `/trydreams` already proves anonymous guests + daily caps work.
- **Sophie's rules for the site:** a button in Secretly a Witch ("want to see
  other people's dreams? you're not the only one"); you must make YOUR dream
  public for the day to see anyone else's (reciprocity gate); per-PANEL
  publishing (share one page of a multi-page dream); text optional (image
  without words). None of these exist yet — pages[] has no per-page
  visibility, nothing anywhere has a public-for-the-day TTL.
- Not an app yet — web first; its own app is the eventual final build.

### Book of Shadows — Synchronicities 4th box "draw another" is a PAID button (TODO)
The Synchronicities section shows the day's coincidences 4-to-a-page. The 3
Home coincidences file in automatically; the **4th box is left empty on
purpose**. Sophie wants a **"Draw it" / draw-another button on that empty box
that opens the pay screen** (buying an extra synchronicity draw beyond the free
3/day). Not built yet — currently the 4th box is just a plain empty square.
When building: reuse `openUpgrade('coincidence')` / the membership flow, gate
the draw, then write the result into the sync archive (`witch_sync_archive`)
under that day so it fills the 4th slot. Ties into the paywall section below.

### ⚠️ Purchase/coming-soon UI is HIDDEN in the iOS app — restore at Stripe launch
For the July 2026 App Store submission, every purchase-flavored or "coming
soon" control is hidden when the page runs inside the iOS wrapper (`IS_APP`,
i.e. `?app=1`). **Nothing was deleted** — each spot is an `IS_APP ?` gate in
`public/witch.html`; the web keeps it all. When the Stripe membership goes
live (and the Apple-compliant purchase path is decided), search `witch.html`
for `IS_APP` and un-gate these four spots:
1. `renderDreamBook()` — locked pages + "Unlock the full dream book" (app
   shows just the illustrated page)
2. `coinRedraw()` — the two redraw popups' "Become a member" / "Unlimited
   with membership" buttons
3. `renderTarotDeep()` — the "Design your own tarot deck — coming soon" tile
4. `openBirthChart()` — the "Order a framed print" block (coming-soon toast)
Remember: digital unlocks inside the app = Apple IAP territory — decide the
approach (IAP vs external-link entitlement) BEFORE un-hiding, see below.

### Paywall / subscription across the app ("get a taste, then pay")
The membership model: free users get a *taste* of each generative feature, the
rest is paywalled. Examples: Dream = 1 illustrated page free, rest blurred;
Coincidence = 1 free draw + limited redraws/day. Applies in "all sorts of
places" — treat as ONE membership that unlocks everything (confirm with Sophie).
- **Hard constraint — Apple In-App Purchase.** On iOS, unlocking digital
  features/subscriptions must go through Apple's IAP (StoreKit), Apple takes
  15–30%. Because Secretly a Witch is a WKWebView wrapper, this is the one place
  that likely needs real *native* code (StoreKit purchase in the shell →
  entitlement bridged into the web view) + subscription products configured in
  App Store Connect (which requires the Paid Apps agreement + banking/tax info
  signed first). A 2025 US ruling now lets apps link out to external web
  payment — could allow selling via Stripe on web and skipping Apple's cut —
  but that area is changing fast; **research current App Store rules before
  committing to an approach** (see the "research current dashboards" design rule).
- **Needed from Sophie:** the model (one membership vs per-feature), price +
  billing period (monthly/annual/trial), the full free-vs-paid list per feature,
  App Store Connect Paid-Apps agreement signed, and (if web path) a Stripe acct.
- **Sequence:** build the paywall UI + entitlement scaffolding first (with a
  test/"coming soon" entitlement) so the visible paywall ships now; wire real
  payment once the agreements + products exist.
- **PAYMENT = WEB / STRIPE (decided 2026-07).** Sell the subscription on the
  Secretly a Witch *website* via Stripe (like Claude/Spotify) → sign into the
  app → it unlocks. No Apple IAP, no Apple cut, no native StoreKit. Tradeoff:
  **paid features require being signed in** (that's how the app knows you
  subscribed); the free taste stays signed-out. The in-app "link out to
  subscribe" is US-only / legally shifting — verify current rules before relying
  on it; worst case people subscribe on the site and the app just unlocks.
- **STRIPE INTEGRATION — SHIPPED (TEST MODE, 2026-07).** `stripe.js`
  (`/api/stripe`): `GET /status`, `GET /entitlement` (verifies the app's
  Firebase ID token vs membry-df528, reads `users/{uid}.membership`),
  `POST /checkout` ($4/mo Checkout Session), `POST /webhook` (crypto-verified;
  `checkout.session.completed` + `customer.subscription.*` flip
  `users/{uid}.membership.active`). Entitlement is server-authoritative, stored
  OUTSIDE the client-synced bundle. `witch.html`: `isPaid()` backed by
  `refreshEntitlement()` on sign-in; "Become a member" → Stripe Checkout
  (external browser on iOS, inline on web); handles `?subscribe=1` / `?sub=success`.
  Test **Product + $4/mo Price + webhook** created via `scripts/stripe-bootstrap.js`;
  test keys stored in the config doc. **Verified live e2e:** status ok, auth
  gating (401 no-token), signed webhook → wrote membership to Firestore, bad
  signature rejected (400). The QA switch `?paid=1`/`?paid=0` still works.
- **LAUNCH CHECKLIST (Sophie + a chat, before real payments):**
  1. Finish the Stripe **account verification** (business name + a reachable
     website — the CWIW account's overdue "confirm your website" task) so
     payouts release. Test mode works without this; live charging needs it.
  2. Create the **LIVE** Product/Price/webhook: `STRIPE_SECRET_KEY=sk_live_… node
     scripts/stripe-bootstrap.js` → put the live `STRIPE_SECRET_KEY` +
     `STRIPE_PRICE_ID` + `STRIPE_WEBHOOK_SECRET` in the config doc (swaps test→live).
  3. Verify the full **card checkout** in a browser with a Stripe test card
     (`4242 4242 4242 4242`) before flipping to live.
  4. (Optional) set `STRIPE_TRIAL_DAYS` for the card-up-front free trial.
  5. Point `secretlyawitch.com` at the witch app (see the Domain item) so the
     subscribe page lives on the real domain.
- **Pricing (Sophie, 2026-07):** **$4/month** to start (may rise depending on
  real per-feature model costs), **monthly only — no annual** (feels deceptive),
  **free trial: CARD UP FRONT** (Stripe collects card, N days free, auto-charges
  when the trial ends; send a reminder email before the charge). Decided 2026-07.
- **Free vs paid map (draft — confirm/expand with Sophie):** ONE membership
  unlocks all of it.
  - **Dream illustration** — LEAVE FULLY OPEN FOR NOW (Sophie, 2026-07): not
    paywalling/capping dreams yet — it's fun to see people's dreams and it's
    marketing research for her planned "Just Dream" shared-dream platform. The
    cost is accepted as research spend. (The 1-page-free/blur-rest paywall is
    still the eventual model, just deferred.)
  - **Suspicious Coincidence** — 3 boxes, drawings persist; 1 redraw/day free;
    more redraws paid.
  - **Birth chart** — your OWN chart free; charts for friends / other people paid
    (Costar model).
  - **Make-your-own-tarot-deck** (new feature, not built) — REVISED (Sophie,
    2026-07) to cap cost: free = **3 cards**; paid = the **major arcana (22)**;
    the **full 78-card deck is never offered** (no minor arcana) — this caps the
    spendiest action at ~22 cards, generated once.
  - **Suspicious Coincidence — generous for paid** (Sophie: "could go forever").
    It's ~1.5¢/draw, so paid = effectively unlimited redraws; free = 1/day.
  - **Advanced / special-topic Witch School lessons** — possible paid tier
    (basic lessons free, advanced or interesting-topic ones paid).
  - **Text coincidence moments in the book** (Book of Miracles / Shadows — which
    one TBD, ties into the BoS rework) — adding a **text-only** moment is free;
    **paying to illustrate it** is the paid action. New feature, not built.
- **Coincidence spec (decided 2026-07, REVISED):** KEEP the **three** Home
  boxes. Within a day the drawings persist (you can't freely change them, only
  redraw). Free = **one redraw per day** (across the boxes); more redraws paid.
  "Draw it!" → "Redraw"; redraw popup + version arrows. **SHIPPED (chunk 1).**
  - **REVISION (Sophie, 2026-07): the 3 boxes RESET at local midnight** — fresh
    empty boxes each day. Before the reset, the day's drawings **archive to the
    Book of Shadows** (Signs & synchronicities) so nothing is lost. If someone
    wants MORE than 3 coincidences in one day, they add them in the **Book of
    Shadows** (text moment → pay to draw). NOT yet built — depends on the Book
    of Shadows rework (larger decision). Chunk 1 shipped the persist-only
    version; this changes it to daily-reset + archive.
  - **Account sync: SHIPPED** — coincidence drawings (`witch_coin_done`) now
    sync to the signed-in account's cloud doc (added to `WITCH_KEYS`; pushes on
    change, re-renders on pull). The redraw counter stays device-local (Sophie
    OK'd a soft limit). Drawings following the account is a pre-release must.

### Domain: point secretlyawitch.com at the witch app (front door)
**CODE SHIPPED (2026-07-24) — waiting on Sophie's DNS/dashboard flip.** The
server is host-aware: requests arriving on `secretlyawitch.com` (or www) get
the witch app at `/`, old Shopify-storefront URLs (`/products/*`,
`/collections/*`, `/cart`, `/pages/*`, …) 301 to the store's permanent home
(`WITCH_STORE_ORIGIN`, default `cod-god-inc.myshopify.com`), old `/blogs/*`
URLs 301 to the new **on-site blog** at `/blog` (+ `/blog/:slug`, server-
rendered from Firestore `forge-blog` — Blog Studio grew a "Publish to
secretlyawitch.com/blog" button, `POST /api/blog/publish-site`; preview at
`/blog?public=1` on the onrender host), plus `robots.txt`, `sitemap.xml`,
canonical/OG tags in `witch.html`, and Stripe checkout returns to the domain
the buyer started on. The onrender host is untouched (hub/studio unchanged;
`/blog` there is still the gated Blog Studio). The SEO story: the blog moves
INTO the witch app, so organic posts now build the real domain instead of
Shopify.
- **Sophie's flip checklist (each step is safe; the site keeps working
  throughout — DNS just switches which thing the domain shows):**
  1. **Render** (dashboard → the imageforge service → Settings → Custom
     Domains → **+ Add Custom Domain**): add `secretlyawitch.com`. Free
     (Hobby) workspaces include 2 custom domains. Render will show the DNS
     records to set and auto-handles the www redirect.
  2. **Hover** (hover.com → secretlyawitch.com → **DNS** tab): DELETE the A
     record `@ → 23.227.38.65` and the CNAME `www → shops.myshopify.com`;
     ADD `A @ → 216.24.57.1` and `CNAME www → imageforge-q125.onrender.com`.
     Delete any AAAA records if present (Render is IPv4-only).
  3. Back in Render: **Verify** → certificate issues automatically (minutes).
  4. **Firebase** (console → project `membry-df528` → Authentication →
     Settings → **Authorized domains**): add `secretlyawitch.com` — sign-in
     (Google popup, email link) fails on the new domain without this.
  5. **Shopify** (admin → Settings → Domains): remove `secretlyawitch.com`
     so the store's primary domain reverts to `cod-god-inc.myshopify.com`
     (checkout + product pages keep working there; the app's Shop tab and the
     redirect layer already point at it).
- **IN-APP BUYING SHIPPED (2026-07-24, Sophie asked for it):** the Shop tab
  now sells inside the app — tap a product → bottom-sheet with images/
  variants/description → **Add to cart** → cart sheet (qty steppers, subtotal)
  → **Checkout** hands off to Shopify's secure pay page only. Storefront API
  (modern replacement for the legacy Buy Button JS), via server proxy:
  `GET /api/witch/shop/product/:handle`, `GET /api/witch/cart?id=`,
  `POST /api/witch/cart/add` (auto-recreates an expired cart),
  `POST /api/witch/cart/update` (qty 0 = remove). Cart id persists in
  `localStorage['witch_cart_id']` (Shopify expires carts ~10 days — handled).
  The token is the PUBLIC storefront token (safe committed; same one embedded
  in thepeoplewatchingclub.com's source, same store). Verified live e2e
  against the real store: create/read/update/remove/stale-cart-recovery.
  NOTE: Shopify emits `checkoutUrl` on the store's PRIMARY domain — today
  that's secretlyawitch.com, and post-flip our `/cart/*` 301 forwards it to
  the store, so checkout works before, during, and after the DNS move.
- **Open (Sophie's call, not blocking):** optionally give Shopify a branded
  subdomain — Hover CNAME `shop → shops.myshopify.com`, add
  `shop.secretlyawitch.com` in Shopify Domains as primary, then set
  `WITCH_STORE_ORIGIN=https://shop.secretlyawitch.com` (Render env or the
  config doc) so store links/redirects use it. With in-app buying live, the
  themed Shopify store pages are now just a fallback surface — retiring them
  is purely cosmetic whenever Sophie wants.

### App Store screenshots — refresh with the new features (Sophie: "later today")
The `ios-witch-screenshots.yml` workflow (memory-library-react) boots a
simulator and captures per-tab shots via `?shot=<sectionId>` + `WITCH_TAB`.
Now that big features shipped (coincidence redraws, Book of Shadows, dreams,
membership), refresh the App Store set before submission:
- Sophie picks WHICH features to feature (suggested: Home moon+card, daily
  tarot, coincidence, your-sky, School, Book of Shadows, Shop, dream).
- Fresh simulators show EMPTY states — add a `?demo=1` seed that fills demo
  content (sample coincidence drawings, a sample chart, a revealed pull) so
  shots aren't blank. Sophie hasn't approved demo-seeding yet — confirm first.

### ⚠️ Unit economics — check BEFORE committing to $4/mo (Sophie flagged)
Many paid features cost real API money per use, so an unlimited $4/mo membership
can LOSE money on power users. Rough per-action costs (cheap tiers we already use):
- Coincidence draw (gpt-image-2 low): **~1.5¢**
- Dream page (gpt-image-2 medium): **~6¢** (a dream is several pages)
- Full 78-card tarot deck: **~$1.20 (low) – ~$4.70 (medium)** — the spendiest single action
- Friend birth chart (gpt-4o-mini text): **fractions of a cent**
- Advanced lessons: **~$0/user** if pre-generated ONCE and shared (do this)
Stripe fee on $4 ≈ 42¢, so real budget ≈ **$3.58/paying user/mo**. A heavy user
doing daily multi-page dreams alone blows past that. **Levers:** (a) per-feature
fair-use caps even for PAID (e.g. N dreams/day, N deck-gens/mo), (b) a credit/
allowance system, (c) higher price. ALSO watch FREE-user cost (they pay nothing
but still burn API $ — keep the taste genuinely small). Recommend: caps + cheap
tiers + pre-generate shared content. TODO: build a proper break-even model.

### Blurred paywalled pages should look DIFFERENT (not the same page repeated)
Right now the blurred/locked pages behind a paywall (e.g. Dream's un-purchased
pages) are literally the SAME page duplicated with a blur, so they all look
identical. They should look like *distinct* pages even though the real ones
don't exist yet — vary the blurred placeholders (different faint layouts /
compositions) so it reads as "there's more real content here," not one page
copied. Applies wherever the taste-then-blur pattern is used.

### Etsy → Shopify product transfer (replace the "Shuttle" app)
Let a chat (or a button in the app) add Etsy listings that aren't yet on Shopify
**into** Shopify automatically — taking over the job Sophie currently does with
the Shuttle app. Right now the app shop mirrors Etsy but can only *show*
products that already exist on Shopify.

- **Blocker — one permission:** the app's Shopify connection is content-only
  (`read_customers, read_content, write_content`). Creating products needs
  **`write_products`** (+ `read_products`). Etsy read access already exists
  (`listings_r`), so that's the only missing piece.
- **Steps:**
  1. **Widen the Shopify scope.** In the Shopify **Dev Dashboard** app
     (dev.shopify.com), create a **new version**, add `write_products` +
     `read_products` to the **required** scopes (not "optional"), and **Release**.
     *(Re-verify the Dev Dashboard UI before doing this — it changes; see the
     Shopify section in the main CLAUDE.md.)*
  2. **Re-authorize.** Visit `/api/shopify/connect` and approve, so a new
     offline token with the product scopes is minted + stored in Firestore.
  3. **Build the transfer endpoint.** Server-side: given an Etsy listing (or all
     currently-unmatched listings), pull its images / title / description /
     price / tags via the Etsy API and create a matching Shopify product
     (Admin API product create + image upload).
  4. **Review before live.** Create the Shopify product as a **draft** so Sophie
     approves it before it publishes (matches how Etsy drafts are reviewed).
  5. **Trigger.** A button in the app's shop (or a chat command) to transfer the
     missing items.
- **Currently missing from Shopify (on Etsy, not shown in the app):**
  - Magic Rituals Card Deck
  - Boo-Boo Doll (healing witchcraft Band-Aid kit)
  - *(A third "Witchcraft Kit" Etsy listing is effectively a duplicate — Sophie
    already has witchcraft-kit products on Shopify.)*

### Background jobs — two minor cases left (Sophie's call)
Everything slow on the Home tab is now a resumable background job (survives
leaving the app). Two low-impact cases were left synchronous on purpose —
convert if Sophie wants, but neither loses real work:
- **Miracles studio illustrations** (Shadows → "Open the Miracles studio",
  legacy/toggle-gated). The page text saves to localStorage immediately; only
  the illustration is synchronous, so leaving mid-render just leaves a page with
  no picture (re-openable), not a lost result. Converting needs per-entry job
  tracking. `/api/generate/replicate` + `/api/generate/dalle`, client
  `genImage()` (~line 2263).
- **Natal chart** ("Cast my birth chart", ~5s: geocode + gpt-4o-mini). Moderate,
  not a long image gen; stateless so a dropped fetch = redo. `/api/witch/natal`.

## Done
- **Background jobs:** Suspicious Coincidence (gpt-image-2 **low**, was the slow
  medium call that lost its image on leaving), Dream "Unlock the symbolism", and
  Dream "Illustrate" are all fire-and-forget jobs that persist a pending id and
  resume polling on return — no spinner-watching, no lost results. Generic
  runner: `POST /api/witch/job` + `GET /:id`. *(2026-07-21)*
- Shop mirrors Etsy: order + filter to Etsy items only, clean one-line display
  names (long SEO titles kept on Shopify). *(2026-07-21)*
- Shop tab is boxless (sharp-corner image + text under, no card outline).
