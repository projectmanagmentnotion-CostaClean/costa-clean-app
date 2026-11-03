#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly MAIN_SHA='a9977eafa6e4873a5d3aae64c0bd4dc64c5cece2'
readonly V3_SHA='6c2d5f265744fa9c4f9f0d81b0d6e8d8fbb1fe61'
readonly P0_SHA='8b1984bb22107b4e4c127a505ca6e4c966abca78'
readonly BASELINE_SHA256='57B4DD8AE3A772394D77A44D6D0CBA81CD0BCE933120B152B97465F080799386'
readonly P0_SHA256='7106CB1AF75D4DD731A5CEE3731B963174B2C8EA2918C0D0B87ABCD616F207B1'
readonly MATRIX_SHA256='0625E1FB41F37E363B3148FC5C80769167E749996E97EB5BE1CD68E182EDE9C0'
readonly COMPAT_GUARD_SHA256='72AAF2E487530803764E2247BB08D9F61F875653003945B60C393EEEB9AE8E71'
readonly COMPAT_RECONCILE_SHA256='80E1E4BA35CA330B2A2A358F5F35A2D822FA681E5E70A3F8DB2B4812683A6BA5'

workspace="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel)}"
manifest="$workspace/supabase/qa/bootstrap/v3-p0-release-manifest.json"
baseline="$workspace/supabase/qa/bootstrap/20260721_qa_baseline_schema.sql"
compat_dir="$workspace/supabase/qa/ci/compat"
transition_sql="$workspace/supabase/qa/ci/p0-transition-security.sql"
cli_log_dir="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/costa-clean-sql-logs.XXXXXX")"
chmod 700 "$cli_log_dir"
tmp_root="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/costa-clean-p0-v3.XXXXXX")"
chmod 700 "$tmp_root"
active_project=''
active_network=''
stage='preflight'

cleanup() {
  local rc=$?
  if [[ -n "$active_project" ]]; then
    if ! (cd "$active_project" && supabase stop --no-backup >"$cli_log_dir/stop.log" 2>&1); then
      printf 'CI_SQL_CLEANUP=FAIL\n'
      [[ "$rc" -ne 0 ]] || rc=1
    fi
  fi
  if [[ -n "$active_network" ]] && ! docker network rm "$active_network" >/dev/null 2>&1; then
    printf 'CI_SQL_CLEANUP=FAIL\n'
    [[ "$rc" -ne 0 ]] || rc=1
  fi
  rm -rf -- "$tmp_root" "$cli_log_dir"
  if [[ "$rc" -ne 0 ]]; then
    printf 'CI_SQL_RESULT=FAIL\nCI_SQL_STAGE=%s\n' "$stage"
  else
    printf 'CI_SQL_CLEANUP=PASS\n'
  fi
  return "$rc"
}
trap cleanup EXIT

unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD SUPABASE_DB_URL SUPABASE_PROJECT_REF || true

fail() {
  printf 'CI_SQL_RESULT=FAIL\nCI_SQL_STAGE=%s\n' "$1"
  exit 1
}

sha256_file() { sha256sum "$1" | awk '{print toupper($1)}'; }

[[ -f "$manifest" && -f "$baseline" && -f "$transition_sql" ]] || fail 'required-local-artifacts'
[[ "$(sha256_file "$baseline")" == "$BASELINE_SHA256" ]] || fail 'baseline-hash'
[[ "$(jq -r '.qaBootstrap.incremental' "$manifest")" == false ]] || fail 'baseline-incremental-flag'
[[ "$(jq -r '.qaBootstrap.productionAllowed' "$manifest")" == false ]] || fail 'baseline-production-guard'
[[ "$(sha256_file "$compat_dir/20261002165959_p0_expense_financial_guard_before_n56.sql")" == "$COMPAT_GUARD_SHA256" ]] || fail 'compat-guard-hash'
[[ "$(sha256_file "$compat_dir/20261002173001_p0_expense_financial_guard_reconcile.sql")" == "$COMPAT_RECONCILE_SHA256" ]] || fail 'compat-reconcile-hash'

# Fetch only the pinned public PR commits and require the remote heads to remain
# exactly those reviewed SHAs. No Supabase credentials or remote DB URL are used.
stage='source-commit-pins'
git fetch --no-tags --depth=1 origin refs/pull/28/head:refs/remotes/origin/ci-pr28
git fetch --no-tags --depth=1 origin refs/pull/30/head:refs/remotes/origin/ci-pr30
[[ "$(git rev-parse refs/remotes/origin/ci-pr28)" == "$V3_SHA" ]] || fail 'pr28-source-sha-drift'
[[ "$(git rev-parse refs/remotes/origin/ci-pr30)" == "$P0_SHA" ]] || fail 'pr30-source-sha-drift'
git cat-file -e "$MAIN_SHA^{commit}" || fail 'main-source-commit-missing'

