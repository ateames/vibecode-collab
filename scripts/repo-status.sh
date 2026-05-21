#!/usr/bin/env bash
# Show git status for the deployment workspace and both application repos.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

status_repo() {
  local label="$1"
  local dir="$2"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " $label"
  echo " Path: $dir"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ ! -d "$dir/.git" ]]; then
    echo "  (not cloned — run: ./scripts/setup.sh)"
    echo ""
    return
  fi

  git -C "$dir" remote -v 2>/dev/null | head -2 | sed 's/^/  /' || true
  echo "  Branch: $(git -C "$dir" branch --show-current 2>/dev/null || echo "(none)")"
  if git -C "$dir" rev-parse HEAD >/dev/null 2>&1; then
    echo "  Commit: $(git -C "$dir" log -1 --oneline)"
  else
    echo "  Commit: (no commits yet)"
  fi
  if [[ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ]]; then
    echo "  Working tree: dirty (uncommitted changes)"
  else
    echo "  Working tree: clean"
  fi
  echo ""
}

status_repo "Deployment workspace" "$ROOT"
status_repo "Lemmy (backend)" "$ROOT/lemmy"
status_repo "Blorp (frontend)" "$ROOT/blorp"
