#!/usr/bin/env bash

# CP-5.1F setup-only runner.
# The PAT must exist only in the setup secret environment. This script never
# prints, persists, or logs it. Run it outside the normal agent phase.

set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/cp51f-pooler-config.sh
source "$SCRIPT_DIR/cp51f-pooler-config.sh"

MODE="${1:-}"
STATUS_FILE="${CP51F_STATUS_FILE:-}"
CURRENT_STAGE="LOCAL_PREFLIGHT"
CURRENT_CODE="UNCLASSIFIED_FAILURE"
STATUS_WRITTEN=0

PROJECT_REF="wfxnwfcdjainpojhbdri"
EXPECTED_STATUS="ACTIVE_HEALTHY"
EXPECTED_POSTGRES_VERSION="17.6.1.084"
MANAGEMENT_API_BASE="https://api.supabase.com/v1"
PRIVATE_SECURE_PATH="${CP51F_PRIVATE_SECURE_PATH:-}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_DUMPALL_BIN="${PG_DUMPALL_BIN:-pg_dumpall}"
JIT_CHANGED=0
JIT_CLEAN=0
JIT_UPDATE_ATTEMPTED=0
SETUP_RESULT="BACKUP_INCOMPLETE"
TARGET_ID=""
TARGET_STATUS="UNKNOWN"
POSTGRES_VERSION=""
JIT_PRE_CONFIG=""
JIT_PRESTATE="UNKNOWN"
JIT_PRE_MAPPING=""
JIT_PRE_MAPPING_KIND="UNKNOWN"
JIT_USER_ID=""
JIT_PRE_ROLES='[]'
POOLER_HOST=""
POOLER_PORT=""
POOLER_USER=""
POOLER_DB=""
TEMP_CREDENTIAL_FILE=""
PGPASSFILE=""
PGSSLMODE=""
PGOPTIONS=""

STAGES=(
  LOCAL_PREFLIGHT PROJECT_METADATA JIT_CONFIG_READ JIT_PROFILE_READ JIT_MAPPING_LIST_READ POOLER_METADATA
  JIT_ENABLE JIT_MAPPING_UPDATE DUMP_ROLES DUMP_SCHEMA DUMP_DATA
  DUMP_HISTORY_SCHEMA DUMP_HISTORY_DATA JIT_CLEANUP MANIFEST_FINALIZE COMPLETE UNKNOWN
)
CODES=(
  SECRET_UNAVAILABLE LOCAL_DEPENDENCY_MISSING POSTGRES_VERSION_INVALID
  REPOSITORY_CONTEXT_INVALID PRIVATE_PATH_INVALID MANAGEMENT_API_GET_FAILED
  MANAGEMENT_API_PUT_FAILED MANAGEMENT_API_DELETE_FAILED TARGET_IDENTITY_MISMATCH
  MANAGEMENT_API_HTTP_401 MANAGEMENT_API_HTTP_403 MANAGEMENT_API_HTTP_404
  MANAGEMENT_API_HTTP_429 MANAGEMENT_API_HTTP_5XX MANAGEMENT_API_NETWORK_ERROR
  MANAGEMENT_API_UNEXPECTED_HTTP
  TARGET_STATUS_MISMATCH TARGET_POSTGRES_VERSION_MISMATCH JIT_PRESTATE_INVALID
  JIT_PRESTATE_UNAVAILABLE
  JIT_PROFILE_INVALID JIT_MAPPING_INVALID POOLER_METADATA_INVALID JIT_ENABLE_FAILED
  JIT_MAPPING_UPDATE_FAILED DUMP_ROLES_FAILED DUMP_SCHEMA_FAILED DUMP_DATA_FAILED
  DUMP_HISTORY_SCHEMA_FAILED DUMP_HISTORY_DATA_FAILED JIT_CLEANUP_FAILED
  MANIFEST_FAILED UNCLASSIFIED_FAILURE LOCAL_PREFLIGHT_PASS AWAITING_PAT_REVOCATION
)

is_allowed() {
  local value="$1"
  shift
  local candidate
  for candidate in "$@"; do
    [[ "$candidate" == "$value" ]] && return 0
  done
  return 1
}

set_stage() {
  CURRENT_STAGE="$1"
  CURRENT_CODE="UNCLASSIFIED_FAILURE"
}

