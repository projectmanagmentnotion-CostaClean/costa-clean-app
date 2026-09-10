# Client Portal Implementation Roadmap

Date: 2026-09-10
Current state: CP-3B.2, CP-3B.3, CP-3B.4 and CP-3B.5A remain complete or partial as recorded below; CP-3B.5B is owner-approved, CP-3B.5C implementation is complete and CP-3B.5D closes the QA trusted contracts and real UI wiring. CP-3C.1 controlled QA fixtures are active and ready for CP-3C.2; authenticated runtime/provider certification remains separate debt.

## Progress and execution authority

- Weighted scope estimate: approximately **65% complete / 35% remaining**.
- This is a scope-weighted orientation, not an hours or delivery-date estimate.
- Current implementation gate: **CP-3B.5D — trusted contract and UI wiring**,
  completed in QA only; production and CRM remain unchanged.
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

## Current Reconciliation — 2026-09-10

This section is authoritative for current sequencing. Earlier paragraphs and
dated closeout notes are retained as historical evidence and are not reopened.

- **CP-3B.2:** implementation complete; exact `390x844` visual/telemetry
  certification debt remains explicit.
- **CP-3B.3:** `PARTIAL — implementation complete; authenticated Console,
  Network and same-key browser evidence remain certification debt`.
- **CP-3B.4:** `PARTIAL — implementation complete; authenticated download,
  expiry and denial evidence remain certification debt`.
- **CP-3B.5A:** `PARTIAL — backend QA contract deployed; authenticated E2E and
  provider configuration evidence remain pending`.
- **CP-3B.5B:** `OWNER_APPROVED` on 2026-09-10. Block 1 and Block 2 remain the
  visual source of truth in the existing `Costa Clean Client Portal` Stitch
  project at iPhone `390x844`.
- **CP-3B.5C:** `IMPLEMENTATION_COMPLETE`. Owner-approved Google login,
  onboarding, account, members, security, legal, marketing and safe states are
  wired into portal routing without production changes.
- **CP-3B.5D:** `CONTRACT_AND_WIRING_COMPLETE` in QA. Onboarding submission,
  member reads, pending-invitation reads, revoke, and versioned marketing
  preference reads/writes use narrow service-role Edge boundaries and trusted
  RPCs. Authenticated browser certification, Google provider verification and
  invitation delivery remain explicit debt; invitation delivery is deferred to
  CP-4.3.
- **CP-3C.1:** `FIXTURES_ACTIVE_READY_FOR_CP3C2`. The separately authorized QA
  identities, deterministic states, protected prestate, private ledger,
  sanitized manifest and dry-run cleanup package are active in QA only.
- **CP-3C.2:** `PARTIAL — CP-3.2R2 replaced corrupted QA identities and
  preserved the original rows; invitation acceptance and integrated browser
  evidence remain`. See
  [`CP3C2_AUTHORIZATION_E2E_QA.md`](./CP3C2_AUTHORIZATION_E2E_QA.md).
- **CP-3C.3:** `NOT STARTED`. Its final authenticated and
  visual certification work consumes the carried evidence debt; it does not
  block the CP-3B.5C implementation gate by status label alone.
- **CP-4, CP-5 and CP-6:** `NOT STARTED`.

Dependency semantics: an implementation gate may proceed when its source,
contract and design prerequisites are complete. Final authenticated QA,
provider verification and owner approval are independent certification gates;
they must remain visible as debt and cannot be silently treated as PASS.

### CP-3B.5B — Stitch owner-review package

Status: `OWNER_APPROVED` (2026-09-10)

Project: `Costa Clean Client Portal` (Stitch ID `7915940018854753326`)

Viewport: iPhone `390x844` only. Generated Block 1 frames:

- `PORTAL_LOGIN_GOOGLE_V1`
- `PORTAL_ONBOARDING_TYPE_V1`
- `PORTAL_ONBOARDING_INDIVIDUAL_V1`
- `PORTAL_ONBOARDING_BUSINESS_V1`
- `PORTAL_ONBOARDING_BILLING_V1`
- `PORTAL_ONBOARDING_PRIVACY_MARKETING_V1`
- `PORTAL_ONBOARDING_REVIEW_V1`
- `PORTAL_ONBOARDING_PENDING_REVIEW_V1`

The existing approved Profile, Properties, Property Detail, Property
Correction, six-cell navigation and independent WhatsApp action were preserved.
No iPad/desktop frames, React code or runtime changes were made. Block 2
contains the following exact owner-review identifiers:

- `PORTAL_MEMBERS_LIST_V1`
- `PORTAL_MEMBERS_MEMBER_VIEW_V1`
- `PORTAL_MEMBER_INVITE_V1`
- `PORTAL_MEMBER_INVITE_SENT_V1`
- `PORTAL_MEMBER_DETAIL_V1`
- `PORTAL_MEMBER_REVOKE_V1`
- `PORTAL_INVITATION_ACCEPT_V1`
- `PORTAL_INVITATION_EXPIRED_V1`
- `PORTAL_INVITATION_REVOKED_V1`
- `PORTAL_INVITATION_USED_V1`
- `PORTAL_INVITATION_INVALID_V1`
- `PORTAL_ACCOUNT_SECURITY_V1`
- `PORTAL_ACCOUNT_SECURITY_PASSWORD_V1`
- `PORTAL_ACCOUNT_SECURITY_GOOGLE_V1`
- `PORTAL_LEGAL_PRIVACY_V1`
- `PORTAL_LEGAL_DOCUMENT_V1`
- `PORTAL_MARKETING_PREFERENCES_V1`
- `PORTAL_MARKETING_PREFERENCES_UPDATED_V1`
- `PORTAL_ERROR_SESSION_EXPIRED_V1`
- `PORTAL_ERROR_NETWORK_V1`
- `PORTAL_ERROR_FORBIDDEN_V1`
- `PORTAL_ERROR_GENERIC_V1`
- `PORTAL_FORM_VALIDATION_V1`
- `PORTAL_ACTION_LOADING_V1`
- `PORTAL_MEMBERS_EMPTY_V1`

