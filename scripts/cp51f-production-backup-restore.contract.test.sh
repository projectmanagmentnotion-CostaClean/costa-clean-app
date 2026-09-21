#!/usr/bin/env bash
set -Eeuo pipefail

WORKFLOW=".github/workflows/cp51f-production-backup-restore.yml"
RESTORE="scripts/cp51f-restore-verify.sh"
[[ -f "$WORKFLOW" && -f "$RESTORE" ]] || { printf 'CONTRACT_TEST=FAIL\n' >&2; exit 1; }

contains() { grep -Fq -- "$1" "$2"; }
not_contains() { ! grep -Fq -- "$1" "$2"; }
line_of() { grep -nF -- "$1" "$WORKFLOW" | head -n1 | cut -d: -f1; }

contains "tags:" "$WORKFLOW"
contains "cp51f-run-*" "$WORKFLOW"
not_contains "pull_request:" "$WORKFLOW"
not_contains "schedule:" "$WORKFLOW"
not_contains "workflow_dispatch:" "$WORKFLOW"
contains "contents: read" "$WORKFLOW"
contains "group: cp51f-production-backup-restore" "$WORKFLOW"
contains "cancel-in-progress: false" "$WORKFLOW"
contains "timeout-minutes: 30" "$WORKFLOW"
contains "CP51F_EXECUTION_ARMED" "$WORKFLOW"
contains "CP51F_EXPECTED_EXECUTION_SHA" "$WORKFLOW"
contains "projectmanagmentnotion-CostaClean/costa-clean-app" "$WORKFLOW"
contains 'GITHUB_SHA' "$WORKFLOW"
contains 'CP51F_BACKUP_AGE_RECIPIENT' "$WORKFLOW"
contains 'SUPABASE_CP51F_TEMP_PAT' "$WORKFLOW"
not_contains 'inputs:' "$WORKFLOW"
contains 'scripts/cp51f-production-backup-setup.sh' "$WORKFLOW"
contains 'CP51F_SETUP_RESULT=AWAITING_PAT_REVOCATION' "$WORKFLOW"
contains 'scripts/cp51f-restore-verify.sh' "$WORKFLOW"
contains 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02' "$WORKFLOW"
contains 'retention-days: 7' "$WORKFLOW"
contains '.tar.gz.age' "$WORKFLOW"
not_contains 'set -x' "$WORKFLOW"
not_contains 'printenv' "$WORKFLOW"
not_contains 'GITHUB_ENV' "$WORKFLOW"
contains 'CP51F_BACKUP_RESTORE_VERIFIED_AWAITING_PAT_REVOCATION' "$WORKFLOW"
not_contains 'CP51F_COMPLETE' "$WORKFLOW"
not_contains 'Authorization B' "$WORKFLOW"
not_contains 'supabase db push' "$WORKFLOW"
not_contains 'migration repair' "$WORKFLOW"
contains 'roles.sql schema.sql data.sql history_schema.sql history_data.sql manifest.json restore-verification.json' "$WORKFLOW"
contains 'PG_BIN_DIR: /usr/lib/postgresql/17/bin' "$WORKFLOW"
contains 'listen_addresses' "$RESTORE"
contains 'unix_socket_directories' "$RESTORE"
contains 'STOP_BACKUP_INTEGRITY_FAILURE' "$RESTORE"
contains 'CP51F_RESTORE_ERROR:' "$RESTORE"
contains 'CP51F_RESTORE_RESULT=PASS' "$RESTORE"

arming_line="$(line_of 'CP51F_ARMING_GATE=PASS')"
pat_line="$(line_of 'SUPABASE_CP51F_TEMP_PAT:')"
[[ -n "$arming_line" && -n "$pat_line" && "$arming_line" -lt "$pat_line" ]] || { printf 'CONTRACT_TEST=FAIL: arming gate ordering\n' >&2; exit 1; }

printf 'CP51F_WORKFLOW_CONTRACT=PASS\n'
