#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly RUNNER="$SCRIPT_DIR/cp51f-production-backup-setup.sh"
readonly PROJECT_REF="wfxnwfcdjainpojhbdri"
readonly API_URL="https://api.supabase.com/v1/projects/$PROJECT_REF/jit-access"

PAT="${CP51F_READONLY_JIT_PROBE_PAT:-}"
unset CP51F_READONLY_JIT_PROBE_PAT

work_dir=""
cleanup() {
  unset PAT escaped_pat
  if [[ -n "$work_dir" && -d "$work_dir" ]]; then
    rm -f -- "$work_dir"/response.* "$work_dir"/curl-error.* "$work_dir"/parser.sh 2>/dev/null || true
    rmdir -- "$work_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

fail() {
  printf '%s\n' 'CP51F_JIT_PRESTATE_PROBE_RESULT=FAIL'
  if [[ -n "${1:-}" ]]; then
    printf 'CP51F_JIT_PRESTATE_PROBE_CODE=%s\n' "$1"
  fi
  exit 1
}

[[ $# -eq 0 && -n "$PAT" ]] || fail
command -v curl >/dev/null 2>&1 || fail
command -v jq >/dev/null 2>&1 || fail
command -v sed >/dev/null 2>&1 || fail
[[ -f "$RUNNER" ]] || fail

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/cp51f-jit-probe.XXXXXX" 2>/dev/null)" || fail
chmod 700 "$work_dir" 2>/dev/null || fail
response_file="$(mktemp "$work_dir/response.XXXXXX" 2>/dev/null)" || fail
error_file="$(mktemp "$work_dir/curl-error.XXXXXX" 2>/dev/null)" || fail
parser_file="$work_dir/parser.sh"

if ! sed -n '/^parse_jit_state() {/,/^}/p' "$RUNNER" >"$parser_file" 2>/dev/null ||
  ! grep -Fq 'jq -ser' "$parser_file" 2>/dev/null; then
  fail JIT_PRESTATE_INVALID
fi
# Load only the certified parser function, never the runner's executable body.
# shellcheck disable=SC1090
source "$parser_file"

escaped_pat="${PAT//\\/\\\\}"
escaped_pat="${escaped_pat//\"/\\\"}"
unset PAT

http_code=""
curl_rc=0
if http_code="$(printf 'header = "Authorization: Bearer %s"\nheader = "Accept: application/json"\n' "$escaped_pat" |
  curl --config - --request GET --connect-timeout 10 --max-time 25 --silent --show-error \
    --output "$response_file" --write-out '%{http_code}' "$API_URL" 2>"$error_file")"; then
  curl_rc=0
else
  curl_rc=$?
fi
unset escaped_pat

if [[ -z "$http_code" || "$http_code" == 000 ]]; then
  fail MANAGEMENT_API_NETWORK_ERROR
fi
case "$http_code" in
  401) fail MANAGEMENT_API_HTTP_401 ;;
  403) fail MANAGEMENT_API_HTTP_403 ;;
  404) fail MANAGEMENT_API_HTTP_404 ;;
  429) fail MANAGEMENT_API_HTTP_429 ;;
  5[0-9][0-9]) fail MANAGEMENT_API_HTTP_5XX ;;
  200) ;;
  *) fail MANAGEMENT_API_UNEXPECTED_HTTP ;;
esac
[[ "$curl_rc" -eq 0 ]] || fail MANAGEMENT_API_UNEXPECTED_HTTP

if ! state="$(parse_jit_state <"$response_file" 2>/dev/null)"; then
  fail JIT_PRESTATE_INVALID
fi

case "$state" in
  enabled|disabled|unavailable) ;;
  *) fail JIT_PRESTATE_INVALID ;;
esac
printf '%s\n' 'CP51F_JIT_PRESTATE_PROBE_RESULT=PASS'
printf 'CP51F_JIT_PRESTATE=%s\n' "$state"
