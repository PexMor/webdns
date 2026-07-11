#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/scripts/render-svg.cjs" \
  "$SCRIPT_DIR/public/icons/icon.svg" \
  "$SCRIPT_DIR/public/icons" \
  192 512