v3_files=( $(jq -r '.migrations[].file' "$manifest") )
equivalent_files=( $(jq -r '.migrations[] | select(.production.status == "exact_statement_match") | .file' "$manifest") )
pending_files=( $(jq -r '.migrations[] | select(.production.status != "exact_statement_match") | .file' "$manifest") )
[[ "${#v3_files[@]}" -eq 18 && "${#equivalent_files[@]}" -eq 5 && "${#pending_files[@]}" -eq 13 ]] || fail 'migration-manifest-counts'

readonly N56_FILE='20261002170000_n56_preproduction_security_hardening.sql'
readonly GRANT_FILE='20261002173000_expense_product_grant_hardening.sql'
readonly GUARD_FILE='20261002165959_p0_expense_financial_guard_before_n56.sql'
readonly RECONCILE_FILE='20261002173001_p0_expense_financial_guard_reconcile.sql'
readonly P0_FILE='20261102120000_p0_expense_access_and_rpc_hardening.sql'
pre_n56_pending=()
for file in "${pending_files[@]}"; do
  [[ "$file" == "$N56_FILE" || "$file" == "$GRANT_FILE" ]] || pre_n56_pending+=("$file")
done
[[ "${#pre_n56_pending[@]}" -eq 11 ]] || fail 'v3-pending-phase-count'

db_container=''
setup_project() {
  local project_id="$1"
  active_project="$tmp_root/$project_id"
  mkdir -p "$active_project/supabase/migrations"
  cp "$workspace/supabase/config.toml" "$active_project/supabase/config.toml"
  sed -i "s/^project_id = .*/project_id = \"$project_id\"/" "$active_project/supabase/config.toml"
  active_network="${project_id}-isolated"
  docker network create --internal "$active_network" >/dev/null
  (cd "$active_project" && supabase start --network-id "$active_network" -x studio,imgproxy,edge-runtime,logflare,vector,postgres-meta,supavisor >"$cli_log_dir/$project_id-start.log" 2>&1) || fail "$project_id-stack-start"
  db_container="$(docker ps --filter "name=supabase_db_${project_id}" --format '{{.Names}}' | head -n 1)"
  [[ -n "$db_container" ]] || fail "$project_id-postgres-container"
  printf 'LOCAL_SUPABASE_STACK=%s\n' "$project_id"
}

stop_project() {
  [[ -n "$active_project" ]] || return 0
  (cd "$active_project" && supabase stop --no-backup >"$cli_log_dir/stop.log" 2>&1) || fail 'local-stack-stop'
  docker network rm "$active_network" >/dev/null
  active_project=''
  active_network=''
  db_container=''
}

db_psql() {
  docker exec -i "$db_container" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

apply_local_migrations() {
  (cd "$active_project" && supabase migration up --local --include-all --yes >"$cli_log_dir/migration-up.log" 2>&1) || fail "$stage-migration-up"
}

copy_sql_from_commit() {
  local commit="$1" source_path="$2" target_name="$3"
  git show "$commit:$source_path" >"$active_project/supabase/migrations/$target_name"
}

copy_main_history() {
  local file path
  while IFS= read -r path; do
    file="${path##*/}"
    [[ "$file" == '20260721_qa_baseline_schema.sql' ]] && continue
    [[ "$file" == *.sql ]] || continue
    git show "$MAIN_SHA:$path" >"$active_project/supabase/migrations/$file"
  done < <(git ls-tree -r --name-only "$MAIN_SHA" -- supabase/migrations)
}

copy_v3_files() {
  local files=("$@") file
  for file in "${files[@]}"; do
    copy_sql_from_commit "$V3_SHA" "supabase/migrations/$file" "$file"
  done
}

load_bootstrap() {
  if grep -Eiq '^[[:space:]]*(COPY[[:space:]]+public\.|INSERT[[:space:]]+INTO[[:space:]]+public\.)' "$baseline"; then
    fail 'bootstrap-contains-business-rows'
  fi
  db_psql -f "$baseline" >"$cli_log_dir/bootstrap.log" 2>&1 || fail 'bootstrap-apply'
}

storage_fingerprint() {
  db_psql -At -c "
    SELECT md5(coalesce(string_agg(item, E'\\n' ORDER BY item), ''))
    FROM (
      SELECT 'policy|' || policyname || '|' || cmd || '|' || permissive || '|' ||
             array_to_string(roles, ',') || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '') AS item
        FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      UNION ALL
      SELECT 'acl|' || c.relname || '|' || r.rolname || '|' || a.privilege_type || '|' || a.is_grantable
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
        JOIN pg_roles r ON r.oid = a.grantee
       WHERE n.nspname = 'storage' AND c.relname IN ('objects', 'buckets')
    ) storage_contract;
  "
}

