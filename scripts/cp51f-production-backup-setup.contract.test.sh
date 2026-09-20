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
grep -Fq -- 'error("invalid JIT state response")' <<<"$source_text"
grep -Fq -- 'curl --config -' <<<"$source_text"
grep -Fq -- 'PGPASSFILE=' <<<"$source_text"
grep -Fq -- 'chmod 600 "$TEMP_CREDENTIAL_FILE"' <<<"$source_text"
grep -Fq -- 'PG_DUMP_BIN' <<<"$source_text"
! grep -Fq -- 'Authorization: Bearer $PAT"' <<<"$source_text"
! grep -Fq -- '--db-url "$PRIVATE_DB_URL"' <<<"$source_text"
! grep -Fq -- 'PRIVATE_DB_URL=' <<<"$source_text"
grep -Fq -- 'AWAITING_PAT_REVOCATION' <<<"$source_text"

state_enabled='{"state":"enabled","appliedSuccessfully":true}'
state_disabled='{"state":"disabled","appliedSuccessfully":true}'
mapping_present='{"user_id":"11111111-1111-1111-1111-111111111111","user_roles":[{"role":"postgres","expires_at":1}]}'
mapping_absent='null'
mapping_invalid='{"user_id":"not-empty","roles":[]}'

node - "$state_enabled" "$state_disabled" "$mapping_present" "$mapping_absent" "$mapping_invalid" <<'NODE'
const [enabled, disabled, present, absent, invalid] = process.argv.slice(2).map(JSON.parse);
const state = value => {
  if (value && typeof value.state === 'string' && ['enabled', 'disabled'].includes(value.state)) return value.state;
  throw new Error('invalid JIT state response');
};
const mapping = value => {
  if (value === null || (value && Object.keys(value).length === 0)) return 'absent';
  if (value && typeof value.user_id === 'string' && value.user_id.length > 0 && Array.isArray(value.user_roles)) return 'present';
  throw new Error('invalid JIT mapping response');
};
if (state(enabled) !== 'enabled' || state(disabled) !== 'disabled' || mapping(present) !== 'present' || mapping(absent) !== 'absent') process.exit(1);
try { mapping(invalid); process.exit(1); } catch {}
NODE

printf '%s\n' 'CP51F_JIT_CONTRACT_TEST=PASS'
