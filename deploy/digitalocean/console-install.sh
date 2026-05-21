#!/usr/bin/env bash
# Self-contained Lemmy install for DigitalOcean Droplet Console (no SSH from laptop required).
# Run as root on vibe-code-collab-prod (137.184.183.96):
#   bash console-install.sh
#
# Or after pushing this repo to GitHub:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_USER/vibecode-collab/main/deploy/digitalocean/console-install.sh | bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/vibecode-collab}"
LEMMY_DIR="${LEMMY_DIR:-/opt/lemmy}"
LEMMY_REPO="${LEMMY_REPO:-https://github.com/LemmyNet/lemmy.git}"
LEMMY_IMAGE_TAG="${LEMMY_IMAGE_TAG:-0.19.18}"
LEMMY_HOSTNAME="${LEMMY_HOSTNAME:-api.vibecodecollab.com}"

gen_secret() { openssl rand -hex 24; }
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(gen_secret)}"
PICTRS_API_KEY="${PICTRS_API_KEY:-$(gen_secret)}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl openssl ufw

# Docker
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-$VERSION}") stable" >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi

# Firewall
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Lemmy
if [[ ! -d "${LEMMY_DIR}/.git" ]]; then
  git clone --recurse-submodules "${LEMMY_REPO}" "${LEMMY_DIR}"
fi
cd "${LEMMY_DIR}/docker"

cat >lemmy.hjson <<HJSON
{
  setup: {
    admin_username: "admin"
    admin_password: "${ADMIN_PASSWORD}"
    site_name: "Vibe Code Collab"
  }
  database: {
    connection: "postgres://lemmy:${POSTGRES_PASSWORD}@postgres:5432/lemmy"
  }
  hostname: "${LEMMY_HOSTNAME}"
  bind: "0.0.0.0"
  port: 8536
  tls_enabled: true
  pictrs: {
    url: "http://pictrs:8080/"
    api_key: "${PICTRS_API_KEY}"
  }
  cors_origin: [
    "https://vibecodecollab.com"
    "https://www.vibecodecollab.com"
  ]
}
HJSON

sed -i "s/PICTRS__SERVER__API_KEY=.*/PICTRS__SERVER__API_KEY=${PICTRS_API_KEY}/" docker-compose.yml
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" docker-compose.yml
sed -i 's/- "1236:1236"/- "127.0.0.1:1236:1236"/' docker-compose.yml
sed -i 's/- "8536:8536"//' docker-compose.yml
# Drop postgres host port; delete ports: key too (empty ports: is invalid YAML)
sed -i '/^  postgres:/,/^  [a-z_-]*:/ {
  /- "5433:5432"/d
  /^    ports:$/d
}' docker-compose.yml
sed -i '/LEMMY_DISABLE_ACTIVITY_SENDING/d' docker-compose.yml
# Production image: delete build block and always set image (safe on re-run).
sed -i '/^  lemmy:/,/^  lemmy-ui:/ {
  /^    build:/d
  /^    # build:/d
  /^      context:/d
  /^      dockerfile:/d
}' docker-compose.yml
if ! grep -qE '^[[:space:]]+image: dessalines/lemmy' docker-compose.yml; then
  sed -i "/^  lemmy:/a\\    image: dessalines/lemmy:${LEMMY_IMAGE_TAG}" docker-compose.yml
fi

install -d -m 0755 "${DEPLOY_DIR}/deploy/digitalocean"
cat >"${DEPLOY_DIR}/deploy/digitalocean/docker-compose.prod.yml" <<PROD
services:
  proxy:
    ports:
      - "127.0.0.1:1236:1236"
  lemmy:
    image: dessalines/lemmy:${LEMMY_IMAGE_TAG}
    environment:
      - RUST_LOG=warn
  lemmy-ui:
    environment:
      - LEMMY_UI_BACKEND=lemmy:8536
      - LEMMY_UI_HTTPS=true
      - LEMMY_UI_ERUDA=false
PROD

COMPOSE=(docker compose -f docker-compose.yml -f "${DEPLOY_DIR}/deploy/digitalocean/docker-compose.prod.yml")
"${COMPOSE[@]}" config >/dev/null
"${COMPOSE[@]}" pull
"${COMPOSE[@]}" up -d

# Caddy
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq
apt-get install -y -qq caddy

cat >/etc/caddy/Caddyfile <<'CADDY'
api.vibecodecollab.com {
	reverse_proxy 127.0.0.1:1236
}
CADDY

systemctl enable --now caddy
systemctl reload caddy

install -d -m 0700 "${DEPLOY_DIR}/deploy/digitalocean"
cat >"${DEPLOY_DIR}/deploy/digitalocean/secrets.env" <<EOF
ADMIN_PASSWORD=${ADMIN_PASSWORD}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
PICTRS_API_KEY=${PICTRS_API_KEY}
EOF
chmod 600 "${DEPLOY_DIR}/deploy/digitalocean/secrets.env"

echo ""
echo "Install complete."
echo "Admin: admin / ${ADMIN_PASSWORD}"
echo "Secrets: ${DEPLOY_DIR}/deploy/digitalocean/secrets.env"
curl -fsS http://127.0.0.1:1236/api/v3/site | head -c 200 || true
echo ""
echo "Public check: curl https://api.vibecodecollab.com/api/v3/site"
