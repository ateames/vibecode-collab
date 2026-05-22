#!/usr/bin/env bash
# From vibecode-collab root: push deploy bundle to the droplet and run setup.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${SSH_HOST:-137.184.183.96}"
SSH_USER="${SSH_USER:-root}"
REMOTE_DEPLOY_DIR="${REMOTE_DEPLOY_DIR:-/opt/vibecode-collab}"

# Hardened SSH identity resolution:
# - Prefer explicitly provided SSH_IDENTITY_FILE
# - Otherwise use the invoking user's real home directory when possible
# - Fall back to HOME only if needed
LOCAL_HOME="${HOME:-}"
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  LOCAL_HOME="$(eval echo "~${SUDO_USER}")"
elif [[ -z "${LOCAL_HOME}" || "${LOCAL_HOME}" == "/root" ]]; then
  DETECTED_HOME="$(dscl . -read "/Users/$(id -un)" NFSHomeDirectory 2>/dev/null | awk '{print $2}' || true)"
  if [[ -n "${DETECTED_HOME}" ]]; then
    LOCAL_HOME="${DETECTED_HOME}"
  fi
fi

SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-${LOCAL_HOME}/.ssh/digitalocean_cursor}"
SSH_PUBLIC_KEY_FILE="${SSH_PUBLIC_KEY_FILE:-${SSH_IDENTITY_FILE}.pub}"

SSH_OPTS=(
  -o BatchMode=yes
  -o ConnectTimeout=30
  -o ConnectionAttempts=3
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=6
  -o TCPKeepAlive=yes
  -o IdentitiesOnly=yes
)

if [[ ! -f "${SSH_IDENTITY_FILE}" ]]; then
  cat <<EOF >&2

SSH private key not found.

  Expected private key:
  ${SSH_IDENTITY_FILE}

  Current user: $(whoami)
  HOME: ${HOME:-unset}
  LOCAL_HOME: ${LOCAL_HOME:-unset}

Fix one of these:

  1. Run the script as your normal local user, not with sudo:
     ./scripts/remote-deploy-lemmy.sh

  2. Or pass the key explicitly:
     SSH_IDENTITY_FILE="/Users/ateames/.ssh/digitalocean_cursor" ./scripts/remote-deploy-lemmy.sh

EOF
  exit 1
fi

SSH_OPTS+=(-i "${SSH_IDENTITY_FILE}")
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

echo "==> Checking SSH to ${SSH_USER}@${SSH_HOST}"
echo "==> Using SSH identity: ${SSH_IDENTITY_FILE}"

if ! ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" 'echo ok' >/dev/null 2>&1; then
  DO_PUB="${SSH_PUBLIC_KEY_FILE}"

  cat <<EOF >&2

SSH failed. The matching public key must be in /root/.ssh/authorized_keys on the droplet.

  SSH identity used:
  ${SSH_IDENTITY_FILE}

  Public key expected:
  ${DO_PUB}

  Fingerprint expected:
  $(ssh-keygen -lf "${DO_PUB}" 2>/dev/null || echo "unknown - public key file missing or unreadable")

  1. DO → Droplet → Access → ensure this key is attached to vibe-code-collab-prod

  2. Or paste this public key in Droplet Console as root:

$(cat "${DO_PUB}" 2>/dev/null || echo "  (missing ${DO_PUB})")

     mkdir -p /root/.ssh && chmod 700 /root/.ssh
     echo 'PASTE_PUBLIC_KEY_LINE_ABOVE' >> /root/.ssh/authorized_keys
     chmod 600 /root/.ssh/authorized_keys
     chown -R root:root /root/.ssh

  3. Test SSH manually:
     ssh -o BatchMode=yes -o ConnectTimeout=15 -o IdentitiesOnly=yes -i "${SSH_IDENTITY_FILE}" "${SSH_USER}@${SSH_HOST}" 'echo ok'

  4. Retry:
     ./scripts/remote-deploy-lemmy.sh

EOF
  exit 1
fi

echo "==> Syncing deploy bundle to ${REMOTE_DEPLOY_DIR}"
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "mkdir -p ${REMOTE_DEPLOY_DIR}/deploy ${REMOTE_DEPLOY_DIR}/scripts/droplet"
rsync -azv --delete --partial --progress -e "${RSYNC_SSH}" \
  "${ROOT}/deploy/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DEPLOY_DIR}/deploy/"

rsync -azv --partial --progress -e "${RSYNC_SSH}" \
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