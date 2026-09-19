# CP-5.1 — Production Readiness Preflight

**Status:** `PREPARED / NOT AUTHORIZED FOR PRODUCTION EXECUTION`  
**Prepared from:** `7870ae4408ab7af0c944b149d2c75a70b8421e65`  
**Working branch:** `codex/cp51-production-readiness-preflight`  
**Previous gate:** CP-4.3C `QA_CERTIFIED / CLOSED`  
**Purpose:** convert the closed QA evidence into an explicit, reviewable production-readiness evidence matrix without performing any production-affecting action.

## 1. Scope

This gate is evidence and planning only.

Allowed in this preflight:

- read repository and already-versioned evidence;
- pin exact source identities and hashes;
- identify missing production-readiness evidence;
- prepare review, rollback, observability, support and authorization requirements;
- create documentation and a reviewable Git branch/PR.

Not authorized by this preflight:

- production or QA Supabase mutation;
- migration apply, migration repair or `db push`;
- production deployment or domain cutover;
- DNS or SiteGround change;
- secret creation, rotation, copying or exposure;
- Brevo production send or any real invitation email;
- Auth-user creation/deletion;
- real-client pilot;
- financial/fiscal write;
- destructive cleanup;
- merge to `main` or any production release.

## 2. Verified baseline

The current project branch already contains the canonical CP-4.3C reconciliation.

| Evidence | Current status | Repository proof |
|---|---|---|
| CP-4.3C trusted invitation delivery | `VERIFIED` | `docs/portal/CP43_TRUSTED_DELIVERY_OUTBOX.md` records `QA_CERTIFIED / CLOSED`. |
| QA worker runtime artifact | `VERIFIED` | `portal-invitation-delivery-worker` V18, SHA-256 `bd309b300e1bbe20532d70ea4a5c1c6d33704b4507307e8a761729794c39d3d6`. |
| Local worker source identity | `VERIFIED_IN_GIT` | Git blob `9c71589dc45e360231e4765c54e087ac27bdd164` at `supabase/functions/portal-invitation-delivery-worker/index.ts`. |
| Canonical CP-4.3C reconciliation migration | `VERIFIED_IN_GIT / NOT APPLIED BY THIS GATE` | `supabase/migrations/20260918155431_cp43_canonical_state_reconciliation.sql`, Git blob `c7c686769160d987c3721721a589dae1eae0dced`. |
| QA runtime certification | `VERIFIED_HISTORICAL_EVIDENCE` | FINAL V18: worker HTTP 200, one Brevo sandbox `drop` request, provider acceptance, payload destruction, lease clear, completed audit and zero real email. |
| Database push policy | `LOCKED` | `docs/DB_PUSH_LOCK.md`; `db push` and migration-history shortcuts remain prohibited. |
| Production P0/P1 baseline | `HISTORICAL_ONLY` | Previous normal-operation closeout recorded P0/P1 = 0; CP-5.1 requires a fresh scoped revalidation before release. |

The CP-4.3C certificate is QA evidence only. It is not production authorization.

## 3. CP-5.1 evidence matrix

| Required evidence | Status now | What closes it |
|---|---|---|
| Exact QA-proven hashes | `PARTIAL_VERIFIED` | Freeze the complete CP-4.3C source/migration/function manifest against the current branch and independently review any divergence from QA V18. |
| Exact production target identity | `NEEDS_FRESH_EVIDENCE` | Read-only multi-source target proof immediately before any later production action; ambiguous or mismatched identity stops the gate. |
| Fresh production backup | `HUMAN_AUTHORIZATION_REQUIRED` | A separately authorized private backup with timestamp, target proof, integrity evidence and restore ownership. No backup data enters Git. |
| Migration review | `SOURCE_AVAILABLE / REVIEW_REQUIRED` | Independent review of the forward-only canonical migration, prerequisites, incompatibility guards and expected production delta. |
| Rollback/recovery runbook | `REQUIRED` | Define restore/recovery path, abort thresholds and operator. Do not invent inverse SQL for a forward-only migration when restore is the safer rollback. |
| Production secrets present | `PRIVATE_VERIFICATION_REQUIRED` | Verify names/presence only through an approved private channel. Never print, copy or commit values. |
| Observability and alerting | `REQUIRED` | Define worker/provider/database signals, thresholds, redacted logs, alert destination and post-release observation window. |
| Support and incident ownership | `HUMAN_INPUT_REQUIRED` | Name the release operator, rollback owner and support/incident owner before execution. |
| Provider/legal facts | `NEEDS_FRESH_RECONCILIATION` | Confirm production Brevo/provider purpose, processor/DPA/region facts, sender-domain ownership and approved legal copy as applicable. |
| P0/P1 = 0 | `NEEDS_FRESH_REVALIDATION` | Fresh security/QA review scoped to the exact release candidate. Historical zero is useful evidence, not a substitute. |
| Invite-only/public registration boundary | `NEEDS_FRESH_PROOF` | Prove public self-registration remains disabled and tenant isolation/revocation boundaries remain intact. |
| Explicit production authorization | `NOT_GRANTED` | A later owner authorization must name the exact candidate, target, allowed operations, rollback evidence and stop conditions. |

