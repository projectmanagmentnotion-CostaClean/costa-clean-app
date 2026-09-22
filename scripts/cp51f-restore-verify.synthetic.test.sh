#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(mktemp -d "${RUNNER_TEMP:-/tmp}/cp51f-synthetic.XXXXXX")"
PRIVATE="$ROOT/private"
RESTORE="$ROOT/restore"
AGE_HOME="$ROOT/age"
mkdir -p "$PRIVATE" "$AGE_HOME"
cleanup() { rm -rf -- "$ROOT"; }
trap cleanup EXIT

SETUP="scripts/cp51f-production-backup-setup.sh"
# shellcheck disable=SC1090
source <(sed -n '/^build_artifact_manifest() {/,/^}/p' "$SETUP")
PRIVATE_SECURE_PATH="$PRIVATE"
readonly PRIVATE_SECURE_PATH

cat >"$PRIVATE/roles.sql" <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cp51f_fixture_role') THEN
    CREATE ROLE cp51f_fixture_role;
  END IF;
END $$;
SQL

cat >"$PRIVATE/schema.sql" <<'SQL'
CREATE SCHEMA IF NOT EXISTS portal_private;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE public.synthetic_restore_fixture (id integer PRIMARY KEY, marker text NOT NULL);
CREATE OR REPLACE FUNCTION public.synthetic_restore_fixture_trigger_fn() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER synthetic_restore_fixture_trigger
BEFORE INSERT ON public.synthetic_restore_fixture
FOR EACH ROW EXECUTE FUNCTION public.synthetic_restore_fixture_trigger_fn();
ALTER TABLE public.synthetic_restore_fixture ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_restore_fixture_policy ON public.synthetic_restore_fixture USING (true);
SQL

cat >"$PRIVATE/data.sql" <<'SQL'
INSERT INTO public.synthetic_restore_fixture (id, marker) VALUES (1, 'synthetic-only');
SQL

cat >"$PRIVATE/history_schema.sql" <<'SQL'
CREATE TABLE supabase_migrations.schema_migrations (version text PRIMARY KEY, name text NOT NULL);
SQL

cat >"$PRIVATE/history_data.sql" <<'SQL'
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260918155431', 'cp43_canonical_state_reconciliation'),
  ('synthetic_fixture_migration', 'synthetic fixture migration');
SQL

write_manifest() {
  local artifact_json
  artifact_json="$(build_artifact_manifest)"

  jq -n --argjson artifacts "$artifact_json" \
    '{manifest_version:1, setup_result:"AWAITING_PAT_REVOCATION", setup_utc:"2026-01-01T00:00:00Z", project_ref:"synthetic-fixture", jit_poststate_matches_prestate:true, artifacts:$artifacts}' \
    >"$PRIVATE/manifest.json"
}

write_manifest

jq -e '
  [.artifacts[].logical_name] == ["roles.sql", "schema.sql", "data.sql", "history_schema.sql", "history_data.sql"] and
  ([.artifacts[].logical_name] | length == 5) and
  ([.artifacts[].logical_name] | unique | length == 5) and
  all(.artifacts[]; .exit_status == 0)
' "$PRIVATE/manifest.json" >/dev/null
while IFS= read -r artifact; do
  [[ -s "$PRIVATE/$artifact" ]]
  manifest_hash="$(jq -er --arg name "$artifact" '.artifacts[] | select(.logical_name == $name) | .sha256' "$PRIVATE/manifest.json")"
  manifest_size="$(jq -er --arg name "$artifact" '.artifacts[] | select(.logical_name == $name) | .size_bytes' "$PRIVATE/manifest.json")"
  [[ "$manifest_hash" == "$(sha256sum "$PRIVATE/$artifact" | awk '{print $1}')" ]]
  [[ "$manifest_size" == "$(stat -c '%s' "$PRIVATE/$artifact")" ]]
