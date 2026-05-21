# Deployment guide

Production split:

| Layer | Platform | Source repo | Artifact |
|-------|----------|-------------|----------|
| Backend | **DigitalOcean** | Your `lemmy` fork | Docker Compose (or DO App Platform) |
| Frontend | **Cloudflare Pages** | Your `blorp` fork | Static `dist/` from `pnpm build` |

Replace `lemmy.example.com` and `app.example.com` with your domains.

---

## 1. Lemmy on DigitalOcean

### Option A: Droplet + Docker Compose (common)

1. Create a Droplet (Ubuntu LTS, 2+ GB RAM recommended for small instances).
2. Install Docker and Docker Compose.
3. Clone **your Lemmy fork** on the server (not necessarily this deployment repo):

   ```bash
   git clone --recurse-submodules git@github.com:YOUR_USER/lemmy.git
   cd lemmy/docker
   ```

4. Configure `lemmy.hjson`:
   - Set `hostname` to `lemmy.example.com`
   - Set `https` appropriately behind your TLS terminator
   - Configure `admin` account, federation, email if needed
   - Set pictrs URL and API key to match `docker-compose.yml`

5. Put TLS in front of nginx (Caddy, Traefik, or DO Load Balancer + Let’s Encrypt).

6. Start the stack:

   ```bash
   docker compose up -d
   ```

7. **Disable or ignore bundled `lemmy-ui`** for end users if you only serve Blorp — users should not need the default UI URL. The API on port 8536 (internal) / proxied HTTPS is what Blorp uses.

References:

- [Lemmy administration docs](https://join-lemmy.org/docs/en/admin/administration.html)
- Upstream compose: `lemmy/docker/docker-compose.yml`

### Option B: DigitalOcean App Platform

Use a Docker-based app spec pointing at your Lemmy image build. This is more involved for Lemmy (postgres, pictrs, volumes); many operators prefer a Droplet + Compose.

### Firewall / ports

- Public: **443** (and 80 → redirect) to reverse proxy
- Do **not** expose Postgres publicly
- Federation: Lemmy docs describe required ports for ActivityPub

### Backups

- Postgres volume (`lemmy/docker/volumes/`)
- pictrs media volume
- `lemmy.hjson` (store securely; secrets out of git)

---

## 2. Blorp on Cloudflare Pages

### Repository connection

1. Cloudflare Dashboard → **Workers & Pages** → Create → **Connect to Git**.
2. Select your **Blorp fork** repository.
3. Build settings:

   | Setting | Value |
   |---------|--------|
   | Framework preset | None (or Vite if offered) |
   | Build command | `pnpm install && pnpm build` |
   | Build output directory | `dist` |
   | Root directory | `/` (repo root) |
   | Node version | 20 |

4. Enable **corepack** if needed (Pages build environment): set env `ENABLE_COREPACK=1` or use `npm i -g pnpm` in a custom install step.

### Environment variables (Production)

Set in Pages → Settings → Environment variables:

| Name | Example | Notes |
|------|---------|--------|
| `REACT_APP_NAME` | `My Community` | Shown in UI |
| `REACT_APP_DEFAULT_INSTANCE` | `https://lemmy.example.com` | **Must** be your live Lemmy URL |
| `REACT_APP_LOCK_TO_DEFAULT_INSTANCE` | `1` | Locks instance picker |
| `REACT_APP_INSTANCE_SELECTION_MODE` | `default_first` | See Blorp README |
| `NODE_VERSION` | `20` | Match local dev |

Optional: content warning, default themes — see [Blorp README](https://github.com/Blorp-Labs/blorp#environment-variables).

Rebuild after changing env vars (they are baked in at build time).

### Custom domain

1. Pages project → **Custom domains** → add `app.example.com`.
2. DNS: CNAME to `*.pages.dev` as Cloudflare instructs.

### CORS on Lemmy

Your Lemmy instance must accept browser requests from `https://app.example.com`. Update Lemmy site settings / `lemmy.hjson` cors configuration per [Lemmy docs](https://join-lemmy.org/docs/) for your version.

Test: open Blorp, log in, load communities — network tab should show API calls to `lemmy.example.com` without CORS errors.

---

## 3. End-to-end checklist

- [ ] Lemmy HTTPS live at `https://lemmy.example.com`
- [ ] Admin account created; federation policy decided
- [ ] CORS allows Blorp origin
- [ ] Blorp Pages build green; `REACT_APP_DEFAULT_INSTANCE` correct
- [ ] Custom domain on Pages with TLS
- [ ] Login, post, comment, image upload tested
- [ ] Backups scheduled for Postgres + pictrs
- [ ] Version pins documented in `deploy/VERSIONS.md`

---

## 4. CI/CD (optional)

| Repo | Suggestion |
|------|------------|
| `lemmy` | GitHub Action → SSH to Droplet → `docker compose pull && up -d` |
| `blorp` | Cloudflare Pages auto-deploy on push to `main` |
| `vibecode-collab` | Docs-only; no runtime deploy |

Keep production deploy secrets in GitHub Environments / Cloudflare / DO — not in this repo.

---

## 5. Staging

Use subdomains, e.g. `lemmy.staging.example.com` + `app.staging.example.com`, with separate Blorp Pages branch or project and a second Compose stack or Droplet.

---

## Files to add in this repo

As you operationalize, commit templates under `deploy/`:

```
deploy/
├── digitalocean/
│   ├── README.md
│   └── lemmy.hjson.example      # redacted template
├── cloudflare/
│   └── pages-env-checklist.md
└── VERSIONS.md                  # pinned lemmy + blorp tags
```

Do **not** commit production secrets or full `lemmy.hjson` with private keys.
