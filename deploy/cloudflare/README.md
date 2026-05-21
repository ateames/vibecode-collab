# Cloudflare Pages — local build, Wrangler direct upload

Blorp is too large for Cloudflare’s **remote** Pages build environment. Build the static site on your machine, then upload `blorp/dist/` with **Wrangler Pages** (`wrangler pages deploy`), not `wrangler deploy` (Workers).

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Node.js 20+ | Same as Blorp |
| pnpm | `corepack enable` |
| Blorp clone | `./scripts/setup.sh` → `blorp/` |
| Cloudflare account | [Dashboard](https://dash.cloudflare.com/) |
| Wrangler auth | `pnpm exec wrangler login` (from repo root after `pnpm install`) |
| Pages project | Existing project (Git-connected or **Direct Upload**) |

## One-time setup

1. **Create or reuse a Pages project**  
   Dashboard → **Workers & Pages** → your Blorp project. Note the **project name** (not the `*.pages.dev` subdomain).

2. **Disable remote builds** (if the project was connected to Git):  
   Settings → Builds → set build command to a no-op or disconnect Git if you only deploy locally. Remote builds are optional once you upload with Wrangler.

3. **Configure this repo** (from `vibecode-collab` root):

   ```bash
   pnpm install
   cp deploy/cloudflare/.env.example deploy/cloudflare/.env
   cp deploy/cloudflare/blorp.production.env.example blorp/.env.production
   ```

   Edit `deploy/cloudflare/.env`:

   - `CLOUDFLARE_PAGES_PROJECT_NAME` — must match the Pages project name in Cloudflare.
   - `CLOUDFLARE_PAGES_BRANCH` — usually `main` or `production` (see your project’s production branch).

   Edit `blorp/.env.production` with your live Lemmy URL and UI copy. See [pages-env-checklist.md](./pages-env-checklist.md).

4. **Align `wrangler.jsonc`** (optional but recommended): set `"name"` to the same value as `CLOUDFLARE_PAGES_PROJECT_NAME`.

5. **Log in to Cloudflare**:

   ```bash
   pnpm exec wrangler login
   pnpm exec wrangler whoami
   ```

## Deploy workflow

From the **repository root**:

```bash
pnpm build:web:prod          # vite build → blorp/dist/
pnpm deploy:cloudflare:prod  # wrangler pages deploy blorp/dist
```

What the build script does:

- Runs `vite build` only (skips `cap sync` from Blorp’s full `pnpm build`).
- Reads `blorp/.env.production` (Vite production mode).

What the deploy script does:

- Runs `wrangler pages deploy <blorp/dist> --project-name=... --branch=...`
- Does **not** run `wrangler deploy`.

## Files

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Pages metadata; `pages_build_output_dir` points at `../../blorp/dist` |
| `.env.example` | Template for `deploy/cloudflare/.env` (project name, branch) |
| `blorp.production.env.example` | Template for `blorp/.env.production` (build-time `REACT_APP_*`) |
| `pages-env-checklist.md` | Variables to verify before/after deploy |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Authentication error` | `pnpm exec wrangler login` |
| Wrong project | Check `CLOUDFLARE_PAGES_PROJECT_NAME` matches dashboard name |
| Stale UI / wrong Lemmy URL | Edit `blorp/.env.production`, rerun `build:web:prod` then deploy |
| Multiple accounts | Set `CLOUDFLARE_ACCOUNT_ID` in `deploy/cloudflare/.env` |
| CORS errors after deploy | Lemmy must allow your Blorp origin — see [docs/deployment.md](../../docs/deployment.md) |

## For other operators (public repo)

Anyone cloning [vibecode-collab](https://github.com/YOUR_USER/vibecode-collab) can use the same flow: fork Blorp, clone with `setup.sh`, copy the two `.env` templates, create their own Pages project, and run the two `pnpm` scripts. No Cloudflare build minutes required.
