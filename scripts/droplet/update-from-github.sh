#!/usr/bin/env bash
# Update vibe-code-collab-prod from GitHub (default branch: dev-prod-1).
# Run on the droplet as root (SSH or DO web console).
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/vibecode-collab}"
LEMMY_DIR="${LEMMY_DIR:-/opt/lemmy}"
REPO="${VIBECODE_REPO:-https://github.com/ateames/vibecode-collab.git}"
BRANCH="${VIBECODE_BRANCH:-dev-prod-1}"

if ! command -v git >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq git curl
fi

if [[ ! -d "${DEPLOY_DIR}/.git" ]]; then
  git clone --depth 1 --branch "${BRANCH}" "${REPO}" "${DEPLOY_DIR}"
else
  git -C "${DEPLOY_DIR}" fetch origin "${BRANCH}"
  git -C "${DEPLOY_DIR}" checkout "${BRANCH}"
  git -C "${DEPLOY_DIR}" pull --ff-only origin "${BRANCH}"
fi

chmod +x "${DEPLOY_DIR}/scripts/droplet/"*.sh 2>/dev/null || true

if [[ ! -d "${LEMMY_DIR}/.git" ]]; then
  echo "Lemmy not installed — running setup-lemmy.sh"
  export DEPLOY_DIR
  "${DEPLOY_DIR}/scripts/droplet/setup-lemmy.sh"
else
  git -C "${LEMMY_DIR}" pull --ff-only || true
  export DEPLOY_DIR
  "${DEPLOY_DIR}/scripts/droplet/fix-postgres-lowmem.sh"
fi

echo ""
echo "Deploy bundle at ${DEPLOY_DIR} ($(git -C "${DEPLOY_DIR}" rev-parse --short HEAD))"
echo "Public API:"
curl -fsS "https://api.vibecodecollab.com/api/v3/site" | head -c 200 || echo "(not reachable yet — check Caddy / Cloudflare)"
