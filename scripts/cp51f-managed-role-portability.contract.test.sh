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
readonly RESERVED_ROLE_RE='^(anon|authenticated|authenticator|dashboard_user|pgbouncer|postgres|service_role|supabase_[A-Za-z0-9_]+|cli_login_[A-Za-z0-9_]+|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin)$'
readonly BUILTIN_ROLE_RE='^pg_[A-Za-z0-9_]+$'
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
ALTER ROLE cp51f_custom_role WITH NOLOGIN;
GRANT anon TO authenticator;
GRANT cp51f_custom_role TO cp51f_custom_grantee;
SQL

ORIGINAL_HASH="$(sha256sum "$PRIVATE/roles.sql" | awk '{print $1}')"

# Exercise the exact production normalizer, not a duplicate implementation.
# shellcheck disable=SC1090
source <(sed -n '/^normalize_roles_for_restore() {/,/^}$/p' scripts/cp51f-restore-verify.sh)
normalize_roles_for_restore "$PRIVATE/roles.sql" "$RESTORE_ROOT/roles.restore.sql"

[[ "$(sha256sum "$PRIVATE/roles.sql" | awk '{print $1}')" == "$ORIGINAL_HASH" ]]
grep -Fq 'CREATE ROLE "anon"' "$RESTORE_ROOT/roles.restore.sql"
grep -Fq 'CREATE ROLE cp51f_custom_role;' "$RESTORE_ROOT/roles.restore.sql"
grep -Fq 'GRANT cp51f_custom_role TO cp51f_custom_grantee;' "$RESTORE_ROOT/roles.restore.sql"
! grep -Eq 'GRANT (anon|authenticated|authenticator|service_role) TO|ALTER ROLE (anon|authenticated|authenticator|service_role)' "$RESTORE_ROOT/roles.restore.sql"
printf 'CP51F_MANAGED_ROLE_NORMALIZATION=PASS\n'

"$INITDB" -D "$PGDATA" -U cp51f_admin --auth=trust --no-locale >/dev/null
"$PG_CTL" -D "$PGDATA" -o "-h '' -k $PGSOCKET -p $PGPORT" -l "$PGLOG" -w start >/dev/null
"$PSQL" -h "$PGSOCKET" -p "$PGPORT" -U cp51f_admin -d postgres -v ON_ERROR_STOP=1 -X -q -f "$RESTORE_ROOT/roles.restore.sql" >/dev/null

[[ "$("$PSQL" -h "$PGSOCKET" -p "$PGPORT" -U cp51f_admin -d postgres -Atqc "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','authenticator','dashboard_user','pgbouncer','postgres','service_role','supabase_admin','supabase_auth_admin','supabase_storage_admin','supabase_realtime_admin','supabase_replication_admin');")" == 12 ]]
[[ "$("$PSQL" -h "$PGSOCKET" -p "$PGPORT" -U cp51f_admin -d postgres -Atqc "SELECT count(*) FROM pg_roles WHERE rolname IN ('$EXPECTED_CUSTOM_ROLE','$EXPECTED_CUSTOM_GRANTEE');")" == 2 ]]
printf 'CP51F_RESERVED_ROLE_PLACEHOLDERS=PASS\n'
printf 'CP51F_CUSTOM_ROLE_RESTORE=PASS\n'
[[ "$(sha256sum "$PRIVATE/roles.sql" | awk '{print $1}')" == "$ORIGINAL_HASH" ]]
printf 'CP51F_ORIGINAL_ROLES_HASH_PRESERVED=PASS\n'
