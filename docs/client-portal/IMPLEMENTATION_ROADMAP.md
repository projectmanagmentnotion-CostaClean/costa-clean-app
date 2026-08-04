# Client Portal Implementation Roadmap

Date: 2026-08-04
Current state: CP-0/CP-1/CP-2A/CP-2A.1/CP-2A.2/CP-2A.3/CP-2A.4/CP-2B/CP-3A/CP-3B.0/CP-3B.0A/CP-3B.0 QA application/CP-3B.1/CP-3B.2A/CP-3B.2A.1/CP-3B.2A.3/CP-3B.2A.4/CP-3B.2A.5 and CP-3B.2A real QA closeout complete; CP-3B.2A.6R.1E prepared; CP-3B.2A.2 remains blocked by missing V2 detail

## Progress and execution authority

- Weighted scope estimate: approximately **65% complete / 35% remaining**.
- This is a scope-weighted orientation, not an hours or delivery-date estimate.
- Next gate: **CP-3B.2A QA application V6R1E**, requiring a separate exact human
  authorization for the final committed HEAD and fresh private backup.
- Detailed executable sequence:
  [`CP3_TO_CP6_EXECUTION_ROADMAP.md`](./CP3_TO_CP6_EXECUTION_ROADMAP.md).
- Agent permissions and separation of duties:
  [`AGENT_EXECUTION_MATRIX.md`](./AGENT_EXECUTION_MATRIX.md).

CP-3A is closed with local source and visible-browser evidence. CP-3B.0 closes
the self-context source contract; CP-3B.0A closes its V2 execution/recovery
package, disposable proof and live QA read-only preflight. The separately
authorized QA application created exactly the narrow self-context function and
passed independent post-application checks with no other remote change. No real
portal QA identity was created. CP-3B.1 now closes the local Auth lifecycle,
strict self-context consumption and visible synthetic UI proof without remote
writes; live real-identity E2E remains reserved for separately authorized
CP-3C.1/CP-3C.2. CP-3B.2A closes the reviewed-change source contract.
CP-3B.2A.1 closed its V2 apply/postcheck/transactional-matrix/recovery package.
The authorized V2 application failed after apply, recovered once and restored
the exact prestate; its authorization is exhausted. CP-3B.2A.2 demonstrates
  that the V2 runner discarded the first failure. The exact remote trigger
  remains unknowable from existing evidence, so CP-3B.2A.2 stays `BLOCKED`.
  CP-3B.2A.3 closed the observability package. Its authorized application was
  stopped before effects because V3 lacked mandatory real authorization and
  concurrency cases. CP-3B.2A.4 supplied actual RPC denials and a two-session
  insertion barrier, but its application stopped before remote effects and is
  superseded. CP-3B.2A.5 closes the three executable P1 findings with explicit
  ambiguous COMMIT handling, a complete executed capability map and exact
  backup/live comparison immediately before apply. CP-3B.2 remains
  blocked and CP-3B.3 has not started. This
document remains the canonical status roadmap; the
detailed roadmap expands it without changing its authority.

CP-3B.2A QA application V6R1E remains the current reproducible rebaseline gate.
It is still separate from the full CP-3B.2 Definition of Ready. The real QA
closeout for the reviewed-change migration now has executed postcheck, matrix
and concurrency evidence with zero residual QA or production writes. Customer-
safe canonical status mapping and opaque profile/property identifier handling
remain to be approved before frontend implementation.

## CP-0 — Discovery

Status: `DONE — source/live read-only evidence`

- Exact app repository and baseline verified.
- Public site identified as WordPress/SiteGround; no Git repository exists in connected/local scope.
- WordPress framework/plugins/forms/legal surfaces inventoried.
- CRM Auth, canonical tables, PDF rendering, Storage, RLS, RPC, Edge and routes mapped.
- Data classification and trust-boundary map produced.
- Production and QA writes: zero.