done < <(jq -r '.artifacts[].logical_name' "$PRIVATE/manifest.json")
printf 'CP51F_MANIFEST_PRODUCER_CONSUMER_CONTRACT=PASS\n'

jq '(.artifacts[].logical_name) |= sub("\\.sql$"; "")' "$PRIVATE/manifest.json" >"$ROOT/legacy-manifest.json"
cp -- "$ROOT/legacy-manifest.json" "$PRIVATE/manifest.json"
set +e
legacy_output="$(CP51F_PRIVATE_SECURE_PATH="$PRIVATE" CP51F_RESTORE_ROOT="$RESTORE" PG_BIN_DIR="${PG_BIN_DIR:-/usr/lib/postgresql/17/bin}" bash scripts/cp51f-restore-verify.sh 2>&1)"
legacy_status=$?
set -e
[[ "$legacy_status" -ne 0 && "$legacy_output" == *'roles.sql hash missing'* ]]
printf 'CP51F_MANIFEST_OLD_NAMES_FAIL_CLOSED=PASS\n'

write_manifest

CP51F_PRIVATE_SECURE_PATH="$PRIVATE" \
CP51F_RESTORE_ROOT="$RESTORE" \
PG_BIN_DIR="${PG_BIN_DIR:-/usr/lib/postgresql/17/bin}" \
  bash scripts/cp51f-restore-verify.sh

jq -e '
  .restore_result == "PASS" and
  .schema_count == 4 and
  .table_count >= 1 and
  .function_count >= 1 and
  .trigger_count >= 1 and
  .policy_count >= 1 and
  .migration_history_row_count == 2 and
  .cp43_canonical_migration_present == "YES" and
  .cp43_migration_ledger_state == "PRESENT_CANONICAL"
' "$PRIVATE/restore-verification.json" >/dev/null
printf 'VERSION_TIMESTAMP_SEMANTICS=PASS\n'
printf 'NAME_SEPARATION=PASS\n'
printf 'CP43_DETECTION=PASS\n'
cp -- "$PRIVATE/restore-verification.json" "$ROOT/canonical-restore-verification.json"

cat >"$PRIVATE/history_data.sql" <<'SQL'
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260918155431', 'wrong_cp43_name'),
  ('synthetic_fixture_migration', 'synthetic fixture migration');
SQL
write_manifest
rm -f -- "$PRIVATE/restore-verification.json"
set +e
mismatch_output="$(CP51F_PRIVATE_SECURE_PATH="$PRIVATE" CP51F_RESTORE_ROOT="$RESTORE" PG_BIN_DIR="${PG_BIN_DIR:-/usr/lib/postgresql/17/bin}" bash scripts/cp51f-restore-verify.sh 2>&1)"
mismatch_status=$?
set -e
[[ "$mismatch_status" -ne 0 && "$mismatch_output" == *STOP_CP43_VERSION_NAME_MISMATCH* ]]
printf 'SYNTHETIC_LEDGER_MISMATCH=VERSION_NAME_MISMATCH\n'

if command -v age-keygen >/dev/null 2>&1 && command -v age >/dev/null 2>&1; then
  cp -- "$ROOT/canonical-restore-verification.json" "$PRIVATE/restore-verification.json"
  age-keygen -o "$AGE_HOME/key.txt" >/dev/null 2>&1
  recipient="$(age-keygen -y "$AGE_HOME/key.txt")"
  age -r "$recipient" -o "$ROOT/verification.json.age" "$PRIVATE/restore-verification.json"
  age -d -i "$AGE_HOME/key.txt" -o "$ROOT/verification.decrypted.json" "$ROOT/verification.json.age"
  cmp -s "$PRIVATE/restore-verification.json" "$ROOT/verification.decrypted.json"
  printf 'CP51F_SYNTHETIC_AGE_ROUNDTRIP=PASS\n'
else
  printf 'CP51F_SYNTHETIC_AGE_ROUNDTRIP=SKIPPED\n'
fi

printf 'CP51F_SYNTHETIC_RESTORE=PASS\n'
