#!/usr/bin/env bash
set -Eeuo pipefail
# shellcheck disable=SC1090,SC2034 # Production functions are extracted at runtime and consume these test globals.

RUNNER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cp51f-production-backup-setup.sh"
source <(sed -n \
  -e '/^parse_jit_state() {/,/^}/p' \
  -e '/^parse_profile_user_id() {/,/^}/p' \
  -e '/^parse_jit_mapping_list() {/,/^}/p' \
  -e '/^cleanup_jit() {/,/^}/p' \
  -e '/^apply_temporary_jit_access() {/,/^}/p' "$RUNNER")

readonly CURRENT_USER='11111111-1111-1111-1111-111111111111'
readonly OTHER_USER='22222222-2222-2222-2222-222222222222'
readonly PROJECT_REF='wfxnwfcdjainpojhbdri'
JIT_USER_ID="$CURRENT_USER"
JIT_PRESTATE=disabled
JIT_PRE_MAPPING_KIND=absent
JIT_PRE_ROLES='[]'
JIT_UPDATE_ROLES='[]'
JIT_UPDATE_ATTEMPTED=0
JIT_CHANGED=0
JIT_CLEAN=0
JIT_PRE_CONFIG=''
JIT_PRE_MAPPING=''
JIT_UPDATE_BODY=''
CURRENT_KIND=absent
CURRENT_ROLES='[]'
GLOBAL_STATE=disabled
FAIL_MAPPING_PUT=0
CALLS=''

set_stage() { CURRENT_STAGE="$1"; }
set_failure() { CURRENT_STAGE="$1"; CURRENT_CODE="$2"; }
management_api_failure_code() { printf '%s' MANAGEMENT_API_HTTP_5XX; }

api_get() {
  case "$1" in
    "/projects/$PROJECT_REF/jit-access")
      jq -cn --arg state "$GLOBAL_STATE" '{state:$state}'
      ;;
    "/projects/$PROJECT_REF/database/jit/list")
      local items='[]'
      if [[ "$CURRENT_KIND" == present ]]; then
        items="$(jq -cn --argjson roles "$CURRENT_ROLES" --arg id "$CURRENT_USER" \
          --arg other "$OTHER_USER" '[{user_id:$id,user_roles:$roles},{user_id:$other,user_roles:[{role:"other"}]}]')"
      else
        items="$(jq -cn --arg other "$OTHER_USER" '[{user_id:$other,user_roles:[{role:"other"}]}]')"
      fi
      jq -cn --argjson items "$items" '{items:$items}'
      ;;
    *) return 1 ;;
  esac
}

api_put() {
  local path="$1" body="$2"
  CALLS+="PUT $path\n"
  if [[ "$path" == "/projects/$PROJECT_REF/jit-access" ]]; then
    GLOBAL_STATE="$(jq -r '.state' <<<"$body")"
    return 0
  fi
  if [[ "$path" == "/projects/$PROJECT_REF/database/jit" ]]; then
    CURRENT_KIND=present
    CURRENT_ROLES="$(jq -c '.roles' <<<"$body")"
    if [[ "$FAIL_MAPPING_PUT" -eq 1 ]]; then return 1; fi
    return 0
  fi
  return 1
}

api_delete() {
  [[ "$1" == "/projects/$PROJECT_REF/database/jit/$JIT_USER_ID" ]] || return 1
  CALLS+="DELETE $1\n"
  CURRENT_KIND=absent
  CURRENT_ROLES='[]'
}

expect_profile() {
  local input="$1" expected="$2" actual
  actual="$(parse_profile_user_id <<<"$input" 2>/dev/null)" || actual=INVALID
  [[ "$actual" == "$expected" ]] || { printf '%s\n' 'profile contract failed' >&2; exit 1; }
}

profile_valid="$(jq -cn --arg id "$CURRENT_USER" '{gotrue_id:$id,primary_email:"private"}')"
expect_profile "$profile_valid" "$CURRENT_USER"
expect_profile '{"primary_email":"private"}' INVALID
expect_profile '{"gotrue_id":17}' INVALID
expect_profile $'{"gotrue_id":"first"}\n{"gotrue_id":"second"}' INVALID

