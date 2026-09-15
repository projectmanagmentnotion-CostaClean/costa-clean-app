# Client Portal Implementation Roadmap

Date: 2026-09-10
Current state: CP-3B.2, CP-3B.3, CP-3B.4 and CP-3B.5A remain complete or partial as recorded below; CP-3B.5B is owner-approved, CP-3B.5C implementation is complete and CP-3B.5D closes the QA trusted contracts and real UI wiring. CP-3C.1 controlled QA fixtures are active and ready for CP-3C.2; authenticated runtime/provider certification remains separate debt. CP-4.1 is closed with an active SiteGround non-production preview; CP-4.2A is partial and CP-4.2B.1 remains partial because SiteGround private environment synchronization is blocked by the site's inode quota.

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
- **CP-3C.2:** `DONE — CP-3C.2R3 QA CORS, invitation lifecycle and
  authenticated authorization certification complete; Google provider and
  CP4.3 email delivery remain external debts`. See
  [`CP3C2_AUTHORIZATION_E2E_QA.md`](./CP3C2_AUTHORIZATION_E2E_QA.md).
- **CP-3C.3:** `DONE — authenticated QA matrix, responsive/accessibility
  evidence and exact QA cleanup complete; external provider debts remain`. See
  [`CP3C3_VISUAL_ACCESSIBILITY_PERFORMANCE_QA.md`](./CP3C3_VISUAL_ACCESSIBILITY_PERFORMANCE_QA.md).
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

CP-3C.3R8.1 (2026-09-14) closes the authenticated QA matrix and exact cleanup
in QA. The owner accepts the dynamic-entry LCP median of `2703.8ms` as
explicit P2 performance debt; the `2500ms` budget remains missed, not passed.
Google QA provider configuration/runtime and invitation email delivery remain
external debts. Portal/CRM isolation is preserved and no more CP-3 performance
experiments are planned. CP-4.1 is not started.

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

Status: `CP4_1_DONE_CP4_2A_PARTIAL_CP4_2B_PENDING`

- **CP-4.1 — Public Website Source, Hosting & Deployment Prerequisite:** `DONE`.
  The source repository, production WordPress runtime, SiteGround hosting
  boundary, DNS and provider backup/restore capability are verified read-only.
  Private WordPress files and database exports are now held in ignored local
  custody with matching hashes. The native SiteGround Node.js preview is active
  at the temporary URL recorded in CP-4.1G. `ROLLBACK_REHEARSAL =
  PASS_ISOLATED_NON_PRODUCTION_RESTORE`; Vercel remains preview-only. See
  `docs/public-web/CP4_1_PUBLIC_WEBSITE_DEPLOYMENT_PREREQUISITE.md`.
- **CP-4.1C — Private database export and native preview integration proof:**
  database export and cleanup pass; SiteGround native preview is closed in
  CP-4.1G with an active temporary project.
- **CP-4.2 — Public website and legal integration:** `PARTIAL`; CP-4.2A foundation and the CP-4.2B QA lead contract are implemented in the independent public-web preview, while SiteGround private environment configuration blocks final preview intake certification; canonical client-area link,
  legal surfaces, first layers and separated privacy/contract/marketing/cookie
  controls, with professional legal review still pending.

CP-4.1D historical update: private files/database custody and an isolated local
restore rehearsal passed. The earlier native SiteGround selector blocker was
superseded by the CP-4.1G retry; no production change was made. CP-4.2 remains
`NOT STARTED`.

CP-4.1G update: the authenticated SiteGround retry exposed
`projectmanagmentnotion-CostaClean/costa-clean-web`, accepted `main`, and
completed an active non-production Node.js deployment at
`https://vilmatibisayg1.sg-host.com`. Route, HTTPS, noindex, responsive
overflow and console checks passed; production WordPress, DNS, email and the
production domain were unchanged. No new technical response from Daniel V.
was visible, so no provider root cause is claimed. CP-4.1 is `DONE` and
CP-4.2A is `PARTIAL_FOUNDATION_COMPLETE_CP4_2B_PENDING`.

## CP-4.2A — Public legal, consent and portal foundation

Status: `PARTIAL_FOUNDATION_COMPLETE_CP4_2B_PENDING`.

The independent public-web repository now contains centralized portal URL
configuration, an Área cliente entry point, legal route/redirect scaffolding,
versioned source registry, revocable necessary/analytics/marketing consent,
separate optional marketing consent in the preview quote flow, and a typed
tracking abstraction that does not activate production tags in preview. The
current production legal pages were identified read-only, but their
substantive content was not readable because the public provider challenge
intercepted the direct routes; no legal copy or fingerprint is claimed as
migrated. The verified external portal target is
`https://app.costacleanbcn.com/portal`.

No CRM runtime, Supabase schema, production WordPress, production database,
DNS, email DNS, domain cutover or real lead intake changed. CP-4.2B remains
partial until the separately certified public lead contract is exercised from
the SiteGround preview.
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

## CP-4.1E — GitHub reauthentication and SiteGround native preview final proof

