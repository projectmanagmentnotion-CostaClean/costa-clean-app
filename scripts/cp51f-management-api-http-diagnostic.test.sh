#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT="scripts/cp51f-production-backup-setup.sh"
ROOT="$(mktemp -d)"
BIN="$ROOT/bin"
PRIVATE="$ROOT/private"
mkdir -p -- "$BIN" "$PRIVATE"
trap 'rm -rf -- "$ROOT"' EXIT

cat >"$BIN/curl" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

cat >/dev/null
output_file=""
while (($# > 0)); do
  case "$1" in
    --output) output_file="$2"; shift 2 ;;
    --write-out) shift 2 ;;
    *) shift ;;
  esac
done

status="${CP51F_TEST_HTTP_STATUS:-000}"
if [[ "$status" != 000 ]]; then
  printf '%s\n' 'synthetic body contains synthetic-secret and https://private.example.invalid' >"$output_file"
  printf '%s' "$status"
  [[ "$status" == 2?? ]] && exit 0
  exit 22
fi
printf '%s' '000'
exit 7
EOF
chmod 700 "$BIN/curl"

# Reuse the production function so the cases cannot drift from the runner.
# shellcheck disable=SC1090
eval "$(awk '/^management_curl\(\) \{/,/^\}/ {print}' "$SCRIPT")"

run_case() {
  local name="$1" status="$2" expected_rc="$3" expected_code="$4"
  local output_file="$ROOT/$name.out" error_file="$ROOT/$name.err"
  local rc
  rm -f -- "$MANAGEMENT_API_ERROR_CODE_FILE" "$output_file" "$error_file"
  set +e
  CP51F_TEST_HTTP_STATUS="$status" PATH="$BIN:$PATH" \
    management_curl 'https://api.supabase.com/v1/projects/synthetic' >"$output_file" 2>"$error_file"
  rc=$?
  set -e

  [[ "$rc" -eq "$expected_rc" ]] || { printf 'HTTP_DIAGNOSTIC_TEST=FAIL:%s exit\n' "$name" >&2; exit 1; }
  if [[ "$expected_rc" -eq 0 ]]; then
    [[ "$(cat "$output_file")" == *'synthetic body contains synthetic-secret'* ]] || {
      printf 'HTTP_DIAGNOSTIC_TEST=FAIL:%s success body handling\n' "$name" >&2
      exit 1
    }
  else
    [[ "$(<"$MANAGEMENT_API_ERROR_CODE_FILE")" == "$expected_code" ]] || {
      printf 'HTTP_DIAGNOSTIC_TEST=FAIL:%s code\n' "$name" >&2
      exit 1
    }
    [[ ! -s "$output_file" ]] || { printf 'HTTP_DIAGNOSTIC_TEST=FAIL:%s body leaked\n' "$name" >&2; exit 1; }
  fi
  if grep -Eiq 'synthetic-secret|Authorization:|Bearer |private\.example' "$error_file" "$MANAGEMENT_API_ERROR_CODE_FILE" 2>/dev/null; then
    printf 'HTTP_DIAGNOSTIC_TEST=FAIL:%s sensitive output\n' "$name" >&2
    exit 1
  fi
}

PRIVATE_SECURE_PATH="$PRIVATE"
PAT='synthetic-secret'
export PRIVATE_SECURE_PATH PAT
MANAGEMENT_API_ERROR_CODE_FILE="$PRIVATE/.api-code"
run_case http_200 200 0 ''
run_case http_401 401 1 MANAGEMENT_API_HTTP_401
run_case http_403 403 1 MANAGEMENT_API_HTTP_403
run_case http_404 404 1 MANAGEMENT_API_HTTP_404
run_case http_429 429 1 MANAGEMENT_API_HTTP_429
run_case http_500 500 1 MANAGEMENT_API_HTTP_5XX
run_case network 000 1 MANAGEMENT_API_NETWORK_ERROR

printf 'CP51F_MANAGEMENT_API_HTTP_DIAGNOSTIC_TESTS=PASS\n'
