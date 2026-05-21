# Cursor workflow

How to maintain **three GitHub repos** from one local workspace using Cursor.

## Open the workspace

```
File → Open Folder → vibecode-collab
```

You will see `lemmy/` and `blorp/` in the tree even though the deployment repo ignores them — they are normal folders on disk with their own `.git` directories.

## Which repo to commit to

| You edited… | Run git in… |
|-------------|-------------|
| `README.md`, `docs/`, `deploy/`, `scripts/` | `vibecode-collab/` (root) |
| `lemmy/docker/lemmy.hjson`, Rust, migrations | `lemmy/` |
| Blorp UI, `blorp/.env.example`, vite config | `blorp/` |

Cursor’s source control panel follows the **root** repo by default. For nested repos:

- Use the terminal: `cd lemmy && git status`
- Or open `lemmy` / `blorp` as a separate Cursor window when doing focused work
- Or use a multi-root workspace file (optional)

Quick check:

```bash
./scripts/repo-status.sh
```

## Typical tasks

### “Update deployment documentation”

1. Edit files under `docs/` or `deploy/`.
2. `git add` / `commit` / `push` from **project root**.
3. No Cloudflare or DO redeploy needed.

### “Ship a Lemmy security update”

1. `cd lemmy` → merge `upstream/main` → push your fork.
2. SSH to DigitalOcean → `docker compose pull && docker compose up -d`.
3. Note version in `deploy/VERSIONS.md` (deployment repo).

### “Ship a Blorp UI update”

1. `cd blorp` → merge `upstream/main` (or your changes).
2. From **vibecode-collab** root: `pnpm build:web:prod` then `pnpm deploy:cloudflare:prod`.
3. Or push to your fork and let Cloudflare Git build (if enabled and within size limits).
4. Verify `blorp/.env.production` if upstream added new `REACT_APP_*` keys.

### “Change instance name or default URL”

1. Edit `blorp/.env.production` (build-time variables).
2. `pnpm build:web:prod` and `pnpm deploy:cloudflare:prod` from the deployment repo root.
3. Document change in `vibecode-collab` if it’s operational knowledge.

## AI / rules

Consider adding later:

- `vibecode-collab/.cursor/rules` — “deployment docs only; don’t edit lemmy/blorp unless asked”
- `lemmy/.cursor/rules` — Rust/Docker conventions
- `blorp/.cursor/rules` — React/pnpm conventions (upstream has `AGENTS.md`)

## GitHub integration summary

```
GitHub: YOUR_USER/vibecode-collab  →  docs & deploy templates (this repo)
GitHub: YOUR_USER/lemmy            →  DO Droplet pulls / builds from here
GitHub: YOUR_USER/blorp            →  Cloudflare Pages connected here
```

## Avoid common mistakes

- Committing `lemmy/` or `blorp/` **into** the deployment repo — prevented by `.gitignore`, but don’t `git add -f` unless you intend submodules (not used here).
- Pushing `.env` with secrets — use `.env.example` only in git.
- Forgetting Blorp env vars are **build-time** — changing Lemmy URL requires a Pages rebuild.
- Running default `lemmy-ui` URL in production while promoting Blorp — pick one UX for users.
