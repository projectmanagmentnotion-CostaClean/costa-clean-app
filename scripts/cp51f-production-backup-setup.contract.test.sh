#!/usr/bin/env bash

set -Eeuo pipefail

runner="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cp51f-production-backup-setup.sh"
source_text="$(<"$runner")"

grep -Fq -- '"/projects/$PROJECT_REF/jit-access"' <<<"$source_text"
grep -Fq -- '"/projects/$PROJECT_REF/database/jit"' <<<"$source_text"
grep -Fq -- '"/projects/$PROJECT_REF/database/jit/$JIT_USER_ID"' <<<"$source_text"
grep -Fq -- '{user_id:$user_id, roles:$roles}' <<<"$source_text"
! grep -Fq -- '{user_id:$user_id, user_roles:$roles}' <<<"$source_text"
grep -Fq -- '(.user_roles | type) == "array"' <<<"$source_text"
grep -Fq -- 'JIT_PRE_MAPPING_KIND" == "absent"' <<<"$source_text"
grep -Fq -- 'JIT_PRESTATE_UNAVAILABLE' <<<"$source_text"
grep -Fq -- 'curl --config -' <<<"$source_text"
grep -Fq -- 'PGPASSFILE=' <<<"$source_text"
grep -Fq -- 'chmod 600 "$TEMP_CREDENTIAL_FILE"' <<<"$source_text"
grep -Fq -- 'PG_DUMP_BIN' <<<"$source_text"
! grep -Fq -- 'Authorization: Bearer $PAT"' <<<"$source_text"
! grep -Fq -- '--db-url "$PRIVATE_DB_URL"' <<<"$source_text"
! grep -Fq -- 'PRIVATE_DB_URL=' <<<"$source_text"
grep -Fq -- 'AWAITING_PAT_REVOCATION' <<<"$source_text"
grep -Fq -- 'PG_DUMPALL_BIN' <<<"$source_text"
grep -Fq -- 'require_command "$PG_DUMPALL_BIN"' <<<"$source_text"
grep -Fq -- 'run_pg_dumpall_roles' <<<"$source_text"
grep -Fq -- '--roles-only' <<<"$source_text"
grep -Fq -- '--no-role-passwords' <<<"$source_text"
! grep -Fq -- '--role-only' <<<"$source_text"
! grep -Fq -- '--use-copy' <<<"$source_text"
grep -Fq -- 'run_pg_dump schema --schema-only --schema=public --schema=portal_private --schema=auth' <<<"$source_text"
grep -Fq -- 'run_pg_dump data --data-only --schema=public --schema=portal_private --schema=auth' <<<"$source_text"
grep -Fq -- 'run_pg_dump history_schema --schema-only --schema=supabase_migrations' <<<"$source_text"
grep -Fq -- 'run_pg_dump history_data --data-only --schema=supabase_migrations' <<<"$source_text"
grep -Fq -- 'roles_passwords_included:false' <<<"$source_text"
version_check_line="$(grep -n 'check_postgres_tool_version' <<<"$source_text" | head -1 | cut -d: -f1)"
jit_mutation_line="$(grep -n 'api_put "/projects/$PROJECT_REF/jit-access" '\''{"state":"enabled"}'\''' <<<"$source_text" | head -1 | cut -d: -f1)"
[[ -n "$version_check_line" && -n "$jit_mutation_line" && "$version_check_line" -lt "$jit_mutation_line" ]]

state_enabled='{"state":"enabled","appliedSuccessfully":true}'
state_disabled='{"state":"disabled","appliedSuccessfully":true}'
mapping_present='{"user_id":"11111111-1111-1111-1111-111111111111","user_roles":[{"role":"postgres","expires_at":1}]}'
mapping_absent='null'
mapping_invalid='{"user_id":"not-empty","roles":[]}'

node - "$state_enabled" "$state_disabled" "$mapping_present" "$mapping_absent" "$mapping_invalid" <<'NODE'
const [enabled, disabled, present, absent, invalid] = process.argv.slice(2).map(JSON.parse);
const mapping = value => {
  if (value === null || (value && Object.keys(value).length === 0)) return 'absent';
  if (value && typeof value.user_id === 'string' && value.user_id.length > 0 && Array.isArray(value.user_roles)) return 'present';
  throw new Error('invalid JIT mapping response');
};
if (mapping(present) !== 'present' || mapping(absent) !== 'absent') process.exit(1);
try { mapping(invalid); process.exit(1); } catch {}
NODE

# Exercise the production jq parser itself against the official GET 200 schema.
source <(sed -n '/^parse_jit_state() {/,/^}/p' "$runner")
expect_jit_state() {
  local input="$1" expected="$2" actual
  actual="$(parse_jit_state <<<"$input")" || {
    printf '%s\n' 'CP51F_JIT_CONTRACT_TEST=FAIL: valid JIT schema rejected' >&2
    exit 1
  }
  [[ "$actual" == "$expected" ]] || exit 1
}
reject_jit_state() {
  local case_name="$1" input="$2"
  if parse_jit_state <<<"$input" >/dev/null 2>&1; then
    printf 'CP51F_JIT_CONTRACT_TEST=FAIL: invalid JIT case rejected incorrectly (%s)\n' "$case_name" >&2
    exit 1
  fi
}

expect_jit_state '{"state":"enabled"}' enabled
expect_jit_state '{"state":"disabled"}' disabled
expect_jit_state '{"state":"enabled","appliedSuccessfully":true}' enabled
expect_jit_state '{"state":"disabled","appliedSuccessfully":false}' disabled
expect_jit_state '{"state":"unavailable","unavailableReason":"postgres_upgrade_required"}' unavailable
reject_jit_state multi_json $'{"state":"enabled"}\n{"state":"disabled"}'
reject_jit_state valid_plus_null $'{"state":"enabled"}\nnull'
reject_jit_state valid_plus_array $'{"state":"enabled"}\n[]'
reject_jit_state valid_plus_invalid_object $'{"state":"enabled"}\n{"state":"other"}'
reject_jit_state null_plus_valid $'null\n{"state":"enabled"}'
reject_jit_state trailing_garbage '{"state":"enabled"} garbage'
reject_jit_state truncated_json '{"state":"enabled"'
reject_jit_state array '[]'
reject_jit_state null 'null'
reject_jit_state unknown_state '{"state":"other"}'
reject_jit_state absent_unavailable_reason '{"state":"unavailable"}'
reject_jit_state unknown_unavailable_reason '{"state":"unavailable","unavailableReason":"secret-reason"}'
reject_jit_state invalid_applied_successfully '{"state":"enabled","appliedSuccessfully":"true"}'

printf '%s\n' 'CP51F_JIT_CONTRACT_TEST=PASS'