expect_mapping() {
  local input="$1" expected_kind="$2" expected_roles="$3" actual
  actual="$(parse_jit_mapping_list "$CURRENT_USER" <<<"$input")" || {
    printf '%s\n' 'mapping-list contract unexpectedly rejected valid shape' >&2; exit 1;
  }
  [[ "$(jq -r '.kind' <<<"$actual")" == "$expected_kind" ]] || exit 1
  [[ "$(jq -S -c '.roles' <<<"$actual")" == "$(jq -S -c '.' <<<"$expected_roles")" ]] || exit 1
}

reject_mapping() {
  local input="$1"
  if parse_jit_mapping_list "$CURRENT_USER" <<<"$input" >/dev/null 2>&1; then
    printf '%s\n' 'invalid mapping-list shape was accepted' >&2; exit 1
  fi
}

expect_mapping '{"items":[]}' absent '[]'
expect_mapping "$(jq -cn --arg id "$OTHER_USER" '{items:[{user_id:$id,user_roles:[]}]}')" absent '[]'
expect_mapping "$(jq -cn --arg id "$CURRENT_USER" '{items:[{user_id:$id,user_roles:[{role:"postgres",expires_at:1}]}]}')" present '[{"role":"postgres","expires_at":1}]'
expect_mapping "$(jq -cn --arg id "$CURRENT_USER" '{items:[{user_id:$id,user_roles:[]}]}')" present '[]'
reject_mapping "$(jq -cn --arg id "$CURRENT_USER" '{items:[{user_id:$id,user_roles:[]},{user_id:$id,user_roles:[]}]}')"
reject_mapping '{"items":{}}'
reject_mapping '{broken'
reject_mapping $'{"items":[]}\n{"items":[]}'
reject_mapping '{"items":[{"user_id":"","user_roles":[]}]}'
reject_mapping '{"items":[{"user_id":"valid-but-missing-roles"}]}'

temporary_roles='[{"role":"postgres","expires_at":9999999999999}]'
original_roles='[{"role":"reader","expires_at":9999999999999}]'

reset_case() {
  GLOBAL_STATE=disabled
  JIT_PRESTATE=disabled
  JIT_PRE_MAPPING_KIND=absent
  JIT_PRE_ROLES='[]'
  JIT_UPDATE_ROLES='[]'
  JIT_UPDATE_ATTEMPTED=0
  JIT_CHANGED=0
  JIT_CLEAN=0
  CURRENT_KIND=absent
  CURRENT_ROLES='[]'
  FAIL_MAPPING_PUT=0
  CALLS=''
}

reset_case
apply_temporary_jit_access "$temporary_roles"
[[ "$GLOBAL_STATE" == enabled && "$CURRENT_KIND" == present ]]
cleanup_jit
[[ "$GLOBAL_STATE" == disabled && "$CURRENT_KIND" == absent && "$JIT_CLEAN" -eq 1 ]]
[[ "$CALLS" == *"DELETE /projects/$PROJECT_REF/database/jit/$CURRENT_USER"* ]]

reset_case
CURRENT_KIND=present
CURRENT_ROLES="$original_roles"
JIT_PRE_MAPPING_KIND=present
JIT_PRE_ROLES="$original_roles"
apply_temporary_jit_access "$temporary_roles"
cleanup_jit
[[ "$GLOBAL_STATE" == disabled && "$CURRENT_KIND" == present && "$JIT_CLEAN" -eq 1 ]]
[[ "$(jq -S -c '.' <<<"$CURRENT_ROLES")" == "$(jq -S -c '.' <<<"$original_roles")" ]]
[[ "$CALLS" != *"DELETE "* ]]

reset_case
FAIL_MAPPING_PUT=1
if apply_temporary_jit_access "$temporary_roles"; then
  printf '%s\n' 'injected ambiguous mapping update unexpectedly passed' >&2; exit 1
fi
[[ "$JIT_CHANGED" -eq 1 && "$CURRENT_KIND" == present ]]
cleanup_jit
[[ "$GLOBAL_STATE" == disabled && "$CURRENT_KIND" == absent && "$JIT_CLEAN" -eq 1 ]]

printf '%s\n' 'CP51F_JIT_MAPPING_CONTRACT=PASS' 'CP51F_JIT_ABSENT_LIFECYCLE=PASS' 'CP51F_JIT_PRESENT_LIFECYCLE=PASS' 'CP51F_JIT_FAILURE_CLEANUP=PASS'