assert_rpc_acl() {
  db_psql -v ON_ERROR_STOP=1 <<'SQL' >"$cli_log_dir/rpc-acl.log" 2>&1 || fail "$stage-rpc-acl"
DO $check$
DECLARE
  signature text;
  target regprocedure;
  count_found integer := 0;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.debug_run_authorized_invoice_batch()',
    'public.run_authorized_invoice_batch()',
    'public.n21_assert_existing_job_quote_compatibility()',
    'public.rls_auto_enable()'
  ] LOOP
    target := to_regprocedure(signature);
    IF target IS NULL THEN RAISE EXCEPTION 'required_rpc_missing'; END IF;
    count_found := count_found + 1;
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = target::oid) THEN
      RAISE EXCEPTION 'required_rpc_not_security_definer';
    END IF;
    IF has_function_privilege('anon', target, 'EXECUTE')
       OR has_function_privilege('authenticated', target, 'EXECUTE')
       OR has_function_privilege('service_role', target, 'EXECUTE') THEN
      RAISE EXCEPTION 'privileged_rpc_acl_not_revoked';
    END IF;
  END LOOP;
  IF count_found <> 4 THEN RAISE EXCEPTION 'required_rpc_count_mismatch'; END IF;
END;
$check$;
SQL
}

assert_n56_storage_policy_contract() {
  db_psql -v ON_ERROR_STOP=1 <<'SQL' >"$cli_log_dir/n56-storage-policy-contract.log" 2>&1 || fail 'n56-storage-policy-contract'
DO $check$
DECLARE
  policy_name text;
  policy_command text;
  policy_roles name[];
  policy_mode text;
  policy_predicate text;
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname IN (
         'Internal staff read expense receipts',
         'Internal staff upload expense receipts',
         'Internal staff update expense receipts',
         'Internal staff delete expense receipts'
       )) <> 4 THEN
    RAISE EXCEPTION 'n56_storage_policy_count_mismatch';
  END IF;

  FOR policy_name, policy_command IN
    SELECT * FROM (VALUES
      ('Internal staff read expense receipts', 'SELECT'),
      ('Internal staff upload expense receipts', 'INSERT'),
      ('Internal staff update expense receipts', 'UPDATE'),
      ('Internal staff delete expense receipts', 'DELETE')
    ) AS expected(name, command)
  LOOP
    SELECT roles, permissive, coalesce(qual, '') || ' ' || coalesce(with_check, '')
      INTO policy_roles, policy_mode, policy_predicate
      FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = policy_name AND cmd = policy_command;
    IF NOT FOUND OR policy_mode <> 'PERMISSIVE'
       OR cardinality(policy_roles) <> 1 OR NOT ('authenticated' = ANY(policy_roles))
       OR policy_predicate NOT ILIKE '%expense-receipts%'
       OR policy_predicate NOT ILIKE '%is_active_internal_staff%'
       OR policy_predicate NOT LIKE '%!~%' THEN
      RAISE EXCEPTION 'n56_storage_policy_contract_mismatch';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname IN (
         'Allow authenticated read expense receipts',
         'Allow authenticated upload expense receipts',
         'Allow authenticated update expense receipts',
         'Allow authenticated delete expense receipts'
       )
  ) THEN
    RAISE EXCEPTION 'n56_legacy_receipt_policy_remains';
  END IF;
END;
$check$;
SQL
}

run_matrix() {
  local run_id="$1"
  db_psql -v project_ref=costa-clean-app -v run_id="$run_id" -f "$tmp_root/p0_expenses_security_matrix.sql" >"$cli_log_dir/p0-matrix.log" 2>&1 || fail "$stage-p0-matrix"
  local rollback_status
  db_psql -At -v run_id="$run_id" >"$cli_log_dir/rollback-postcheck.log" 2>&1 <<'SQL' || fail "$stage-p0-rollback-postcheck-query"
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM public.expenses WHERE description LIKE :'run_id' || '%')
              AND NOT EXISTS (SELECT 1 FROM auth.users WHERE email LIKE lower(:'run_id') || '-%@example.invalid')
            THEN 'PASS' ELSE 'FAIL' END;
SQL
  rollback_status="$(tr -d '\r\n' <"$cli_log_dir/rollback-postcheck.log")"
  [[ "$rollback_status" == 'PASS' ]] || fail "$stage-p0-rollback-persisted-fixture"
}

