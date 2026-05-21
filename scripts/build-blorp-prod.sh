#!/usr/bin/env bash
# Production web build for Blorp (Vite only — no Capacitor sync). Output: blorp/dist/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLORP="$ROOT/blorp"
ENV_PROD="$BLORP/.env.production"
ENV_EXAMPLE="$ROOT/deploy/cloudflare/blorp.production.env.example"

if [[ ! -d "$BLORP/.git" ]]; then
  echo "Error: blorp/ not found. Run ./scripts/setup.sh first." >&2
  exit 1
fi

if [[ ! -f "$ENV_PROD" ]]; then
  echo "Error: missing $ENV_PROD" >&2
  echo "Copy the template and set your production Lemmy URL:" >&2
  echo "  cp deploy/cloudflare/blorp.production.env.example blorp/.env.production" >&2
  exit 1
fi

echo "==> Installing Blorp dependencies (if needed) ..."
cd "$BLORP"
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "==> Building Blorp for production (vite only, output: blorp/dist/) ..."
NODE_ENV=production pnpm exec vite build

if [[ ! -d "$BLORP/dist" ]] || [[ ! -f "$BLORP/dist/index.html" ]]; then
  echo "Error: build did not produce blorp/dist/index.html" >&2
  exit 1
fi

echo ""
echo "Build OK: $BLORP/dist/"
echo "Deploy with: pnpm deploy:cloudflare:prod"
