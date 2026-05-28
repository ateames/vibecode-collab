# Local development

Work from the **parent folder** so all three repos sit side by side. Cursor can open the whole directory; use multi-root or focus on `lemmy/` / `blorp/` when editing application code.

## Prerequisites

| Tool | Lemmy | Blorp |
|------|-------|-------|
| Docker + Compose | Required for full stack | Optional (API-only dev) |
| Rust toolchain | For building from source | — |
| Node.js 20+ | — | Required |
| pnpm | — | `corepack enable` |

## Workspace bootstrap

```bash
./scripts/setup.sh
./scripts/repo-status.sh
```

## Lemmy (local backend)

Official paths:

- Docker: `lemmy/docker/` — see [Lemmy Docker Development](https://github.com/LemmyNet/lemmy/blob/main/docker/README.md)
- Local Rust: [Contributing / Local Development](https://github.com/LemmyNet/lemmy/blob/main/readmes/README.md)

Typical Docker quick start:

```bash
cd lemmy/docker
cp lemmy.hjson.example lemmy.hjson   # if example exists; else edit lemmy.hjson
docker compose up -d
```

Default compose exposes the stack on port **1236** (see `docker-compose.yml`). Adjust `lemmy.hjson` for hostname, federation, and pictrs.

For Blorp-only UI work, you only need the **Lemmy API** reachable (local Docker or a staging instance).

## Blorp (local frontend)

```bash
cd blorp
corepack enable
pnpm install
cp .env.example .env
```

Point Blorp at your Lemmy API in `.env`:

```env
REACT_APP_NAME=Vibe Code Collab
REACT_APP_DEFAULT_INSTANCE=http://localhost:1236
REACT_APP_LOCK_TO_DEFAULT_INSTANCE=1
REACT_APP_INSTANCE_SELECTION_MODE=default_first
```

Use `https://` and your real hostname when testing against staging/production.

```bash
pnpm dev        # Vite dev server
pnpm build      # Production build (includes Capacitor sync)
pnpm test       # Unit tests
```

## Production Blorp → Cloudflare Pages (from workspace root)

When Cloudflare cannot build Blorp remotely, use the deployment repo scripts (see [deploy/cloudflare/README.md](../deploy/cloudflare/README.md)):

```bash
cd ..   # vibecode-collab root, if you were in blorp/
pnpm install
cp deploy/cloudflare/blorp.production.env.example blorp/.env.production
# edit blorp/.env.production and deploy/cloudflare/.env
pnpm build:web:prod
pnpm deploy:cloudflare:prod
```

`build:web:prod` runs **Vite only** (faster, smaller artifact than Blorp’s full `pnpm build`).

## Bot posting admin (`services/bots`)

Manual queue for `@ai_tool_news_bot` and `@github_projects_bot` (post / ignore before publishing to Lemmy).

```bash
cd services/bots
cp .env.example .env
# Set ADMIN_API_TOKEN (16+ chars), LEMMY_BASE_URL=http://localhost:1236, bot passwords

pnpm install
pnpm db:migrate
pnpm lemmy:resolve-communities   # copy community IDs into .env
pnpm seed:queue
pnpm dev
```

Open http://127.0.0.1:3030/admin and enter the same token as `ADMIN_API_TOKEN`. Use **Fetch new content** to pull GitHub repos (Search API) and AI news (RSS) into the queue after configuring `GITHUB_SEARCH_QUERY`, optional `GITHUB_TOKEN`, and `AI_NEWS_RSS_URLS` in `.env`. Full checklist: [services/bots/README.md](../services/bots/README.md).

From the workspace root you can also run `pnpm bots:dev`, `pnpm bots:migrate`, and `pnpm bots:seed`.

## CORS and local API

Blorp runs in the browser and calls the Lemmy API cross-origin. Production Lemmy must allow your Blorp origin. For local dev:

- Run Blorp on the host/port Vite prints (often `http://localhost:5173`).
- Ensure Lemmy/CORS settings allow that origin, or use the same reverse proxy in dev.

Check Lemmy admin docs and your `lemmy.hjson` for `cors_origin` / related settings when moving from local to production.

## Recommended Cursor layout

1. Open folder: `vibecode-collab` (entire workspace).
2. Terminal panel: tab per repo (`cd lemmy`, `cd blorp`).
3. Use `.cursor/rules` in each repo if you add project-specific AI rules later.

## Updating dependencies

```bash
# Lemmy — follow upstream release notes; rebuild Docker images
cd lemmy && git pull && cd docker && docker compose pull && docker compose up -d --build

# Blorp
cd blorp && git pull && pnpm install
```

Record versions you ship in `deploy/VERSIONS.md` (create when you first deploy).
