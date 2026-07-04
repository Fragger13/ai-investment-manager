#!/usr/bin/env bash
# Nightly backup of the AskPapa SQLite DB (consistent snapshot via .backup)
# and the uploaded-documents folder. Keeps 14 days locally in ~/backups.
# Installed to cron by deploy/setup-ec2.sh.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$HOME/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

sqlite3 "$APP_DIR/backend/ai_investment_manager.db" ".backup '$BACKUP_DIR/db-$STAMP.sqlite'"
gzip "$BACKUP_DIR/db-$STAMP.sqlite"

if [ -d "$APP_DIR/backend/uploaded_documents" ]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$APP_DIR/backend" uploaded_documents
fi

# Prune anything older than 14 days.
find "$BACKUP_DIR" -name "db-*.sqlite.gz" -mtime +14 -delete
find "$BACKUP_DIR" -name "uploads-*.tar.gz" -mtime +14 -delete

echo "$(date -Is) backup ok: db-$STAMP.sqlite.gz"
