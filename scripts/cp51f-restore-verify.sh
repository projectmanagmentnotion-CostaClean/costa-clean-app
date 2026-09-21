#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly REQUIRED_ARTIFACTS=(roles.sql schema.sql data.sql history_schema.sql history_data.sql)
readonly RESTORE_SUPERUSER=cp51f_admin
readonly CP43_CANONICAL_MIGRATION_VERSION=20260918155431
readonly CP43_CANONICAL_MIGRATION_NAME=cp43_canonical_state_reconciliation

PRIVATE_PATH="${CP51F_PRIVATE_SECURE_PATH:?CP51F_PRIVATE_SECURE_PATH is required}"
RUNNER_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
RESTORE_ROOT="${CP51F_RESTORE_ROOT:-$RUNNER_ROOT/cp51f-restore}"
PG_BIN_DIR="${PG_BIN_DIR:-/usr/lib/postgresql/17/bin}"
PGDATA="$RESTORE_ROOT/pgdata"
PGSOCKET="$RESTORE_ROOT/socket"
LOG_ROOT="$RESTORE_ROOT/logs"
PGLOG="$LOG_ROOT/postgres.log"
PGDATABASE=cp51f_restore_db
MANIFEST="$PRIVATE_PATH/manifest.json"

PSQL="$PG_BIN_DIR/psql"
INITDB="$PG_BIN_DIR/initdb"
PG_CTL="$PG_BIN_DIR/pg_ctl"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [[ -x "$PG_CTL" && -d "$PGDATA" ]]; then
    "$PG_CTL" -D "$PGDATA" -m fast -w stop >"$LOG_ROOT/pg_ctl_stop.log" 2>&1 || true
  fi
  rm -rf -- "$PGDATA" "$PGSOCKET" "$LOG_ROOT"
  rmdir -- "$RESTORE_ROOT" 2>/dev/null || true
}
trap cleanup EXIT

[[ -d "$PRIVATE_PATH" && ! -L "$PRIVATE_PATH" ]] || fail "CP51F_RESTORE_ERROR: private backup path invalid"
[[ -s "$MANIFEST" ]] || fail "CP51F_RESTORE_ERROR: manifest missing or empty"
command -v jq >/dev/null 2>&1 || fail "CP51F_RESTORE_ERROR: jq unavailable"
command -v sha256sum >/dev/null 2>&1 || fail "CP51F_RESTORE_ERROR: sha256sum unavailable"
[[ -x "$PSQL" && -x "$INITDB" && -x "$PG_CTL" ]] || fail "CP51F_RESTORE_ERROR: PostgreSQL 17 tools unavailable"

for tool in "$PSQL" "$INITDB" "$PG_CTL"; do
  "$tool" --version | grep -Eq ' 17([.]|$)' || fail "CP51F_RESTORE_ERROR: PostgreSQL 17 required"
done

mkdir -p -- "$RESTORE_ROOT" "$PGSOCKET" "$LOG_ROOT"
chmod 700 "$RESTORE_ROOT" "$PGSOCKET" "$LOG_ROOT"

[[ "$(jq -r '.setup_result // empty' "$MANIFEST")" == "AWAITING_PAT_REVOCATION" ]] || fail "CP51F_RESTORE_ERROR: runner state is not awaiting PAT revocation"
[[ "$(jq -r '.jit_poststate_matches_prestate // false' "$MANIFEST")" == "true" ]] || fail "CP51F_RESTORE_ERROR: JIT cleanup state is not certified"

verify_artifact() {
  local name="$1"
  local path="$PRIVATE_PATH/$name"
  local expected actual
  [[ -s "$path" ]] || fail "CP51F_RESTORE_ERROR: $name missing or empty"
  expected="$(jq -er --arg name "$name" '[.artifacts[] | select(.logical_name == $name) | .sha256] | if length == 1 then .[0] else error("artifact hash cardinality") end' "$MANIFEST")" || fail "CP51F_RESTORE_ERROR: $name hash missing"
  [[ "$expected" =~ ^[0-9a-fA-F]{64}$ ]] || fail "CP51F_RESTORE_ERROR: $name hash malformed"
  actual="$(sha256sum "$path" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || fail "STOP_BACKUP_INTEGRITY_FAILURE"
}

for artifact in "${REQUIRED_ARTIFACTS[@]}"; do
  verify_artifact "$artifact"
done

if ! "$INITDB" -D "$PGDATA" -U "$RESTORE_SUPERUSER" --auth=trust --no-locale >"$LOG_ROOT/initdb.log" 2>&1; then
  fail "CP51F_RESTORE_ERROR: initdb failed"
fi

if ! "$PG_CTL" -D "$PGDATA" -o "-h '' -k $PGSOCKET" -l "$PGLOG" -w start >"$LOG_ROOT/pg_ctl_start.log" 2>&1; then
  fail "CP51F_RESTORE_ERROR: PostgreSQL start failed"
fi

run_query() {
  local phase="$1" database="$2" sql="$3"
  local output="$LOG_ROOT/$phase.out" error="$LOG_ROOT/$phase.err" result
  if ! "$PSQL" -h "$PGSOCKET" -U "$RESTORE_SUPERUSER" -d "$database" -v ON_ERROR_STOP=1 -X -q -Atqc "$sql" >"$output" 2>"$error"; then
    fail "CP51F_RESTORE_ERROR: $phase failed"
  fi
  result="$(<"$output")"
  rm -f -- "$output" "$error"
  printf '%s' "$result"
}

