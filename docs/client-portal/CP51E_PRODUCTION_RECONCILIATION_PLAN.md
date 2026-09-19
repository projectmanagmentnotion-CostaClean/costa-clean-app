# CP-5.1E — Production Reconciliation / Deployment Plan

**Status:** `PREPARED / PRODUCTION MUTATION NOT AUTHORIZED`

This is a source-only release plan. It records what a future, separately
authorized production reconciliation would need to prove and execute. It does
not authorize a migration, DDL, deployment, configuration change, secret
operation, email, invitation or customer-facing smoke test.

## Fixed release identities

| Item | Value | Evidence status |
|---|---|---|
| Production Supabase ref | `wfxnwfcdjainpojhbdri` | `VERIFIED` by prior read-only preflight |
| Production status | `ACTIVE_HEALTHY` | `VERIFIED` by prior read-only preflight |
| Release candidate | `7870ae4408ab7af0c944b149d2c75a70b8421e65` | `VERIFIED` locally |
| Migration file | `supabase/migrations/20260918155431_cp43_canonical_state_reconciliation.sql` | `VERIFIED` locally |
| Migration Git blob | `c7c686769160d987c3721721a589dae1eae0dced` | `VERIFIED` locally |
| Delivery worker source blob | `9c71589dc45e360231e4765c54e087ac27bdd164` | `VERIFIED` locally |
| Member-actions source blob | `ba1c025a401f49293ef0fdbce5b2994b81e3385e` | `VERIFIED` locally |

The current production preflight result is:

`BLOCKED / STOP_PRESTATE_DRIFT / PRODUCTION_NOT_COMPATIBLE_WITH_CP43_CANDIDATE`

Production did not contain the CP-4.3C contract at the time of the authorized
read-only inspection. No production mutation occurred.

## 1. Current production versus CP-4.3C target

The `CURRENT PRODUCTION` column below reflects only the prior read-only
evidence. `NOT EXECUTED` and `NEEDS_RUNTIME_PROOF` are not passes.

