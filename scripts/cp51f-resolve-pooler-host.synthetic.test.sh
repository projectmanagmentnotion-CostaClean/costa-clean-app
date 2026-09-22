#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(mktemp -d)"
trap 'rm -rf -- "$ROOT"' EXIT
RESOLVER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cp51f-resolve-pooler-host.sh"
EXPECTED_USER='postgres.wfxnwfcdjainpojhbdri'

pass_case() {
  local name="$1" host="$2" uri_port="$3" property="$4"
  local response github_env actual expected_env
  response="$ROOT/$name.json"
  github_env="$ROOT/$name.env"
  printf '{"database_type":"PRIMARY","%s":"postgresql://synthetic-user:synthetic-password@%s:%s/postgres"}\n' \
    "$property" "$host" "$uri_port" >"$response"
  : >"$github_env"
  actual="$(GITHUB_ENV="$github_env" bash "$RESOLVER" "$response")" || {
    printf 'CP51F_POOLER_RESOLUTION_TEST=FAIL case=%s\n' "$name" >&2
    exit 1
  }
  [[ "$actual" == "$host" ]] || exit 1
  expected_env="CP51F_POOLER_HOST=$host
CP51F_POOLER_PORT=5432
CP51F_POOLER_USER=$EXPECTED_USER
CP51F_POOLER_DB=postgres"
  [[ "$(<"$github_env")" == "$expected_env" ]] || exit 1
  if grep -Eq 'synthetic-user|synthetic-password|postgresql://' <<<"$actual $(<"$github_env")"; then
    printf 'CP51F_POOLER_RESOLUTION_TEST=FAIL raw_uri_public case=%s\n' "$name" >&2
    exit 1
  fi
}

fail_case() {
  local name="$1" json="$2" response github_env
  response="$ROOT/$name.json"
  github_env="$ROOT/$name.env"
  printf '%s' "$json" >"$response"
  : >"$github_env"
  if GITHUB_ENV="$github_env" bash "$RESOLVER" "$response" >/dev/null 2>&1; then
    printf 'CP51F_POOLER_RESOLUTION_TEST=FAIL accepted=%s\n' "$name" >&2
    exit 1
  fi
  [[ ! -s "$github_env" ]] || exit 1
}

pass_case primary_connection_string_aws0 aws-0-eu-west-1.pooler.supabase.com 6543 connection_string
pass_case compatibility_connectionString_aws1 aws-1-eu-west-1.pooler.supabase.com 5432 connectionString
pass_case arbitrary_numeric_pooler_index aws-42-eu-west-1.pooler.supabase.com 6543 connection_string

fail_case zero_primary '[]'
fail_case two_primary '[{"database_type":"PRIMARY","connection_string":"postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"},{"database_type":"PRIMARY","connection_string":"postgresql://u:p@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"}]'
fail_case missing_connection_string '[{"database_type":"PRIMARY","db_host":"aws-0-eu-west-1.pooler.supabase.com"}]'
fail_case malformed_json '[{"database_type":"PRIMARY"'
fail_case top_level_object '{"database_type":"PRIMARY"}'
fail_case wrong_region '[{"database_type":"PRIMARY","connection_string":"postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres"}]'
fail_case non_supabase_host '[{"database_type":"PRIMARY","connection_string":"postgresql://u:p@pooler.example.com:6543/postgres"}]'
fail_case scheme_in_host '[{"database_type":"PRIMARY","connection_string":"postgresql://u:p@https://aws-0-eu-west-1.pooler.supabase.com:6543/postgres"}]'
fail_case extra_at_sign '[{"database_type":"PRIMARY","connection_string":"postgresql://u:p@extra@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"}]'
fail_case embedded_path '[{"database_type":"PRIMARY","connection_string":"postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com/path:6543/postgres"}]'

printf '%s\n' \
  'CP51F_POOLER_PRIMARY_CONNECTION_STRING_TESTS=PASS' \
  'CP51F_POOLER_COMPATIBILITY_FIELD_TESTS=PASS' \
  'CP51F_POOLER_INDEX_VARIANTS_TESTS=PASS' \
  'CP51F_POOLER_FAIL_CLOSED_TESTS=PASS' \
  'CP51F_POOLER_SESSION_PORT_FIXED_5432=PASS'
