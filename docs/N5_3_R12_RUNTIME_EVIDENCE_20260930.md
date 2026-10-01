# Costa Clean — N5.3 R12 runtime evidence

## Provenance

- Certification run: `N53-R12-20260930162918-bd18a6d3`
- QA project: `kpvvydthlxupjjqqdpxy`
- Application implementation SHA: `a009240adb798860cdbda95dbd3a3704adc8ccc3`
- Application branch: `codex/post-v3-n52-document-extraction`
- Edge runtime: `expense-document-normalization`, QA version 3, ACTIVE
- Execution date: 2026-09-30 (Europe/Madrid)
- Evidence scope: N5.3 runtime certification and exact QA residue cleanup only

This report is documentary evidence. It contains no credentials, tokens, browser storage, private QA profile data, or screenshots.

## Authentication and project boundary

- QA_USER_A_AUTH = PASS
- QA_USER_A_ACTIVE_INTERNAL_STAFF = PASS
- QA project pin matched `kpvvydthlxupjjqqdpxy`.
- Production project was not accessed for mutation.

## Runtime results

| Check | Result | Evidence summary |
|---|---|---|
| Fresh extraction success | PASS | HTTP 200; attempt 1 |
| Fresh normalization success | PASS | HTTP 200; attempt 1 |
| Idempotent normalization reuse | PASS | Same normalization attempt reused |
| First-claim concurrency | PASS | Two simultaneous requests; one effective normalization |
| Unexpected HTTP 500 | 0 | No unexpected runtime 500s |
| Active normalization duplicates | 0 | No active duplicate normalizations |
| Valid VAT arithmetic | PASS | VAT lines reconciled; reconciliationStatus = MATCH |
| Invalid provider response | PASS | Extraction failed with INVALID_PROVIDER_RESPONSE |
| Runtime guard order | PASS | Source/regression evidence |
| Schema version guard | PASS | Focused contract/runtime evidence for unsupported v2 |
| Cross-user certification | PREVIOUS_CERTIFICATION_ACCEPTED | Prior accepted cross-user result |
| A/B data leak | NO | No cross-user data exposure observed |
| Financial writes | 0 | No financial rows created or changed |

The deployed fixture supplies the valid VAT proposal. Negative VAT arithmetic and unsupported schema v2 were verified by focused runtime/contract tests; no direct database mutation was used to manufacture malformed live rows.

## Exact R12 fixture manifest

### Sessions

- `113e8869-36f3-4a84-8208-82e2f24f8388`
- `f7729f87-a33f-43b6-a0b9-5470f17b08d3`
- `cb43867f-8b5a-43d0-851b-3be03cdd35eb`
- `495077db-0536-4d08-a7d3-3605bd733784`

### Documents

- `af3d2c82-acb4-4ac5-81ad-07059f089e60`
- `e6811ba3-d332-4bd3-b56c-9297a2c2efc1`
- `e8b2a679-f05d-4575-b5bf-312eb4713d71`
- `fc6985d4-fe6c-470a-95d6-757558be9a9a`

### Extractions

- `bc5c9bff-ca6c-4bb1-aac9-4528e302210f`
- `3eea28e0-6bbe-48a1-b3c1-baa99fda4ab1`
- `0611a667-8927-4ce2-920a-de52f3d34d44`
- `479b0e70-5eab-45ae-95e3-609eeede6d5a`

### Normalizations

- `a2e155a5-9d82-4ae4-af03-a5b6835bb021`
- `a57900d5-62dd-4d7b-b960-011919d2e8de`
- `3de71025-0b5b-4dcb-b88e-6788c5250627`

The last extraction failed with `INVALID_PROVIDER_RESPONSE`; no successful proposal was persisted for that fixture. The concurrent fixture produced one effective normalization. Repeated normalization reused the existing successful normalization and did not create an active duplicate.

## Storage

Four exact capture objects were removed through the authenticated Supabase Storage API, and each exact path was verified absent with HTTP 404. No direct `storage.objects` delete was used. The `.emptyFolderPlaceholder` object was not touched.

## Database cleanup evidence

- Exact cleanup was executed through the QA Supabase SQL Editor after explicit human confirmation.
- One transaction, in dependency-safe order: 3 normalizations, 4 extractions, 4 documents, 4 sessions.
- Each delete used an explicit ID list containing only the IDs in this report.
- Row guards required exact counts of 3/4/4/4; a mismatch would raise and roll back.
- Committed result: sessions=0, documents=0, extractions=0, normalizations=0.
- Financial baseline remained expenses=1, invoices=9, payments=0.

Gates:

- DB_CLEANUP = PASS
- QA final capture baseline = 0/0/0/0
- Financial baseline = PASS
- Storage cleanup = PASS

## Repository checks

At the implementation SHA, the worktree was clean before and after runtime/cleanup.

- Focused N5.3 tests: 39/39 PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- Code changes from runtime/cleanup: 0
- New application commits from runtime/cleanup: 0
- Migrations: 0
- Edge deploys in this run: 0
- Production mutations: 0

This evidence commit is documentation-only and does not change application runtime behavior, schema, routes, auth, or financial logic.
