#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT="scripts/cp51f-production-backup-setup.sh"
REPO_ROOT="$(git rev-parse --show-toplevel)"
ROOT="$(mktemp -d)"
trap 'rm -rf -- "$ROOT"' EXIT
RUNNER_TEMP="$ROOT/runner"
BIN="$ROOT/bin"
mkdir -p -- "$RUNNER_TEMP" "$BIN"

write_tool() {
  local path="$1" version="$2"
  printf '%s\n' '#!/usr/bin/env bash' "printf '%s\\n' '$version'" >"$path"
  chmod 700 "$path"
}

run_case() {
  local name="$1" expected_result="$2" expected_stage="$3" expected_code="$4"
  shift 4
  local status="$RUNNER_TEMP/$name.json" private="$ROOT/$name-private"
  rm -f -- "$status"
  set +e
  env RUNNER_TEMP="$RUNNER_TEMP" \
    CP51F_PRIVATE_SECURE_PATH="$private" \
    CP51F_STATUS_FILE="$status" \
    PATH="$BIN:$PATH" \
    "$@" bash "$SCRIPT" --local-preflight >/dev/null 2>&1
  local rc=$?
  set -e
  if { [[ "$expected_result" == PASS && "$rc" -ne 0 ]] || [[ "$expected_result" == FAIL && "$rc" -eq 0 ]]; }; then
    printf 'DIAGNOSTIC_TEST=FAIL: %s exit\n' "$name" >&2
    exit 1
  fi
  [[ -s "$status" ]] || { printf 'DIAGNOSTIC_TEST=FAIL: %s status missing\n' "$name" >&2; exit 1; }
  grep -Fqx "{\"result\":\"$expected_result\",\"stage\":\"$expected_stage\",\"code\":\"$expected_code\"}" "$status" || {
    printf 'DIAGNOSTIC_TEST=FAIL: %s status mismatch\n' "$name" >&2
    exit 1
  }
  if grep -Eiq 'SUPABASE_CP51F_TEMP_PAT|Bearer|postgresql://|synthetic customer' "$status"; then
    printf 'DIAGNOSTIC_TEST=FAIL: %s status contains sensitive marker\n' "$name" >&2
    exit 1
  fi
}

write_tool "$BIN/pg_dump17" 'pg_dump (PostgreSQL) 17.11'
write_tool "$BIN/pg_dumpall17" 'pg_dumpall (PostgreSQL) 17.11'
write_tool "$BIN/psql17" 'psql (PostgreSQL) 17.11'
write_tool "$BIN/pg_dump16" 'pg_dump (PostgreSQL) 16.9'
write_tool "$BIN/jq" 'jq (synthetic preflight stub)'

run_case missing_dependency FAIL LOCAL_PREFLIGHT LOCAL_DEPENDENCY_MISSING \
  PG_DUMP_BIN=cp51f-missing PG_DUMPALL_BIN="$BIN/pg_dumpall17" PSQL_BIN="$BIN/psql17"
run_case wrong_major FAIL LOCAL_PREFLIGHT POSTGRES_VERSION_INVALID \
  PG_DUMP_BIN="$BIN/pg_dump16" PG_DUMPALL_BIN="$BIN/pg_dumpall17" PSQL_BIN="$BIN/psql17"
run_case invalid_private_path FAIL LOCAL_PREFLIGHT PRIVATE_PATH_INVALID \
  CP51F_PRIVATE_SECURE_PATH="$REPO_ROOT/.git" PG_DUMP_BIN="$BIN/pg_dump17" PG_DUMPALL_BIN="$BIN/pg_dumpall17" PSQL_BIN="$BIN/psql17"
run_case success PASS LOCAL_PREFLIGHT LOCAL_PREFLIGHT_PASS \
  PG_DUMP_BIN="$BIN/pg_dump17" PG_DUMPALL_BIN="$BIN/pg_dumpall17" PSQL_BIN="$BIN/psql17"

if grep -nE 'cat .*cp51f-runner\.log|upload-artifact.*cp51f-runner\.log' \
  .github/workflows/cp51f-production-backup-restore.yml >/dev/null; then
  printf 'DIAGNOSTIC_TEST=FAIL: raw runner log publication\n' >&2
  exit 1
fi

printf 'CP51F_DIAGNOSTIC_TESTS=PASS\n'
