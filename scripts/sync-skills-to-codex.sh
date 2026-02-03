#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR=".cursor/skills"
DEST_DIR="${CODEX_HOME:-$HOME/.codex}/skills"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Source skills directory not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

# Copy all skills, overwriting existing ones to keep Codex UI in sync.
cp -R "$SOURCE_DIR"/* "$DEST_DIR"/

echo "Synced skills from $SOURCE_DIR to $DEST_DIR"
