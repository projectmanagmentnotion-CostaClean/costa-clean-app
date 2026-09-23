#!/usr/bin/env bash
set -Eeuo pipefail

# Exercise the exact production classifiers/readiness loop extracted from the
# runner. No Supabase connection or database is used by this contract test.

SCRIPT="scripts/cp51f-production-backup-setup.sh"
ROOT="$(mktemp -d)"
trap 'rm -rf -- "$ROOT"' EXIT
PRIVATE_SECURE_PATH="$ROOT/private"
mkdir -p -- "$PRIVATE_SECURE_PATH"

source <(sed -n '/^classify_db_session_error() {/,/^}/p' "$SCRIPT")
source <(sed -n '/^run_db_session_readiness() {/,/^}/p' "$SCRIPT")
source <(sed -n '/^classify_dump_error() {/,/^}/p' "$SCRIPT")
source <(sed -n '/^dump_roles_retry_allowed() {/,/^}/p' "$SCRIPT")

expect_dump_code() {
  local name="$1" text="$2" expected="$3" file actual
  file="$ROOT/$name.stderr"
  printf '%s\n' "$text" >"$file"
  actual="$(classify_dump_error "$file")"
  [[ "$actual" == "$expected" ]] || {
    printf 'DUMP_CLASSIFIER=FAIL: %s expected %s got %s\n' "$name" "$expected" "$actual" >&2
    exit 1
  }
}

expect_dump_code auth 'pg_dumpall: error: password authentication failed for user "postgres"' DUMP_ROLES_AUTH_FAILED
expect_dump_code refused 'pg_dumpall: error: connection refused' DUMP_ROLES_NETWORK_ERROR
expect_dump_code timeout 'pg_dumpall: error: connection timed out' DUMP_ROLES_TIMEOUT
expect_dump_code reset 'pg_dumpall: error: connection reset by peer' DUMP_ROLES_NETWORK_ERROR
expect_dump_code closed 'server closed the connection unexpectedly' DUMP_ROLES_SERVER_CLOSED
expect_dump_code ssl 'SSL SYSCALL error: EOF detected' DUMP_ROLES_SSL_ERROR
expect_dump_code permission 'pg_dumpall: error: permission denied for relation pg_authid' DUMP_ROLES_PERMISSION_DENIED
expect_dump_code statement 'canceling statement due to statement timeout' DUMP_ROLES_STATEMENT_TIMEOUT
expect_dump_code query 'pg_dumpall: error: query failed: invalid query' DUMP_ROLES_QUERY_FAILED
expect_dump_code unknown 'unexpected private diagnostic' DUMP_ROLES_UNKNOWN

for code in DUMP_ROLES_AUTH_FAILED DUMP_ROLES_PERMISSION_DENIED DUMP_ROLES_STATEMENT_TIMEOUT DUMP_ROLES_QUERY_FAILED DUMP_ROLES_UNKNOWN; do
  if dump_roles_retry_allowed "$code"; then
    printf 'DUMP_RETRY=FAIL: non-transient %s was retryable\n' "$code" >&2
    exit 1
  fi
done
for code in DUMP_ROLES_NETWORK_ERROR DUMP_ROLES_TIMEOUT DUMP_ROLES_SSL_ERROR DUMP_ROLES_SERVER_CLOSED; do
  dump_roles_retry_allowed "$code" || {
    printf 'DUMP_RETRY=FAIL: transient %s was not retryable\n' "$code" >&2
    exit 1
  }
done

cat >"$ROOT/mock-psql" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
count_file="$MOCK_PSQL_COUNT_FILE"
count=0
[[ -f "$count_file" ]] && count="$(<"$count_file")"
count=$((count + 1))
printf '%s\n' "$count" >"$count_file"
case "$MOCK_PSQL_MODE" in
  pass) printf '%s\n' 1; exit 0 ;;
  transient_then_pass) if [[ "$count" -eq 1 ]]; then printf '%s\n' 'connection refused' >&2; exit 1; fi; printf '%s\n' 1; exit 0 ;;
  auth_failure) printf '%s\n' 'password authentication failed' >&2; exit 1 ;;
  network_failure) printf '%s\n' 'connection reset by peer' >&2; exit 1 ;;
  *) printf '%s\n' 'unknown mock failure' >&2; exit 1 ;;
esac
EOF
chmod 700 "$ROOT/mock-psql"

sleep() { :; }
PSQL_BIN="$ROOT/mock-psql"
DB_SESSION_MAX_ATTEMPTS=4
DB_SESSION_TIMEOUT_SECONDS=8
POOLER_HOST=pooler.example.invalid
POOLER_PORT=5432
POOLER_USER=postgres.example
POOLER_DB=postgres
PGPASSFILE="$ROOT/pgpass"
PGSSLMODE=require
PGOPTIONS='-c jit=true'
export PSQL_BIN POOLER_HOST POOLER_PORT POOLER_USER POOLER_DB PGPASSFILE PGSSLMODE PGOPTIONS

run_readiness_case() {
  local name="$1" mode="$2" expected_result="$3" expected_code="$4" expected_calls="$5"
  local count_file output_file result
  count_file="$ROOT/$name.count"
  output_file="$ROOT/$name.output"
  : >"$count_file"
  MOCK_PSQL_MODE="$mode" MOCK_PSQL_COUNT_FILE="$count_file" export MOCK_PSQL_MODE MOCK_PSQL_COUNT_FILE
  result=PASS
  run_db_session_readiness >"$output_file" || result=FAIL
  if [[ "$expected_result" == PASS ]]; then
    [[ "$result" == PASS ]] || exit 1
    grep -Fqx 'CP51F_DB_SESSION_READINESS=PASS' "$output_file" || exit 1
  else
    [[ "$result" == FAIL ]] || exit 1
    [[ "$DB_SESSION_LAST_ERROR_CODE" == "$expected_code" ]] || exit 1
  fi
  [[ "$(<"$count_file")" == "$expected_calls" ]] || exit 1
  if grep -Eiq 'password|connection refused|connection reset|Bearer|postgresql://' "$output_file"; then
    printf 'READINESS_REDACTION=FAIL: %s\n' "$name" >&2
    exit 1
  fi
}

run_readiness_case immediate_pass pass PASS '' 1
run_readiness_case transient_recovery transient_then_pass PASS '' 2
run_readiness_case auth_stop auth_failure FAIL DB_SESSION_AUTH_FAILED 4
run_readiness_case network_stop network_failure FAIL DB_SESSION_NETWORK_ERROR 4

printf '%s\n' 'CP51F_DB_SESSION_READINESS_CONTRACT=PASS'
printf '%s\n' 'CP51F_DUMP_ERROR_CLASSIFIER=PASS'
printf '%s\n' 'CP51F_DUMP_TRANSIENT_RETRY=PASS'
printf '%s\n' 'CP51F_DUMP_NONTRANSIENT_NO_RETRY=PASS'
printf '%s\n' 'CP51F_DUMP_ERROR_REDACTION=PASS'
