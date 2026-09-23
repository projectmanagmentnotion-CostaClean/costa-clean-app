#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(mktemp -d "${RUNNER_TEMP:-/tmp}/cp51f-managed-roles.XXXXXX")"
PRIVATE="$ROOT/private"
RESTORE_ROOT="$ROOT/restore"
PGDATA="$RESTORE_ROOT/pgdata"
PGSOCKET="$RESTORE_ROOT/socket"
PGLOG="$RESTORE_ROOT/postgres.log"
PGPORT=55434
PG_BIN_DIR="${PG_BIN_DIR:-/usr/lib/postgresql/17/bin}"
PSQL="$PG_BIN_DIR/psql"
INITDB="$PG_BIN_DIR/initdb"
PG_CTL="$PG_BIN_DIR/pg_ctl"
EXPECTED_CUSTOM_ROLE=cp51f_custom_role
EXPECTED_CUSTOM_GRANTEE=cp51f_custom_grantee
ORIGINAL_HASH=""
# shellcheck disable=SC2034 # consumed by the dynamically sourced normalizer
readonly RESERVED_ROLE_RE="^(anon|authenticated|authenticator|dashboard_user|pgbouncer|postgres|service_role|supabase_[A-Za-z0-9_]+|cli_login_[A-Za-z0-9_]+|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin)\$"
# shellcheck disable=SC2034 # consumed by the dynamically sourced normalizer
readonly BUILTIN_ROLE_RE="^pg_[A-Za-z0-9_]+\$"
trap 'set +e; "$PG_CTL" -D "$PGDATA" -m fast -w stop >/dev/null 2>&1; rm -rf -- "$ROOT"' EXIT

mkdir -p "$PRIVATE" "$PGSOCKET"
for tool in "$PSQL" "$INITDB" "$PG_CTL"; do
  "$tool" --version | grep -Eq ' 17([.]|$)'
done

cat >"$PRIVATE/roles.sql" <<'SQL'
CREATE ROLE anon;
ALTER ROLE anon WITH NOLOGIN;
CREATE ROLE authenticated;
ALTER ROLE authenticated WITH NOLOGIN;
CREATE ROLE authenticator;
ALTER ROLE authenticator WITH NOLOGIN;
CREATE ROLE dashboard_user;
CREATE ROLE pgbouncer;
CREATE ROLE postgres;
CREATE ROLE service_role;
CREATE ROLE supabase_admin;
CREATE ROLE supabase_auth_admin;
CREATE ROLE supabase_storage_admin;
CREATE ROLE supabase_realtime_admin;
CREATE ROLE supabase_replication_admin;
CREATE ROLE cp51f_custom_role;
CREATE ROLE cp51f_custom_grantee;
CREATE ROLE cp51f_custom_grantor;
ALTER ROLE cp51f_custom_role WITH NOLOGIN;
GRANT anon TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT anon TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT service_role TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT pg_monitor TO supabase_read_only_user WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT cp51f_custom_role TO cp51f_custom_grantee WITH ADMIN OPTION, INHERIT FALSE, SET FALSE GRANTED BY cp51f_custom_grantor;
SQL

ORIGINAL_HASH="$(sha256sum "$PRIVATE/roles.sql" | awk '{print $1}')"

# Exercise the exact production normalizer, not a duplicate implementation.
# shellcheck disable=SC1090
source <(sed -n '/^normalize_roles_for_restore() {/,/^}$/p' scripts/cp51f-restore-verify.sh)
normalize_roles_for_restore "$PRIVATE/roles.sql" "$RESTORE_ROOT/roles.restore.sql"

[[ "$(sha256sum "$PRIVATE/roles.sql" | awk '{print $1}')" == "$ORIGINAL_HASH" ]]
grep -Fq 'CREATE ROLE "anon"' "$RESTORE_ROOT/roles.restore.sql"
grep -Fq 'CREATE ROLE cp51f_custom_role;' "$RESTORE_ROOT/roles.restore.sql"
grep -Fq 'GRANT cp51f_custom_role TO cp51f_custom_grantee WITH ADMIN OPTION, INHERIT FALSE, SET FALSE;' "$RESTORE_ROOT/roles.restore.sql"
if grep -Eq 'GRANT (anon|authenticated|authenticator|service_role) TO|ALTER ROLE (anon|authenticated|authenticator|service_role)' "$RESTORE_ROOT/roles.restore.sql"; then
  exit 1
