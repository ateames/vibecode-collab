# Repository model

This project uses **three independent Git repositories**. Only the deployment workspace (this repo) is tracked when you `git commit` at the project root.

## Roles

| Repository | Typical GitHub name | Contains |
|------------|---------------------|----------|
| **Deployment** | `vibecode-collab` | README, docs, `deploy/`, scripts, `.env.example` |
| **Lemmy** | `lemmy` (your fork) | Rust backend, `docker/`, migrations, config templates |
| **Blorp** | `blorp` (your fork) | React/Vite frontend, Blorp-specific env and CI |

## Why separate repos?

- **Different deploy targets** — Lemmy on DigitalOcean (Docker), Blorp on Cloudflare Pages (static build).
- **Different release cycles** — Pull Lemmy security updates without touching Blorp, and vice versa.
- **Clear Cursor scope** — Open `lemmy/` or `blorp/` when working on that stack; open the root when editing deploy docs.
- **Upstream alignment** — Stay close to [LemmyNet/lemmy](https://github.com/LemmyNet/lemmy) and [Blorp-Labs/blorp](https://github.com/Blorp-Labs/blorp) via `upstream` remotes.

## Initial fork setup

### 1. Fork on GitHub

- Fork [LemmyNet/lemmy](https://github.com/LemmyNet/lemmy) → `github.com/YOUR_USER/lemmy`
- Fork [Blorp-Labs/blorp](https://github.com/Blorp-Labs/blorp) → `github.com/YOUR_USER/blorp`
- Create empty repo → `github.com/YOUR_USER/vibecode-collab` (push this workspace)

### 2. Configure remotes (recommended pattern)

**Lemmy**

```bash
cd lemmy
git remote rename origin upstream
git remote add origin git@github.com:YOUR_USER/lemmy.git
git fetch --all
git push -u origin main
```

**Blorp**

```bash
cd blorp
git remote rename origin upstream
git remote add origin git@github.com:YOUR_USER/blorp.git
git fetch --all
git push -u origin main
```

**Deployment (this repo)**

```bash
cd /path/to/vibecode-collab
git remote add origin git@github.com:YOUR_USER/vibecode-collab.git
git push -u origin main
```

### 3. Syncing upstream changes

```bash
# Lemmy
cd lemmy
git fetch upstream
git checkout main
git merge upstream/main   # or rebase, per your preference
git push origin main

# Blorp
cd blorp
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

Tag or note the Lemmy/Blorp versions you deploy in this repo’s `deploy/` or a `CHANGELOG.md` when you cut production releases.

## Branching conventions (suggestion)

| Repo | Branch | Use |
|------|--------|-----|
| All | `main` | Production-deployed state |
| All | `develop` | Integration / staging (optional) |
| Lemmy | `config/production` | Only `lemmy.hjson` / docker overrides (optional) |
| Blorp | feature branches | UI customizations |

Keep **secrets out of git** — use DigitalOcean and Cloudflare dashboards (or sealed env), never commit `.env` with real keys.

## What gets committed where

| Change | Commit in |
|--------|-----------|
| New deployment doc | `vibecode-collab` |
| `lemmy.hjson`, Docker overrides for your instance | `lemmy` fork (or `vibecode-collab/deploy/` as copies) |
| Blorp theme / env defaults | `blorp` fork |
| Postgres data, pictrs uploads | **Never** — server volumes only |

## Clone on a new machine

```bash
git clone git@github.com:YOUR_USER/vibecode-collab.git
cd vibecode-collab
export LEMMY_REPO=git@github.com:YOUR_USER/lemmy.git
export BLORP_REPO=git@github.com:YOUR_USER/blorp.git
./scripts/setup.sh
```
