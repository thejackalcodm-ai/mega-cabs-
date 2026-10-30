#!/usr/bin/env bash
# Runs all migrations + the pgTAP suite against a throwaway local PostgreSQL database.
#
# Requires a local PostgreSQL 15+ server with the pgtap extension installed
# (Debian/Ubuntu: apt install postgresql-16-pgtap). Connection uses the usual
# PG* environment variables; defaults to the local socket as user "postgres".
#
# Against a real Supabase stack use `supabase test db` instead: it runs the same
# supabase/tests/*.test.sql files (the local stub below is NOT needed there).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${TEST_DB:-portal_rls_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -U "${PGUSER:-postgres}")

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
"${PSQL[@]}" -d "$DB" -f supabase/tests/local/supabase-stub.sql >/dev/null
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null
  echo "migrated  $(basename "$f")"
done

failed=0
for t in supabase/tests/*.test.sql; do
  echo "running   $(basename "$t")"
  out="$("${PSQL[@]}" -d "$DB" -t -A -f "$t" 2>&1)" || failed=1
  echo "$out"
  grep -qE '^not ok' <<<"$out" && failed=1
done

if [ "$failed" -eq 0 ]; then echo "RESULT: ALL TESTS PASSED"; else echo "RESULT: FAILURES"; fi
exit "$failed"