set_failure() {
  CURRENT_STAGE="$1"
  CURRENT_CODE="$2"
}

write_status() {
  local result="$1" stage="$2" code="$3"
  [[ -n "$STATUS_FILE" ]] || return 0
  is_allowed "$stage" "${STAGES[@]}" || { stage=UNKNOWN; code=UNCLASSIFIED_FAILURE; }
  is_allowed "$code" "${CODES[@]}" || code=UNCLASSIFIED_FAILURE
  printf '{"result":"%s","stage":"%s","code":"%s"}\n' "$result" "$stage" "$code" >"$STATUS_FILE"
  chmod 600 "$STATUS_FILE"
  STATUS_WRITTEN=1
}

die() {
  printf '%s\n' "CP51F_SETUP_ERROR: $1" >&2
  exit 1
}

die_code() {
  set_failure "$1" "$2"
  die "$3"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die_code LOCAL_PREFLIGHT LOCAL_DEPENDENCY_MISSING "required command unavailable"
}

validate_private_path() {
  [[ -n "$PRIVATE_SECURE_PATH" ]] || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "private path is required"
  [[ "$PRIVATE_SECURE_PATH" = /* ]] || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "private path must be absolute"
  [[ ! -L "$PRIVATE_SECURE_PATH" ]] || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "private path must not be a symlink"
  mkdir -p -- "$PRIVATE_SECURE_PATH" || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "private path unavailable"
  PRIVATE_SECURE_PATH="$(cd "$PRIVATE_SECURE_PATH" && pwd -P)" || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "private path unavailable"
  [[ "$PRIVATE_SECURE_PATH" != "$GIT_ROOT" && "$PRIVATE_SECURE_PATH" != "$GIT_ROOT"/* ]] || \
    die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "private path must be outside the Git worktree"
  [[ ! -L "$PRIVATE_SECURE_PATH" ]] || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "private path must not be a symlink"
}

validate_status_path() {
  [[ -n "$STATUS_FILE" ]] || return 0
  [[ "$STATUS_FILE" = /* && -n "${RUNNER_TEMP:-}" ]] || \
    die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "status path is invalid"
  local status_root status_parent
  status_root="$(cd "$RUNNER_TEMP" && pwd -P)" || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "runner temp unavailable"
  status_parent="$(dirname "$STATUS_FILE")"
  [[ -d "$status_parent" ]] || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "status parent unavailable"
  status_parent="$(cd "$status_parent" && pwd -P)" || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "status parent unavailable"
  [[ "$status_parent" == "$status_root" || "$status_parent" == "$status_root"/* ]] || \
    die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "status path must be under runner temp"
  [[ ! -L "$STATUS_FILE" ]] || die_code LOCAL_PREFLIGHT PRIVATE_PATH_INVALID "status path must not be a symlink"
}

early_exit() {
  local rc=$?
  set +e
  if [[ "$STATUS_WRITTEN" -eq 0 ]]; then
    write_status FAIL "$CURRENT_STAGE" "$CURRENT_CODE"
  fi
  exit "$rc"
}

trap early_exit EXIT

GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die_code LOCAL_PREFLIGHT REPOSITORY_CONTEXT_INVALID "not running inside the repository"
validate_status_path

check_postgres_tool_version() {
  local tool="$1"
  local version_output version_major
  version_output="$($tool --version 2>/dev/null)" || die_code LOCAL_PREFLIGHT POSTGRES_VERSION_INVALID "version check failed"
  version_major="$(printf '%s\n' "$version_output" | sed -nE 's/.* ([0-9]+)(\.[0-9]+)?.*/\1/p')"
  [[ "$version_major" == "17" ]] || die_code LOCAL_PREFLIGHT POSTGRES_VERSION_INVALID "PostgreSQL 17 required"
}

run_local_preflight() {
  set_stage LOCAL_PREFLIGHT
  require_command curl
  require_command jq
  require_command sha256sum
  require_command stat
  require_command git
  require_command "$PG_DUMP_BIN"
  require_command "$PG_DUMPALL_BIN"
  validate_private_path
  check_postgres_tool_version "$PG_DUMP_BIN"
  check_postgres_tool_version "$PG_DUMPALL_BIN"
  CURRENT_CODE="LOCAL_PREFLIGHT_PASS"
}

run_local_preflight

if [[ "$MODE" == "--local-preflight" ]]; then
  printf '%s\n' 'CP51F_LOCAL_PREFLIGHT=PASS'
  write_status PASS LOCAL_PREFLIGHT LOCAL_PREFLIGHT_PASS
  exit 0
fi

[[ -z "$MODE" ]] || die_code LOCAL_PREFLIGHT UNCLASSIFIED_FAILURE "unsupported mode"
[[ -n "${SUPABASE_CP51F_TEMP_PAT:-}" ]] || die_code LOCAL_PREFLIGHT SECRET_UNAVAILABLE "setup secret is unavailable"

PAT="$SUPABASE_CP51F_TEMP_PAT"
unset SUPABASE_CP51F_TEMP_PAT

API_ERROR_FILE="$(mktemp "$PRIVATE_SECURE_PATH/.api-error.XXXXXX")"
MANAGEMENT_API_ERROR_CODE_FILE="$PRIVATE_SECURE_PATH/.api-code"
cleanup_files() {
  rm -f "$API_ERROR_FILE" "$MANAGEMENT_API_ERROR_CODE_FILE" "$PRIVATE_SECURE_PATH/.api-response."* "$PRIVATE_SECURE_PATH/.dump-error" "$PRIVATE_SECURE_PATH/.manifest.tmp"
  if [[ -n "$TEMP_CREDENTIAL_FILE" ]]; then
    rm -f -- "$TEMP_CREDENTIAL_FILE"
  fi
}

read_management_api_failure_code() {
  if [[ -s "$MANAGEMENT_API_ERROR_CODE_FILE" ]]; then
    MANAGEMENT_API_LAST_ERROR_CODE="$(<"$MANAGEMENT_API_ERROR_CODE_FILE")"
  else
    MANAGEMENT_API_LAST_ERROR_CODE=MANAGEMENT_API_UNEXPECTED_HTTP
  fi
}

management_curl() {
  local response_file http_code curl_rc=0
  response_file="$(mktemp "$PRIVATE_SECURE_PATH/.api-response.XXXXXX")"
  rm -f "$MANAGEMENT_API_ERROR_CODE_FILE"
  http_code="$(printf '%s\n' \
    'silent' \
    'show-error' \
    'fail' \
    'retry = 2' \
    'connect-timeout = 15' \
    'max-time = 60' \
    "header = \"Authorization: Bearer $PAT\"" \
    'header = "Accept: application/json"' |
    curl --config - --output "$response_file" --write-out '%{http_code}' "$@" 2>/dev/null)" || curl_rc=$?

  if [[ "$http_code" == 000 || -z "$http_code" ]]; then
    printf '%s' MANAGEMENT_API_NETWORK_ERROR >"$MANAGEMENT_API_ERROR_CODE_FILE"
  elif [[ "$http_code" == 401 ]]; then
    printf '%s' MANAGEMENT_API_HTTP_401 >"$MANAGEMENT_API_ERROR_CODE_FILE"
  elif [[ "$http_code" == 403 ]]; then
    printf '%s' MANAGEMENT_API_HTTP_403 >"$MANAGEMENT_API_ERROR_CODE_FILE"
  elif [[ "$http_code" == 404 ]]; then
    printf '%s' MANAGEMENT_API_HTTP_404 >"$MANAGEMENT_API_ERROR_CODE_FILE"
  elif [[ "$http_code" == 429 ]]; then
    printf '%s' MANAGEMENT_API_HTTP_429 >"$MANAGEMENT_API_ERROR_CODE_FILE"
  elif [[ "$http_code" == 5?? ]]; then
    printf '%s' MANAGEMENT_API_HTTP_5XX >"$MANAGEMENT_API_ERROR_CODE_FILE"
  elif [[ "$http_code" != 2?? || "$curl_rc" -ne 0 ]]; then
    printf '%s' MANAGEMENT_API_UNEXPECTED_HTTP >"$MANAGEMENT_API_ERROR_CODE_FILE"
  else
    cat "$response_file"
    rm -f "$response_file"
    return 0
  fi

  rm -f "$response_file"
  return 1
}

api_get() {
  local path="$1"
  local result
  result="$(management_curl "$MANAGEMENT_API_BASE$path" 2>"$API_ERROR_FILE")" || {
      read_management_api_failure_code
      printf '%s\n' "CP51F_SETUP_ERROR: Management API GET failed" >&2
      return 1
    }
  printf '%s' "$result"
}

api_put() {
  local path="$1"
  local body="$2"
  local result
  result="$(management_curl -X PUT \
    -H 'Content-Type: application/json' \
    --data-binary "$body" \
    "$MANAGEMENT_API_BASE$path" 2>"$API_ERROR_FILE")" || {
      read_management_api_failure_code
      printf '%s\n' "CP51F_SETUP_ERROR: Management API PUT failed" >&2
      return 1
    }
  printf '%s' "$result"
}

api_delete() {
  local path="$1"
  local result
  result="$(management_curl -X DELETE \
    "$MANAGEMENT_API_BASE$path" 2>"$API_ERROR_FILE")" || {
      read_management_api_failure_code
      printf '%s\n' "CP51F_SETUP_ERROR: Management API DELETE failed" >&2
      return 1
    }
  printf '%s' "$result"
}

management_api_failure_code() {
  if is_allowed "${MANAGEMENT_API_LAST_ERROR_CODE:-}" \
    MANAGEMENT_API_HTTP_401 MANAGEMENT_API_HTTP_403 MANAGEMENT_API_HTTP_404 \
    MANAGEMENT_API_HTTP_429 MANAGEMENT_API_HTTP_5XX MANAGEMENT_API_NETWORK_ERROR \
    MANAGEMENT_API_UNEXPECTED_HTTP; then
    printf '%s' "$MANAGEMENT_API_LAST_ERROR_CODE"
  else
    printf '%s' MANAGEMENT_API_UNEXPECTED_HTTP
  fi
}

parse_jit_state() {
  jq -ser '
    if length != 1 then
      error("invalid JIT state response")
    else
      .[0] as $document |
      if ($document | type) != "object" or ($document.state | type) != "string" then
      error("invalid JIT state response")
      elif $document.state == "enabled" or $document.state == "disabled" then
      if ($document | has("appliedSuccessfully")) and ($document.appliedSuccessfully | type) != "boolean" then
        error("invalid JIT state response")
      else $document.state end
      elif $document.state == "unavailable" and
      ($document.unavailableReason | type) == "string" and
      ($document.unavailableReason as $reason |
        (["platform_unsupported", "postgres_upgrade_required", "ssl_enforcement_required", "temporarily_unavailable"] | index($reason)) != null) then
      "unavailable"
      else
      error("invalid JIT state response")
      end
    end
  '
}

parse_profile_user_id() {
  jq -ser '
    if length != 1 then
      error("invalid profile response")
    else
      .[0] as $document |
      if ($document | type) == "object" and
        ($document.gotrue_id | type) == "string" and
        ($document.gotrue_id | gsub("[[:space:]]"; "") | length) > 0 then
        $document.gotrue_id
      else
        error("invalid profile response")
      end
    end
  ' 2>/dev/null
}

parse_jit_mapping_list() {
  local expected_user_id="$1"
  jq -ser --arg user_id "$expected_user_id" '
    if length != 1 then
      error("invalid JIT mapping list response")
    else
      .[0] as $document |
      if ($document | type) != "object" or ($document.items | type) != "array" then
        error("invalid JIT mapping list response")
      elif any($document.items[];
        type != "object" or
        (.user_id | type) != "string" or
        (.user_id | length) == 0 or
        (.user_roles | type) != "array") then
        error("invalid JIT mapping list response")
      else
        [$document.items[] | select(.user_id == $user_id)] as $matches |
        if ($matches | length) > 1 then
          error("duplicate JIT mapping")
        elif ($matches | length) == 0 then
          {kind:"absent", roles:[]}
        else
          {kind:"present", roles:$matches[0].user_roles}
        end
      end
    end
  ' 2>/dev/null
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

  local restore_body post_config post_list post_mapping_kind post_roles
  if [[ "$JIT_PRE_MAPPING_KIND" == "absent" ]]; then
    [[ -n "$JIT_USER_ID" ]] || return 1
    post_list="$(api_get "/projects/$PROJECT_REF/database/jit/list")" || return 1
    post_mapping_kind="$(parse_jit_mapping_list "$JIT_USER_ID" <<<"$post_list" | jq -er '.kind')" || return 1
    if [[ "$post_mapping_kind" == "present" ]]; then
      [[ "$JIT_UPDATE_ATTEMPTED" -eq 1 ]] || return 1
      post_roles="$(parse_jit_mapping_list "$JIT_USER_ID" <<<"$post_list" | jq -S -c '.roles')" || return 1
      [[ "$post_roles" == "$JIT_UPDATE_ROLES" ]] || return 1
      api_delete "/projects/$PROJECT_REF/database/jit/$JIT_USER_ID" >/dev/null || return 1
    fi
  else
    restore_body="$(jq -cn --arg user_id "$JIT_USER_ID" --argjson roles "$JIT_PRE_ROLES" \
      '{user_id:$user_id, roles:$roles}')"
    api_put "/projects/$PROJECT_REF/database/jit" "$restore_body" >/dev/null || return 1
  fi

  if [[ "$JIT_PRESTATE" == "disabled" ]]; then
    api_put "/projects/$PROJECT_REF/jit-access" '{"state":"disabled"}' >/dev/null || return 1
  fi

  post_config="$(api_get "/projects/$PROJECT_REF/jit-access")" || return 1
  [[ "$(parse_jit_state <<<"$post_config")" == "$JIT_PRESTATE" ]] || return 1
  post_list="$(api_get "/projects/$PROJECT_REF/database/jit/list")" || return 1
  post_mapping_kind="$(parse_jit_mapping_list "$JIT_USER_ID" <<<"$post_list" | jq -er '.kind')" || return 1
  if [[ "$JIT_PRE_MAPPING_KIND" == "absent" ]]; then
    [[ "$post_mapping_kind" == "absent" ]] || return 1
  else
    [[ "$post_mapping_kind" == "present" ]] || return 1
    post_roles="$(parse_jit_mapping_list "$JIT_USER_ID" <<<"$post_list" | jq -S -c '.roles')" || return 1
    [[ "$post_roles" == "$(jq -S -c '.' <<<"$JIT_PRE_ROLES")" ]] || return 1
  fi

  JIT_CLEAN=1
}

apply_temporary_jit_access() {
  local roles="$1"
  if [[ "$JIT_PRESTATE" == "disabled" ]]; then
    set_stage JIT_ENABLE
    JIT_CHANGED=1
    api_put "/projects/$PROJECT_REF/jit-access" '{"state":"enabled"}' >/dev/null || {
      set_failure JIT_ENABLE "$(management_api_failure_code)"
      return 1
    }
  fi

  JIT_UPDATE_BODY="$(jq -cn --arg user_id "$JIT_USER_ID" --argjson roles "$roles" \
    '{user_id:$user_id, roles:$roles}')" || return 1
  JIT_UPDATE_ROLES="$(jq -S -c '.' <<<"$roles")" || return 1
  set_stage JIT_MAPPING_UPDATE
  JIT_CHANGED=1
  JIT_UPDATE_ATTEMPTED=1
  api_put "/projects/$PROJECT_REF/database/jit" "$JIT_UPDATE_BODY" >/dev/null || {
    set_failure JIT_MAPPING_UPDATE "$(management_api_failure_code)"
    return 1
  }
}

on_exit() {
  local rc=$?
  set +e
  if [[ "$JIT_CHANGED" -eq 1 && "$JIT_CLEAN" -ne 1 ]]; then
    if ! cleanup_jit; then
      set_failure JIT_CLEANUP "${MANAGEMENT_API_LAST_ERROR_CODE:-JIT_CLEANUP_FAILED}"
      write_failure_manifest "STOP_JIT_CLEANUP_FAILURE"
      rc=70
    fi
  fi
  if [[ "$STATUS_WRITTEN" -eq 0 ]]; then
    if [[ "$rc" -eq 0 ]]; then
      write_status PASS COMPLETE AWAITING_PAT_REVOCATION
    else
      write_status FAIL "$CURRENT_STAGE" "$CURRENT_CODE"
    fi
  fi
  cleanup_files
  unset PAT API_ERROR_FILE PGPASSFILE PGSSLMODE PGOPTIONS
  exit "$rc"
}
trap on_exit EXIT

set_stage PROJECT_METADATA
PROJECT_JSON="$(api_get "/projects/$PROJECT_REF")" || { set_failure PROJECT_METADATA "$(management_api_failure_code)"; exit 1; }
TARGET_ID="$(jq -r '.id // empty' <<<"$PROJECT_JSON")"
TARGET_STATUS="$(jq -r '.status // empty' <<<"$PROJECT_JSON")"
POSTGRES_VERSION="$(jq -r '.database.version // empty' <<<"$PROJECT_JSON")"
[[ "$TARGET_ID" == "$PROJECT_REF" ]] || die_code PROJECT_METADATA TARGET_IDENTITY_MISMATCH "target identity mismatch"
[[ "$TARGET_STATUS" == "$EXPECTED_STATUS" ]] || die_code PROJECT_METADATA TARGET_STATUS_MISMATCH "target status mismatch"
[[ "$POSTGRES_VERSION" == "$EXPECTED_POSTGRES_VERSION" ]] || die_code PROJECT_METADATA TARGET_POSTGRES_VERSION_MISMATCH "PostgreSQL version mismatch"

set_stage JIT_CONFIG_READ
JIT_PRE_CONFIG="$(api_get "/projects/$PROJECT_REF/jit-access")" || { set_failure JIT_CONFIG_READ "$(management_api_failure_code)"; exit 1; }
JIT_PRESTATE="$(parse_jit_state <<<"$JIT_PRE_CONFIG")" || die_code JIT_CONFIG_READ JIT_PRESTATE_INVALID "unknown JIT prestate"
[[ "$JIT_PRESTATE" != "unavailable" ]] || die_code JIT_CONFIG_READ JIT_PRESTATE_UNAVAILABLE "temporary access is officially unavailable"
set_stage JIT_PROFILE_READ
PROFILE_JSON="$(api_get "/profile")" || { set_failure JIT_PROFILE_READ "$(management_api_failure_code)"; exit 1; }
JIT_USER_ID="$(parse_profile_user_id <<<"$PROFILE_JSON")" || die_code JIT_PROFILE_READ JIT_PROFILE_INVALID "invalid authenticated profile response"

set_stage JIT_MAPPING_LIST_READ
JIT_PRE_MAPPING="$(api_get "/projects/$PROJECT_REF/database/jit/list")" || { set_failure JIT_MAPPING_LIST_READ "$(management_api_failure_code)"; exit 1; }
JIT_PRE_MAPPING_STATE="$(parse_jit_mapping_list "$JIT_USER_ID" <<<"$JIT_PRE_MAPPING")" || die_code JIT_MAPPING_LIST_READ JIT_MAPPING_INVALID "invalid JIT mapping list response"
JIT_PRE_MAPPING_KIND="$(jq -er '.kind' <<<"$JIT_PRE_MAPPING_STATE")"
JIT_PRE_ROLES="$(jq -c '.roles' <<<"$JIT_PRE_MAPPING_STATE")"

set_stage POOLER_METADATA
POOLER_HOST="${CP51F_POOLER_HOST:-}"
POOLER_PORT="${CP51F_POOLER_PORT:-}"
POOLER_USER="${CP51F_POOLER_USER:-}"
POOLER_DB="${CP51F_POOLER_DB:-}"
cp51f_validate_pooler_config "$POOLER_HOST" "$POOLER_PORT" "$POOLER_USER" "$POOLER_DB" "$PROJECT_REF" || \
  die_code POOLER_METADATA POOLER_METADATA_INVALID "official Session Pooler metadata did not match the required target"

JIT_EXPIRES_AT="$(( $(date +%s) + 900 ))000"
JIT_ROLES='[{"role":"postgres","expires_at":'"$JIT_EXPIRES_AT"'}]'
if [[ -n "${CP51F_ALLOWED_CIDR:-}" ]]; then
  JIT_ROLES="$(jq -cn --arg cidr "$CP51F_ALLOWED_CIDR" --argjson expires "$JIT_EXPIRES_AT" \
    '[{role:"postgres", expires_at:$expires, allowed_networks:{allowed_cidrs:[{cidr:$cidr}]}}]')"
fi
apply_temporary_jit_access "$JIT_ROLES" || exit 1

TEMP_CREDENTIAL_FILE="$(mktemp "$PRIVATE_SECURE_PATH/.pgpass.XXXXXX")"
chmod 600 "$TEMP_CREDENTIAL_FILE"
escaped_pat="$(printf '%s' "$PAT" | sed 's/[\\:]/\\\\&/g')"
printf '%s:%s:%s:%s:%s\n' \
  "$POOLER_HOST" "$POOLER_PORT" "$POOLER_DB" "$POOLER_USER" "$escaped_pat" >"$TEMP_CREDENTIAL_FILE"
PGPASSFILE="$TEMP_CREDENTIAL_FILE"
PGSSLMODE="require"
PGOPTIONS="-c jit=true"
export PGPASSFILE PGSSLMODE PGOPTIONS

run_pg_dump() {
  local name="$1"
  shift
  "$PG_DUMP_BIN" \
    --host "$POOLER_HOST" \
    --port "$POOLER_PORT" \
    --username "$POOLER_USER" \
    --dbname "$POOLER_DB" \
    --file "$PRIVATE_SECURE_PATH/$name.sql" "$@" \
    2>"$PRIVATE_SECURE_PATH/.dump-error" || return 1
  rm -f "$PRIVATE_SECURE_PATH/.dump-error"
  [[ -s "$PRIVATE_SECURE_PATH/$name.sql" ]]
}

run_pg_dumpall_roles() {
  local name="$1"
  shift
  "$PG_DUMPALL_BIN" \
    --host "$POOLER_HOST" \
    --port "$POOLER_PORT" \
    --username "$POOLER_USER" \
    --database "$POOLER_DB" \
    --roles-only \
    --no-role-passwords \
    --file "$PRIVATE_SECURE_PATH/$name.sql" "$@" \
    2>"$PRIVATE_SECURE_PATH/.dump-error" || return 1
  rm -f "$PRIVATE_SECURE_PATH/.dump-error"
  [[ -s "$PRIVATE_SECURE_PATH/$name.sql" ]]
}

set_stage DUMP_ROLES
run_pg_dumpall_roles roles || { set_failure DUMP_ROLES DUMP_ROLES_FAILED; exit 1; }
set_stage DUMP_SCHEMA
run_pg_dump schema --schema-only --schema=public --schema=portal_private --schema=auth || { set_failure DUMP_SCHEMA DUMP_SCHEMA_FAILED; exit 1; }
set_stage DUMP_DATA
run_pg_dump data --data-only --schema=public --schema=portal_private --schema=auth || { set_failure DUMP_DATA DUMP_DATA_FAILED; exit 1; }
set_stage DUMP_HISTORY_SCHEMA
run_pg_dump history_schema --schema-only --schema=supabase_migrations || { set_failure DUMP_HISTORY_SCHEMA DUMP_HISTORY_SCHEMA_FAILED; exit 1; }
set_stage DUMP_HISTORY_DATA
run_pg_dump history_data --data-only --schema=supabase_migrations || { set_failure DUMP_HISTORY_DATA DUMP_HISTORY_DATA_FAILED; exit 1; }

set_stage JIT_CLEANUP
cleanup_jit || die_code JIT_CLEANUP JIT_CLEANUP_FAILED "JIT cleanup did not restore the exact prestate"

set_stage MANIFEST_FINALIZE
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
    '{manifest_version:1,setup_result:"AWAITING_PAT_REVOCATION",setup_utc:$setup_utc,
    project_ref:$project_ref,target_status:$target_status,postgres_version:$postgres_version,
    direct_ipv6_used:false,session_pooler_used:true,session_pooler_port:5432,
    jit_used:true,jit_prestate:$jit_prestate,jit_poststate:$jit_poststate,
    jit_poststate_matches_prestate:true,storage_object_bytes_included:false,
    auth_coverage:"ATTEMPTED_IN_AUTH_SCHEMA_AND_DATA_DUMPS",
    roles_passwords_included:false,
    migration_state_coverage:"CAPTURED_IN_HISTORY_ARTIFACTS",
    classic_pat_revocation:"AWAITING_PAT_REVOCATION",
    artifacts:$artifacts}' > "$PRIVATE_SECURE_PATH/.manifest.tmp" || die_code MANIFEST_FINALIZE MANIFEST_FAILED "manifest write failed"
mv "$PRIVATE_SECURE_PATH/.manifest.tmp" "$PRIVATE_SECURE_PATH/manifest.json" || die_code MANIFEST_FINALIZE MANIFEST_FAILED "manifest finalize failed"
SETUP_RESULT="AWAITING_PAT_REVOCATION"
printf '%s\n' "CP51F_SETUP_RESULT=$SETUP_RESULT"
printf '%s\n' "CP51F_PRIVATE_SECURE_PATH_READY=YES"
