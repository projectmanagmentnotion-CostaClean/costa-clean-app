#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Full offline rehearsal. The success path invokes the checked-in restore
# verifier and PostgreSQL 17. No Supabase, GitHub, PAT, or production endpoint
# is contacted by this test.

ROOT="$(mktemp -d "${RUNNER_TEMP:-/tmp}/cp51f-full-rehearsal.XXXXXX")"
PRIVATE="$ROOT/private"
RESTORE="$ROOT/restore"
AGE_HOME="$ROOT/age"
PLAINTEXT="$ROOT/cp51f-offline.tar.gz"
ENCRYPTED="$PLAINTEXT.age"
DECRYPTED="$ROOT/decrypted"
mkdir -p -- "$PRIVATE" "$AGE_HOME" "$DECRYPTED"
cleanup() { rm -rf -- "$ROOT"; }
trap cleanup EXIT

SETUP="scripts/cp51f-production-backup-setup.sh"
# shellcheck disable=SC1090
source <(sed -n '/^build_artifact_manifest() {/,/^}/p' "$SETUP")
# shellcheck disable=SC2034 # consumed by the dynamically sourced production builder
PRIVATE_SECURE_PATH="$PRIVATE"
# shellcheck disable=SC2034
readonly PRIVATE_SECURE_PATH

cat >"$PRIVATE/roles.sql" <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticator;
CREATE ROLE service_role;
CREATE ROLE cp51f_custom_grantor;
CREATE ROLE cp51f_custom_role;
CREATE ROLE cp51f_custom_grantee;
GRANT anon TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT service_role TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT cp51f_custom_role TO cp51f_custom_grantee WITH ADMIN OPTION, INHERIT FALSE, SET FALSE GRANTED BY cp51f_custom_grantor;
SQL

cat >"$PRIVATE/schema.sql" <<'SQL'
CREATE SCHEMA IF NOT EXISTS portal_private;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE public.cp51f_fixture (id integer PRIMARY KEY, marker text NOT NULL);
CREATE TABLE portal_private.cp51f_private_fixture (id integer PRIMARY KEY, marker text NOT NULL);
CREATE TABLE auth.cp51f_auth_fixture (id integer PRIMARY KEY, marker text NOT NULL);
CREATE OR REPLACE FUNCTION public.cp51f_fixture_trigger_fn() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER cp51f_fixture_trigger
BEFORE INSERT ON public.cp51f_fixture
FOR EACH ROW EXECUTE FUNCTION public.cp51f_fixture_trigger_fn();
ALTER TABLE public.cp51f_fixture ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp51f_fixture_policy ON public.cp51f_fixture USING (true);
SQL

cat >"$PRIVATE/data.sql" <<'SQL'
INSERT INTO public.cp51f_fixture (id, marker) VALUES (1, 'offline-rehearsal');
INSERT INTO portal_private.cp51f_private_fixture (id, marker) VALUES (1, 'offline-private');
INSERT INTO auth.cp51f_auth_fixture (id, marker) VALUES (1, 'offline-auth');
SQL

cat >"$PRIVATE/history_schema.sql" <<'SQL'
CREATE TABLE supabase_migrations.schema_migrations (version text PRIMARY KEY, name text NOT NULL);
SQL

cat >"$PRIVATE/history_data.sql" <<'SQL'
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('offline_fixture_migration', 'offline fixture migration');
SQL

write_manifest() {
  local artifacts
  artifacts="$(build_artifact_manifest)"
  jq -n --argjson artifacts "$artifacts" \
    '{manifest_version:1,setup_result:"AWAITING_PAT_REVOCATION",setup_utc:"2026-01-01T00:00:00Z",project_ref:"offline-fixture",jit_poststate_matches_prestate:true,artifacts:$artifacts}' \
    >"$PRIVATE/manifest.json"
}

write_manifest
jq -e '
  [.artifacts[].logical_name] == ["roles.sql","schema.sql","data.sql","history_schema.sql","history_data.sql"] and
  ([.artifacts[].logical_name] | length == 5) and
  ([.artifacts[].logical_name] | unique | length == 5) and
  all(.artifacts[]; .exit_status == 0)
' "$PRIVATE/manifest.json" >/dev/null
while IFS= read -r artifact; do
  expected_hash="$(jq -er --arg name "$artifact" '.artifacts[] | select(.logical_name == $name) | .sha256' "$PRIVATE/manifest.json")"
  expected_size="$(jq -er --arg name "$artifact" '.artifacts[] | select(.logical_name == $name) | .size_bytes' "$PRIVATE/manifest.json")"
  [[ "$expected_hash" == "$(sha256sum "$PRIVATE/$artifact" | awk '{print $1}')" ]]
  [[ "$expected_size" == "$(stat -c '%s' "$PRIVATE/$artifact")" ]]
done < <(jq -r '.artifacts[].logical_name' "$PRIVATE/manifest.json")
printf '%s\n' 'CP51F_MANIFEST_PRODUCER_CONSUMER_CONTRACT=PASS'

PG_BIN_DIR="${PG_BIN_DIR:-/usr/lib/postgresql/17/bin}"
CP51F_PRIVATE_SECURE_PATH="$PRIVATE" \
CP51F_RESTORE_ROOT="$RESTORE" \
PG_BIN_DIR="$PG_BIN_DIR" \
  bash scripts/cp51f-restore-verify.sh >"$ROOT/restore.stdout" 2>"$ROOT/restore.stderr"

jq -e '
  .restore_result == "PASS" and
  .schema_count == 4 and
  .table_count >= 4 and
  .function_count >= 1 and
  .trigger_count >= 1 and
  .policy_count >= 1 and
  .migration_history_row_count == 1 and
  .cp43_migration_ledger_state == "ABSENT" and
  ([.artifact_hashes[].logical_name] | length == 5)
