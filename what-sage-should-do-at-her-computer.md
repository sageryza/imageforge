# What Sage Should Do While She's at Her Computer

A running list of things that are easier (or only possible) on a real computer,
not the phone. **Any chat can add to this** — drop new items under "Backlog" with
a short why. Keep links as full clickable `https://…` links so they're one tap.

_Last updated: August 6, 2026._

---

## ⭐ Active: Set up a Google Ads account (so it's ready if we decide to use it)

You don't have to *run* any ads today. The goal is just to get the account,
billing, and verification done now, because verification can take a few days and
you rarely have a computer free. Once it exists, we can turn ads on or off any
time.

### First, two things worth knowing before you spend a cent

- **Etsy already advertises you on Google for free-until-it-sells.** Etsy's
  "Offsite Ads" automatically puts your listings on Google, Facebook, etc. You
  pay nothing up front — only a commission (12–15%) when a sale comes *from* one
  of those ads. So you already have Google exposure. Your own Google Ads account
  is a *separate, optional* lever on top of that. Manage Etsy's version here:
  [Etsy Offsite Ads settings](https://www.etsy.com/your/shops/me/advertising).
- **Tracking Etsy sales in Google Ads is limited.** Google can't see a "purchase"
  happen on Etsy (we can't put Google's tracking code on Etsy's pages). So we
  measure success through clicks + Etsy's own Stats, using tagged links. Just know
  it's not as airtight as a normal store — we'll be reading tea leaves a bit.

### The setup checklist (do these on the computer)

1. **Go to** [ads.google.com](https://ads.google.com) and sign in with the Google
   account you want to own this (probably your shop email).
2. **Skip the "smart" fast-setup.** Google will try to force you to build a
   campaign immediately. Look for **"Switch to Expert Mode"** (or a
   "Create an account without a campaign" link) and click it. This is the single
   most important step — it avoids getting railroaded into a live, spending
   campaign.
3. **Set your business info** (these are permanent, so get them right):
   - Country: **United States**
   - Time zone: **Pacific Time**
   - Currency: **USD**
4. **Add billing:** your business name/address + a card. Billing country US.
   You won't be charged unless a campaign is running.
5. **Do the verification steps if prompted.** Google increasingly asks for
   advertiser identity verification (a document + sometimes a phone code). It can
   take a few days to clear — this is the whole reason to do it now.
6. **Leave it with NO active campaign.** When you finish setup, make sure there's
   nothing running / everything is paused. An empty account costs $0.
7. **Tell me when it's done.** Then, whenever you want, I can help you plan the
   first campaign — likely a small Search or Performance Max campaign pointing at
   your best-converting listings, with tagged links so we can watch it in Etsy
   Stats.

### Optional, only if you get curious later
- Google Merchant Center ([merchants.google.com](https://merchants.google.com))
  is what powers Google *Shopping* (the product-photo ads). It needs a product
  feed, which is fiddly with Etsy — skip it for now. Search/Performance Max ads
  that link to your Etsy listings don't need it.

---

## Backlog (other computer-only tasks — add here)

_Chats: add items below with a one-line reason._

- **NDE supercut — ONE computer session banks everything (July 2026 flow).**
  Run on the computer because YouTube blocks the cloud servers' IPs; your home
  internet works. Needs `yt-dlp` once (`brew install yt-dlp`).
  1. **Run the grab-everything script** (`scripts/nde-grab-all.js`, a chat sends
     it as a download): `node "$(ls -t ~/Downloads/*grab-all*.js | head -1)"`.
     It self-discovers EVERY "near death experience of …" interview on Anthony
     Chene's channel, stores each transcript (free — no AI call) AND uploads the
     full-quality audio straight to Firebase (`nde-audio/`). Safe to leave
     running unattended (~1-2h); re-running resumes/skips what's done.
  2. **That's it — the computer is done forever.** Any chat can then mine themes
     (`scripts/nde-themes.js`, ~$1-2/25 videos on gpt-5.6-sol) and cut clips
     server-side from the banked audio (`scripts/nde-slice-server.js` — needs
     ffmpeg: `apt-get install -y --no-install-recommends ffmpeg`, plus the
     deckfactory service account; outputs public clip links + a ZIP), with no
     computer involved — works while Sophie is traveling.

- **Cut 4 reference clips out of Donnie Darko (Director's Cut).** Must run on
  the computer — the cloud sessions can't reach the upload at all (YouTube
  geo-restricts it to the US and blocks datacenter IPs). Source video:
  https://youtu.be/8b95qGVqw6w
  Timestamps were located against a Director's-Cut-synced subtitle track, so
  they should match — but **run the mailbox one first to check for an offset**
  (if the uploader added an intro card, add that many seconds to all four).
  1. **55:35–56:10** — "I just don't debate it anymore" (the God-exists line;
     he says it twice, at 55:46 and 55:58).
  2. **1:03:22–1:03:50** — the mom saying she doesn't recall him ever having
     mentioned a rabbit.
  3. **25:48–26:06** — the old woman at the mailbox, "No mail today. Maybe
     tomorrow." ← run this one first as the offset check.
  4. **2:01:28–2:06:30** — the reversal sequence through to him waking up in
     bed laughing. A window, not an exact mark: it's wordless, so there were
     no subtitle cues to pin inside it. Bounded by his letter voiceover ending
     at 2:01:32 and the next morning's dialogue starting at 2:06:22.

  Needs `brew install yt-dlp ffmpeg` once. Then per clip:
  `yt-dlp -f 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b' --force-keyframes-at-cuts
  --download-sections "*00:25:48-00:26:06" -o "03-mailbox.%(ext)s" <url>`.
  `--force-keyframes-at-cuts` is what makes the cut land on the exact second
  instead of snapping to the nearest keyframe (it re-encodes, so it's slower).
- **Set up YouTube auto-upload (OAuth).** So a chat can push finished videos to
  your channel as private drafts (you just tap Publish). One-time browser sign-in
  only you can do. On the computer: create a Google Cloud project → enable
  **YouTube Data API v3** → OAuth consent screen (External, add yourself as a Test
  user, then Publish app to Production) → create an **OAuth client (Desktop app)**
  → paste the Client ID + secret into chat. Start:
  https://console.cloud.google.com/apis/credentials
- **Add `ELEVENLABS_API_KEY` to the Claude Code environment settings.** So every
  future chat can use the cloned "Voice A" for video voiceovers without you
  re-pasting the key each session. (Same place `OPENAI_API_KEY` / `REPLICATE_API_TOKEN` live.)
- _(example) Reconnect the Etsy app authorization at
  https://imageforge-q125.onrender.com/api/etsy/connect if the shop report ever
  shows a "reconnect" banner — needs a browser sign-in._

---

## Done

_Move finished items here with the date._