fi
if grep -Eq 'GRANTED BY|pg_monitor|supabase_read_only_user' "$RESTORE_ROOT/roles.restore.sql"; then
  exit 1
fi
printf 'CP51F_PG17_ROLE_MEMBERSHIP_SYNTAX=PASS\n'
printf 'CP51F_MANAGED_ROLE_NORMALIZATION=PASS\n'

expect_normalizer_failure() {
  local name="$1"
  local statement="$2"
  local output status
  printf '%s\n' "$statement" >"$PRIVATE/invalid.sql"
  set +e
  output="$(normalize_roles_for_restore "$PRIVATE/invalid.sql" "$RESTORE_ROOT/invalid.restore.sql" 2>&1)"
  status=$?
  set -e
  [[ "$status" -ne 0 && "$output" == *ROLE_* ]] || {
    printf 'ROLE_NEGATIVE_TEST_FAILED=%s\n' "$name" >&2
    exit 1
  }
}

expect_normalizer_failure unknown_option 'GRANT cp51f_custom_role TO cp51f_custom_grantee WITH MAGIC TRUE;'
expect_normalizer_failure duplicate_option 'GRANT cp51f_custom_role TO cp51f_custom_grantee WITH INHERIT TRUE, INHERIT FALSE;'
expect_normalizer_failure malformed_grantor 'GRANT cp51f_custom_role TO cp51f_custom_grantee GRANTED BY;'
expect_normalizer_failure missing_member 'GRANT cp51f_custom_role TO;'
expect_normalizer_failure missing_grantor 'GRANT cp51f_custom_role TO cp51f_custom_grantee GRANTED BY;'
expect_normalizer_failure invalid_identifier 'GRANT cp51f_custom_role TO cp51f_custom_grantee; DROP ROLE cp51f_custom_role;'
expect_normalizer_failure trailing_tokens 'GRANT cp51f_custom_role TO cp51f_custom_grantee WITH INHERIT TRUE EXTRA;'
expect_normalizer_failure password_material 'ALTER ROLE cp51f_custom_role PASSWORD '\''secret'\'';'
expect_normalizer_failure object_privilege 'GRANT SELECT ON public.example TO cp51f_custom_role;'
normalize_roles_for_restore "$PRIVATE/roles.sql" "$RESTORE_ROOT/roles.restore.sql"

"$INITDB" -D "$PGDATA" -U cp51f_admin --auth=trust --no-locale >/dev/null
"$PG_CTL" -D "$PGDATA" -o "-h '' -k $PGSOCKET -p $PGPORT" -l "$PGLOG" -w start >/dev/null
"$PSQL" -h "$PGSOCKET" -p "$PGPORT" -U cp51f_admin -d postgres -v ON_ERROR_STOP=1 -X -q -f "$RESTORE_ROOT/roles.restore.sql" >/dev/null

[[ "$("$PSQL" -h "$PGSOCKET" -p "$PGPORT" -U cp51f_admin -d postgres -Atqc "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','authenticator','dashboard_user','pgbouncer','postgres','service_role','supabase_admin','supabase_auth_admin','supabase_storage_admin','supabase_realtime_admin','supabase_replication_admin');")" == 12 ]]
[[ "$("$PSQL" -h "$PGSOCKET" -p "$PGPORT" -U cp51f_admin -d postgres -Atqc "SELECT count(*) FROM pg_roles WHERE rolname IN ('$EXPECTED_CUSTOM_ROLE','$EXPECTED_CUSTOM_GRANTEE','cp51f_custom_grantor');")" == 3 ]]
printf 'CP51F_RESERVED_ROLE_PLACEHOLDERS=PASS\n'
printf 'CP51F_CUSTOM_ROLE_RESTORE=PASS\n'
[[ "$("$PSQL" -h "$PGSOCKET" -p "$PGPORT" -U cp51f_admin -d postgres -Atqc "SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid JOIN pg_roles g ON g.oid = m.member WHERE r.rolname = '$EXPECTED_CUSTOM_ROLE' AND g.rolname = '$EXPECTED_CUSTOM_GRANTEE';")" == 1 ]]
printf 'CP51F_CUSTOM_MEMBERSHIP_OPTIONS=PASS\n'
[[ "$(sha256sum "$PRIVATE/roles.sql" | awk '{print $1}')" == "$ORIGINAL_HASH" ]]
printf 'CP51F_ORIGINAL_ROLES_HASH_PRESERVED=PASS\n'