## 4. Safe continuation chain

### CP-5.1A — Candidate identity and source review

Goal: freeze the exact release candidate without remote writes.

Deliverables:

- exact branch/commit and file manifest;
- worker/migration/function identities;
- diff against the accepted QA evidence;
- independent security and PR-quality review;
- explicit list of expected production effects;
- explicit list of things that must remain unchanged.

Remote mutations: `0`.

### CP-5.1B — Production preflight package

Goal: prepare the executable production gate without executing it.

Deliverables:

- exact production identity procedure;
- backup/restore requirements;
- migration preconditions and postconditions;
- rollback/abort procedure;
- private-secret presence checklist;
- observability plan;
- synthetic-only smoke plan;
- cleanup plan;
- exact authorization text template.

Remote mutations: `0` until a separate authorization is granted.

### CP-5.1C — Operational and compliance readiness

Goal: close non-code blockers before any release.

Deliverables:

- incident/support owner;
- provider and legal fact reconciliation;
- fresh P0/P1 review;
- public-registration/invite-only proof;
- monitoring thresholds and observation window;
- pilot eligibility criteria for CP-5.2.

Remote mutations: `0`.

### CP-5.1D — Exact production authorization gate

This stage is not implicitly authorized by prior QA work, by this document, by a passing PR, or by a continuation agent.

A future authorization must identify at minimum:

- exact release commit/hash set;
- exact production target;
- exact allowed mutations;
- verified backup/restore evidence;
- approved operator and incident owner;
- stop/rollback thresholds;
- whether real provider delivery is included or remains disabled;
- whether CP-5.2 pilot is excluded.

Only after that authorization may a production-affecting executor be considered.

## 5. Mandatory stop conditions

Stop CP-5.1 immediately if any of the following is true:

- production target identity is ambiguous or inconsistent;
- the release candidate differs from the reviewed hash set;
- fresh backup/restore evidence is absent when a mutation would begin;
- migration behavior is not independently reviewed;
- a required secret is missing or any secret value would need to enter Git/output;
- P0/P1 is open or cannot be freshly assessed;
- incident/rollback ownership is missing;
- public self-registration is unexpectedly enabled;
- cross-client isolation or revocation evidence regresses;
- `db push`, migration repair or migration-history manipulation becomes necessary;
- the action would touch invoices, numbering, payments, fiscal state or other protected domains outside the exact release scope;
- a production email/send would occur without explicit authorization for real delivery.

## 6. Agent routing

Use the repository agent roles manually and independently:

1. `project-continuation` — reconstruct current state and select only the next unlocked CP-5.1 sub-gate.
2. `implementation-planner` — build the bounded evidence plan.
3. `release-deployment-guardian` — own release boundaries, backup/rollback and target identity.
4. `supabase-guardian` — read-only source/schema/migration review unless a separate remote authorization exists.
5. `security-privacy-auditor` — verify tenancy, secret boundaries, provider/privacy risks and P0/P1.
6. `qa-e2e-specialist` — define fresh release-candidate verification and synthetic smoke.
7. `pr-quality-gate` — independent reviewer; the implementer does not self-approve.
8. `documentation-roadmap` — keep canonical status/evidence aligned.

No agent may treat this routing table as production authorization.

## 7. Preflight completion criteria

This preflight can be marked complete when:

- all source identities are frozen against one current commit;
- the exact production-readiness delta is documented;
- every item in the evidence matrix is either verified or explicitly assigned to a later authorization-bound gate;
- no secret/private backup content is committed;
- no remote mutation occurred;
- independent review agrees the next prompt is bounded to CP-5.1;
- the project has one unambiguous next gate rather than parallel continuation paths.

At that point the next action is CP-5.1A source/release-candidate review, not production execution.
