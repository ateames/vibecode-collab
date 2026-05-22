#!/usr/bin/env bash
# Fix 502 on 127.0.0.1:1236 when Postgres OOMs on 2 GB droplets (shared_buffers=3GB default).
# Run on the droplet as root.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/vibecode-collab}"
LEMMY_DIR="${LEMMY_DIR:-/opt/lemmy/docker}"
LOWMEM="${DEPLOY_DIR}/deploy/digitalocean/customPostgresql.lowmem.conf"
PROD="${DEPLOY_DIR}/deploy/digitalocean/docker-compose.prod.yml"

if [[ ! -f "${LOWMEM}" ]]; then
  echo "Missing ${LOWMEM} — pull vibecode-collab or copy customPostgresql.lowmem.conf" >&2
  exit 1
fi

if ! grep -q customPostgresql.lowmem.conf "${PROD}"; then
  echo "Add postgres volume override to ${PROD} (see deploy/digitalocean/docker-compose.prod.yml in repo)" >&2
  exit 1
fi

if ! swapon --show | grep -q .; then
  echo "Adding 2G swap..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q swapfile /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

cd "${LEMMY_DIR}"
docker compose -f docker-compose.yml -f "${PROD}" up -d
sleep 10
docker compose -f docker-compose.yml -f "${PROD}" ps postgres lemmy
HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:1236/api/v3/site || echo 000)"
echo "http://127.0.0.1:1236/api/v3/site => HTTP ${HTTP_CODE}"
if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "Postgres logs:" >&2
  docker logs docker-postgres-1 --tail 15 >&2
  exit 1
fi
