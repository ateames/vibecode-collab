#!/usr/bin/env bash
# From vibecode-collab root: push deploy bundle to the droplet and run setup.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${SSH_HOST:-137.184.183.96}"
SSH_USER="${SSH_USER:-root}"
REMOTE_DEPLOY_DIR="${REMOTE_DEPLOY_DIR:-/opt/vibecode-collab}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)

echo "==> Checking SSH to ${SSH_USER}@${SSH_HOST}"
if ! ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" 'echo ok' >/dev/null 2>&1; then
  cat <<EOF >&2

SSH failed. Add your public key to the droplet first:

  1. DigitalOcean → Droplets → vibe-code-collab-prod → Access → Add SSH key
  2. Or paste this key in the droplet console:
$(cat "${HOME}/.ssh/id_ed25519.pub" 2>/dev/null || cat "${HOME}/.ssh/id_rsa.pub" 2>/dev/null || echo "  (no local .pub key found)")

  3. Retry: SSH_HOST=${SSH_HOST} SSH_USER=${SSH_USER} ./scripts/remote-deploy-lemmy.sh

EOF
  exit 1
fi

echo "==> Syncing deploy bundle to ${REMOTE_DEPLOY_DIR}"
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "mkdir -p ${REMOTE_DEPLOY_DIR}"
rsync -az --delete \
  "${ROOT}/deploy/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DEPLOY_DIR}/deploy/"
rsync -az \
  "${ROOT}/scripts/droplet/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DEPLOY_DIR}/scripts/droplet/"

echo "==> Installing Docker, firewall, Caddy, Lemmy"
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail
export DEPLOY_DIR="${REMOTE_DEPLOY_DIR}"
chmod +x "${REMOTE_DEPLOY_DIR}/scripts/droplet/"*.sh
"${REMOTE_DEPLOY_DIR}/scripts/droplet/install-docker.sh"
"${REMOTE_DEPLOY_DIR}/scripts/droplet/configure-firewall.sh"
"${REMOTE_DEPLOY_DIR}/scripts/droplet/setup-lemmy.sh"
"${REMOTE_DEPLOY_DIR}/scripts/droplet/install-caddy.sh"
REMOTE

echo ""
echo "==> Public API check (via Cloudflare)"
curl -fsS "https://api.vibecodecollab.com/api/v3/site" | head -c 300 || {
  echo "API not reachable yet. If Cloudflare shows 521:"
  echo "  - Install Origin cert: deploy/digitalocean/README.md"
  echo "  - Set SSL/TLS to Full (strict)"
}
echo ""
echo "Done. Admin password is on the server: ${REMOTE_DEPLOY_DIR}/deploy/digitalocean/secrets.env"
