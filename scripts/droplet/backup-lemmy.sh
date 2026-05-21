#!/usr/bin/env bash
# Run on the DigitalOcean droplet (cron weekly). Backs up Postgres + pictrs volumes.
set -euo pipefail

LEMMY_DIR="${LEMMY_DIR:-/opt/lemmy}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/vibecode-collab}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${STAMP}"

install -d -m 0700 "${DEST}"

cd "${LEMMY_DIR}/docker"

docker compose exec -T postgres pg_dump -U lemmy lemmy | gzip >"${DEST}/lemmy.sql.gz"
cp lemmy.hjson "${DEST}/lemmy.hjson"
tar -czf "${DEST}/pictrs.tar.gz" -C volumes pictrs 2>/dev/null || true

find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null || true
echo "Backup written to ${DEST}"
