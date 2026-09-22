#!/usr/bin/env bash

set -Eeuo pipefail
set +x

REPO_ROOT="$(git rev-parse --show-toplevel)"
readonly REPO_ROOT
readonly PROBE="$REPO_ROOT/scripts/cp51f-jit-prestate-readonly-probe.sh"
readonly MOCK_CURL="$REPO_ROOT/scripts/cp51f-jit-prestate-readonly-probe.mock-curl.sh"
ROOT="$(mktemp -d)"
readonly ROOT
readonly MOCK_BIN="$ROOT/bin"
readonly RUN_TMP="$ROOT/tmp"
trap 'rm -rf -- "$ROOT"' EXIT
mkdir -p -- "$MOCK_BIN" "$RUN_TMP"
cp -- "$MOCK_CURL" "$MOCK_BIN/curl"
chmod 700 "$MOCK_BIN/curl"

run_case() {
  local name="$1" expected_result="$2" expected_code="$3" expected_state="$4"
  local body="$5" status="$6" network_error="$7" output_file="$ROOT/$1.stdout" error_file="$ROOT/$1.stderr"
  local rc=0 expected

  if env PATH="$MOCK_BIN:$PATH" TMPDIR="$RUN_TMP" \
    CP51F_READONLY_JIT_PROBE_PAT='synthetic-never-a-real-token' \
    CP51F_PROBE_FIXTURE_BODY="$body" \
    CP51F_PROBE_FIXTURE_STATUS="$status" \
    CP51F_PROBE_FIXTURE_NETWORK_ERROR="$network_error" \
    bash "$PROBE" >"$output_file" 2>"$error_file"; then
    rc=0
  else
    rc=$?
  fi

  if [[ "$expected_result" == PASS ]]; then
    [[ "$rc" -eq 0 ]] || { printf 'PROBE_TEST=FAIL:%s\n' "$name" >&2; exit 1; }
    expected="CP51F_JIT_PRESTATE_PROBE_RESULT=PASS"
    expected+=$'\n'"CP51F_JIT_PRESTATE=$expected_state"
  else
    [[ "$rc" -ne 0 ]] || { printf 'PROBE_TEST=FAIL:%s\n' "$name" >&2; exit 1; }
    expected="CP51F_JIT_PRESTATE_PROBE_RESULT=FAIL"
    [[ -z "$expected_code" ]] || expected+=$'\n'"CP51F_JIT_PRESTATE_PROBE_CODE=$expected_code"
  fi
  [[ "$(<"$output_file")" == "$expected" ]] || { printf 'PROBE_TEST=FAIL:%s-output\n' "$name" >&2; exit 1; }
  if grep -Eiq 'synthetic-never-a-real-token|unavailableReason|postgres_upgrade_required|synthetic curl stderr secret marker|Authorization: Bearer|user_id|postgresql://' "$output_file" "$error_file"; then
    printf 'PROBE_TEST=FAIL:%s-sensitive-output\n' "$name" >&2
    exit 1
  fi
}

run_case enabled PASS '' enabled '{"state":"enabled"}' 200 NO
run_case disabled PASS '' disabled $' \t\n{"state":"disabled","appliedSuccessfully":false}\r\n' 200 NO
run_case unavailable PASS '' unavailable '{"state":"unavailable","unavailableReason":"postgres_upgrade_required"}' 200 NO
run_case multi_json FAIL JIT_PRESTATE_INVALID '' $'{"state":"enabled"}\n{"state":"disabled"}' 200 NO
run_case trailing_garbage FAIL JIT_PRESTATE_INVALID '' '{"state":"enabled"} garbage' 200 NO
run_case invalid_schema FAIL JIT_PRESTATE_INVALID '' '{"state":"other"}' 200 NO
run_case http_401 FAIL MANAGEMENT_API_HTTP_401 '' '{}' 401 NO
run_case http_403 FAIL MANAGEMENT_API_HTTP_403 '' '{}' 403 NO
run_case http_404 FAIL MANAGEMENT_API_HTTP_404 '' '{}' 404 NO
run_case http_429 FAIL MANAGEMENT_API_HTTP_429 '' '{}' 429 NO
run_case http_500 FAIL MANAGEMENT_API_HTTP_5XX '' '{}' 500 NO
run_case network_error FAIL MANAGEMENT_API_NETWORK_ERROR '' '' 000 YES
[[ -z "$(find "$RUN_TMP" -mindepth 1 -maxdepth 1 -print -quit)" ]] || {
  printf '%s\n' 'PROBE_TEST=FAIL:temporary-files-not-cleaned' >&2
  exit 1
}

printf '%s\n' \
  'CP51F_PROBE_ENABLED_TEST=PASS' \
  'CP51F_PROBE_DISABLED_TEST=PASS' \
  'CP51F_PROBE_UNAVAILABLE_TEST=PASS' \
  'CP51F_PROBE_MULTI_JSON_TEST=PASS' \
  'CP51F_PROBE_TRAILING_GARBAGE_TEST=PASS' \
  'CP51F_PROBE_INVALID_SCHEMA_TEST=PASS' \
  'CP51F_PROBE_HTTP_401_TEST=PASS' \
  'CP51F_PROBE_HTTP_403_TEST=PASS' \
  'CP51F_PROBE_HTTP_404_TEST=PASS' \
  'CP51F_PROBE_HTTP_429_TEST=PASS' \
  'CP51F_PROBE_HTTP_5XX_TEST=PASS' \
  'CP51F_PROBE_NETWORK_ERROR_TEST=PASS' \
  'CP51F_READONLY_JIT_PROBE_SYNTHETIC_TESTS=PASS'
