#!/usr/bin/env bash
# Steam / local launcher for Linux & macOS.
set -euo pipefail
cd "$(dirname "$0")"

ARCH="$(uname -m)"
NODE=""
if [[ -x "./runtime/node" ]]; then
  NODE="./runtime/node"
elif [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]] && [[ -x "./runtime/node-arm64" ]]; then
  NODE="./runtime/node-arm64"
elif [[ -x "./runtime/node-x64" ]]; then
  NODE="./runtime/node-x64"
else
  echo "Missing portable Node in ./runtime/"
  exit 1
fi

chmod +x "$NODE" ./asteroids-* 2>/dev/null || true
exec "$NODE" "./steam/launch-game.js"
