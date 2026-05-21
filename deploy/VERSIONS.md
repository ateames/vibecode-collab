# Pinned production versions

| Component | Tag / version | Notes |
|-----------|---------------|--------|
| Lemmy | `dessalines/lemmy:0.19.18` | [`docker-compose.prod.yml`](digitalocean/docker-compose.prod.yml) |
| lemmy-ui | `dessalines/lemmy-ui:nightly` | Upstream compose default; admin/debug only |
| pictrs | `asonix/pictrs:0.5.17-pre.9` | Upstream compose |
| Postgres | `pgautoupgrade/pgautoupgrade:18-alpine` | Upstream compose |

Update Lemmy tag in `deploy/digitalocean/env.example` and `docker-compose.prod.yml`, then re-run `setup-lemmy.sh` or `docker compose pull && up -d` on the droplet.
