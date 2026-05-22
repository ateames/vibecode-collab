# Lemmy on DigitalOcean — `vibe-code-collab-prod`


| Item      | Value                            |
| --------- | -------------------------------- |
| Droplet   | `vibe-code-collab-prod`          |
| Public IP | `137.184.183.96`                 |
| Lemmy API | `https://api.vibecodecollab.com` |
| Blorp UI  | `https://vibecodecollab.com`     |


## Option A — Droplet web console (no SSH key on laptop)

1. [DigitalOcean](https://cloud.digitalocean.com/) → **vibe-code-collab-prod** → **Access** → **Launch Droplet Console**.
2. Log in as `root`.
3. From your Mac, print a paste-ready installer:

```bash
./scripts/print-console-install.sh
```

1. Paste the printed line into the console and wait (~5–10 min).
  Or after pushing this repo:
2. Save admin password from `/opt/vibecode-collab/deploy/digitalocean/secrets.env` on the server.

## Option B — SSH deploy (from your Mac)

1. Add your SSH public key to the droplet (DO → **Access** → **Add SSH key**):

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBwK9VvN9nt/D1mmvJAmeTDkP2HijtMzunz4YqgekzsN ateames@Austins-MacBook-Pro.local
```

1. From the `vibecode-collab` repo root:

```bash
chmod +x scripts/remote-deploy-lemmy.sh scripts/droplet/*.sh
./scripts/remote-deploy-lemmy.sh
```

This installs Docker, configures UFW (22/80/443), clones Lemmy, writes production `lemmy.hjson`, starts Compose, and installs Caddy.

Admin credentials are written on the server only:

```bash
ssh root@137.184.183.96 'cat /opt/vibecode-collab/deploy/digitalocean/secrets.env'
```

Remove the `setup { ... }` block from `/opt/lemmy/docker/lemmy.hjson` after first admin login.

## 502 from `http://127.0.0.1:1236/api/v3/site`

The nginx proxy returns **502** when Lemmy or Postgres is down. On a **2 GB** droplet, upstream `lemmy/docker/customPostgresql.conf` sets `shared_buffers = 3GB`, which makes Postgres exit with **Out of memory**.

1. Ensure **swap** (2 GB): `swapon --show`
2. Use the low-memory Postgres config (included in `docker-compose.prod.yml`):

```bash
# Pull latest vibecode-collab on the server so customPostgresql.lowmem.conf exists, then:
cd /opt/lemmy/docker
docker compose -f docker-compose.yml -f /opt/vibecode-collab/deploy/digitalocean/docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f /opt/vibecode-collab/deploy/digitalocean/docker-compose.prod.yml ps
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:1236/api/v3/site
```

Expect **200**. If Postgres still fails: `docker logs docker-postgres-1 --tail 20`.

## Troubleshooting compose / Caddy

`**service "lemmy" has neither an image nor a build context**` — the install script commented out `build:` but left `context:` / `dockerfile:`, or a re-run skipped adding `image:`. On the droplet:

```bash
cd /opt/lemmy/docker
sed -i '/^  lemmy:/,/^  lemmy-ui:/ { /^    build:/d; /^    # build:/d; /^      context:/d; /^      dockerfile:/d; }' docker-compose.yml
grep -qE '^[[:space:]]+image: dessalines/lemmy' docker-compose.yml || sed -i '/^  lemmy:/a\    image: dessalines/lemmy:0.19.18' docker-compose.yml
sed -i '/^  postgres:/,/^  [a-z_-]*:/ { /- "5433:5432"/d; /^    ports:$/d; }' docker-compose.yml
docker compose -f docker-compose.yml -f /opt/vibecode-collab/deploy/digitalocean/docker-compose.prod.yml config >/dev/null && echo compose OK
```

Re-run `./scripts/print-console-install.sh` from your Mac after pulling these fixes, or use `./scripts/remote-deploy-lemmy.sh`.

`**Unit caddy.service not found**` — Caddy installs only after `docker compose up` succeeds. Fix compose first, then install Caddy (`install-caddy.sh` or re-run console install).

## Cloudflare SSL (recommended)

1. **SSL/TLS** → **Full (strict)** for `vibecodecollab.com`.
2. **Origin Server** → create certificate for `api.vibecodecollab.com`.
3. On the droplet:

```bash
install -d -m 0750 -o root -g caddy /etc/caddy/certs
# paste origin.pem and origin-key.pem into /etc/caddy/certs/
chown root:caddy /etc/caddy/certs/origin.pem /etc/caddy/certs/origin-key.pem
chmod 640 /etc/caddy/certs/origin.pem /etc/caddy/certs/origin-key.pem
cp /opt/vibecode-collab/deploy/digitalocean/Caddyfile.example /etc/caddy/Caddyfile
systemctl restart caddy
```

Caddy runs as user `caddy`. The certs **directory** must be `root:caddy` mode `750` (not `root:root`), or startup fails with `open .../origin.pem: permission denied`.

## Manual steps on the server

```bash
export DEPLOY_DIR=/opt/vibecode-collab
/opt/vibecode-collab/scripts/droplet/install-docker.sh
/opt/vibecode-collab/scripts/droplet/configure-firewall.sh
/opt/vibecode-collab/scripts/droplet/setup-lemmy.sh
/opt/vibecode-collab/scripts/droplet/install-caddy.sh
```

Optional env overrides: copy `[env.example](env.example)` to `deploy/digitalocean/.env` on the server before `setup-lemmy.sh`.

## Backups

```bash
/opt/vibecode-collab/scripts/droplet/backup-lemmy.sh
```

Cron example (weekly Sunday 03:00 UTC):

```
0 3 * * 0 root /opt/vibecode-collab/scripts/droplet/backup-lemmy.sh
```

## Updates

```bash
cd /opt/lemmy/docker
git pull
docker compose -f docker-compose.yml -f /opt/vibecode-collab/deploy/digitalocean/docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f /opt/vibecode-collab/deploy/digitalocean/docker-compose.prod.yml up -d
```

## Blorp frontend

Set `REACT_APP_DEFAULT_INSTANCE=https://api.vibecodecollab.com` in `blorp/.env.production`, then from repo root:

```bash
pnpm build:web:prod
pnpm deploy:cloudflare:prod
```

See [deploy/cloudflare/README.md](../cloudflare/README.md).