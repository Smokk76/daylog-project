#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"
TARGET_FILE="$BACKUP_DIR/main-backup.json"

SOURCE_FILE="${1:-}"
if [[ -z "$SOURCE_FILE" ]]; then
  SOURCE_FILE="$(ls -t "$HOME"/Downloads/daylog-project-full-backup*.json 2>/dev/null | head -n 1 || true)"
fi
if [[ -z "$SOURCE_FILE" ]]; then
  SOURCE_FILE="$(ls -t "$HOME"/Downloads/roomworks-estimator-full-backup*.json 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$SOURCE_FILE" || ! -f "$SOURCE_FILE" ]]; then
  echo "No backup file found."
  echo "Pass a path explicitly:"
  echo "npm run backup:push -- \"/path/to/daylog-project-full-backup.json\""
  echo "Legacy names like roomworks-estimator-full-backup.json are also supported."
  exit 1
fi

SOURCE_BASENAME="$(basename "$SOURCE_FILE")"
if [[ ! "$SOURCE_BASENAME" =~ ^(daylog-project|roomworks-estimator)-full-backup.*\.json$ ]]; then
  echo "Invalid backup filename: $SOURCE_BASENAME"
  echo "Expected a full backup file like:"
  echo "- daylog-project-full-backup*.json"
  echo "- roomworks-estimator-full-backup*.json (legacy)"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$SOURCE_FILE" "$TARGET_FILE"

cd "$ROOT_DIR"
git add "$TARGET_FILE"

if git diff --cached --quiet; then
  echo "Backup is unchanged; nothing to commit."
  exit 0
fi

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
git commit -m "chore: update main backup $STAMP"
CURRENT_BRANCH="$(git branch --show-current)"
git push origin "$CURRENT_BRANCH"

echo "Pushed backup to GitHub on branch: $CURRENT_BRANCH"
echo "Saved file: $TARGET_FILE"
