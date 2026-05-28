# Vibe Code Collab — deployment workspace

A **documentation and deployment** repository for **Vibe Code Collab**, a federated community platform built on a [Lemmy](https://github.com/LemmyNet/lemmy) backend and a [Blorp](https://github.com/Blorp-Labs/blorp) frontend fork.

This repo does **not** contain Lemmy or Blorp source code. Those live in **two separate Git repositories** that you clone next to this project. Use this repo to document your setup, track deploy config, and manage the workflow between **Cursor → GitHub → DigitalOcean → Cloudflare Pages**.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Users (browser / mobile)                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Pages          ←  Blorp fork (Vibe Code Collab UI)  │
│  app.yourdomain.com        REACT_APP_DEFAULT_INSTANCE → Lemmy   │
└────────────────────────────┬────────────────────────────────────┘
                             │ Lemmy API (HTTPS, CORS)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  DigitalOcean              ←  Lemmy repo (Docker Compose)       │
│  lemmy.yourdomain.com      lemmy + postgres + pictrs + nginx    │
└─────────────────────────────────────────────────────────────────┘
```


| Component          | Repo                                                                   | Deploy target    | Role                                            |
| ------------------ | ---------------------------------------------------------------------- | ---------------- | ----------------------------------------------- |
| **This workspace** | *your* `vibecode-collab` (or similar)                                  | GitHub           | Docs, scripts, deploy templates                 |
| **Lemmy**          | *your fork* of [LemmyNet/lemmy](https://github.com/LemmyNet/lemmy)     | DigitalOcean     | Backend API, federation, database               |
| **Blorp fork**     | *your fork* of [Blorp-Labs/blorp](https://github.com/Blorp-Labs/blorp) | Cloudflare Pages | Vibe Code Collab UI (replaces default lemmy-ui) |


## Quick start

### 1. Clone this deployment repo

```bash
git clone git@github.com:YOUR_GITHUB_USER/vibecode-collab.git
cd vibecode-collab
```

### 2. Clone Lemmy and Blorp (separate repos)

```bash
chmod +x scripts/*.sh
./scripts/setup.sh
```

Or clone manually:

```bash
git clone --recurse-submodules https://github.com/LemmyNet/lemmy.git lemmy
git clone https://github.com/Blorp-Labs/blorp.git blorp
```

After you create **your own forks**, point `origin` at them and optionally set URLs in `.env`:

```bash
cp .env.example .env
# Edit .env, then:
export LEMMY_REPO=https://github.com/YOUR_USER/lemmy.git
export BLORP_REPO=https://github.com/YOUR_USER/blorp.git
./scripts/setup.sh
```

### 3. Check status across all three repos

```bash
./scripts/repo-status.sh
```

### 4. Deploy Vibe Code Collab UI to Cloudflare Pages (local build)

Cloudflare’s remote build often cannot build the Blorp frontend. From this repo root:

```bash
pnpm install
cp deploy/cloudflare/.env.example deploy/cloudflare/.env
cp deploy/cloudflare/blorp.production.env.example blorp/.env.production
# Edit both env files, then:
pnpm exec wrangler login
pnpm build:web:prod
pnpm deploy:cloudflare:prod
```

See [deploy/cloudflare/README.md](deploy/cloudflare/README.md).

## Repository layout

```
vibecode-collab/          ← THIS REPO (deployment + docs)
├── README.md
├── package.json          ← pnpm build:web:prod, deploy:cloudflare:prod
├── docs/
├── deploy/               ← DO / Cloudflare (Wrangler Pages upload)
├── scripts/
├── services/bots/      ← manual bot-posting admin (queue + Lemmy API)
├── .env.example
├── lemmy/                ← separate git repo (gitignored here)
└── blorp/                ← separate git repo (gitignored here)
```

`lemmy/` and `blorp/` are **ignored by this repo’s `.gitignore`** so you never accidentally commit upstream application code into the deployment repo. Each directory is a normal git clone with its own `origin`, branches, and pull requests.

## Documentation


| Doc                                                | Description                                     |
| -------------------------------------------------- | ----------------------------------------------- |
| [docs/repositories.md](docs/repositories.md)       | Three-repo model, forking, remotes, branching   |
| [docs/local-setup.md](docs/local-setup.md)         | Local development with Cursor                   |
| [docs/deployment.md](docs/deployment.md)           | DigitalOcean (Lemmy) + Cloudflare Pages (Blorp) |
| [docs/cursor-workflow.md](docs/cursor-workflow.md) | Day-to-day maintenance across repos             |


## Publishing to your GitHub

### This repo (deployment)

1. Create a new GitHub repository (e.g. `vibecode-collab`).
2. Push this workspace (without `lemmy/` or `blorp/` — they are gitignored):
  ```bash
   git remote add origin git@github.com:YOUR_GITHUB_USER/vibecode-collab.git
   git push -u origin main
  ```

### Lemmy and Blorp (application repos)

Fork upstream, then repoint remotes in each clone:

```bash
# Lemmy
cd lemmy
git remote rename origin upstream
git remote add origin git@github.com:YOUR_GITHUB_USER/lemmy.git
git push -u origin main

# Blorp
cd blorp
git remote rename origin upstream
git remote add origin git@github.com:YOUR_GITHUB_USER/blorp.git
git push -u origin main
```

See [docs/repositories.md](docs/repositories.md) for sync with upstream and release tagging.

## Environment variables (overview)

**Vibe Code Collab UI** (Blorp fork, build time on Cloudflare Pages) — copy from [blorp/.env.example](blorp/.env.example) after cloning:


| Variable                             | Purpose                                     |
| ------------------------------------ | ------------------------------------------- |
| `REACT_APP_NAME`                     | Display name in the UI (`Vibe Code Collab`) |
| `REACT_APP_TAGLINE`                  | Subtitle in browser tab / SEO               |
| `REACT_APP_PUBLIC_URL`               | Public app URL for legal pages              |
| `REACT_APP_SUPPORT_EMAIL`            | Support contact email                       |
| `REACT_APP_GITHUB_REPO`              | Optional GitHub repo for support links      |
| `REACT_APP_DEFAULT_INSTANCE`         | Your Lemmy URL (must match production API)  |
| `REACT_APP_LOCK_TO_DEFAULT_INSTANCE` | `1` to restrict users to your instance      |
| `REACT_APP_INSTANCE_SELECTION_MODE`  | e.g. `default_first`                        |


**Lemmy** (runtime on DigitalOcean) — configure in `lemmy/docker/lemmy.hjson` (see Lemmy admin docs).

A consolidated template lives in [.env.example](.env.example) for your own notes (not used by Lemmy/Blorp directly).

## Licenses

- [Lemmy](https://github.com/LemmyNet/lemmy) — AGPL-3.0
- [Blorp](https://github.com/Blorp-Labs/blorp) — AGPL-3.0

If you distribute modified versions, comply with the respective licenses.

## Next steps

1. Fork Lemmy and Blorp on GitHub and update remotes ([docs/repositories.md](docs/repositories.md)).
2. Push this deployment repo to GitHub.
3. Follow [docs/deployment.md](docs/deployment.md) for DigitalOcean and Cloudflare Pages.
4. Add instance-specific files under `deploy/` (compose overrides, `lemmy.hjson` snippets, Pages env checklist).

