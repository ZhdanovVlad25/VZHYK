#!/usr/bin/env bash
# ВЖИК — щоденний backup продакшн БД. docs/deployment.md §7.
#
# Використання (на хості з docker-compose.prod.yml, або cron там же):
#   ./scripts/backup-db.sh
#
# Env (беруться з .env.production, якщо не задані явно):
#   BACKUP_DIR       — куди писати дампи, дефолт ./backups
#   BACKUP_RETENTION_DAYS — скільки днів зберігати локальні дампи, дефолт 14
#
# Cron-приклад (щодня о 3:00):
#   0 3 * * * cd /path/to/vzhyk && ./scripts/backup-db.sh >> /var/log/vzhyk-backup.log 2>&1
#
# Відновлення:
#   gunzip -c backups/vzhyk_2026-08-12T030000Z.sql.gz | \
#     docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.production ]; then
  # shellcheck disable=SC1091
  set -a; source .env.production; set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER не задано (.env.production)}"
POSTGRES_DB="${POSTGRES_DB:-vzhyk}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
out_file="$BACKUP_DIR/vzhyk_${timestamp}.sql.gz"

echo "[backup-db] дамплю $POSTGRES_DB → $out_file"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=plain | gzip > "$out_file"

echo "[backup-db] готово: $(du -h "$out_file" | cut -f1)"

echo "[backup-db] прибираю дампи старші за ${BACKUP_RETENTION_DAYS} днів"
find "$BACKUP_DIR" -name 'vzhyk_*.sql.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete
