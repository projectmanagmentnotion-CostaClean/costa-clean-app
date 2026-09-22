#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/cp51f-pooler-config.sh"

valid_host='aws-0-eu-central-1.pooler.supabase.com'
valid_user='postgres.wfxnwfcdjainpojhbdri'
valid_ref='wfxnwfcdjainpojhbdri'

expect_valid() {
  cp51f_validate_pooler_config "$valid_host" 5432 "$valid_user" postgres "$valid_ref"
}

expect_invalid() {
  local name="$1" host="$2" port="$3" user="$4" database="$5" project_ref="$6"
  if cp51f_validate_pooler_config "$host" "$port" "$user" "$database" "$project_ref"; then
    printf 'CP51F_POOLER_CONFIG_TEST=FAIL case=%s\n' "$name" >&2
    exit 1
  fi
}

expect_valid
expect_invalid empty_host '' 5432 "$valid_user" postgres "$valid_ref"
expect_invalid scheme 'https://aws-0-eu-central-1.pooler.supabase.com' 5432 "$valid_user" postgres "$valid_ref"
expect_invalid userinfo 'user@aws-0-eu-central-1.pooler.supabase.com' 5432 "$valid_user" postgres "$valid_ref"
expect_invalid embedded_port 'aws-0-eu-central-1.pooler.supabase.com:5432' 5432 "$valid_user" postgres "$valid_ref"
expect_invalid outside_domain 'aws-0.example.com' 5432 "$valid_user" postgres "$valid_ref"
expect_invalid whitespace 'aws-0-eu-central-1.pooler.supabase.com ' 5432 "$valid_user" postgres "$valid_ref"
expect_invalid wrong_port "$valid_host" 6543 "$valid_user" postgres "$valid_ref"
expect_invalid wrong_user "$valid_host" 5432 postgres postgres "$valid_ref"
expect_invalid wrong_project "$valid_host" 5432 postgres.wrong-project postgres "$valid_ref"
expect_invalid wrong_ref "$valid_host" 5432 "$valid_user" postgres wrongprojectref
expect_invalid wrong_database "$valid_host" 5432 "$valid_user" template1 "$valid_ref"
expect_invalid missing_variable "$valid_host" '' "$valid_user" postgres "$valid_ref"

printf '%s\n' \
  'CP51F_POOLER_CONFIG_VALID_CASE=PASS' \
  'CP51F_POOLER_CONFIG_INVALID_CASES=PASS' \
  'CP51F_POOLER_METADATA_API_REQUIRED=NO' \
  'CP51F_POOLER_CONFIGURATION_FAILS_CLOSED=YES'
