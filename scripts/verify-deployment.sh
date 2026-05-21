#!/usr/bin/env bash
# Quick checks for production Lemmy + Blorp wiring.
set -euo pipefail

API_URL="${API_URL:-https://api.vibecodecollab.com}"
APP_URL="${APP_URL:-https://vibecodecollab.com}"

echo "==> DNS"
dig +short api.vibecodecollab.com A | head -3 || true

echo ""
echo "==> Lemmy API (expect 200 + JSON when origin is up)"
HTTP_CODE="$(curl -sS -o /tmp/lemmy-site.json -w "%{http_code}" "${API_URL}/api/v3/site" || echo "000")"
echo "HTTP ${HTTP_CODE}"
if [[ "${HTTP_CODE}" == "200" ]]; then
  head -c 200 /tmp/lemmy-site.json
  echo ""
else
  echo "521/502 = Cloudflare cannot reach origin — run ./scripts/remote-deploy-lemmy.sh after SSH is configured"
fi

echo ""
echo "==> Blorp app"
APP_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "${APP_URL}/" || echo "000")"
echo "HTTP ${APP_CODE} ${APP_URL}"

echo ""
echo "==> SSH (optional)"
SSH_HOST="${SSH_HOST:-137.184.183.96}"
if ssh -o BatchMode=yes -o ConnectTimeout=5 "root@${SSH_HOST}" 'docker compose -f /opt/lemmy/docker/docker-compose.yml ps 2>/dev/null | head -5' 2>/dev/null; then
  echo "Droplet SSH OK"
else
  echo "SSH not configured — add key per deploy/digitalocean/README.md"
fi
