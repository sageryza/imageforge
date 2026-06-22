# ImageForge

A small Express app for turning text into illustrated visuals — card decks,
sticker sheets, single images, and **A Little Book of Miracles** (an illustrated
flip-through book of everyday miracles & synchronicities).

## Pages

- `/` — main forge (Stickers, Deck, Single, Settings)
- `/book` — Little Book of Miracles (Write + Read)
- `/talking` — Talking to Myself (standalone illustrated zine of dreams,
  memories & wishes; uses `gpt-image-1` with a `dall-e-3` fallback)
- `/gallery` — all saved images

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
