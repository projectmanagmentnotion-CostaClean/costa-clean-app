# Storage P0 and V1 unblock record — 2026-11-26

## QA compatibility

The Production-only migration does not need to be applied to QA. QA's N51
`captures/<session-id>/...` policies and `public.expense_capture_sessions`
contract are separate from the verified Production schema; applying this
migration to QA would intersect with its restrictive Storage policies. QA and
Production were not modified.

The local proof applies the exact Production P0 SQL to a disposable PostgreSQL
17 schema matching the Production contracts. It intentionally excludes N51
capture tables and policies. The P0 migration is unchanged at SHA-256
`F9CBF05254FEE66C727BC3841B25B4026C6628D6378F2C841DCFD4A23A2D9892`.

The role matrix covers owner, finance, admin, operator, readonly, authenticated
non-member, anon, restrictive-policy resistance and unrelated-bucket isolation.
The replacement cases cover successful cleanup of a canonical previous file
and fail-closed behavior for a noncanonical legacy file after its pointer has
moved. That legacy file remains inaccessible; the UI reports cleanup separately
from the successful new pointer.

Evidence: focused Vitest `expenseAttachmentsApi.test.ts` and
`expenseReceiptWorkflow.test.ts` passed `10/10`; the local PostgreSQL proof
printed `STORAGE_P0_SECURITY_TESTS=PASS`, including both replacement markers;
`npm run lint` and `npm run build` passed. The production migration file has no
diff from the V1 base and retains the SHA-256 above.

## P0 approval path

The current session exposes no general `/approve` command or approval-only
Supabase action. The Supabase connector exposes `apply_migration` and
`execute_sql`, which execute database operations; no support-ticket creation
tool is exposed either. No remote DDL was attempted in this work block.

The prior rejection's exact response text or request/correlation ID is not
present in the committed V1 evidence. The exact current impediment is that this
session has no owner-approval handoff channel; the available database tools
would execute the change rather than prepare an approval-only request. Do not
invent a rejection reason or retry the DDL.

### Draft support request — not sent

**Subject:** Official owner-approval path required for Costa Clean Storage P0

Please identify or enable the official owner-approval process for this exact
operation. The current Codex session does not expose `/approve` or an
approval-only Supabase action; its available database actions execute SQL or
apply migrations. No operation should be executed while this approval path is
unavailable.

- Target: Costa Clean Production, Supabase ref `wfxnwfcdjainpojhbdri`.
- Operation: apply exactly
  `supabase/migrations/20261125164758_secure_expense_receipt_storage_p0.sql`.
- SHA-256: `F9CBF05254FEE66C727BC3841B25B4026C6628D6378F2C841DCFD4A23A2D9892`.
- Effect: replace broad bucket-only `expense-receipts` access with the reviewed
  staff/financial-role policies and restrictive guards in one transaction.
- Exclusions: no QA apply, `db push`, migration-history repair, Storage object
  writes, bucket changes, Auth/data changes, deployment or unrelated policy
  edits.
- Preconditions: owner approval for this exact target and migration, fresh
  recoverable database backup, independent Storage-object recovery evidence,
  and live prestate verification per `expense_receipt_p0_runbook.md`.
- Recovery: transaction rollback before commit; after commit, keep restrictive
  guards and use a separately reviewed forward fix if needed.

The V1 evidence does not preserve the prior rejection response or correlation
ID. If support needs that external event, the owner must supply its reference;
this draft does not guess it.

## Preview V1 status

The November 3 rejection is a separate operation and does not block Preview V1.
The release candidate is the local branch `codex/v1-unlock-prep-20261126`,
based on `codex/v1-integration-prep-20261125` at `1a67bcc`. This work block
prepares the candidate and its evidence for owner authorization. It does not
push a branch or create a Vercel deployment.

### Draft Preview V1 authorization — not submitted

Authorize the official Vercel **Preview** deployment for branch
`codex/v1-unlock-prep-20261126`, using its reviewed local commit. Keep it on the
Preview URL; do not assign a Production alias or change `main`. This deployment
contains no Supabase migration or remote database effect. Approval must name
the exact commit SHA shown by Git immediately before execution. No push or
deployment has been performed.

## Owner action and next production step

1. Submit the draft support request through the organization's official
   owner/support channel and obtain the exact approval procedure.
2. Separately approve the Preview V1 release artifact and its official
   deployment target once the local commit and checks are recorded.
3. For Production, inspect the latest backup's restore availability, prove
   Storage recovery independently, recheck the target and migration hash, then
   obtain explicit owner authorization for the one migration above.
4. Only after that authorization, run the single reviewed apply and its
   postchecks. Do not use QA as a substitute target.
