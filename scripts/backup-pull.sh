#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_FILE="$ROOT_DIR/backups/main-backup.json"

cd "$ROOT_DIR"
CURRENT_BRANCH="$(git branch --show-current)"
git pull --ff-only origin "$CURRENT_BRANCH"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "No backup found at: $SOURCE_FILE"
  exit 1
fi

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
TARGET_FILE="$HOME/Downloads/roomworks-estimator-restored-$STAMP.json"
cp "$SOURCE_FILE" "$TARGET_FILE"

echo "Restored backup copied to:"
echo "$TARGET_FILE"
echo "Next step: open the app and click Import Full Backup."