| Area | Current production | CP-4.3C target | Classification |
|---|---|---|---|
| `public.client_portal_invitations` | Absent in the read-only relation check | Existing portal baseline required by the migration | `ABSENT_REQUIRED` |
| `public.client_portal_audit_events` | Absent in the read-only relation check | Existing audit baseline required by the migration | `ABSENT_REQUIRED` |
| `public.portal_invitation_delivery_outbox` | Absent | Created with the canonical columns and defaults | `ABSENT_REQUIRED` |
| `public.portal_invitation_delivery_payloads` | Absent | Created with encrypted ciphertext, nonce, key version and expiry | `ABSENT_REQUIRED` |
| Outbox columns/types/nullability | Not inspectable because table is absent | `id`, `invitation_id`, provider, idempotency, correlation, state, attempt, next-attempt, lease, provider result and timestamps | `ABSENT_REQUIRED` |
| Payload columns/types/nullability | Not inspectable because table is absent | invitation key, ciphertext, nonce, key version, created/expiry timestamps | `ABSENT_REQUIRED` |
| Outbox constraints | Not inspectable because table is absent | PK, invitation FK/unique, idempotency unique/checks, provider/status/attempt checks and state check | `ABSENT_REQUIRED` |
| Payload constraints | Not inspectable because table is absent | PK/FK, ciphertext/nonce/key-version format checks and expiry check | `ABSENT_REQUIRED` |
| Outbox indexes | Not inspectable because table is absent | PK, invitation unique, idempotency unique and partial ready index | `ABSENT_REQUIRED` |
| Payload indexes | Not inspectable because table is absent | PK and expiry index | `ABSENT_REQUIRED` |
| Outbox RLS | Not inspectable because table is absent | RLS enabled and forced | `ABSENT_REQUIRED` |
| Payload RLS | Not inspectable because table is absent | RLS enabled and forced | `ABSENT_REQUIRED` |
| Outbox grants | Not inspectable because table is absent | public/anon/authenticated revoked; service role select/insert/update only | `ABSENT_REQUIRED` |
| Payload grants | Not inspectable because table is absent | public/anon/authenticated revoked; service role select/insert/update/delete only | `ABSENT_REQUIRED` |
| Audit event constraint | Baseline table/constraint absent in the check | Exact allowlist includes delivery accepted/retry/blocked/terminal-failed events and existing approved events | `ABSENT_REQUIRED` |
| Existing audit data | Cannot be evaluated without the baseline table | Every existing event must belong to the canonical allowlist | `NEEDS_RUNTIME_PROOF` |
| `portal_private.clear_invitation_delivery_payload` | Absent | Security-definer trigger function with fixed search path | `ABSENT_REQUIRED` |
| Invitation status trigger | Absent | After status change, delete payload and block queued/leased/retry delivery | `ABSENT_REQUIRED` |
| `portal_create_invitation_delivery_trusted` | Absent | Service-role-only trusted creation path with actor, role, expiry, token-hash, payload and rate-limit validation | `ABSENT_REQUIRED` |
| `portal_claim_invitation_delivery_trusted` | Absent | Service-role-only lease/claim path with stale-lease and expiry blocking | `ABSENT_REQUIRED` |
| `portal_finalize_invitation_delivery_trusted` | Absent | Service-role-only state transition, attempt, provider result and payload-destruction path | `ABSENT_REQUIRED` |
| `portal_private.cleanup_expired_invitation_delivery_payloads` | Absent | Security-definer cleanup function with fixed search path | `ABSENT_REQUIRED` |
| SECURITY DEFINER/search paths | CP-4.3C functions absent; current unrelated advisor debt is not a target match | Required functions use the exact source-declared fixed search paths | `ABSENT_REQUIRED` |
| Trusted function grants | Absent with functions | Execute revoked from public/anon/authenticated and granted to service role only | `ABSENT_REQUIRED` |
| `pg_cron` extension | Installed, version `1.6.4` | Required extension present | `PRESENT_MATCH` |
| CP-4.3C cleanup cron | Absent | One active job, `*/15 * * * *`, exact cleanup command | `ABSENT_REQUIRED` |
| Other cron jobs | No CP-4.3C job present; unrelated jobs were not used as target evidence | Must not conflict with the named CP-4.3C job | `NEEDS_RUNTIME_PROOF` |
| `pg_net` | Installed as environment metadata | Not required by the canonical migration | `NOT_APPLICABLE` |
| Migration history | CP-4.3C migration absent from the observed production list | Canonical migration recorded only after successful execution | `ABSENT_REQUIRED` |
| `portal-invitation-delivery-worker` | Not present in active production Edge Function inventory | Deploy exact candidate artifact, with private worker configuration | `ABSENT_REQUIRED` |
| `portal-member-actions` | Not present in active production Edge Function inventory | Deploy exact candidate artifact if the release includes invitation delivery wiring | `ABSENT_REQUIRED` |
| Worker JWT setting | Not available for an absent function | Worker uses its own request secret and must not be treated as a public JWT endpoint | `NEEDS_RUNTIME_PROOF` |
| Member-actions JWT setting | Not available for an absent function | Existing portal handler/auth contract must be verified before deployment | `NEEDS_RUNTIME_PROOF` |
| Brevo/provider configuration | Values were not read; presence was not authorized in this run | Presence-only verification of named server configuration | `NEEDS_RUNTIME_PROOF` |
| Backup | No fresh backup was created or verified | Fresh private backup bound to exact target before mutation | `ABSENT_REQUIRED` |
| Restore proof | No restore was executed | Named restore owner and isolated restore verification | `ABSENT_REQUIRED` |
| Monitoring/alerts | No production mutation or alert setup performed | Redacted signals, routing, thresholds and owner | `NEEDS_RUNTIME_PROOF` |

### Target contract details

The canonical migration defines these delivery states:

`queued`, `leased`, `provider_accepted`, `retry_scheduled`, `blocked`,
`terminal_failed`.

The outbox is intentionally free of recipient, invite URL and raw token
material. The payload table stores only ciphertext, nonce, key version and
expiry metadata. The trusted claim function leases one eligible item, rejects
non-service-role callers, blocks stale or unavailable invitations, enforces a
maximum of five attempts and uses `FOR UPDATE SKIP LOCKED`. Finalization
requires a valid lease and destroys payloads on provider acceptance, block or
terminal failure. Retry requires an unexpired payload and pending invitation.

The audit allowlist additions are:

