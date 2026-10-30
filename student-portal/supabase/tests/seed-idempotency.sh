#!/usr/bin/env bash
# Runs the demo seed twice against the locally migrated test database (see run-local.sh) and
# fails if any table's row count changes between runs. Requires DATABASE_URL.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?DATABASE_URL is required}"
COUNTS="select string_agg(table_name || '=' || (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', table_name), false, true, '')))[1]::text, ' ' order by table_name)
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name not in ('audit_logs', 'notification_outbox')"

SEED_TARGET=pg npx tsx supabase/seed/seed.ts
first="$(psql -X -At "$DATABASE_URL" -c "$COUNTS")"
SEED_TARGET=pg npx tsx supabase/seed/seed.ts >/dev/null
second="$(psql -X -At "$DATABASE_URL" -c "$COUNTS")"
if [ "$first" != "$second" ]; then
  diff <(tr ' ' '\n' <<<"$first") <(tr ' ' '\n' <<<"$second") || true
  echo "RESULT: seed is NOT idempotent"
  exit 1
fi
echo "RESULT: seed is idempotent ($(wc -w <<<"$first") tables unchanged on the second run)"
