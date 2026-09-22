#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(mktemp -d "${RUNNER_TEMP:-/tmp}/cp51f-manifest-contract.XXXXXX")"
readonly ROOT
readonly PRIVATE="$ROOT/private"
readonly FAKE_PG="$ROOT/pg-bin"
readonly RESTORE_ROOT="$ROOT/restore"
readonly SETUP="scripts/cp51f-production-backup-setup.sh"
readonly RESTORE="scripts/cp51f-restore-verify.sh"
readonly EXPECTED_NAMES=(roles.sql schema.sql data.sql history_schema.sql history_data.sql)
trap 'rm -rf -- "$ROOT"' EXIT
mkdir -p "$PRIVATE" "$FAKE_PG"

# Exercise the exact manifest builder called by the production runner.
# shellcheck disable=SC1090
source <(sed -n '/^build_artifact_manifest() {/,/^}/p' "$SETUP")
PRIVATE_SECURE_PATH="$PRIVATE"
readonly PRIVATE_SECURE_PATH

for name in "${EXPECTED_NAMES[@]}"; do
  printf 'synthetic fixture for %s\n' "$name" >"$PRIVATE/$name"
done

artifact_json="$(build_artifact_manifest)"
jq -e --argjson expected '["roles.sql", "schema.sql", "data.sql", "history_schema.sql", "history_data.sql"]' '
  [.[] | .logical_name] == $expected and
  ([.[] | .logical_name] | length == 5) and
  ([.[] | .logical_name] | unique | length == 5)
' <<<"$artifact_json" >/dev/null

for name in "${EXPECTED_NAMES[@]}"; do
  [[ -s "$PRIVATE/$name" ]]
  jq -e --arg name "$name" \
    --arg sha "$(sha256sum "$PRIVATE/$name" | awk '{print $1}')" \
    --argjson size "$(stat -c '%s' "$PRIVATE/$name")" \
    '([.[] | select(.logical_name == $name)] | length == 1) and
     ([.[] | select(.logical_name == $name)][0] | .sha256 == $sha and .size_bytes == $size and .exit_status == 0)' \
    <<<"$artifact_json" >/dev/null
done

jq -n --argjson artifacts "$artifact_json" '{manifest_version:1,artifacts:$artifacts}' >"$PRIVATE/manifest.json"

for tool in psql initdb pg_ctl; do
  cat >"$FAKE_PG/$tool" <<'SH'
#!/usr/bin/env bash
if [[ "${1:-}" == --version ]]; then
  printf '%s\n' 'PostgreSQL 17.0 synthetic stub'
  exit 0
fi
: >"${CP51F_SYNTHETIC_INITDB_MARKER:?}"
exit 99
SH
  chmod 700 "$FAKE_PG/$tool"
done

# Recreate the historic aliases and prove the strict consumer rejects them before initdb.
jq '(.artifacts[].logical_name) |= sub("\\.sql$"; "")' \
  "$PRIVATE/manifest.json" >"$ROOT/legacy-manifest.json"
cp -- "$ROOT/legacy-manifest.json" "$PRIVATE/manifest.json"
set +e
legacy_output="$(CP51F_PRIVATE_SECURE_PATH="$PRIVATE" CP51F_RESTORE_ROOT="$RESTORE_ROOT" PG_BIN_DIR="$FAKE_PG" CP51F_SYNTHETIC_INITDB_MARKER="$ROOT/initdb-called" bash "$RESTORE" 2>&1)"
legacy_status=$?
set -e
[[ "$legacy_status" -ne 0 && "$legacy_output" == *'roles.sql hash missing'* ]]
[[ ! -e "$ROOT/initdb-called" ]]

printf 'CP51F_MANIFEST_PRODUCER_CONSUMER_CONTRACT=PASS\n'
printf 'CP51F_MANIFEST_OLD_NAMES_FAIL_CLOSED=PASS\n'