- `invitation_delivery_provider_accepted`
- `invitation_delivery_retry_scheduled`
- `invitation_delivery_blocked`
- `invitation_delivery_terminal_failed`

The exact existing allowlist remains the migration source of truth; it must not
be reconstructed from memory during a future release.

## 2. Exact future release sequence

The following is a gated sequence, not an execution instruction.

### Gate 0 — Candidate and target revalidation

Reconfirm the exact commit, migration blob and function blobs locally, then
prove the production ref from independent non-secret provider signals. Stop on
any hash, target or branch ambiguity.

### Gate 1 — Fresh private backup and restore readiness

Create a fresh private backup only under Authorization A below. Record only
safe metadata: target ref, timestamp, backup type, integrity reference and
restore owner. Confirm a usable recovery path before opening a mutation window.

### Gate 2 — Read-only prestate revalidation

Repeat the CP-4.3C preflight immediately before release. The current state is
expected to remain `STOP_PRESTATE_DRIFT` until reconciliation occurs. Do not
repair, mark history or make a partial change from this gate.

### Gate 3 — Private configuration presence

Verify presence and environment scoping without reading values. Required names
are listed below. Production delivery must remain disabled if the provider,
sender, encryption, worker or acceptance URL configuration is incomplete.

### Gate 4 — Canonical database reconciliation

The only acceptable database artifact is the exact migration file and blob
identified above. The migration must run as its own transaction, including its
embedded preflight. A future controlled runner may use:

`supabase migration up --linked`

only after verifying the CLI version, clean candidate checkout and exact pending
migration set. This command applies pending migrations to the linked project;
therefore it is **not** safe to run blindly here. No `--include-all`,
`migration repair`, manual ledger write, `db push`, ad-hoc SQL or substitute
migration is allowed. If the approved runner cannot prove that only the exact
CP-4.3C migration will execute, the gate is
`HUMAN_AUTHORIZATION_REQUIRED` and execution stops.

The migration's own transaction and preflight should cause an atomic failure if
the portal baseline, existing schema, audit allowlist or cron state is
incompatible. A failure before commit must leave the database unchanged by
that migration. This does not replace a backup or incident plan.

### Gate 5 — Migration ledger verification

After a successful execution, independently verify the exact migration version
in the remote migration ledger, the commit/blob provenance in the release
record, and the resulting relations, constraints, RLS, grants, functions,
trigger, audit constraint and cron job. Never insert or repair ledger rows.

### Gate 6 — Edge Function deployment

Deploy only the exact candidate artifacts, separately and under Authorization B.
The database contract must exist and pass verification first. Deploy the worker
before enabling member-actions delivery wiring; then verify the worker remains
fail-closed when configuration or its request secret is missing. No real email
or customer invitation is part of this plan.

### Gate 7 — Synthetic validation

Use only approved controlled identities and sandbox/drop provider behavior. The
validation design is below. Any real recipient, real provider delivery or
customer identity stops the release.

### Gate 8 — Observation window and gate close

Observe the approved signals for an owner-approved window. No thresholds are
invented in this document; each threshold remains `HUMAN_INPUT_REQUIRED` until
approved. Close CP-4.3C reconciliation only after independent review confirms
all gates and CP-5.2 remains `NOT STARTED`.

### Rollout dependency analysis

| Ordering | Consequence |
|---|---|
| DB before worker | Safe only if no production caller can create delivery rows before the worker/configuration gate. The trusted RPCs exist, but absent worker means queued rows could age; therefore keep invitation delivery disabled until worker verification. |
| Worker before DB | Unsafe. The worker would call absent RPCs and fail closed, but deployment creates an unverified production surface and can obscure whether failures are schema or configuration failures. |
| Member-actions before worker | Unsafe for live delivery. It can trigger the worker endpoint; keep the delivery path disabled until worker and provider gates pass. |
| Worker before member-actions | Preferred after DB verification: the worker can be tested with controlled fixtures, while the public portal wiring remains unavailable. |
| DB and functions in one simultaneous release | Not preferred because independent failure diagnosis and rollback become harder. Use DB verify, worker verify, then member-actions enablement. |

## 3. Migration execution and history strategy

The migration is a canonical forward-only reconciliation, not a reconstruction
of QA history. It starts a transaction, performs compatibility checks, creates
or validates the required contract, commits atomically, and has no embedded
inverse migration. The future release must therefore:

