#!/usr/bin/env bash
# Print a one-liner to paste into DigitalOcean Droplet Console (Access → Launch Console).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT}/deploy/digitalocean/console-install.sh"
B64="$(base64 < "${SCRIPT}" | tr -d '\n')"
echo "Paste this entire line as root in the DO web console:"
echo ""
echo "echo '${B64}' | base64 -d | bash"
echo ""
