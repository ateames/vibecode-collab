# Lemmy on DigitalOcean — `vibe-code-collab-prod`

| Item | Value |
|------|--------|
| Droplet | `vibe-code-collab-prod` |
| Public IP | `137.184.183.96` |
| Lemmy API | `https://api.vibecodecollab.com` |
| Blorp UI | `https://vibecodecollab.com` |

## Option A — Droplet web console (no SSH key on laptop)

1. [DigitalOcean](https://cloud.digitalocean.com/) → **vibe-code-collab-prod** → **Access** → **Launch Droplet Console**.
2. Log in as `root`.
3. From your Mac, print a paste-ready installer:

```bash
./scripts/print-console-install.sh
```

4. Paste the printed line into the console and wait (~5–10 min).

   Or after pushing this repo:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/ateames/vibecode-collab/dev-prod-1/deploy/digitalocean/console-install.sh | bash
   ```

5. Save admin password from `/opt/vibecode-collab/deploy/digitalocean/secrets.env` on the server.

## Option B — SSH deploy (from your Mac)

1. Add your SSH public key to the droplet (DO → **Access** → **Add SSH key**):

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBwK9VvN9nt/D1mmvJAmeTDkP2HijtMzunz4YqgekzsN ateames@Austins-MacBook-Pro.local
```

2. From the `vibecode-collab` repo root:

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

## Cloudflare SSL (recommended)

1. **SSL/TLS** → **Full (strict)** for `vibecodecollab.com`.
2. **Origin Server** → create certificate for `api.vibecodecollab.com`.
3. On the droplet:

```bash
install -d -m 0750 /etc/caddy/certs
# paste origin.pem and origin-key.pem into /etc/caddy/certs/
cp /opt/vibecode-collab/deploy/digitalocean/Caddyfile.example /etc/caddy/Caddyfile
systemctl reload caddy
```

## Manual steps on the server

```bash
export DEPLOY_DIR=/opt/vibecode-collab
/opt/vibecode-collab/scripts/droplet/install-docker.sh
/opt/vibecode-collab/scripts/droplet/configure-firewall.sh
/opt/vibecode-collab/scripts/droplet/setup-lemmy.sh
/opt/vibecode-collab/scripts/droplet/install-caddy.sh
```

Optional env overrides: copy [`env.example`](env.example) to `deploy/digitalocean/.env` on the server before `setup-lemmy.sh`.

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