run_file() {
  local phase="$1" database="$2" file="$3"
  local log="$LOG_ROOT/$phase.log"
  if ! "$PSQL" -h "$PGSOCKET" -U "$RESTORE_SUPERUSER" -d "$database" -v ON_ERROR_STOP=1 -X -q -f "$file" >"$log" 2>&1; then
    fail "CP51F_RESTORE_ERROR: $phase failed"
  fi
  rm -f -- "$log"
}

run_query create_database postgres "CREATE DATABASE $PGDATABASE OWNER $RESTORE_SUPERUSER;" >/dev/null
run_file roles postgres "$PRIVATE_PATH/roles.sql"
run_file schema "$PGDATABASE" "$PRIVATE_PATH/schema.sql"
run_file history_schema "$PGDATABASE" "$PRIVATE_PATH/history_schema.sql"
run_file data "$PGDATABASE" "$PRIVATE_PATH/data.sql"
run_file history_data "$PGDATABASE" "$PRIVATE_PATH/history_data.sql"

SCHEMA_COUNT="$(run_query schema_count "$PGDATABASE" "SELECT count(*) FROM pg_namespace WHERE nspname IN ('public','portal_private','auth','supabase_migrations');")"
TABLE_COUNT="$(run_query table_count "$PGDATABASE" "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('public','portal_private','auth','supabase_migrations') AND c.relkind IN ('r','p','v','m','f','S');")"
FUNCTION_COUNT="$(run_query function_count "$PGDATABASE" "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public','portal_private','auth','supabase_migrations');")"
TRIGGER_COUNT="$(run_query trigger_count "$PGDATABASE" "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','portal_private','auth','supabase_migrations');")"
POLICY_COUNT="$(run_query policy_count "$PGDATABASE" "SELECT count(*) FROM pg_policies WHERE schemaname IN ('public','portal_private','auth','supabase_migrations');")"
MIGRATION_HISTORY_ROW_COUNT="$(run_query migration_history_count "$PGDATABASE" "SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN 'MISSING' ELSE (SELECT count(*)::text FROM supabase_migrations.schema_migrations) END;")"
CP43_MIGRATION_LEDGER_STATE="$(run_query cp43_presence "$PGDATABASE" "SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$CP43_CANONICAL_MIGRATION_VERSION') THEN 'ABSENT' WHEN EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$CP43_CANONICAL_MIGRATION_VERSION' AND name = '$CP43_CANONICAL_MIGRATION_NAME') THEN 'PRESENT_CANONICAL' ELSE 'VERSION_NAME_MISMATCH' END;")"
[[ "$CP43_MIGRATION_LEDGER_STATE" != VERSION_NAME_MISMATCH ]] || fail "STOP_CP43_VERSION_NAME_MISMATCH"
CP43_CANONICAL_MIGRATION_PRESENT=NO
[[ "$CP43_MIGRATION_LEDGER_STATE" == PRESENT_CANONICAL ]] && CP43_CANONICAL_MIGRATION_PRESENT=YES

[[ "$SCHEMA_COUNT" == 4 ]] || fail "CP51F_RESTORE_ERROR: required schemas validation failed"
[[ "$MIGRATION_HISTORY_ROW_COUNT" != MISSING ]] || fail "CP51F_RESTORE_ERROR: migration history validation failed"

ARTIFACT_HASHES="$(jq -c '[.artifacts[] | {logical_name, size_bytes, sha256, exit_status}]' "$MANIFEST")"
RESTORE_VERIFICATION="$PRIVATE_PATH/restore-verification.json"
jq -n \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg restore_superuser "$RESTORE_SUPERUSER" \
  --arg restore_network_exposure "unix_socket_only_listen_addresses_empty" \
  --arg schema_count "$SCHEMA_COUNT" \
  --arg table_count "$TABLE_COUNT" \
  --arg function_count "$FUNCTION_COUNT" \
  --arg trigger_count "$TRIGGER_COUNT" \
  --arg policy_count "$POLICY_COUNT" \
  --arg migration_history_row_count "$MIGRATION_HISTORY_ROW_COUNT" \
  --arg cp43_present "$CP43_CANONICAL_MIGRATION_PRESENT" \
  --arg cp43_ledger_state "$CP43_MIGRATION_LEDGER_STATE" \
  --argjson artifact_hashes "$ARTIFACT_HASHES" \
  '{restore_result:"PASS", generated_at:$generated_at, restore_superuser:$restore_superuser, restore_network_exposure:$restore_network_exposure, schema_count:($schema_count|tonumber), table_count:($table_count|tonumber), function_count:($function_count|tonumber), trigger_count:($trigger_count|tonumber), policy_count:($policy_count|tonumber), migration_history_row_count:($migration_history_row_count|tonumber), cp43_canonical_migration_present:$cp43_present, cp43_migration_ledger_state:$cp43_ledger_state, artifact_hashes:$artifact_hashes}' \
  >"$RESTORE_VERIFICATION"
chmod 600 "$RESTORE_VERIFICATION"

printf 'CP43_CANONICAL_MIGRATION_PRESENT_PRE_RELEASE=%s\n' "$CP43_CANONICAL_MIGRATION_PRESENT"
printf 'CP43_MIGRATION_LEDGER_STATE=%s\n' "$CP43_MIGRATION_LEDGER_STATE"
printf 'CP51F_RESTORE_RESULT=PASS\n'
