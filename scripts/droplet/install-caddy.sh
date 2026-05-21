#!/usr/bin/env bash
# Run on the DigitalOcean droplet as root.
set -euo pipefail

if command -v caddy >/dev/null 2>&1; then
  echo "Caddy already installed: $(caddy version)"
else
  apt-get update -qq
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

install -d -m 0750 /etc/caddy/certs

DEPLOY_DIR="${DEPLOY_DIR:-/opt/vibecode-collab/deploy/digitalocean}"
if [[ -f "${DEPLOY_DIR}/Caddyfile" ]]; then
  cp "${DEPLOY_DIR}/Caddyfile" /etc/caddy/Caddyfile
elif [[ -f "${DEPLOY_DIR}/Caddyfile.example" ]]; then
  cp "${DEPLOY_DIR}/Caddyfile.example" /etc/caddy/Caddyfile
fi

if [[ ! -f /etc/caddy/certs/origin.pem ]]; then
  echo "NOTE: Cloudflare Origin cert not found at /etc/caddy/certs/origin.pem"
  echo "      Use Caddy automatic HTTPS in Caddyfile or paste certs from Cloudflare dashboard."
fi

systemctl enable --now caddy
caddy validate --config /etc/caddy/Caddyfile 2>/dev/null || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy
echo "Caddy status: $(systemctl is-active caddy)"
