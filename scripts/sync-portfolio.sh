#!/usr/bin/env bash
# Builds the portfolio hub and replaces portfolio-content/ with its static
# export. Run before committing a portfolio update.
#   HUB_DIR=/path/to/cc-portfolio-hub npm run sync:portfolio
set -euo pipefail

BROKER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HUB_DIR="${HUB_DIR:-$BROKER_DIR/../codingcops/cc-portfolio-hub}"

[ -f "$HUB_DIR/package.json" ] || { echo "Hub not found at $HUB_DIR (set HUB_DIR)"; exit 1; }

(cd "$HUB_DIR" && npm run build)

rm -rf "$BROKER_DIR/portfolio-content"
cp -R "$HUB_DIR/out" "$BROKER_DIR/portfolio-content"
echo "hub commit: $(git -C "$HUB_DIR" rev-parse --short HEAD)$(git -C "$HUB_DIR" diff --quiet || echo ' (+uncommitted changes)')" > "$BROKER_DIR/portfolio-content/BUILD_INFO"
echo "Synced $(du -sh "$BROKER_DIR/portfolio-content" | cut -f1) into portfolio-content/"