Residual prerequisite: obtain a WordPress/SiteGround export, owner and deployment procedure before CP-4.

## CP-1 — Security, tenancy and legal design

Status: `DONE — documentation only`

- Explicit memberships, secure invitations and pending approval designed.
- `client_admin`/`client_member`, service requests, audit, revocation, recovery, anti-enumeration, rate limiting and MFA-ready controls specified.
- P0 current any-authenticated policy risk identified.
- Exact RLS/grant/RPC intent and cross-client matrix defined.
- Private invoice delivery and short signed access specified.
- Legal, content, consent, processor/transfer and retention matrices prepared.
- Exact CP-2 QA authorization package prepared.

No professional legal approval is claimed.

## CP-2A — Immutable source package and disposable proof

Status: `DONE — source only, QA/production unchanged`

- one reviewed migration, four Edge boundaries and private Storage design;
- explicit staff trust boundary and deny-by-default customer tenancy;
- deterministic synthetic fixtures, authorization matrix and exact cleanup;
- PostgreSQL 17.10 disposable apply/rollback/reapply proof;
- frozen migration/Edge/runner/fixture/rollback hashes;
- future QA commands documented but not executed.

Evidence: `CP2A_IMPLEMENTATION_PACKAGE.md` and `CP2B_EXACT_QA_AUTHORIZATION.md`.

## CP-2A.1 — QA-compatible execution package

Status: `DONE — source/local only, QA/production unchanged`

- original 16 frozen artifacts preserved byte-for-byte;
- separate V2 Auth/fixtures/matrix/cleanup/recovery/runner package;
- Auth UUIDs generated dynamically and injected privately;
- exact private ledger under `.git/cp2b-private/`;
- target/hash/backup/authorization execution gates;
- PostgreSQL 17 disposable dynamic-Auth/matrix/cleanup/rollback proof;
- V2 manifest and future exact authorization prepared but not granted.

Evidence: `CP2A1_QA_EXECUTION_PACKAGE.md`, `CP2B_EXACT_QA_AUTHORIZATION_V2.md`, and `scripts/client-portal/cp2b_qa_package_v2.manifest.json`.

## CP-2A.2 — Windows-compatible Supabase CLI runner

Status: `DONE — source/local read-only, QA/production unchanged`

- the clean V2 block was reproduced as Windows `spawnSync(.cmd) -> EINVAL` before ledger creation;
- a separate V3 launcher executes the real Supabase JavaScript entry and supports restricted, quoted `.cmd` execution;
- V3 adds a separate manifest, authorization ID, outer execution gate and Windows preload while preserving all original/V2 bytes;
- real Windows shim, Supabase version, authenticated project listing, QA link, production rejection, command quoting and secret redaction are locally proven;
- no V2/V3 `--execute` command ran and remote writes remain zero.

Evidence: `CP2A2_WINDOWS_RUNNER_FIX.md`, `CP2B_EXACT_QA_AUTHORIZATION_V3.md`, and `scripts/client-portal/cp2b_qa_package_v3.manifest.json`.

## CP-2A.3 — QA migration bootstrap contract correction

Status: `DONE — source/local/disposable proof only, QA/production unchanged`

- the blocked V3 attempt was reconciled to zero remote residue and its private ledger remains preserved;
- PostgreSQL 17 reproduced the original `staff_role`/`role` mismatch as SQLSTATE `42703`;
- V4 bootstraps only the confirmed real active staff identity with the migration's exact `(user_id, role)` contract;
- synthetic suspended staff remains exclusively a frozen V2 fixture with status `suspended`;
- the explicit V4 runner preserves V3 launch security and V2 ledger/Auth/matrix/cleanup/recovery mechanics;
- local baseline and restored private QA public-schema proofs pass V4 migration, 11-table RLS/FORCE RLS, matrix, cleanup and recovery;
- V4 is `PREPARED_NOT_AUTHORIZED`; no V4 remote execution occurred.
- the required frozen CP-2A.2 authenticated proof passes through the authorized private-auth process without printing or versioning secrets;
- the Production Agents pilot commit remains preserved as the integrated remote base.

