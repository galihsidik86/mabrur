#!/bin/bash
# Backup PostgreSQL database
# Jalankan via cron: 0 2 * * * /path/to/backup.sh

set -e

DB_NAME="${DB_NAME:-mabrur}"
DB_USER="${DB_USER:-mabrur}"
DB_HOST="${DB_HOST:-localhost}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mabrur}"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting backup: $DB_NAME → $FILENAME"

pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip > "$FILENAME"

echo "[$(date)] Backup selesai: $(du -h "$FILENAME" | cut -f1)"

# Hapus backup lama
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Backup lama (>$RETENTION_DAYS hari) dihapus"

# Restore: gunzip < backup.sql.gz | psql -U mabrur mabrur
