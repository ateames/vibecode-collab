#!/usr/bin/env bash
# Upload blorp/dist to an existing Cloudflare Pages project (direct upload, not wrangler deploy).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/blorp/dist"
CF_ENV="$ROOT/deploy/cloudflare/.env"
WRANGLER="$ROOT/node_modules/.bin/wrangler"

load_env() {
  if [[ -f "$CF_ENV" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$CF_ENV"
    set +a
  fi
}

load_env

PROJECT="${CLOUDFLARE_PAGES_PROJECT_NAME:-}"
BRANCH="${CLOUDFLARE_PAGES_BRANCH:-main}"

if [[ -z "$PROJECT" ]]; then
  echo "Error: set CLOUDFLARE_PAGES_PROJECT_NAME in deploy/cloudflare/.env" >&2
  echo "  cp deploy/cloudflare/.env.example deploy/cloudflare/.env" >&2
  exit 1
fi

if [[ ! -f "$DIST/index.html" ]]; then
  echo "Error: $DIST not found. Run: pnpm build:web:prod" >&2
  exit 1
fi

if [[ ! -x "$WRANGLER" ]]; then
  echo "Error: wrangler not installed. Run: pnpm install (from repo root)" >&2
  exit 1
fi

WRANGLER_ARGS=(
  pages deploy "../../blorp/dist"
  --cwd "$ROOT/deploy/cloudflare"
  --project-name="$PROJECT"
  --branch="$BRANCH"
)

if [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  WRANGLER_ARGS+=(--account-id="$CLOUDFLARE_ACCOUNT_ID")
fi

echo "==> Deploying $DIST to Cloudflare Pages ..."
echo "    project: $PROJECT"
echo "    branch:  $BRANCH"
echo ""

"$WRANGLER" "${WRANGLER_ARGS[@]}"
