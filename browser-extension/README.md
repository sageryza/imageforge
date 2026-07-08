# Send to Deck Factory — Chrome extension

One click on midjourney.com to push the images on the page straight into the Deck
Factory import pipeline (`/api/ingest/upload`) — no bulk-download, no manual
upload. It runs entirely in **your** browser on **your** logged-in session; it
never sees your Midjourney password and never touches Midjourney's servers, it
just automates "grab these images and send them to my app."

## Install (one time, ~2 minutes)

1. Download this `browser-extension/` folder to your computer.
2. Go to `chrome://extensions` (works in Chrome, Edge, Brave, Arc).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and pick this `browser-extension/` folder.
5. Pin the extension, click it, and fill in:
   - **App URL** — your deployed app (default `https://imageforge-q125.onrender.com`).
   - **Studio token** — your `STUDIO_TOKEN` (the import route is gated by it).
   - **Batch name** — e.g. `houseplants`.
   - **Keyword** — optional tag (e.g. `calathea`) so a batch is searchable later.
   - **Save.**

## Use

1. Go to midjourney.com and show the images you want (scroll them into view, or
   open your likes / a keyword search).
2. Click the floating **🌿 Send to Deck Factory** button (bottom-right).
3. It sends every Midjourney image on the page into your batch and shows a toast
   with the count. Then tell Claude the batch name and it'll review them.

## Heads-up (first-run calibration)

Midjourney's page layout isn't public and changes over time, so the image-grabbing
logic (`collectMidjourneyImageUrls` / `toFullRes` in `content.js`) may need a small
tune-up the first time. It logs what it found to the browser console
(`[Deck Factory] found N image(s)`) — if the count or resolution looks off, that
one function is where to adjust. Two things to verify on the first real run:

- **It grabs the images you expect** (not thumbnails of the wrong things).
- **Full resolution:** `toFullRes` upgrades thumbnail URLs to full-size; if the
  imported images come in small, that transform needs adjusting to match
  Midjourney's current CDN URL format.

If the app's import route rejects the raw Midjourney URLs (e.g. they need your
session), the fallback is to fetch each image in the background worker first — a
small change to `background.js`. Ping Claude and it'll adjust.