Evidence: `CP2A3_BOOTSTRAP_CONTRACT_FIX.md`, `CP2B_EXACT_QA_AUTHORIZATION_V4.md`, and `scripts/client-portal/cp2b_qa_package_v4.manifest.json`.

## CP-2A.4 — PostgreSQL secret transport and pre-effect connectivity

Status: `DONE — live QA read-only proof, QA/production unchanged`

- V4 `sensitive_argument_rejected` reproduced before process spawn on Windows and Linux;
- separate V5 transport converts the private URL to a minimal `PG*` environment before calling the frozen launcher;
- URL/password/Supabase keys/peppers never enter child arguments and the database URL is removed from the child environment;
- live QA `SELECT 1`, exact target, exact active staff UUID and clean portal prestate pass;
- `postgres_pre_effect_check` is enforced before `ledger_create` and `auth_create`;
- connectivity failure leaves new ledger, Auth users and remote writes at zero;
- 36/36 V5 authenticated tests pass;
- V5 is `PREPARED_NOT_AUTHORIZED`; no V5 `--execute` occurred.

Evidence: `CP2A4_POSTGRES_SECRET_TRANSPORT_FIX.md`, `CP2B_EXACT_QA_AUTHORIZATION_V5.md`, and `scripts/client-portal/cp2b_qa_package_v5.manifest.json`.

## CP-2B — QA schema, authorization and server APIs

Status: `DONE — Supabase Cloud QA boundary validated`

- exact V5 authorization, private HEAD-bound backup and triple QA identity passed;
- the runner executed once and completed its private ledger;
- 11 portal/security tables retain RLS plus `FORCE RLS`;
- one confirmed internal staff membership remains active;
- SQL cross-client and HTTP Edge denial matrices passed;
- four portal Edge Functions and the private `invoice-documents` bucket remain;
- ten synthetic Auth users, two PDFs and all synthetic fixtures were removed;
- independent reconciliation found zero synthetic residue and unchanged
  financial counts/sequences;
- production, WordPress, SiteGround and `/portal` were untouched.

Do not use `db push` or migration repair.

Evidence: `CP2B_V5_QA_EXECUTION_20260727.md`.

## CP-3 — Portal UI in QA

Status: `IN PROGRESS — CP-3A/CP-3B.0/CP-3B.0A/CP-3B.0 QA APPLICATION/CP-3B.1/CP-3B.2A/CP-3B.2A.1/CP-3B.2A.3/CP-3B.2A.4/CP-3B.2A.5 DONE; CP-3B.2A.2 BLOCKED; CP-3B.2 BLOCKED_PENDING_CP3B2A_QA_V5`

- **CP-3A — Portal UI foundation:** `DONE — local source/runtime evidence`.
  Isolated `/portal` bootstrap, typed read-only adapters, explicit access state
  machine, responsive shell, base pages and development-only synthetic preview;
  remote writes `0`.
- **CP-3B.0 — Self access context backend contract:**
  `DONE — source/local/QA validated`. Zero-parameter `auth.uid()`
  contract, six deterministic states, multi-client selection, minimal DTO,
  grants and rollback/reapply are proven. Its exact V2 QA application ran once,
  created one function and passed independent catalog and residue checks.
- **CP-3B.0A — QA application execution and recovery package:**
  `DONE`. Immutable V2 manifest, exact
  pre-effect ordering, HEAD-bound private backup/snapshot, PostgreSQL 17
  apply/postcheck, transactional QA matrix and one-function recovery are
  proven. The separately authorized one-shot QA execution passed with one apply,
  zero recovery attempts and zero synthetic residue.
