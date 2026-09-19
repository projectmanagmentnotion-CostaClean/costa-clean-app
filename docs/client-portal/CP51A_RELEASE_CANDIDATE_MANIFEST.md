# CP-5.1A — Release Candidate Identity and Source Review

**Status:** `SOURCE_FROZEN / REMOTE_EXECUTION_NOT_AUTHORIZED`  
**Runtime candidate commit:** `7870ae4408ab7af0c944b149d2c75a70b8421e65`  
**Gate-document commit:** `95e8f2c43cc794f8ebe232f79c82b5c48e818106`  
**QA runtime reference:** `portal-invitation-delivery-worker` V18  
**QA worker artifact SHA-256:** `bd309b300e1bbe20532d70ea4a5c1c6d33704b4507307e8a761729794c39d3d6`

This file freezes the CP-5.1A source candidate and records a source-only review. It does not prove production applicability and does not authorize a production, QA, provider, DNS, Auth or secret mutation.

## 1. Candidate rule

The executable release candidate is exactly commit:

`7870ae4408ab7af0c944b149d2c75a70b8421e65`

The CP-5.1 preflight documentation added after that commit is governance-only and does not alter the runtime candidate.

Any later runtime/source commit invalidates this manifest and requires CP-5.1A regeneration before a production gate can proceed.

PR #17 is not part of the candidate. It was closed as superseded by the canonical reconciliation already present in `7870ae4`.

## 2. Portal acceptance and runtime source identities

| Path | Git blob SHA |
|---|---|
| `src/portal/PortalApp.tsx` | `4a2d7006a4bdb9133486e410c46f8b30383aa029` |
| `src/portal/PortalInvitationAcceptance.tsx` | `128c3335936ed71142809e2f6197435845cc9cb1` |
| `src/portal/bootstrapPortal.tsx` | `28431595bdc857a25b7f6f60f382ca4dda91b8f9` |
| `src/portal/invitationAcceptance.ts` | `3daf099807c7c8ed92d5d24ac149d39ee1431c9a` |
| `src/portal/portalNavigation.ts` | `73a1684c35aa4e00fbceb91e5103a764e097b6e0` |
| `supabase/config.toml` | `c265030c1839be9b861b0ed74ba3f1f5e7889a22` |
| `supabase/functions/_shared/brevoTransactionalEmail.ts` | `8dd23bc4d657269c5bdfd9dcfccda08d4e5fbabb` |
| `supabase/functions/_shared/portalHandler.ts` | `4aad18fa9ff757e99eb09d321a34d3661d9c63ec` |
| `supabase/functions/_shared/portalInvitationDeliveryOutbox.ts` | `d20e7fa08c3045654b33a504b9fc1f4c0e83a7ef` |
| `supabase/functions/_shared/portalInvitationDeliveryPayload.ts` | `b31a8c533202b5b7835770c6b24820850327d972` |
| `supabase/functions/_shared/portalInvitationDeliverySandbox.ts` | `2768c52633a4a8e49b43cb94aaa4e85881987ca1` |
| `supabase/functions/_shared/portalInvitationDeliveryWorker.ts` | `ffce58bd0a0aa605379427b3181400db828408cb` |
| `supabase/functions/_shared/transactionalEmail.ts` | `1182431c0b5d4b545e1751dd763a4c306e9ba9d5` |
| `supabase/functions/portal-invitation-delivery-worker/index.ts` | `9c71589dc45e360231e4765c54e087ac27bdd164` |
| `supabase/functions/portal-member-actions/index.ts` | `ba1c025a401f49293ef0fdbce5b2994b81e3385e` |

## 3. Migration identities

| Path | Git blob SHA | Role |
|---|---|---|
| `supabase/migrations/20260916133605_cp43_portal_invitation_delivery_outbox.sql` | `9543d49877826eb8386ea50eefaed9ab4c2f7f22` | QA-history/source evidence |
| `supabase/migrations/20260916133654_cp43_outbox_reduce_service_role_privileges.sql` | `b3d81014db6787ec2fd562df67e938e873356196` | QA-history/source evidence |
| `supabase/migrations/20260916141036_cp43_encrypted_invitation_delivery_payload.sql` | `dff7cb50acecbd09988e09492f56ad5922502f0d` | QA-history/source evidence |
| `supabase/migrations/20260917120959_cp43_fix_delivery_payload_ciphertext_validation.sql` | `bf8f044e21eeec615acbd7416f10dfc1326d6a1d` | QA-history/source evidence |
| `supabase/migrations/20260917122537_cp43_fix_trusted_worker_role_guard.sql` | `12abfd25e9f25aba018a33db6444caf1300a4ca5` | QA-history/source evidence |
| `supabase/migrations/20260918155431_cp43_canonical_state_reconciliation.sql` | `c7c686769160d987c3721721a589dae1eae0dced` | canonical forward-only production-review candidate |

The five earlier CP-4.3C files are evidence of the QA/source chain. The canonical forward-only reconciliation is the production-review candidate. This manifest does not authorize registering, repairing, renaming or applying migration history.

## 4. Regression-test identities

| Path | Git blob SHA |
|---|---|
| `scripts/client-portal/portalHandler.test.mjs` | `30b15df56878a7f7d70782cbc0fdfdf7bb2a42dd` |
| `scripts/client-portal/portalInvitationDeliveryOutbox.test.mjs` | `fdd6dd8ccac744828a1e4288d28d0cb65212d1c9` |
| `scripts/client-portal/portalInvitationDeliverySandbox.test.mjs` | `9d628face4d2b4d2da17c5da7e5ebff9ab3385a5` |
| `scripts/client-portal/portalInvitationDeliveryWorker.test.mjs` | `c3d1c40063a5e2c13cb9d074ff7766862d485014` |
| `scripts/client-portal/transactionalEmail.test.mjs` | `eb4f03bcc669852de4aa0eabbdbaf3104c1173c8` |