1. pin the candidate commit and exact migration blob;
2. run the approved migration runner against the exact production ref;
3. allow the migration to fail closed on incompatible prestate;
4. capture the runner result privately and the safe release identifiers;
5. verify the migration ledger only through read-only inspection;
6. verify the resulting schema and security contract independently.

The ledger must show the migration version only because the migration actually
executed successfully. No fake repair, manual insert, `supabase_migrations`
write or `migration repair` is permitted. The verifiable chain is:

`candidate commit → migration file/blob → approved execution result → remote ledger version → resulting contract evidence`

If a runner applies more than the exact intended migration, or if the ledger
and schema evidence disagree, stop and classify the release
`HUMAN_AUTHORIZATION_REQUIRED`/`STOP_MIGRATION_PROVENANCE`.

## 4. Edge Function release inventory

| Function | Source/blob | Dependencies and settings | Future order/rollback |
|---|---|---|---|
| `portal-invitation-delivery-worker` | `supabase/functions/portal-invitation-delivery-worker/index.ts`; blob `9c71589dc45e360231e4765c54e087ac27bdd164` | Calls trusted claim/finalize RPCs; requires `SUPABASE_URL`, service-role server credential, worker secret, payload encryption key, invitation accept URL, QA recipient, delivery environment and `BREVO_SANDBOX_MODE=drop`; provider module is server-side | Deploy after DB verification and before member-actions enablement. Roll back to a previously known artifact or disable the delivery path; do not improvise source changes. |
| `portal-member-actions` | `supabase/functions/portal-member-actions/index.ts`; blob `ba1c025a401f49293ef0fdbce5b2994b81e3385e` | Portal handler plus delivery trigger; requires provider, sender, payload key/key version, worker secret and accept URL presence; sends only opaque invitation ID to worker | Deploy/enable after worker controlled validation. Roll back to the prior known function artifact and verify invitation delivery is disabled. |

The prior production Edge Function inventory contained neither required
function. Deployment status, JWT configuration and runtime environment
presence were not established by the read-only preflight and remain
`NEEDS_RUNTIME_PROOF`. No function is deployed by this document.

## 5. Secret/config presence matrix

Values must never be read into output, chat, Git or this document.

| Secret/config name | Required by | Must exist before | Presence validation | Owner |
|---|---|---|---|---|
| `SUPABASE_URL` | Worker/member-actions | Function deployment | Private presence-only check in exact production function scope | `HUMAN_INPUT_REQUIRED` |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker server-side RPC calls | Worker enablement | Private presence-only check; never print | `HUMAN_INPUT_REQUIRED` |
| `PORTAL_INVITATION_DELIVERY_WORKER_SECRET` | Worker and member-actions | Worker/member-actions enablement | Private presence-only and length-policy check | `HUMAN_INPUT_REQUIRED` |
| `PORTAL_INVITATION_DELIVERY_KEY` | Worker payload encryption/decryption | Worker enablement | Private presence-only and format-policy check | `HUMAN_INPUT_REQUIRED` |
| `PORTAL_INVITATION_DELIVERY_KEY_VERSION` | Member-actions delivery configuration | Member-actions enablement | Private presence-only check | `HUMAN_INPUT_REQUIRED` |
| `PORTAL_INVITATION_ACCEPT_URL` | Worker/member-actions | Synthetic validation | Private presence-only and production-origin check | `HUMAN_INPUT_REQUIRED` |
| `TRANSACTIONAL_EMAIL_PROVIDER` | Member-actions/provider factory | Synthetic validation | Presence plus approved value classification, without credential output | `HUMAN_INPUT_REQUIRED` |
| `BREVO_API_KEY` | Transactional provider | Any provider-bound test | Presence-only; never read or print value | `HUMAN_INPUT_REQUIRED` |
| `BREVO_SENDER_EMAIL` | Transactional provider | Provider readiness | Presence-only plus separately approved sender verification | `HUMAN_INPUT_REQUIRED` |
| `BREVO_SENDER_NAME` | Transactional provider | Provider readiness | Presence-only | `HUMAN_INPUT_REQUIRED` |
| `PORTAL_INVITATION_DELIVERY_ENV` | Worker sandbox/environment guard | Worker enablement | Presence-only and environment classification | `HUMAN_INPUT_REQUIRED` |
| `PORTAL_INVITATION_DELIVERY_QA_RECIPIENT` | Worker controlled validation | Synthetic validation | Presence-only; no real customer recipient | `HUMAN_INPUT_REQUIRED` |
| `BREVO_SANDBOX_MODE` | Worker fail-closed QA/drop mode | Synthetic validation | Presence-only and exact controlled-mode check | `HUMAN_INPUT_REQUIRED` |

