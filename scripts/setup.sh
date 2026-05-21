#!/usr/bin/env bash
# Clone or update the Lemmy and Blorp application repos alongside this workspace.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LEMMY_URL="${LEMMY_REPO:-https://github.com/LemmyNet/lemmy.git}"
BLORP_URL="${BLORP_REPO:-https://github.com/Blorp-Labs/blorp.git}"

clone_or_pull() {
  local name="$1"
  local url="$2"
  local dir="$ROOT/$name"

  if [[ -d "$dir/.git" ]]; then
    echo "==> Updating $name ..."
    git -C "$dir" pull --ff-only
    if [[ "$name" == "lemmy" ]] && [[ -f "$dir/.gitmodules" ]]; then
      git -C "$dir" submodule update --init --recursive
    fi
  else
    echo "==> Cloning $name from $url ..."
    if [[ "$name" == "lemmy" ]]; then
      git clone --recurse-submodules "$url" "$dir"
    else
      git clone "$url" "$dir"
    fi
  fi
}

clone_or_pull lemmy "$LEMMY_URL"
clone_or_pull blorp "$BLORP_URL"

echo ""
echo "Done. Workspace layout:"
echo "  $ROOT/          (this deployment repo)"
echo "  $ROOT/lemmy/    (Lemmy backend — separate git repo)"
echo "  $ROOT/blorp/    (Blorp frontend — separate git repo)"
