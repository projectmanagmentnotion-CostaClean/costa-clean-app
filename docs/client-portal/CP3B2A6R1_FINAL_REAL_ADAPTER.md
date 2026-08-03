# CP-3B.2A.6R.1 Final Real PostgreSQL Adapter

Status: prepared, not authorized.

This document closes the V6R1 package closeout for the client-portal reviewed
change contract. It records the current package boundary only; it does not
authorize QA execution, production work, or any legal approval.

## Scope

- Preserve the frozen migration contract at
  `supabase/migrations/20260728160000_portal_reviewed_change_contract.sql`.
- Keep the package on Git branch `main` with the exact QA ref
  `kpvvydthlxupjjqqdpxy` and reject production ref `wfxnwfcdjainpojhbdri`.
- Keep `--execute` blocked until a future exact human authorization is issued.
- Keep all private backup evidence ignored and untracked.

## V6R1 closeout points

- The package revision is `V6R1`.
- The historical `sourceBaseHead` remains the gate start commit
  `79a83b42cd739e4a952f0a3eac61729600949766`.
- The preflight/backup path records the observed HEAD at runtime.
- Optional missing columns are handled safely in the SQL snapshot contract.
- The local proof remains read-only and private.

## Non-goals

- No QA apply.
- No `--execute`.
- No schema mutation.
- No production or WordPress/SiteGround changes.