run_transition() {
  local phase="$1"
  local run_id="P0T-${phase^^}-A1B2C3D4"
  stage="transition-$phase"
  db_psql -v phase="$phase" -v run_id="$run_id" -f "$transition_sql" >"$cli_log_dir/transition-$phase.log" 2>&1 || fail "transition-$phase-security"
  local rollback_status
  db_psql -At -v run_id="$run_id" >"$cli_log_dir/transition-rollback-postcheck.log" 2>&1 <<'SQL' || fail "transition-$phase-rollback-postcheck-query"
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM public.expenses WHERE description LIKE :'run_id' || '%')
              AND NOT EXISTS (SELECT 1 FROM auth.users WHERE email LIKE lower(:'run_id') || '-%@example.invalid')
            THEN 'PASS' ELSE 'FAIL' END;
SQL
  rollback_status="$(tr -d '\r\n' <"$cli_log_dir/transition-rollback-postcheck.log")"
  [[ "$rollback_status" == 'PASS' ]] || fail "transition-$phase-rollback-persisted-fixture"
  printf 'TRANSITION_SECURITY_%s=PASS_REAL_SYNTHETIC\n' "${phase^^}"
}

stage='prepare-p0-source'
git show "$P0_SHA:supabase/migrations/$P0_FILE" >"$tmp_root/$P0_FILE"
git show "$P0_SHA:supabase/qa/p0_expenses_security_matrix.sql" >"$tmp_root/p0_expenses_security_matrix.sql"
[[ "$(sha256_file "$tmp_root/$P0_FILE")" == "$P0_SHA256" ]] || fail 'p0-hash'
[[ "$(sha256_file "$tmp_root/p0_expenses_security_matrix.sql")" == "$MATRIX_SHA256" ]] || fail 'matrix-hash'

stage='p0-independent-synthetic'
setup_project 'costa-clean-sql-p0'
load_bootstrap
copy_main_history
apply_local_migrations
copy_v3_files "${equivalent_files[@]}"
apply_local_migrations
rpc_storage_before="$(storage_fingerprint)"
cp "$tmp_root/$P0_FILE" "$active_project/supabase/migrations/$P0_FILE"
apply_local_migrations
rpc_storage_after="$(storage_fingerprint)"
[[ "$rpc_storage_before" == "$rpc_storage_after" ]] || fail 'p0-changed-storage-catalog-or-acl'
assert_rpc_acl
run_matrix 'P0-AB12CD34'
printf 'P0_SQL_TEST=PASS_REAL_SYNTHETIC\nP0_STORAGE_UNCHANGED=PASS\nRPC_ACL=PASS_REAL_SYNTHETIC\nROLLBACK_TEST=PASS_REAL_SYNTHETIC\n'
stop_project

stage='v3-compat-chain-synthetic'
setup_project 'costa-clean-sql-v3'
load_bootstrap
copy_main_history
apply_local_migrations
copy_v3_files "${equivalent_files[@]}"
copy_v3_files "${pre_n56_pending[@]}"
apply_local_migrations

cp "$compat_dir/$GUARD_FILE" "$active_project/supabase/migrations/$GUARD_FILE"
apply_local_migrations
run_transition guard

copy_v3_files "$N56_FILE"
apply_local_migrations
run_transition n56
assert_n56_storage_policy_contract

copy_v3_files "$GRANT_FILE"
apply_local_migrations
run_transition grants

cp "$compat_dir/$RECONCILE_FILE" "$active_project/supabase/migrations/$RECONCILE_FILE"
apply_local_migrations
run_transition reconciled
storage_before_p0="$(storage_fingerprint)"

cp "$tmp_root/$P0_FILE" "$active_project/supabase/migrations/$P0_FILE"
apply_local_migrations
storage_after_p0="$(storage_fingerprint)"
[[ "$storage_before_p0" == "$storage_after_p0" ]] || fail 'p0-changed-v3-storage-catalog-or-acl'
assert_rpc_acl
cp "$tmp_root/p0_expenses_security_matrix.sql" "$active_project/supabase/qa/p0_expenses_security_matrix.sql"
stage='v3-final-p0-matrix'
run_matrix 'P0-DC34EF56'

printf 'V3_SQL_TEST=INCOMPLETE_PRESTATE\nV3_CHAIN_EXECUTION=PASS_REAL_SYNTHETIC\nV3_STORAGE_POLICY_CATALOG=PASS_REAL_SYNTHETIC\nV3_STORAGE_UNCHANGED_BY_P0=PASS_REAL_SYNTHETIC\nP0_FIRST_VARIANT=NOT_TESTED_LEDGER_ORDER_UNAPPROVED\nPRESTATE_FIDELITY=INCOMPLETE\n'
stop_project
printf 'CI_SQL_RESULT=PASS_SYNTHETIC_ONLY\n'
