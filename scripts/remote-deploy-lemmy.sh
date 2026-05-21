#!/usr/bin/env bash
# From vibecode-collab root: push deploy bundle to the droplet and run setup.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${SSH_HOST:-137.184.183.96}"
SSH_USER="${SSH_USER:-root}"
REMOTE_DEPLOY_DIR="${REMOTE_DEPLOY_DIR:-/opt/vibecode-collab}"
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-${HOME}/.ssh/digitalocean_cursor}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -o IdentitiesOnly=yes)
if [[ -f "${SSH_IDENTITY_FILE}" ]]; then
  SSH_OPTS+=(-i "${SSH_IDENTITY_FILE}")
fi
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

echo "==> Checking SSH to ${SSH_USER}@${SSH_HOST}"
if ! ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" 'echo ok' >/dev/null 2>&1; then
  DO_PUB="${HOME}/.ssh/digitalocean_cursor.pub"
  cat <<EOF >&2

SSH failed. The key must be in /root/.ssh/authorized_keys on the droplet.

  Fingerprint expected: $(ssh-keygen -lf "${DO_PUB}" 2>/dev/null || echo "unknown")

  1. DO → Droplet → Access → ensure this key is attached to vibe-code-collab-prod
  2. Or paste in Droplet Console (as root):
$(cat "${DO_PUB}" 2>/dev/null || echo "  (missing ${DO_PUB})")

     mkdir -p /root/.ssh && chmod 700 /root/.ssh
     echo 'PASTE_LINE_ABOVE' >> /root/.ssh/authorized_keys
     chmod 600 /root/.ssh/authorized_keys

  3. Retry: ./scripts/remote-deploy-lemmy.sh

EOF
  exit 1
fi

echo "==> Syncing deploy bundle to ${REMOTE_DEPLOY_DIR}"
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "mkdir -p ${REMOTE_DEPLOY_DIR}"
rsync -az --delete -e "${RSYNC_SSH}" \
  "${ROOT}/deploy/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DEPLOY_DIR}/deploy/"
rsync -az -e "${RSYNC_SSH}" \
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
