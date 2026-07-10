# ImageForge — project notes

## Live app
- **Deployed:** https://imageforge-q125.onrender.com (Render.com, free plan)
  - Hub: https://imageforge-q125.onrender.com/
  - Test Station: https://imageforge-q125.onrender.com/test
  - Picture Book (Miracles): https://imageforge-q125.onrender.com/book
  - Illustrated Zine (Talking to Myself): https://imageforge-q125.onrender.com/talking
  - Gallery: https://imageforge-q125.onrender.com/gallery

## What it is
A hub for making illustrated projects (card decks, picture books, sticker
sheets, zines, single images). Home screen (`/`) is a grid of project types;
each opens a focused workflow that shares the same house styles.

## Stack
- Single-file Node/Express backend: `server.js` (~"v11").
- Static frontend in `public/` (`index.html` = hub, `test.html`, `book.html`,
  `talking.html`, `gallery.html`); shared design system in `public/forge.css`.
- Deployed on Render via `render.yaml`. Env vars set in the Render dashboard
  (all `sync:false`): `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`,
  `FIREBASE_SERVICE_ACCOUNT`. Firebase project id: `membry-df528`.

## Image generation
- OpenAI `gpt-image-2` (the zine; single/sticker can also use DALL·E 3).
- Replicate Flux LoRA house styles in `MODELS.replicate` (`server.js`). Each has
  a trigger word prepended to the prompt. A model may pin a `version` hash or
  leave it `null` to resolve the latest from Replicate on first use (cached).
  Styles: Gouache (gosh), Painterly (pnt), Sketchy (special), Book Illustrations
  (vict), Watercolor Drawings (wtr), PWC Scans (tok), **HOONIE** linocut
  (`sageryza/hoonie`, trigger `HOONIE`, suffix "linocut relief print, white
  background", 40 inference steps — applied automatically server-side).
- Committed style previews live in `public/samples/<seg>.webp` (used by the Test
  Station tiles). Regenerate with `node scripts/gen-samples.js` against a running
  server (needs `REPLICATE_API_TOKEN`).
- `saveToFirebase()` uploads generated images to Firebase Storage for permanent
  URLs + the gallery; without `FIREBASE_SERVICE_ACCOUNT` images are temporary
  (~1hr) Replicate/OpenAI URLs.

## Design rules (forever)
- **No pills.** Text buttons are rounded rectangles — `border-radius: 6px`.
  Circular icon buttons (toggles, dots) are the only exception.
- **Always use full clickable links** in updates — app pages, the deployed URL,
  PRs — never bare text the user has to assemble.
- **Always include clickable testing links** when something is ready to test:
  the deployed page for the feature plus the PR link.
- **Copy-paste / handoff messages = one code block.** When the user asks for a
  message to copy-paste, forward, or hand off to another chat, put the ENTIRE
  message inside a single fenced code block so it copies in one tap — no
  commentary mixed in, never split across sections or styled headers.

## Sibling repos
- `memory-library-react` — the games (incl. the Xi card deck), live at
  incaseofamnesia.com; Firebase Cloud Functions that read API keys from
  locked-down Firestore docs (`config/replicate`, `config/openai`, etc.).
- `sage-lora-app` — a minimal standalone Replicate LoRA generator.

## Dev workflow
- Develop on a feature branch, commit + push, open a DRAFT PR.

## Audio messages (forever)
- **Long replies also become voice notes.** Whenever a reply is long — it explains
  multiple things, answers several questions, or asks several important questions —
  ALSO generate an audio version and send it as an mp3 file alongside the text.
- **Format: male British voice at 1.2x speed.** Generate with OpenAI TTS (model
  `gpt-4o-mini-tts`, voice `onyx`, instructions: "warm, natural male British accent
  (RP), conversational"), using `OPENAI_API_KEY` from the environment (ask Sage for
  a key if it is not set). Then speed it up with `ffmpeg -filter:a "atempo=1.2"`
  and send the mp3 to Sage.
- Adapt the text for listening: skip URLs and code, read numbers naturally, keep
  the wording otherwise faithful to the written message.