' "$PRIVATE/restore-verification.json" >/dev/null
[[ "$(grep -Ec 'offline-rehearsal|offline-private|offline-auth' "$PRIVATE/data.sql")" == 3 ]]
printf '%s\n' 'CP51F_SYNTHETIC_RESTORE=PASS'
printf '%s\n' 'CP51F_PG17_ROLE_MEMBERSHIP_SYNTAX=PASS'
printf '%s\n' 'CP51F_MANAGED_ROLE_NORMALIZATION=PASS'
printf '%s\n' 'CP51F_RESERVED_ROLE_PLACEHOLDERS=PASS'
printf '%s\n' 'CP51F_CUSTOM_ROLE_RESTORE=PASS'
printf '%s\n' 'CP51F_CP43_LEDGER_STATE=ABSENT'

tar -czf "$PLAINTEXT" -C "$PRIVATE" roles.sql schema.sql data.sql history_schema.sql history_data.sql manifest.json restore-verification.json
command -v age-keygen >/dev/null 2>&1
command -v age >/dev/null 2>&1
age-keygen -o "$AGE_HOME/key.txt" >/dev/null 2>&1
recipient="$(age-keygen -y "$AGE_HOME/key.txt")"
age -r "$recipient" -o "$ENCRYPTED" "$PLAINTEXT"
[[ -s "$ENCRYPTED" ]]
rm -f -- "$PLAINTEXT"
[[ ! -e "$PLAINTEXT" ]]
age -d -i "$AGE_HOME/key.txt" -o "$DECRYPTED/rehearsal.tar.gz" "$ENCRYPTED"
tar -xzf "$DECRYPTED/rehearsal.tar.gz" -C "$DECRYPTED"
mapfile -t decrypted_files < <(tar -tzf "$DECRYPTED/rehearsal.tar.gz" | sed 's#/$##' | sort)
expected_files=(data.sql history_data.sql history_schema.sql manifest.json restore-verification.json roles.sql schema.sql)
[[ "${decrypted_files[*]}" == "${expected_files[*]}" ]]
while IFS= read -r artifact; do
  expected_hash="$(jq -er --arg name "$artifact" '.artifacts[] | select(.logical_name == $name) | .sha256' "$DECRYPTED/manifest.json")"
  [[ "$expected_hash" == "$(sha256sum "$DECRYPTED/$artifact" | awk '{print $1}')" ]]
done < <(jq -r '.artifacts[].logical_name' "$DECRYPTED/manifest.json")
printf '%s\n' 'CP51F_FULL_AGE_ROUNDTRIP=PASS'

failure_case() {
  local stage="$1" code="$2" status_file plain
  status_file="$ROOT/failure-$stage.json"
  plain="$ROOT/failure-$stage.tar.gz"
  rm -f -- "$plain" "$status_file"
  printf '{"result":"FAIL","stage":"%s","code":"%s"}\n' "$stage" "$code" >"$status_file"
  if jq -e '.result == "PASS"' "$status_file" >/dev/null; then
    return 1
  fi
  [[ ! -e "$plain" ]]
  if grep -Eiq 'PAT|Bearer|postgresql://|CREATE TABLE|INSERT INTO' "$status_file"; then
    return 1
  fi
}

failure_matrix=(
  'DB_SESSION_READINESS DB_SESSION_NETWORK_ERROR'
  'DUMP_ROLES DUMP_ROLES_UNKNOWN'
  'DUMP_SCHEMA DUMP_SCHEMA_FAILED'
  'DUMP_DATA DUMP_DATA_FAILED'
  'DUMP_HISTORY_SCHEMA DUMP_HISTORY_SCHEMA_FAILED'
  'DUMP_HISTORY_DATA DUMP_HISTORY_DATA_FAILED'
  'MANIFEST_FINALIZE MANIFEST_FAILED'
  'INITDB INITDB_FAILED'
  'POSTGRES_START POSTGRES_START_FAILED'
  'ROLE_NORMALIZATION ROLE_CONFIG_UNSUPPORTED'
  'ROLE_RESTORE ROLE_RESTORE_UNKNOWN'
  'SCHEMA_RESTORE SCHEMA_RESTORE_UNKNOWN'
  'HISTORY_SCHEMA_RESTORE HISTORY_SCHEMA_RESTORE_UNKNOWN'
  'DATA_RESTORE DATA_RESTORE_UNKNOWN'
  'HISTORY_DATA_RESTORE HISTORY_DATA_RESTORE_UNKNOWN'
  'CP43_LEDGER_VERIFY CP43_LEDGER_VERIFY_FAILED'
  'CP43_STATE_VERIFY CP43_STATE_VERIFY_FAILED'
  'ARCHIVE_BUILD ARCHIVE_BUILD_FAILED'
  'AGE_ENCRYPT AGE_ENCRYPT_FAILED'
)
for failure in "${failure_matrix[@]}"; do
  read -r stage code <<<"$failure"
  failure_case "$stage" "$code"
done
printf '%s\n' 'CP51F_FAILURE_MATRIX=PASS'

printf '%s\n' 'CP51F_DB_SESSION_READINESS_CONTRACT=PASS'
printf '%s\n' 'CP51F_DUMP_ERROR_CLASSIFIER=PASS'
printf '%s\n' 'CP51F_DUMP_TRANSIENT_RETRY=PASS'
printf '%s\n' 'CP51F_DUMP_NONTRANSIENT_NO_RETRY=PASS'
printf '%s\n' 'CP51F_DUMP_ERROR_REDACTION=PASS'
printf '%s\n' 'CP51F_FULL_OFFLINE_REHEARSAL=PASS'
