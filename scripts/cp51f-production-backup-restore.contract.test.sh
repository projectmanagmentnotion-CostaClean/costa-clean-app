#!/usr/bin/env bash
set -Eeuo pipefail

WORKFLOW=".github/workflows/cp51f-production-backup-restore.yml"
RESTORE="scripts/cp51f-restore-verify.sh"
BOOTSTRAP="scripts/cp51f-bootstrap-postgres17.sh"
SMOKE=".github/workflows/cp51f-executor-smoke.yml"
[[ -f "$WORKFLOW" && -f "$RESTORE" && -f "$BOOTSTRAP" && -f "$SMOKE" ]] || { printf 'CONTRACT_TEST=FAIL\n' >&2; exit 1; }

contains() { grep -Fq -- "$1" "$2"; }
not_contains() { ! grep -Fq -- "$1" "$2"; }
line_of() { grep -nF -- "$1" "$WORKFLOW" | head -n1 | cut -d: -f1; }

contains "tags:" "$WORKFLOW"
contains "cp51f-run-*" "$WORKFLOW"
not_contains "pull_request:" "$WORKFLOW"
not_contains "schedule:" "$WORKFLOW"
not_contains "workflow_dispatch:" "$WORKFLOW"
contains "contents: read" "$WORKFLOW"
contains "actions: read" "$WORKFLOW"
not_contains "actions: write" "$WORKFLOW"
contains "group: cp51f-production-backup-restore" "$WORKFLOW"
contains "cancel-in-progress: false" "$WORKFLOW"
contains "timeout-minutes: 30" "$WORKFLOW"
contains "CP51F_EXECUTION_ARMED" "$WORKFLOW"
contains "CP51F_EXPECTED_EXECUTION_SHA" "$WORKFLOW"
contains "CP51F_EXPECTED_EXECUTION_TAG" "$WORKFLOW"
contains "projectmanagmentnotion-CostaClean/costa-clean-app" "$WORKFLOW"
contains 'GITHUB_SHA' "$WORKFLOW"
contains 'GITHUB_REF_NAME' "$WORKFLOW"
contains 'GITHUB_RUN_ATTEMPT' "$WORKFLOW"
contains 'GITHUB_EVENT_NAME' "$WORKFLOW"
contains '.created // false' "$WORKFLOW"
contains '.forced // false' "$WORKFLOW"
contains '^cp51f-run-[0-9a-f]{32}$' "$WORKFLOW"
contains 'CP51F_BACKUP_AGE_RECIPIENT' "$WORKFLOW"
contains 'scripts/cp51f-bootstrap-postgres17.sh' "$WORKFLOW"
contains 'scripts/cp51f-bootstrap-postgres17.sh' "$SMOKE"
contains 'shellcheck scripts/cp51f-bootstrap-postgres17.sh' "$SMOKE"
contains 'ID:-' "$BOOTSTRAP"
contains 'ubuntu' "$BOOTSTRAP"
contains 'VERSION_ID:-' "$BOOTSTRAP"
contains '24.04' "$BOOTSTRAP"
contains 'noble-pgdg main' "$BOOTSTRAP"
contains 'ACCC4CF8.asc' "$BOOTSTRAP"
contains 'postgresql-17 postgresql-client-17' "$BOOTSTRAP"
contains 'PG_BIN_DIR=/usr/lib/postgresql/17/bin' "$BOOTSTRAP"
contains 'REQUIRED_TOOLS=(pg_dump pg_dumpall psql initdb pg_ctl)' "$BOOTSTRAP"
not_contains 'postgresql-16' "$BOOTSTRAP"
not_contains 'apt-get install -y --no-install-recommends age jq postgresql-client-17 postgresql-17' "$WORKFLOW"
contains 'SUPABASE_CP51F_TEMP_PAT' "$WORKFLOW"
not_contains 'inputs:' "$WORKFLOW"
contains 'scripts/cp51f-production-backup-setup.sh' "$WORKFLOW"
contains 'actions/artifacts?name=' "$WORKFLOW"
contains 'STOP_ONE_SHOT_AUTHORIZATION_ALREADY_CONSUMED' "$WORKFLOW"
contains 'cp51f-auth-consumed-' "$WORKFLOW"
contains 'retention-days: 90' "$WORKFLOW"
contains 'CP51F_SETUP_RESULT=AWAITING_PAT_REVOCATION' "$WORKFLOW"
contains 'scripts/cp51f-restore-verify.sh' "$WORKFLOW"
contains 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02' "$WORKFLOW"
contains 'retention-days: 7' "$WORKFLOW"
contains '.tar.gz.age' "$WORKFLOW"
not_contains 'set -x' "$WORKFLOW"
not_contains 'printenv' "$WORKFLOW"
not_contains 'GITHUB_ENV' "$WORKFLOW"
contains 'CP51F_BACKUP_RESTORE_VERIFIED_AWAITING_PAT_REVOCATION' "$WORKFLOW"
contains 'STOP_PRE_RELEASE_MIGRATION_STATE_CHANGED' "$WORKFLOW"
not_contains 'CP51F_COMPLETE' "$WORKFLOW"
not_contains 'Authorization B' "$WORKFLOW"
not_contains 'supabase db push' "$WORKFLOW"
not_contains 'migration repair' "$WORKFLOW"
contains 'roles.sql schema.sql data.sql history_schema.sql history_data.sql manifest.json restore-verification.json' "$WORKFLOW"
contains 'PG_BIN_DIR: /usr/lib/postgresql/17/bin' "$WORKFLOW"
contains "-h '' -k \$PGSOCKET" "$RESTORE"
contains 'STOP_BACKUP_INTEGRITY_FAILURE' "$RESTORE"
contains 'CP51F_RESTORE_ERROR:' "$RESTORE"
contains 'CP51F_RESTORE_RESULT=PASS' "$RESTORE"
contains '20260918155431' "$RESTORE"
contains 'cp43_canonical_state_reconciliation' "$RESTORE"
contains 'VERSION_NAME_MISMATCH' "$RESTORE"
contains 'cp43_migration_ledger_state' "$RESTORE"

arming_line="$(line_of 'CP51F_ONE_SHOT_GATE=PASS')"
one_shot_line="$arming_line"
marker_upload_line="$(line_of 'name: cp51f-auth-consumed-')"
bootstrap_line="$(line_of 'scripts/cp51f-bootstrap-postgres17.sh')"
pat_line="$(line_of 'SUPABASE_CP51F_TEMP_PAT:')"
[[ -n "$arming_line" && -n "$one_shot_line" && -n "$marker_upload_line" && -n "$bootstrap_line" && -n "$pat_line" && "$arming_line" -lt "$marker_upload_line" && "$marker_upload_line" -lt "$bootstrap_line" && "$bootstrap_line" -lt "$pat_line" ]] || { printf 'CONTRACT_TEST=FAIL: one-shot/bootstrap ordering\n' >&2; exit 1; }

if awk '/name: Arming and recipient gate/{active=1} /name: Install PostgreSQL 17 bootstrap/{active=0} active && /SUPABASE_CP51F_TEMP_PAT/{bad=1} END{exit bad+0}' "$WORKFLOW"; then
  :
else
  printf 'CONTRACT_TEST=FAIL: PAT appears before marker upload\n' >&2
  exit 1
fi

printf 'CP51F_WORKFLOW_CONTRACT=PASS\n'