Owner GitHub sudo reauthentication completed. SiteGround's GitHub App is
active with read-only code/metadata access and `ALL_REPOSITORIES`;
`projectmanagmentnotion-CostaClean/costa-clean-web` on `main` is accessible in
GitHub. SiteGround still leaves its GitHub import flow in indefinite loading
after `CONTINUAR`, without repository or branch selectors, so no Node.js
project or temporary URL was created. The remaining issue is classified as
`PARTIAL_SITEGROUND_PROVIDER_PLATFORM_BLOCKED`. Support evidence is prepared
but unsent; production, DNS, email, WordPress and CRM remain unchanged.
CP-4.2 remains `NOT_STARTED`.

## CP-4.1F — SiteGround provider support escalation

An owner-authorized technical chat was opened for `costacleanbcn.com` on
2026-09-14 at 16:05 Europe/Madrid. No ticket ID is visible while the chat is
open (`CASE_ID = NOT_VISIBLE_CHAT_OPEN`). Agent `Daniel V.` acknowledged the
request at 16:06 and is reviewing it. No integration reset, retry, preview
creation or technical fix has occurred. `SUPPORT_CASE_OPEN = YES` and
`SUPPORT_CASE_STATUS = OPEN_AWAITING_PROVIDER_REVIEW`. CP-4.1 remains
`PARTIAL_SITEGROUND_PROVIDER_PLATFORM_BLOCKED`; CP-4.2 remains `NOT_STARTED`.

## CP-4.1G — SiteGround native preview closeout

The provider retry was executed in the authenticated normal Chrome session.
The repository and `main` branch became visible and selectable, the build
reached `Desplegado`, and the resulting non-production project is active at
`https://vilmatibisayg1.sg-host.com`. The preview passed route rendering,
HTTPS, `noindex`, critical-console-error and overflow checks at
`390x844`, `768x1024` and `1440x900`; no form was submitted and no real lead
was created. No production WordPress, DNS, email or domain cutover changed.

The support chat showed no new technical provider response at execution time,
so the observed retry success is recorded without asserting a provider root
cause. `PUBLIC_PRODUCTION_TARGET = SITEGROUND`,
`WORDPRESS_ROLE = ROLLBACK_AND_MIGRATION_SOURCE_ONLY`, and
`VERCEL_ROLE = TEMPORARY_PREVIEW_ONLY`. CP-4.1 is `DONE`; CP-4.2 remains
`NOT_STARTED`.

## CP-4.2B — Safe public lead intake and QA CRM contract

| Field | Result |
|---|---|
| Scope | `QA_ONLY`; public lead/request intake; no CP-4.3 |
| QA project | `kpvvydthlxupjjqqdpxy` (`CostaClean QA`) |
| Production changes | `0` |
| Public transport | SiteGround server `/api/quote` -> signed QA Edge Function -> narrow QA RPC |
| Supabase migration | Applied: `20260914170000_cp42b_public_lead_intake_qa.sql` |
| Edge Function | `public-lead-intake`, `ACTIVE`, JWT verification disabled because HMAC is mandatory |
| HMAC/replay | SHA-256 body binding; five-minute timestamp window; constant-time comparison |
| Idempotency | Submission UUID is required and ledger-backed |
| CRM writes | QA `leads` only; no client/property/job/quote/invoice/payment creation or links |
| RLS | `leads` and intake ledger `ENABLE ROW LEVEL SECURITY` plus `FORCE ROW LEVEL SECURITY` |
| RPC grants | `service_role` only; `anon` and `authenticated` denied |
| QA state | Ledger `0`; leads `2`; existing QA entities unchanged |
| Legal state | Notice/privacy substantive recovery; cookie/terms `SHORTCODE_ONLY`; professional review pending |
| SiteGround private env | `BLOCKED`; current project controls do not expose env vars and `SITE TOOLS` redirected to login |
| Synthetic lead | `NOT_EXECUTED`; no residue to clean |
| CP-4.1 | `DONE` |
| CP-4.2 | `PARTIAL_SITEGROUND_ENV_CONFIGURATION_BLOCKED` |
| CP-4.3 | `NOT_STARTED` |

The route fails closed when the exact QA endpoint, secret or environment is
missing. The QA Supabase dashboard accepted a secret replacement without
exposing its value. SiteGround then blocked the corresponding update because
the preview site exceeded its inode quota (`99.79%`; disk usage reported as
`53.58%`) and disabled Site Tools. The deployed origin guard moved the live
preview request from `403` to the HMAC boundary (`401`), but the synchronized
secret could not be installed in SiteGround. No synthetic lead or ledger row
was created. The remaining gate is to re-enable Site Tools without deleting
production resources, set the same QA secret and endpoint as private
SiteGround variables, redeploy once, and run synthetic create/idempotency/
consent/cleanup certification against the temporary preview URL. DNS,
production WordPress, email DNS, production Supabase and customer data remain
unchanged. CP-4.3 remains `NOT_STARTED`.
