#!/usr/bin/env bash

# CP-5.1F setup-only runner.
# The PAT must exist only in the setup secret environment. This script never
# prints, persists, or logs it. Run it outside the normal agent phase.

set -Eeuo pipefail
umask 077

PROJECT_REF="wfxnwfcdjainpojhbdri"
EXPECTED_STATUS="ACTIVE_HEALTHY"
EXPECTED_POSTGRES_VERSION="17.6.1.084"
MANAGEMENT_API_BASE="https://api.supabase.com/v1"
PAT_ENV_NAME="SUPABASE_CP51F_TEMP_PAT"
PRIVATE_SECURE_PATH="${CP51F_PRIVATE_SECURE_PATH:-}"
SUPABASE_BIN="${SUPABASE_BIN:-supabase}"
JIT_CHANGED=0
JIT_CLEAN=0
SETUP_RESULT="BACKUP_INCOMPLETE"

die() {
  printf '%s\n' "CP51F_SETUP_ERROR: $1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command unavailable: $1"
}

[[ -n "${SUPABASE_CP51F_TEMP_PAT:-}" ]] || die "setup secret is unavailable"
[[ -n "$PRIVATE_SECURE_PATH" ]] || die "CP51F_PRIVATE_SECURE_PATH is required"

require_command curl
require_command jq
require_command sha256sum
require_command stat
require_command git
require_command "$SUPABASE_BIN"

GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not running inside the repository"
PRIVATE_SECURE_PATH="$(mkdir -p "$PRIVATE_SECURE_PATH" && cd "$PRIVATE_SECURE_PATH" && pwd -P)"
[[ "$PRIVATE_SECURE_PATH" != "$GIT_ROOT" && "$PRIVATE_SECURE_PATH" != "$GIT_ROOT"/* ]] || die "private path must be outside the Git worktree"
[[ ! -L "$PRIVATE_SECURE_PATH" ]] || die "private path must not be a symlink"

PAT="$SUPABASE_CP51F_TEMP_PAT"
unset SUPABASE_CP51F_TEMP_PAT

API_ERROR_FILE="$(mktemp "$PRIVATE_SECURE_PATH/.api-error.XXXXXX")"
cleanup_files() {
  rm -f "$API_ERROR_FILE" "$PRIVATE_SECURE_PATH/.dump-error" "$PRIVATE_SECURE_PATH/.manifest.tmp"
}

api_get() {
  local path="$1"
  local result
  result="$(curl --silent --show-error --fail --retry 2 --connect-timeout 15 --max-time 60 \
    -H "Authorization: Bearer $PAT" \
    -H 'Accept: application/json' \
    "$MANAGEMENT_API_BASE$path" 2>"$API_ERROR_FILE")" || {
      printf '%s\n' "CP51F_SETUP_ERROR: Management API GET failed" >&2
      return 1
    }
  printf '%s' "$result"
}

api_put() {
  local path="$1"
  local body="$2"
  local result
  result="$(curl --silent --show-error --fail --retry 2 --connect-timeout 15 --max-time 60 \
    -X PUT \
    -H "Authorization: Bearer $PAT" \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    --data-binary "$body" \
    "$MANAGEMENT_API_BASE$path" 2>"$API_ERROR_FILE")" || {
      printf '%s\n' "CP51F_SETUP_ERROR: Management API PUT failed" >&2
      return 1
    }
  printf '%s' "$result"
}

write_failure_manifest() {
  local result="$1"
  jq -n \
    --arg result "$result" \
    --arg project_ref "$PROJECT_REF" \
    --arg target_status "$TARGET_STATUS" \
    --arg jit_prestate "$JIT_PRESTATE" \
    --arg jit_poststate "UNKNOWN" \
    --arg setup_utc "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{manifest_version:1, setup_result:$result, setup_utc:$setup_utc,
      project_ref:$project_ref, target_status:$target_status,
      direct_ipv6_used:false, session_pooler_used:false,
      jit_prestate:$jit_prestate, jit_poststate:$jit_poststate,
      jit_poststate_matches_prestate:false, classic_pat_revocation:"REQUIRED_AFTER_SETUP",
      artifacts:[]}' > "$PRIVATE_SECURE_PATH/.manifest.tmp" &&
    mv "$PRIVATE_SECURE_PATH/.manifest.tmp" "$PRIVATE_SECURE_PATH/manifest.json"
}

cleanup_jit() {
  [[ "$JIT_CLEAN" -eq 1 ]] && return 0

  local restore_body post_config post_mapping pre_mapping_normalized post_mapping_normalized
  restore_body="$(jq -cn --arg user_id "$JIT_USER_ID" --argjson roles "$JIT_PRE_ROLES" \
    '{user_id:$user_id, roles:$roles}')"
  api_put "/projects/$PROJECT_REF/database/jit" "$restore_body" >/dev/null || return 1

  if [[ "$JIT_PRESTATE" == "disabled" ]]; then
    api_put "/projects/$PROJECT_REF/jit-access" '{"state":"disabled"}' >/dev/null || return 1
  fi

  post_config="$(api_get "/projects/$PROJECT_REF/jit-access")" || return 1
  post_mapping="$(api_get "/projects/$PROJECT_REF/database/jit")" || return 1
  [[ "$(jq -r '.state // empty' <<<"$post_config")" == "$JIT_PRESTATE" ]] || return 1
  pre_mapping_normalized="$(jq -S -c '{user_id, user_roles}' <<<"$JIT_PRE_MAPPING")"
  post_mapping_normalized="$(jq -S -c '{user_id, user_roles}' <<<"$post_mapping")"
  [[ "$pre_mapping_normalized" == "$post_mapping_normalized" ]] || return 1

  JIT_CLEAN=1
}

on_exit() {
  local rc=$?
  set +e
  if [[ "$JIT_CHANGED" -eq 1 && "$JIT_CLEAN" -ne 1 ]]; then
    if ! cleanup_jit; then
      write_failure_manifest "STOP_JIT_CLEANUP_FAILURE"
      rc=70
    fi
  fi
  cleanup_files
  unset PAT PRIVATE_DB_URL API_ERROR_FILE
  exit "$rc"
}
trap on_exit EXIT

CLI_HELP_FILE="$(mktemp "$PRIVATE_SECURE_PATH/.cli-help.XXXXXX")"
"$SUPABASE_BIN" db dump --help >"$CLI_HELP_FILE" 2>/dev/null || die "supabase db dump help failed"
grep -q -- '--db-url' "$CLI_HELP_FILE" || die "installed CLI lacks --db-url"
grep -q -- '--file' "$CLI_HELP_FILE" || die "installed CLI lacks --file"
rm -f "$CLI_HELP_FILE"

PROJECT_JSON="$(api_get "/projects/$PROJECT_REF")"
TARGET_ID="$(jq -r '.id // empty' <<<"$PROJECT_JSON")"
TARGET_STATUS="$(jq -r '.status // empty' <<<"$PROJECT_JSON")"
POSTGRES_VERSION="$(jq -r '.database.version // empty' <<<"$PROJECT_JSON")"
[[ "$TARGET_ID" == "$PROJECT_REF" ]] || die "target identity mismatch"
[[ "$TARGET_STATUS" == "$EXPECTED_STATUS" ]] || die "target status mismatch"
[[ "$POSTGRES_VERSION" == "$EXPECTED_POSTGRES_VERSION" ]] || die "PostgreSQL version mismatch"

JIT_PRE_CONFIG="$(api_get "/projects/$PROJECT_REF/jit-access")"
JIT_PRESTATE="$(jq -r '.state // empty' <<<"$JIT_PRE_CONFIG")"
[[ "$JIT_PRESTATE" == "enabled" || "$JIT_PRESTATE" == "disabled" ]] || die "unknown JIT prestate"
JIT_PRE_MAPPING="$(api_get "/projects/$PROJECT_REF/database/jit")"
JIT_USER_ID="$(jq -r '.user_id // empty' <<<"$JIT_PRE_MAPPING")"
JIT_PRE_ROLES="$(jq -c '.user_roles // []' <<<"$JIT_PRE_MAPPING")"
[[ -n "$JIT_USER_ID" ]] || die "JIT user identity unavailable"

POOLER_JSON="$(api_get "/projects/$PROJECT_REF/config/database/pooler")"
POOLER_HOST="$(jq -r 'map(select(.database_type == "PRIMARY"))[0].db_host // empty' <<<"$POOLER_JSON")"
POOLER_PORT="$(jq -r 'map(select(.database_type == "PRIMARY"))[0].db_port // empty' <<<"$POOLER_JSON")"
POOLER_USER="$(jq -r 'map(select(.database_type == "PRIMARY"))[0].db_user // empty' <<<"$POOLER_JSON")"
POOLER_DB="$(jq -r 'map(select(.database_type == "PRIMARY"))[0].db_name // empty' <<<"$POOLER_JSON")"
[[ -n "$POOLER_HOST" && "$POOLER_PORT" == "5432" && "$POOLER_USER" == "postgres.$PROJECT_REF" && "$POOLER_DB" == "postgres" ]] || die "official Session Pooler metadata did not match the required target"

if [[ "$JIT_PRESTATE" == "disabled" ]]; then
  api_put "/projects/$PROJECT_REF/jit-access" '{"state":"enabled"}' >/dev/null
  JIT_CHANGED=1
fi

JIT_EXPIRES_AT="$(( $(date +%s) + 900 ))000"
JIT_ROLES='[{"role":"postgres","expires_at":'"$JIT_EXPIRES_AT"'}]'
if [[ -n "${CP51F_ALLOWED_CIDR:-}" ]]; then
  JIT_ROLES="$(jq -cn --arg cidr "$CP51F_ALLOWED_CIDR" --argjson expires "$JIT_EXPIRES_AT" \
    '[{role:"postgres", expires_at:$expires, allowed_networks:{allowed_cidrs:[{cidr:$cidr}]}}]')"
fi
JIT_UPDATE_BODY="$(jq -cn --arg user_id "$JIT_USER_ID" --argjson roles "$JIT_ROLES" \
  '{user_id:$user_id, roles:$roles}')"
api_put "/projects/$PROJECT_REF/database/jit" "$JIT_UPDATE_BODY" >/dev/null
JIT_CHANGED=1

PAT_URI="$(printf '%s' "$PAT" | jq -sRr @uri)"
PRIVATE_DB_URL="postgresql://${POOLER_USER}:${PAT_URI}@${POOLER_HOST}:${POOLER_PORT}/${POOLER_DB}?options=-c%20jit%3dtrue&sslmode=require"

run_dump() {
  local name="$1"
  shift
  "$SUPABASE_BIN" db dump --db-url "$PRIVATE_DB_URL" --file "$PRIVATE_SECURE_PATH/$name.sql" "$@" \
    2>"$PRIVATE_SECURE_PATH/.dump-error" || die "dump failed: $name"
  rm -f "$PRIVATE_SECURE_PATH/.dump-error"
  [[ -s "$PRIVATE_SECURE_PATH/$name.sql" ]] || die "empty dump: $name"
}

run_dump roles --role-only
run_dump schema --schema 'public,portal_private,auth'
run_dump data --data-only --use-copy --schema 'public,portal_private,auth'
run_dump history_schema --schema 'supabase_migrations'
run_dump history_data --data-only --use-copy --schema 'supabase_migrations'

cleanup_jit || die "JIT cleanup did not restore the exact prestate"

artifact_manifest='[]'
for name in roles schema data history_schema history_data; do
  file="$PRIVATE_SECURE_PATH/$name.sql"
  size="$(stat -c '%s' "$file")"
  sha256="$(sha256sum "$file" | awk '{print $1}')"
  coverage="public,portal_private,auth,functions,triggers,policies,grants,audit,application"
  [[ "$name" == history_* ]] && coverage="supabase_migrations"
  artifact_manifest="$(jq -cn --argjson prior "$artifact_manifest" --arg logical_name "$name" \
    --arg type 'postgresql-logical-dump' --arg utc "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg size "$size" --arg sha256 "$sha256" --arg coverage "$coverage" \
    '$prior + [{logical_name:$logical_name,type:$type,utc:$utc,size_bytes:($size|tonumber),sha256:$sha256,exit_status:0,coverage:$coverage}]')"
done

jq -n \
  --arg project_ref "$PROJECT_REF" \
  --arg target_status "$TARGET_STATUS" \
  --arg postgres_version "$POSTGRES_VERSION" \
  --arg jit_prestate "$JIT_PRESTATE" \
  --arg jit_poststate "$JIT_PRESTATE" \
  --arg setup_utc "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson artifacts "$artifact_manifest" \
  '{manifest_version:1,setup_result:"BACKUP_READY_RESTORE_PENDING",setup_utc:$setup_utc,
    project_ref:$project_ref,target_status:$target_status,postgres_version:$postgres_version,
    direct_ipv6_used:false,session_pooler_used:true,session_pooler_port:5432,
    jit_used:true,jit_prestate:$jit_prestate,jit_poststate:$jit_poststate,
    jit_poststate_matches_prestate:true,storage_object_bytes_included:false,
    auth_coverage:"ATTEMPTED_IN_AUTH_SCHEMA_AND_DATA_DUMPS",
    migration_state_coverage:"CAPTURED_IN_HISTORY_ARTIFACTS",
    classic_pat_revocation:"REQUIRED_AFTER_SETUP",
    artifacts:$artifacts}' > "$PRIVATE_SECURE_PATH/.manifest.tmp"
mv "$PRIVATE_SECURE_PATH/.manifest.tmp" "$PRIVATE_SECURE_PATH/manifest.json"
SETUP_RESULT="BACKUP_READY_RESTORE_PENDING"
printf '%s\n' "CP51F_SETUP_RESULT=$SETUP_RESULT"
printf '%s\n' "CP51F_PRIVATE_SECURE_PATH_READY=YES"
