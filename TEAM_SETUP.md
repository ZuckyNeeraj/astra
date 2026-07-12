# Team Setup — running Astra locally

This gets `make dev` working against the **shared team backend**. Everyone points
at the same Convex dev deployment (`quirky-mallard-785`), so all the API keys
(Gmail, OpenAI, ElevenLabs, etc.) already work server-side — you don't need any
of them locally.

## Prerequisites

- Node.js + npm
- The **Convex dev deploy key** — ask the maintainer for it (it's a secret, shared
  privately, not committed). It starts with `dev:quirky-mallard-785|...`.

## Setup

From the repo root:

```bash
# 1. Root env — the deploy key is what connects you to the shared backend.
cat > .env.local <<'EOF'
CONVEX_DEPLOY_KEY=<paste the dev deploy key here>
EOF

# 2. Frontend env — public Convex URLs only, no secrets.
cat > frontend/.env.local <<'EOF'
VITE_CONVEX_URL=https://quirky-mallard-785.convex.cloud
VITE_CONVEX_SITE_URL=https://quirky-mallard-785.convex.site
EOF
```

Then install and run:

```bash
make install
make dev
```

`make dev` runs the Convex backend sync + the Vite frontend together (Ctrl-C stops
both). With `CONVEX_DEPLOY_KEY` set, no Convex login is needed.

## ⚠️ We all share one backend and one set of data

- **Do not run `make wipe` or `make reset`** — they wipe/reset the demo for
  *everyone*, not just you.
- `.env.local` files are gitignored — never commit them or the deploy key.

## Handy commands

Run `make` (or `make help`) to see everything. Common ones:

| Command      | What it does                                         |
| ------------ | ---------------------------------------------------- |
| `make dev`   | Run Convex backend + Vite frontend together          |
| `make web`   | Run only the Vite frontend                           |
| `make db`    | Run only the Convex dev backend                      |
| `make stop`  | Stop any running Convex/Vite dev servers             |

## Troubleshooting

- **Frontend loads but data never appears / Convex errors** — check
  `frontend/.env.local` has `VITE_CONVEX_URL` and you restarted `make dev` after
  creating it (Vite only reads env on startup).
- **`convex dev` asks you to log in or create a project** — your root `.env.local`
  is missing `CONVEX_DEPLOY_KEY`, or the key is wrong. Confirm it starts with
  `dev:`.
- **Key stopped working** — the maintainer may have rotated it. Ask for the new
  one and update `CONVEX_DEPLOY_KEY` in your root `.env.local`.
