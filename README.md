# ImageForge

A hub for turning text into illustrated projects. The home screen (`/`) is a
grid of project types — each opens a focused workflow that shares the same set
of house styles (gpt-image-2 plus the Replicate Flux LoRAs).

## Pages

- `/` — **the hub**: a home screen listing every project type. The Card Deck,
  Sticker Sheet, Single Image and Styles & Settings workflows live here as
  focused in-page workspaces; the others link out to their own pages.
- `/book` — **Picture Book**: A Little Book of Miracles (Write + Read)
- `/talking` — **Illustrated Zine**: Talking to Myself (dreams, memories &
  wishes rendered as diary-comic panels; uses `gpt-image-2`)
- `/gallery` — all saved images, grouped by project

## Design system

Shared tokens and components live in [`public/forge.css`](public/forge.css).
Design rule: **no pill-shaped buttons** — text buttons are rounded rectangles
(`border-radius: 6px`); circular icon buttons are the only exception.

## House styles

The Replicate LoRAs are defined in `MODELS.replicate` in `server.js`. Each has a
trigger word that's prepended to every prompt. A model may pin a `version` hash
or leave it `null` to resolve the latest version from Replicate on first use —
that's how **HOONIE** (`sageryza/hoonie`, a vintage linocut/engraving LoRA) is
wired in, with its `linocut relief print, white background` suffix and 40
inference steps applied automatically.

## Environment variables

Secrets are read from the environment — never commit them. See `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | Text generation + DALL·E images |
| `REPLICATE_API_TOKEN` | yes | Replicate (custom LoRA) styles |
| `FIREBASE_SERVICE_ACCOUNT` | optional | Save images permanently + gallery |
| `PORT` | optional | Defaults to 3001 (Render sets this) |

## Run locally

```bash
npm install
cp .env.example .env   # then fill in your keys
# load .env into your shell, or export the vars manually, then:
npm start
```

Open http://localhost:3001 (or http://localhost:3001/book).

## Deploy on Render

This repo includes a `render.yaml` Blueprint.

- **New setup:** Render Dashboard → New → Blueprint → pick this repo. It creates
  the web service; set `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, and (optionally)
  `FIREBASE_SERVICE_ACCOUNT` when prompted (they're marked `sync: false`).
- **Existing service:** if a Render service is already connected to this repo,
  it auto-deploys on each push to your default branch. Just make sure the env
  vars above are set under the service's **Environment** tab, then redeploy.

Build command: `npm install` · Start command: `npm start`
