#!/usr/bin/env bash
# Run on the DigitalOcean droplet as root.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/vibecode-collab}"
LEMMY_DIR="${LEMMY_DIR:-/opt/lemmy}"
LEMMY_REPO="${LEMMY_REPO:-https://github.com/LemmyNet/lemmy.git}"
LEMMY_IMAGE_TAG="${LEMMY_IMAGE_TAG:-0.19.18}"
ENV_FILE="${DEPLOY_DIR}/deploy/digitalocean/.env"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

gen_secret() {
  openssl rand -hex 24
}

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(gen_secret)}"
PICTRS_API_KEY="${PICTRS_API_KEY:-$(gen_secret)}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
SITE_NAME="${SITE_NAME:-Vibe Code Collab}"
LEMMY_HOSTNAME="${LEMMY_HOSTNAME:-api.vibecodecollab.com}"

SECRETS_FILE="${DEPLOY_DIR}/deploy/digitalocean/secrets.env"
umask 077
cat >"${SECRETS_FILE}" <<EOF
# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) — keep private, do not commit
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
PICTRS_API_KEY=${PICTRS_API_KEY}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
chmod 600 "${SECRETS_FILE}"

if [[ ! -d "${LEMMY_DIR}/.git" ]]; then
  git clone --recurse-submodules "${LEMMY_REPO}" "${LEMMY_DIR}"
fi

cd "${LEMMY_DIR}/docker"

TEMPLATE="${DEPLOY_DIR}/deploy/digitalocean/lemmy.hjson.example"
if [[ ! -f "${TEMPLATE}" ]]; then
  echo "Missing ${TEMPLATE}" >&2
  exit 1
fi

sed \
  -e "s/ADMIN_USERNAME_PLACEHOLDER/${ADMIN_USERNAME}/g" \
  -e "s/ADMIN_PASSWORD_PLACEHOLDER/${ADMIN_PASSWORD}/g" \
  -e "s/SITE_NAME_PLACEHOLDER/${SITE_NAME}/g" \
  -e "s/POSTGRES_PASSWORD_PLACEHOLDER/${POSTGRES_PASSWORD}/g" \
  -e "s/PICTRS_API_KEY_PLACEHOLDER/${PICTRS_API_KEY}/g" \
  -e "s/api.vibecodecollab.com/${LEMMY_HOSTNAME}/g" \
  "${TEMPLATE}" >lemmy.hjson

# Patch pictrs key in compose
sed -i "s/PICTRS__SERVER__API_KEY=.*/PICTRS__SERVER__API_KEY=${PICTRS_API_KEY}/" docker-compose.yml
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" docker-compose.yml

# Production: use release image instead of build
if grep -q '^    build:' docker-compose.yml; then
  sed -i '/^  lemmy:/,/^  lemmy-ui:/ {
    s/^    build:/    # build:/
  }' docker-compose.yml
  if ! grep -q 'image: dessalines/lemmy' docker-compose.yml; then
    sed -i "/^  lemmy:/a\\    image: dessalines/lemmy:${LEMMY_IMAGE_TAG}" docker-compose.yml
  fi
fi

# Bind proxy to localhost only; drop public postgres port
sed -i 's/- "1236:1236"/- "127.0.0.1:1236:1236"/' docker-compose.yml
sed -i 's/- "8536:8536"//' docker-compose.yml
sed -i '/^    ports:$/,/^    [a-z]/ {
  /- "5433:5432"/d
}' docker-compose.yml

# Remove dev federation disable
sed -i '/LEMMY_DISABLE_ACTIVITY_SENDING/d' docker-compose.yml

PROD_OVERRIDE="${DEPLOY_DIR}/deploy/digitalocean/docker-compose.prod.yml"
COMPOSE_CMD=(docker compose)
if [[ -f "${PROD_OVERRIDE}" ]]; then
  COMPOSE_CMD+=( -f docker-compose.yml -f "${PROD_OVERRIDE}" )
else
  COMPOSE_CMD+=( -f docker-compose.yml )
fi

export LEMMY_IMAGE_TAG
"${COMPOSE_CMD[@]}" pull
"${COMPOSE_CMD[@]}" up -d

echo ""
echo "Lemmy stack started. Local check:"
curl -fsS http://127.0.0.1:1236/api/v3/site | head -c 200 || true
echo ""
echo "Admin (first login only — remove setup block from lemmy.hjson after):"
echo "  user: ${ADMIN_USERNAME}"
echo "  pass: ${ADMIN_PASSWORD}"
echo "Secrets saved: ${SECRETS_FILE}"