## 6. Backup, restore and rollback gate

**`BACKUP_REQUIRED_BEFORE_MUTATION`**

Before any future mutation, a fresh private backup must be created for the
exact production ref and release window. It must have a timestamp, target
identity, integrity verification, retention period and named `BACKUP_OWNER` and
`RESTORE_OWNER`. A restore verification should use an approved isolated target,
prove schema/data/security invariants and record elapsed time and result without
committing backup content or credentials.

The migration is transactional: an error before commit should roll back its
transaction. If the database commits but a later function deployment fails,
do not run improvised inverse SQL. Disable the dependent delivery path, retain
the verified database state, and use the approved recovery decision: restore
the verified backup or apply a separately reviewed corrective migration. The
rollback decision, RTO and trigger remain `HUMAN_INPUT_REQUIRED`.

Rollback layers:

- Database: verified restore/recovery path preferred; no inverse SQL invented.
- Worker: revert to the exact prior artifact or disable the endpoint/path.
- Member-actions: revert to the exact prior artifact and disable delivery.
- Secrets/config: do not rotate, delete or replace during rollback without an
  explicit authorization.
- Frontend: no frontend production mutation is included in CP-5.1E.

Rollback triggers include failed schema/security verification, unavailable
backup, unexpected function behavior, provider boundary failure, secret
leakage, cross-client isolation failure, token leakage, or any real-customer
delivery. Owner and timing: `HUMAN_INPUT_REQUIRED`.

## 7. Synthetic validation design

This design is not executed now and sends no real email. Controlled identities
must be explicitly approved and must remain inside the provider drop/sandbox
boundary.

1. Create one invitation through the trusted path and verify one outbox row,
   one encrypted payload and one `invitation_created` audit event.
2. Claim the row with the worker and verify lease ownership, 120-second lease
   policy, no raw token in the outbox/logs, and ciphertext-only payload handling.
3. Exercise provider accepted, retry, blocked and terminal-failed outcomes with
   a controlled provider boundary; verify idempotency and attempt count.
4. Verify payload deletion after acceptance, block, terminal failure,
   invitation revocation, expiry and cleanup execution.
5. Verify stale lease handling, retry payload availability and no duplicate
   provider submission for the same idempotency key.
6. Verify cross-client and unauthorized actor denial, revocation denial,
   replay denial and no public registration path.
7. Verify no invoice, payment, numbering, fiscal or financial mutation occurs.
8. Verify audit records contain safe outcome metadata only and no token,
   ciphertext key, credential or unnecessary recipient data.

Any real email, real customer, public registration, secret output or financial
effect is an immediate stop.

## 8. Observation window

Required signals are:

- worker invocation successes/failures and runtime errors;
- outbox counts by state and attempt exhaustion;
- stale leases and delivery outcome ambiguity;
- provider accepted/retry/blocked/terminal-failed counts;
- payload expiry and cleanup job health;
- audit event anomalies;
- auth/access anomalies around invitation acceptance;
- cross-client denial and token/secret leakage indicators.

Alert destinations, observation duration, numeric thresholds, release observer,
incident owner and rollback owner are all `HUMAN_INPUT_REQUIRED`. No arbitrary
threshold is a pass, and no observation window has started.

## 9. Security and performance debt separation

The prior advisor findings remain outside CP-5.1E reconciliation:

| Finding | Classification | Disposition |
|---|---|---|
| Security-definer functions executable by `anon`/`authenticated` | `NON_BLOCKING_SECURITY_DEBT` / `NEEDS_TRIAGE` | Observe and track separately; no production fix authorized |
| Mutable function `search_path` findings | `NON_BLOCKING_SECURITY_DEBT` / `NEEDS_TRIAGE` | Separate remediation work; not silently changed here |
| Leaked-password protection disabled | `NEEDS_TRIAGE` | Requires separate Auth/security authorization |
| Unindexed foreign keys and RLS init-plan findings | `NON_BLOCKING_PERFORMANCE_DEBT` | Separate performance work |
| Unused and duplicate indexes | `NON_BLOCKING_PERFORMANCE_DEBT` | Separate performance work |