These test identities freeze the regression evidence associated with the candidate. CP-5.1 still requires fresh release-candidate validation before execution.

## 5. Canonical evidence identities

| Path | Git blob SHA |
|---|---|
| `docs/portal/CP43_TRUSTED_DELIVERY_OUTBOX.md` | `25c3727a9e3ec1fd8501276f06ac5968af8713e1` |
| `docs/portal/CP43_TRANSACTIONAL_EMAIL_PROVIDER_DECISION.md` | `0208497d78b869051984c98904d36105e3800513` |
| `docs/client-portal/CP3_TO_CP6_EXECUTION_ROADMAP.md` | `4d3cdc0a12f5e9523d5276386cc1952ac46fe8c7` |

## 6. Source-only review of the canonical migration

Reviewed file:

`supabase/migrations/20260918155431_cp43_canonical_state_reconciliation.sql`

### Observed safety properties

- Wrapped in an explicit transaction from `begin;` to `commit;`.
- Starts with fail-closed compatibility checks before canonical DDL.
- Rejects partial delivery schema.
- Rejects incompatible outbox columns/contracts.
- Rejects incompatible encrypted-payload columns/contracts.
- Requires the portal baseline to exist.
- Requires `pg_cron` to already exist rather than installing it implicitly.
- Validates the existing audit-event constraint/data before replacing the constraint.
- Creates or verifies the outbox and encrypted-payload tables.
- Enables and forces RLS on both delivery tables.
- Revokes generic public/anonymous/authenticated table access.
- Grants bounded service-role access.
- Keeps trusted create/claim/finalize RPCs as `SECURITY DEFINER` functions with explicit service-role guards for worker-only operations.
- Recreates the invitation-status payload-clearing trigger.
- Validates the cleanup cron job: more than one matching job aborts; an incompatible existing job aborts; no job creates the exact expected schedule.
- Does not install `pg_net`; the file explicitly excludes QA certifiers, `pg_net`, temporary fixtures and marker migrations.
- Does not contain a `db push` or migration-history repair path.

### Production-review risks that remain open

1. **Audit constraint lock/change:** the migration drops and re-adds `client_portal_audit_events_event_type_check`. Production preflight must assess locking/availability impact and validate current data before execution.
2. **Trigger/function replacement:** trusted functions and the invitation-status trigger are replaced. Exact baseline compatibility must be proven against production immediately before a later apply.
3. **Cron prerequisite:** `pg_cron` must exist and the named job must be absent or exactly compatible. Any ambiguity stops the gate.
4. **Operational DML exists inside function bodies:** claim/finalize/cleanup functions contain bounded `UPDATE`/`DELETE` logic as part of their runtime contract. Those bodies are defined by the migration; they are not a reason to claim that production behavior is safe without fresh verification.
5. **No inverse rollback is embedded:** CP-5.1B must define the actual restore/recovery strategy and operator before any mutation.
6. **Migration-history lock remains active:** `db push`, migration repair and history manipulation remain prohibited even if this file passes source review.
7. **Production applicability is unproven here:** Git source review cannot replace exact production identity, prestate, backup and live preflight evidence.

### Source-review disposition

`PASS_FOR_CP51A_SOURCE_FREEZE / NOT_PASS_FOR_PRODUCTION_EXECUTION`

No destructive shortcut or history manipulation is justified by this review. The next safe work is the production-preflight **package design**, not execution.

## 7. Candidate invariants for the next gate

CP-5.1B must reject the candidate if any of these change without a fresh CP-5.1A:

- runtime commit `7870ae4408ab7af0c944b149d2c75a70b8421e65`;
- canonical migration blob `c7c686769160d987c3721721a589dae1eae0dced`;
- worker source blob `9c71589dc45e360231e4765c54e087ac27bdd164`;
- accepted QA worker artifact SHA-256 `bd309b300e1bbe20532d70ea4a5c1c6d33704b4507307e8a761729794c39d3d6`;
- provider/worker trust boundary;
- invitation acceptance route/contract;
- database-push lock;
- production/QA separation.

## 8. Independent review result

Independent source-only review on the CP-5.1 branch verified the candidate
commit, migration blob, worker blob and documentation-only diff against
`codex/ux-operational-mobile-v2`. The scoped CP-4.3C regression tests passed
52/52; lint, TypeScript build and Vite build passed. This remains a source
freeze only and does not prove production applicability.

Disposition: `PASS_FOR_CP51A_SOURCE_FREEZE / NOT_PASS_FOR_PRODUCTION_EXECUTION`.

## 9. Agent manifest reconciliation

The initial agent-pack gate reported 15 SHA-256 mismatches, not one isolated
profile. Git history proves that the profiles and validation pack were changed
legitimately by `565a5f8` (`feat(v3): install exhaustive quality and brand
foundations`) and `ebd5d33` (`docs(v3): certify operations refinement`). The
current profiles still pass all structural, policy, naming, tool and secret
checks. Only the 15 manifest `sha256` fields were updated to the bytes now
present in their declared paths; no profile content or validator rule was
changed. The resulting `qa:agents` result is `160/160 PASS`.

## 10. Next unlocked work

CP-5.1B may now be prepared as a **zero-mutation production preflight package**.

It must define how a future authorized run will prove:

- exact production identity;
- exact candidate/hash match;
- prestate compatibility;
- fresh private backup and restore ownership;
- secret presence without secret disclosure;
- expected SQL/schema delta;
- monitoring and rollback thresholds;
- synthetic smoke and cleanup;
- postconditions;
- automatic stop on any ambiguity.

Preparing that package does not grant authorization to execute it.