- **CP-3B.1 — Authentication and access lifecycle:**
  `DONE — local implementation and visible synthetic-runtime evidence`.
  Portal-only PKCE Auth, session event ordering, parameterless self-context
  resolution, strict DTO validation, neutral recovery, active/multi-client/
  pending/suspended/revoked/without-access outcomes and iPhone-first UI are
  proven. Complete invitations, remote users and real-identity E2E remain
  outside this gate.
- **CP-3B.2A — Reviewed change backend contract:**
  `DONE — SOURCE CONTRACT`; its execution path is superseded by CP-3B.2A.1.
- **CP-3B.2A.1 — QA application execution and recovery package:**
  `DONE`; exact V2 plan/preflight, immutable dependency chain, HEAD-bound
  eight-artifact private backup, PostgreSQL 17 postcheck/matrix/recovery proof
  and fail-closed `--execute` are complete. Its one authorized QA application
  is `BLOCKED_RECOVERED — SUPERSEDED`; V2 authorization is not reusable.
- **CP-3B.2A.2 — QA failure investigation and V3 remediation:**
  `BLOCKED_PENDING_EXACT_TRIGGER_EVIDENCE`; the runner diagnostic-loss defect
  is reproduced and a local V3 draft passes PostgreSQL 17, but the original
  remote SQL/parser/transport assertion was discarded by V2 and cannot be
  named without a newly authorized remote reproduction. V3 application is
  `BLOCKED_NOT_AUTHORIZABLE`; QA writes in this gate `0`.
- **CP-3B.2A.3 — V3 failure observability package:**
  `DONE`; it preserves and verifies the primary failure before recovery,
  enforces immutable primary versus separate recovery failure, classifies
  SQL/parser/transport/timeout outcomes, verifies the complete target policy/ACL
  set, and proves integrated PostgreSQL 17 persist/reread/recovery plus
  reapply. The original remote trigger remains
  `UNKNOWN_PENDING_V3_EXECUTION`; its QA application is
  `BLOCKED_BEFORE_EFFECT — SUPERSEDED`.
- **CP-3B.2A.4 — Executable authorization and real concurrency matrix V4:**
  `DONE`; actual RPC denials cover anon, no membership, revoked, suspended and
  invalid/foreign payloads with exact neutral SQLSTATEs. Two independent
  PostgreSQL workers are held at the real request-table insertion boundary and
  prove simultaneous same-key retry/conflict for profile and property. Its QA
  application is `BLOCKED_BEFORE_REMOTE_EFFECTS — SUPERSEDED`.
- **CP-3B.2A.5 — Final executable-path safety closure V5:**
  `DONE`; explicit observer-confirmed fixture states prevent speculative
  cleanup after an ambiguous COMMIT, the V5 runner executes the complete V3+V4
  capability contract, and a fresh HEAD-bound private backup must match the
  live prestate and immediate drift sentinel before apply. The package is
  `READY_PENDING_EXPLICIT_V5_AUTHORIZATION`; this gate made zero remote writes.
- **CP-3B.2A.6R.1E — Real PostgreSQL rebaseline closeout package:**
  `PREPARED_NOT_AUTHORIZED`; Git blob identity plus canonical JSON identity
  now connect to a real PostgreSQL QA adapter and ignored private backup path,
  while the full V5 operational contract remains preserved as evidence. No QA
  or production write is authorized.
- **CP-3B.2A real QA closeout — Reviewed-change transactional closeout:**
  `DONE`; the reviewed-change migration was applied once in QA, the strict
  read-only postcheck passed, the transactional matrix passed, the independent
  two-session concurrency harness passed and cleanup left zero residual QA or
  production writes. This closeout does not authorize CP-3B.2 or later gates.
- **CP-3B.2 — Profile and properties:**
  `BLOCKED_PENDING_CP3B2A_QA_V6R1E`; account context, read models and reviewed
  change requests without canonical-table writes. After QA application, freeze
  customer-safe canonical status and opaque-ID mappings before implementation.
- **CP-3B.3 — Services and requests:** real pending-review request workflow,
  cancellation, idempotency and explicit feedback.