The absent CP-4.3C contract is the release blocker. These historical findings
must not be reclassified as resolved or silently fixed by the reconciliation.

## 10. Owner matrix

| Role | Required value |
|---|---|
| `RELEASE_OWNER` | `HUMAN_INPUT_REQUIRED` |
| `ROLLBACK_OWNER` | `HUMAN_INPUT_REQUIRED` |
| `INCIDENT_OWNER` | `HUMAN_INPUT_REQUIRED` |
| `OBSERVABILITY_OWNER` | `HUMAN_INPUT_REQUIRED` |
| `BACKUP_OWNER` | `HUMAN_INPUT_REQUIRED` |
| `RESTORE_OWNER` | `HUMAN_INPUT_REQUIRED` |

No person is inferred or assigned.

## 11. Separate future authorizations

### Authorization A — Backup / pre-mutation safety

> I authorize only the private backup and restore-readiness operation for
> production Supabase ref `wfxnwfcdjainpojhbdri`, for the CP-4.3C candidate
> `7870ae4408ab7af0c944b149d2c75a70b8421e65`. Allowed actions are target
> identity confirmation, creation of one fresh private backup, integrity
> verification, recording of non-secret timestamp/type/reference metadata, and
> verification of an approved isolated restore procedure. No migration, DDL,
> SQL write, migration-history change, `db push`, function deployment,
> frontend deployment, secret read/rotation, email, Auth mutation, invitation,
> DNS, SiteGround, financial/fiscal operation, destructive cleanup or CP-5.2
> action is authorized. Do not place backup contents, credentials, tokens or
> private connection details in Git or output. Stop on any target ambiguity,
> backup failure, restore failure, secret exposure or scope expansion.

### Authorization B — CP-4.3C production reconciliation

> I authorize a separately scheduled CP-4.3C production reconciliation only
> against Supabase production ref `wfxnwfcdjainpojhbdri`, using release
> candidate commit `7870ae4408ab7af0c944b149d2c75a70b8421e65`, migration file
> `supabase/migrations/20260918155431_cp43_canonical_state_reconciliation.sql`,
> migration Git blob
> `c7c686769160d987c3721721a589dae1eae0dced`, delivery worker
> `portal-invitation-delivery-worker` source blob
> `9c71589dc45e360231e4765c54e087ac27bdd164`, and
> `portal-member-actions` source blob
> `ba1c025a401f49293ef0fdbce5b2994b81e3385e`. Allowed actions are exact
> prestate revalidation, use of a separately verified fresh backup, execution
> of exactly the pinned migration through an approved controlled migration
> runner, read-only migration/schema verification, deployment of exactly the
> named Edge Function artifacts if individually confirmed, and controlled
> synthetic validation within the approved sandbox/drop boundary. No `db push`,
> migration repair, manual migration-history write, substitute SQL, secret
> value access or rotation, real email, customer invitation, Auth mutation,
> DNS, SiteGround, frontend production deployment, financial/fiscal write,
> destructive cleanup or CP-5.2 action is authorized. Stop on any target,
> candidate, migration, prestate, backup, configuration, function, provider,
> security, privacy or monitoring discrepancy; any real recipient or customer;
> any secret/token leakage; any ledger/schema mismatch; or any scope expansion.
>
> CP-5.2 remains `NOT STARTED` even if CP-4.3C reconciliation later completes.

## 12. Current disposition

- CP-4.3C: `QA_CERTIFIED / CLOSED`
- CP-5.1A: `COMPLETE`
- CP-5.1B: `COMPLETE`
- CP-5.1C: `COMPLETE`
- CP-5.1D: `COMPLETE / STOP_PRESTATE_DRIFT`
- CP-5.1E: `PREPARED / PRODUCTION MUTATION NOT AUTHORIZED`
- CP-5.1: `BLOCKED / STOP_PRESTATE_DRIFT`
- CP-5.2: `NOT STARTED`

No production mutation is authorized by this document.
