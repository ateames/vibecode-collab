# Bot posting admin (MVP)

Manual review queue for `@ai_tool_news_bot` and `@github_projects_bot`. Post or ignore queued items via a small admin UI; posts go to Lemmy through the v3 API.

## Quick start (local)

```bash
cd services/bots
cp .env.example .env
# Edit .env: ADMIN_API_TOKEN, bot passwords, LEMMY_BASE_URL

pnpm install
pnpm db:migrate

# Resolve community IDs (requires communities to exist on the instance)
pnpm lemmy:resolve-communities
# Copy printed IDs into .env

pnpm seed:queue
pnpm dev
```

Open [http://127.0.0.1:3030/admin](http://127.0.0.1:3030/admin), set the API token (same as `ADMIN_API_TOKEN`), click **Fetch new content** to ingest from GitHub/RSS, then use Post / Ignore.

## API

All `/admin/bot-posts/*` routes require `Authorization: Bearer <ADMIN_API_TOKEN>`.


| Method | Path                          | Description                  |
| ------ | ----------------------------- | ---------------------------- |
| GET    | `/health`                     | Liveness (no auth)           |
| GET    | `/admin`                      | Admin HTML UI                |
| GET    | `/admin/bot-posts/pending`    | Pending + failed queue items |
| POST   | `/admin/bot-posts/ingest`     | Fetch GitHub + RSS into queue |
| POST   | `/admin/bot-posts/:id/post`   | Post to Lemmy                |
| POST   | `/admin/bot-posts/:id/ignore` | Mark ignored                 |


## Setup checklist

1. Create Lemmy users `ai_tool_news_bot` and `github_projects_bot`.
2. Create bot target communities on Lemmy (or reuse existing ones). Set `*_COMMUNITY_NAME` to each community’s **slug** (the `/c/<slug>` segment), e.g. `tools_and_workflows` — not the display title. Add bots as members (mods if required).
3. Run `pnpm lemmy:resolve-communities` and copy the printed `*_COMMUNITY_ID` lines into `.env`.
4. Run `pnpm lemmy:mark-bot-accounts` (or set bot flag in lemmy-ui profile).
5. Configure `services/bots/.env` (see `.env.example`).
6. `pnpm db:migrate && pnpm seed:queue`.
7. `pnpm dev` locally, or run on the droplet bound to `127.0.0.1` and use SSH port forwarding.

## Production (droplet)

Run on the server (not public):

```bash
# On droplet, after cloning deployment repo
cd services/bots
cp .env.example .env   # fill production values
pnpm install
pnpm db:migrate
pnpm start             # or use systemd — see deploy/digitalocean/bots-admin.service.example
```

Access admin from your machine:

```bash
ssh -L 3030:127.0.0.1:3030 user@your-droplet
# Then open http://localhost:3030/admin
```

## Content ingestion

Configure in `.env` (see `.env.example`):

- **GitHub projects (search)** — `GITHUB_TOKEN` (recommended), `GITHUB_SEARCH_QUERIES` (comma-separated) or legacy `GITHUB_SEARCH_QUERY`, `GITHUB_SEARCH_SORT`, `GITHUB_SEARCH_PER_PAGE`, `GITHUB_MAX_AGE_DAYS`
- **GitHub projects (awesome lists)** — `GITHUB_AWESOME_LIST_REPOS` (comma-separated `owner/repo`), `GITHUB_AWESOME_MAX_NEW_PER_LIST`, `GITHUB_AWESOME_RESOLVE_MONOREPO_PATHS` (resolve relative README paths to `/tree/...` URLs)
- **AI tool news** — `AI_NEWS_RSS_URLS` (comma-separated feed URLs), `AI_NEWS_MAX_ITEMS_PER_FEED`, `AI_NEWS_MAX_AGE_DAYS`

Example search queries:

```env
GITHUB_SEARCH_QUERIES=topic:coding-agents+stars:>50+pushed:>2025-03-01,topic:ai-coding+stars:>100+pushed:>2025-03-01
GITHUB_SEARCH_SORT=updated
```

Example awesome-list sources (coding agents / AI agent curations):

```env
GITHUB_AWESOME_LIST_REPOS=Arindam200/awesome-ai-apps,Shubhamsaboo/awesome-llm-apps,Jenqyang/Awesome-AI-Agents,caramaschiHG/awesome-ai-agents-2026,kyrolabs/awesome-agents
```

On the **first ingest**, each list may add up to `GITHUB_AWESOME_MAX_NEW_PER_LIST` items (filtered by repo recency). Later ingests only queue **newly added README links** not seen in the prior snapshot. `GITHUB_TOKEN` is required for awesome-list ingestion.

Ingest via admin **Fetch new content** or API:

```bash
curl -X POST http://127.0.0.1:3030/admin/bot-posts/ingest \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sources":["all"]}'
```

Duplicates are skipped using `(source_type, source_external_id)`.

## AI summaries

When `OPENAI_API_KEY` is set and `SUMMARIZER_ENABLED=true` (default), ingest generates a 2–3 sentence summary for each new link before it enters the queue. Summaries are stored in `body`, shown in the admin **Summary** column, and published to Lemmy so they appear in Blorp feed cards.

Configure in `.env`:

- `OPENAI_API_KEY` — required for summaries; omit to keep RSS/GitHub excerpts only
- `OPENAI_MODEL` — default `gpt-4o-mini`
- `SUMMARIZER_ENABLED` — set `false` to disable without removing the key
- `SUMMARY_MIN_SOURCE_CHARS` — fetch linked page when RSS excerpt is shorter (default `200`)
- `SUMMARY_MAX_OUTPUT_CHARS` — cap summary length (default `300`)

GitHub project links use the repo README when available; news links use the RSS excerpt or fetch the article HTML as fallback. Failed summaries do not block ingest — the original body is kept.

## Scripts


| Script                           | Purpose                               |
| -------------------------------- | ------------------------------------- |
| `pnpm db:migrate`                | Apply SQLite schema                   |
| `pnpm seed:queue`                | Insert sample pending items           |
| `pnpm lemmy:resolve-communities` | Print community IDs for `.env`        |
| `pnpm lemmy:mark-bot-accounts`   | Set `bot_account: true` for bot users |
| `pnpm test`                      | Unit tests                            |


## Security

- Service defaults to `HOST=127.0.0.1` — not exposed on the public internet.
- Protect with a long `ADMIN_API_TOKEN`.
- Never commit `.env` or bot passwords.