Stitch's internal numeric frame identifiers are not exposed in the current
project view; the names above are the exact owner-review identifiers.

Next gate: **CP-3C authenticated certification** after the carried provider and
browser evidence debt is scheduled. Do not start it automatically.

### CP-3B.5C — Owner-approved Stitch UI implementation

Status: `IMPLEMENTATION_COMPLETE`

Implemented in `src/portal/**`: Google login entry, five-step onboarding,
account hub, members/security/legal/marketing routes, role-safe member surfaces,
loading/error/validation states and existing six-cell navigation/WhatsApp
preservation. No CRM, production, Supabase schema, Edge Function or secret was
modified.

CP-3B.5D adds the missing trusted read/write boundaries and wires the approved
surfaces to them. Invitation delivery remains intentionally unavailable and is
deferred to CP-4.3; the UI never claims that an email was sent. Exact
`390x844` authenticated visual, Console and Network certification, plus private
Google provider verification, remain separate certification debt.

Verification: full suite `633 passed, 4 skipped` across `104` files; lint, QA
build and diff-check pass. QA trusted functions were applied/deployed without
fixtures or production changes. Supabase advisor warnings outside these new
service-role-only functions remain pre-existing and are not silently relabeled.

CP-3B.2A QA application V6R1E remains the current reproducible rebaseline gate.
It is still separate from the full CP-3B.2 Definition of Ready. The real QA
closeout for the reviewed-change migration now has executed postcheck, matrix
and concurrency evidence with zero residual QA or production writes. Customer-
safe canonical status mapping and opaque profile/property identifier handling
are approved for implementation. CP-3B.2 is now the next active gate.

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
  `IMPLEMENTATION_COMPLETE — 390x844 visual/telemetry certification debt`; account context, read models and reviewed
  change requests without canonical-table writes. The customer-safe canonical
  status and opaque-ID mappings are frozen and the frontend implementation is
  the active gate. Local implementation now includes the isolated `/portal`
  shell, real profile/property read adapter, strict backend `publicRef`
  handling for properties, and reviewed-change forms. QA contract alignment is
  applied only to `kpvvydthlxupjjqqdpxy`; the remaining gate is exact
  `390x844` visual certification. Its mobile workspace overflow fix is now in
  the frontend; numeric DevTools metrics and console/network evidence remain
  the gate, not a new roadmap block.
- Owner decision update: the final mobile nav is `Inicio | Inmuebles | Servicios
  | Facturas | Cuenta | Más`; `Más` is integrated as the sixth visible control
  while preserving its bottom sheet. WhatsApp is a persistent portal action.
  This updates the implementation target but does not itself certify the
  `390x844` manual evidence gate.
- **CP-3B.3 — Services and requests:** `PARTIAL — authenticated QA evidence
  captured`; pending-review workflow, cancellation, explicit feedback and
  zero-duplicate remote reconciliation are evidenced. DevTools console/
  network and authenticated same-key response remain `NOT_EXECUTED`; the
  unrecoverable session-scoped key is explicit certification debt. Existing
  trusted contract-matrix coverage remains independent supporting evidence,
  not a substitute for the authenticated portal retry.
- **CP-3B.4 — Invoices and private documents:** customer-safe financial states,
  one private QA PDF fixture, and the narrow `documentAvailable` /
  `documentId` contract are implemented. Status: `PARTIAL — authenticated
  browser download, expiry and negative authorization evidence pending`.
  Evidence: `CP3B4_INVOICES_PRIVATE_DOCUMENTS.md`.
- **CP-3B.5A — Backend members, security and onboarding contract:** client roles,
  invitations/revocation, account security, versioned terms and layered privacy.
  Current audit status: `PARTIAL — backend QA deployed; authenticated E2E
  identity/configuration pending`. Evidence:
  `CP3B5_ACCOUNT_SECURITY_GOOGLE_ONBOARDING.md` and
  `cp3b5a_qa_package.manifest.json`. Production remains unchanged.
- **CP-3B.5B — Stitch owner-review package:**
  `DESIGN_COMPLETE_OWNER_APPROVAL_PENDING`; the eight iPhone Block 1 frames and
  25 iPhone Block 2 frames are recorded in the current reconciliation above.
  No code or runtime work is authorized by this design-only gate.
- **2026-09-10 authenticated certification attempt:** the available Chrome
  portal tab was unauthenticated at `/portal/login`. CP-3B.4 download/expiry/
  denial evidence and CP-3B.5A authenticated onboarding evidence remain
  `NOT_EXECUTED`; no credentials or remote writes were used. Local checks
  passed: `npm test` (629 passed, 4 skipped), lint, QA build, and diff check.
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

CP-3B.2 implementation evidence:
[`CP3B2_REAL_READ_CONTRACT_AUDIT.md`](./CP3B2_REAL_READ_CONTRACT_AUDIT.md) and
[`QA_LEGACY_SYNTHETIC_DATA_CLEANUP.md`](./QA_LEGACY_SYNTHETIC_DATA_CLEANUP.md).

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
