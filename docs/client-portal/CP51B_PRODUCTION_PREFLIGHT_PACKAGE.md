# CP-5.1B — Zero-Mutation Production Preflight Package

**Status:** `PREPARED / EXECUTION REQUIRES SEPARATE EXACT AUTHORIZATION`  
**Runtime candidate:** `7870ae4408ab7af0c944b149d2c75a70b8421e65`  
**Source manifest:** `docs/client-portal/CP51A_RELEASE_CANDIDATE_MANIFEST.md`  
**Expected QA ref:** `kpvvydthlxupjjqqdpxy`  
**Expected production ref:** `wfxnwfcdjainpojhbdri`  
**Mutation budget for CP-5.1B execution:** `0`

The production ref above is the repository-declared expected target. It is not considered proven merely because it appears in this file. A future authorized preflight must re-prove target identity from live read-only evidence and reject QA, unknown or conflicting targets.

## 1. Purpose

CP-5.1B defines the exact read-only preflight that must run before any production-affecting release authorization can be considered.

This package does not access production by itself.

It must fail closed if:

- live target identity cannot be proven;
- candidate hashes drift;
- a required private backup cannot be created/verified;
- production prestate is incompatible;
- secret/config presence cannot be proven privately;
- rollback ownership is missing;
- monitoring is not ready;
- P0/P1 is open or unknown;
- the planned action requires `db push`, migration repair or history manipulation.

## 2. Hard separation of environments

Expected identities:

- QA: `kpvvydthlxupjjqqdpxy`
- production: `wfxnwfcdjainpojhbdri`

A future preflight must explicitly reject:

- QA when production is expected;
- production when QA is expected;
- any third/unknown ref;
- a mixed state where public config, provider metadata and database session disagree.

No target identity may be inferred from a branch name, local directory, CLI link alone or a single environment variable.

## 3. Stage 0 — Local/source pin verification

Remote access: `0`.

Required checks:

1. current runtime candidate equals `7870ae4408ab7af0c944b149d2c75a70b8421e65`;
2. canonical migration blob equals `c7c686769160d987c3721721a589dae1eae0dced`;
3. worker source blob equals `9c71589dc45e360231e4765c54e087ac27bdd164`;
4. accepted QA worker artifact SHA-256 equals `bd309b300e1bbe20532d70ea4a5c1c6d33704b4507307e8a761729794c39d3d6`;
5. all identities in `CP51A_RELEASE_CANDIDATE_MANIFEST.md` still match;
6. `docs/DB_PUSH_LOCK.md` remains active;
7. no unreviewed runtime commit has entered the candidate.

Failure result: `STOP_CANDIDATE_DRIFT`.

## 4. Stage 1 — Exact production identity proof

Requires: separate authorization for read-only production access.

Allowed operations: read-only identity/metadata queries only.

The proof must use multiple independent sources, for example:

1. expected production project ref from the reviewed release package;
2. public application/Supabase project URL identity;
3. authenticated provider/project metadata;
4. live PostgreSQL read-only session identity/database metadata when an approved private connection exists.

Required result:

`PRODUCTION_IDENTITY_CONFIRMED`

Any mismatch result:

`STOP_TARGET_AMBIGUITY`

The evidence report must store only non-secret identifiers and safe digests. Connection strings, tokens, passwords, cookies and service-role values are forbidden from Git/output.

## 5. Stage 2 — Fresh private backup and restore ownership

Requires: separate authorization for the backup operation.

The backup must be:

- created immediately before any future mutation window;
- bound to the exact production target identity;
- private and ignored by Git;
- timestamped;
- integrity-checked;
- accompanied by a documented restore operator and recovery location;
- sufficient for the exact database objects affected by the release;
- complemented by version/rollback references for application and Edge Function artifacts.

This repository document records only safe metadata such as backup timestamp, type and a non-sensitive digest/reference. It never stores backup contents or credentials.

If no fresh verifiable backup exists:

`STOP_BACKUP_MISSING`

## 6. Stage 3 — Production prestate compatibility

Requires: separate read-only production authorization.

The preflight must prove the current production state is compatible with the canonical forward-only migration without applying it.

At minimum inspect:

- portal baseline relations/functions required by the migration;
- presence/absence and shape of delivery outbox/payload tables;
- RLS/FORCE RLS state;
- current grants;
- current invitation-status trigger state;
- current trusted RPC definitions or absence;
- current `client_portal_audit_events_event_type_check`;
- existing audit data compatibility;
- `pg_cron` extension availability;
- cleanup cron job count, schedule, command and active state;
- absence of conflicting QA-only/certifier scaffolding in the planned production contract.

Required result:

`PRESTATE_COMPATIBLE`

Any incompatible or unexpected object:

`STOP_PRESTATE_DRIFT`

No repair is permitted inside this preflight.

## 7. Stage 4 — Private configuration/secret-presence audit

Requires: approved private environment access.

Verify presence and environment scoping without exposing values.

Expected server-only configuration families include the production equivalents required by the trusted delivery path, including:

- transactional email provider selection;
- provider API credential;
- sender identity;
- optional reply-to identity where configured;
- invitation payload encryption key and key version;
- worker authentication secret;
- canonical production invitation-accept URL;
- Supabase service-role/server configuration used by the worker.

Production must not reuse the QA-only allowlist/sandbox contract accidentally.

A value is never printed, copied into chat, committed or stored in the readiness report.

Missing/mis-scoped configuration:

`STOP_CONFIGURATION_INCOMPLETE`

## 8. Stage 5 — Provider and legal/operational facts

Before release authorization, confirm:

- Brevo remains the approved transactional provider for this purpose;
- sender/domain ownership is verified for the intended production sender;
- processor/DPA/region/transfer facts are current where applicable;
- privacy/retention documentation still matches the encrypted-payload lifecycle;
- real-email delivery, if later requested, is explicitly included in the production authorization rather than inferred from QA sandbox evidence;
- support and incident/breach ownership are named.

Unresolved material provider/legal fact:

`STOP_PROVIDER_OR_LEGAL_READINESS`

## 9. Stage 6 — Observability package

Before production execution, define and verify the ability to observe at minimum:

- worker invocation success/failure rate;
- provider acceptance/failure class;
- `retry_scheduled`, `blocked`, `terminal_failed` and `provider_accepted` state counts;
- stale leases;
- encrypted payloads approaching/over expiry;
- cleanup cron health;
- invitation audit events;
- function/runtime errors;
- authentication/access anomalies around invitation acceptance.

Logs/alerts must remain redacted:

- no raw invitation token;
- no provider credential;
- no encryption key;
- no service-role credential;
- no full private backup data;
- no unnecessary recipient PII in operational alerts.

The readiness record must define:

- alert destination;
- release observer;
- incident owner;
- rollback owner;
- observation window;
- thresholds that stop/rollback CP-5.2.

Missing ownership or alert visibility:

`STOP_OBSERVABILITY_NOT_READY`

## 10. Stage 7 — Fresh P0/P1 and boundary revalidation

Historical P0/P1 = 0 is not enough for this release candidate.

Fresh release-candidate review must cover:

- invite-only boundary;
- public self-registration remains disabled;
- client isolation;
- membership/revocation behavior;
- private invoice-document access boundary;
- token secrecy;
- encrypted-payload lifecycle;
- service-role-only worker/RPC boundary;
- provider retry/idempotency ambiguity handling;
- secret/log redaction;
- no portal path to invoice/payment/numbering/fiscal mutation.

Any open or unclassified P0/P1:

`STOP_SECURITY_RELEASE_BLOCKER`

## 11. Stage 8 — Expected release delta declaration

CP-5.1 must document the exact later CP-5.2 delta before authorizing it.

Potential release components represented by the current candidate include:

- client-portal invitation acceptance frontend/runtime;
- trusted `portal-member-actions` invitation wiring;
- `portal-invitation-delivery-worker`;
- shared transactional-email/delivery modules;
- canonical CP-4.3C database reconciliation;
- production-only private environment configuration;
- provider/sender configuration required for the authorized delivery mode.

This list is descriptive, not permission to deploy.

The exact CP-5.2 authorization must state which components are actually changing relative to current production. Components already identical in production must not be redeployed merely because they appear in the candidate.

## 12. Rollback/recovery design

Before any future mutation, the release plan must assign a recovery path per layer.

### Frontend/application

- preserve prior deployed application artifact/version;
- provide exact rollback target;
- verify protected/public route behavior after rollback.

### Edge Functions

- preserve exact previously deployed function versions/artifacts;
- define independent rollback for `portal-member-actions` and the delivery worker;
- verify the worker cannot be invoked unexpectedly after rollback.

### Database

The canonical migration is forward-only and has no embedded inverse rollback.

Therefore:

- do not improvise inverse SQL during an incident;
- rely on the reviewed backup/restore or a separately reviewed corrective migration according to the failure mode;
- define RTO/decision threshold before execution;
- validate data/security invariants after recovery.

### Configuration/provider

- preserve prior safe configuration state privately;
- define how delivery is disabled safely if provider/config verification fails;
- do not rotate or delete secrets as an improvised rollback unless explicitly planned.

## 13. Synthetic validation design

CP-5.1 can design, but not execute, the production smoke.

Future CP-5.2 smoke must use only authorized synthetic/designated pilot identities and prove:

- invite creation through the trusted path;
- invitation acceptance;
- revoked/expired/replay denial;
- cross-client denial;
- private document access controls;
- request submission without automatic job/invoice/payment creation;
- no financial/fiscal/numbering drift;
- expected audit/observability events;
- exact cleanup where synthetic fixtures are used.

No real customer is implicitly enrolled by CP-5.1.

## 14. Exact authorization template for a future read-only CP-5.1 execution

A valid authorization should name all of the following:

> Authorize CP-5.1 production-readiness **read-only preflight** against expected production ref `wfxnwfcdjainpojhbdri` for runtime candidate `7870ae4408ab7af0c944b149d2c75a70b8421e65` and canonical migration blob `c7c686769160d987c3721721a589dae1eae0dced`. Allowed actions are production identity verification, read-only prestate inspection, private configuration-presence verification, and preparation/verification of a fresh private backup if separately included. No migration apply, function deployment, frontend deployment, DNS change, secret rotation, email send, Auth mutation, customer invitation, financial/fiscal write, migration-history write or `db push` is authorized. Stop on any target/hash/prestate/backup/config ambiguity.

If backup creation itself is considered a production-affecting action by the available provider/tool, it requires an explicit inclusion in the authorization rather than being inferred.

## 15. Separate authorization still required for CP-5.2

Even a fully passing CP-5.1 read-only preflight does not authorize:

- migration apply;
- function deployment;
- frontend deployment;
- production configuration mutation;
- real email delivery;
- pilot invitations;
- production smoke writes.

Those belong to a later exact CP-5.2 authorization after CP-5.1 is independently reviewed and closed.

## 16. Current disposition

`CP51B_PACKAGE_PREPARED / ZERO_REMOTE_ACTIONS`

Next safe steps:

1. independent review of CP-5.1A and CP-5.1B;
2. normal repository validation for the documentation PR;
3. only then, if the owner chooses, an exact authorization for the read-only production preflight.

No production or QA access was required to prepare this package.