- **CP-3B.4 — Invoices and private documents:** read-only financial states and
  private 60-second signed downloads.
- **CP-3B.5 — Members, security and legal acceptance:** client roles,
  invitations/revocation, account security, versioned terms and layered privacy.
- **CP-3C.1 — Controlled QA identities and fixtures:** separately authorized,
  synthetic, exact-cleanup dataset.
- **CP-3C.2 — End-to-end authorization QA:** positive and negative journeys,
  cross-client isolation, expiry and cleanup.
- **CP-3C.3 — Visual, accessibility and performance QA:** mobile, iPad, desktop,
  keyboard, screen readers, reduced motion and Web Vitals.

No production release is part of CP-3.

CP-3A evidence:
[`CP3A_PORTAL_UI_FOUNDATION_20260728.md`](./CP3A_PORTAL_UI_FOUNDATION_20260728.md).

CP-3B.1 evidence:
[`CP3B1_AUTH_ACCESS_LIFECYCLE_20260728.md`](./CP3B1_AUTH_ACCESS_LIFECYCLE_20260728.md).

CP-3B.0 evidence:
[`CP3B0_SELF_ACCESS_CONTEXT_CONTRACT.md`](./CP3B0_SELF_ACCESS_CONTEXT_CONTRACT.md)
and
[`CP3B0_EXACT_QA_AUTHORIZATION.md`](./CP3B0_EXACT_QA_AUTHORIZATION.md).

CP-3B.0A evidence:
[`CP3B0A_QA_EXECUTION_PACKAGE.md`](./CP3B0A_QA_EXECUTION_PACKAGE.md)
and
[`CP3B0_EXACT_QA_AUTHORIZATION_V2.md`](./CP3B0_EXACT_QA_AUTHORIZATION_V2.md).

CP-3B.0 QA application evidence:
[`CP3B0_QA_APPLICATION_20260728.md`](./CP3B0_QA_APPLICATION_20260728.md).

## CP-4 — Public website and legal integration

Status: `NOT STARTED`

- **CP-4.1 — WordPress source and deployment prerequisite:** export, backup,
  ownership, staging and rollback before any edit.
- **CP-4.2 — Public website and legal integration:** canonical client-area link,
  legal surfaces, first layers and separated privacy/contract/marketing/cookie
  controls, with professional legal review still pending.
- **CP-4.3 — Invitation email delivery adapter:** provider boundary, templates,
  domain authentication, rate limits, audit, safe logs, fallback and monitoring.

No website form may auto-create/link a CRM client.

## CP-5 — Production security release

Status: `NOT STARTED`

- **CP-5.1 — Production readiness gate:** independently authorized identity,
  hashes, backup, rollback, secrets, observability, support and incident response.
- **CP-5.2 — Restricted production pilot:** designated invite-only cohort, smoke
  tests, monitoring and exact rollback; no public signup.
- **CP-5.3 — Production stabilization:** errors, performance, accessibility,
  support, metrics, documentation and closure of every P0/P1.

No invoice, payment, fiscal-close or numbering write is authorized by CP-5.

## CP-6 — Final smoke and handoff

Status: `NOT STARTED`

- complete smoke and evidence package;
- cross-client isolation, revocation, invoice expiry and request-review proof;
- legal links and consent separation;
- user and operations manuals plus support/incident runbooks;
- explicit ROPA, retention, rights and breach ownership;
- final debt, acceptance, P0/P1 closure and canonical roadmap closeout.

## Dependency order

```text
internal staff trust split
  -> memberships/invitations/applications
  -> narrow portal APIs + audit/rate limit
  -> private document boundary
  -> two-client QA proof
  -> portal UI
  -> QA authorization, accessibility and performance proof
  -> WordPress/legal integration
  -> production readiness and restricted pilot
  -> stabilization and final handoff
```

No downstream gate may run around a failed upstream security boundary.
