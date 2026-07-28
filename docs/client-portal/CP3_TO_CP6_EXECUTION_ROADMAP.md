# Client Portal CP-3 to CP-6 Execution Roadmap

Date: 2026-07-28

Status: CP-3A/CP-3B.0/CP-3B.0A and CP-3B.0 QA application `DONE`;
CP-3B.1 `UNBLOCKED_NOT_STARTED`; later gates are `NOT STARTED`

Canonical status: [`IMPLEMENTATION_ROADMAP.md`](./IMPLEMENTATION_ROADMAP.md)

Agent permissions: [`AGENT_EXECUTION_MATRIX.md`](./AGENT_EXECUTION_MATRIX.md)

This document expands the canonical roadmap; it does not authorize execution.
Start every block with `project-continuation`, confirm its Definition of Ready,
and close it independently before opening the next gate. Remote QA, production,
WordPress and email-provider operations always need their own exact human gate.
Suggested file paths are forecasts, not permission to rewrite those modules.

## CP-3A — Portal UI foundation

| Field | Specification |
|---|---|
| Status | `DONE — local source/runtime evidence`; closed 2026-07-28 |
| Objective | Isolate `/portal` behind an independent bootstrap, Auth state machine and typed server-boundary adapters. |
| User outcome | A responsive portal shell exposes honest loading, unauthenticated, pending, authenticated, forbidden and error states without exposing CRM internals. |
| Dependencies | CP-2B evidence closed; UI contract approved; local preview available; no remote write required. |
| Agents | Primary `senior-fullstack-builder`; specialists `frontend-ux-accessibility`, `qa-e2e-specialist`, `security-privacy-auditor`; independent reviewer `pr-quality-gate`. |
| In scope | Route isolation, independent bootstrap, typed adapters, state machine, shell, base pages and local preview. |
| Out of scope | Real login flows, remote writes, QA fixtures, WordPress, production, email delivery and business workflows. |
| Likely files/modules | App/router entry, new portal bootstrap/shell/pages/adapters/styles/tests; no Supabase migrations or Edge changes. |
| Definition of Ready | Route collision analysis, adapter contract, UI state diagram, responsive wireframe, exact allowed files and local-only validation plan approved. |
| Implementation steps | Add isolated entry and guard; model Auth states; add typed no-write adapters; build flat responsive shell/base pages; add unit/route tests; preview locally. |
| Acceptance | `/portal` cannot render CRM navigation; every state is explicit; no fake save; no canonical-table client access; existing routes remain unchanged. |
| Validations | Targeted tests, route isolation tests, `npm test`, `npm run lint`, `npm run build`, diff and secret/private-file scan. |
| Visual QA | Visible local QA at 390x844, 768x1024 and desktop; keyboard order, focus, overflow and complete state review. |
| Security/privacy | No `service_role`; no email-based linkage; no PII fixtures; adapters expose only portal-specific DTOs. |
| Rollback | Revert the single CP-3A commit; no remote state exists to clean. |
| Stop conditions | Any need for schema/Auth/Edge writes, ambiguous route ownership, CRM regression, secret exposure or failed isolation test. |
| Closeout documentation | [`CP3A_PORTAL_UI_FOUNDATION_20260728.md`](./CP3A_PORTAL_UI_FOUNDATION_20260728.md); route/state inventory, runtime evidence, risks and exact next gate recorded. |
| Expected commit | `feat: establish client portal UI and auth boundary` |
| Next gate | CP-3B.1 |

## CP-3B.0 — Self access context backend contract

| Field | Specification |
|---|---|
| Status | `DONE — source/local/QA validated`; QA application `DONE` |
| Objective | Resolve the authenticated caller's own portal access state without a browser-provided `user_id` or prior `client_id`. |
| User outcome | No portal UI change yet; CP-3B.1 now has a QA-validated narrow backend contract for active, multi-client, pending, suspended, revoked and no-access states. |
| Dependencies | CP-3A closed; CP-2B frozen boundary present; original bootstrap block reproduced. |
| Agents | Planning `implementation-planner`; implementation/review `supabase-guardian`, `security-privacy-auditor`, `qa-e2e-specialist`; independent reviewer `pr-quality-gate`. |
| In scope | One forward-only zero-parameter RPC, source tests, disposable PostgreSQL proof, immutable manifest and read-only QA plan/preflight. |
| Out of scope | Frontend, production, Auth users, email/metadata tenancy, Edge, Storage, RLS/policy/table-grant changes and migration history; QA application occurred only in the separately authorized V2 gate. |
| Acceptance | `auth.uid()` is the only identity; active memberships are minimal and ordered; inactive identifiers are hidden; anon denied; authenticated granted; no PII/write. |
| Validations | Original-block reproduction, six-state/cross-user/multi-client matrix, rollback/reapply, zero residue, full test/lint/build and hash/security review. |
| Rollback | Local proof drops only `portal_resolve_self_access_context()` and proves reapply; remote rollback requires a future private backup and exact gate. |
| Stop conditions | Hash/target mismatch, CP-2B drift, need for email/metadata/client parameter, PII, policy/table grant change, remote write or failed isolation. |
| Evidence | [`CP3B0_SELF_ACCESS_CONTEXT_CONTRACT.md`](./CP3B0_SELF_ACCESS_CONTEXT_CONTRACT.md), [`CP3B0_EXACT_QA_AUTHORIZATION.md`](./CP3B0_EXACT_QA_AUTHORIZATION.md) and [`CP3B0_QA_APPLICATION_20260728.md`](./CP3B0_QA_APPLICATION_20260728.md). |
| Expected commit | `security: add self-resolving portal access context` |
| Next gate | CP-3B.1, unblocked but not started |

## CP-3B.0A — QA application execution and recovery package

| Field | Specification |
|---|---|
| Status | `DONE`; package closed and separately authorized QA execution passed |
| Objective | Freeze a deterministic QA-only apply, postcheck, transactional matrix and one-function recovery runner for the CP-3B.0 RPC. |
| User outcome | No UI change; the package enabled the exact QA application to run once with verified backup, target, hashes and recovery controls. |
| Dependencies | CP-3B.0 V1 and CP-2B V5 chains intact; PostgreSQL 17; authenticated QA reads; production excluded. |
| Agents | Planning `implementation-planner`; implementation/review `supabase-guardian`, `security-privacy-auditor`, `qa-e2e-specialist`; independent reviewer `pr-quality-gate`. |
| In scope | New V2 SQL/runner/proof/tests/manifest, private HEAD-bound backup and snapshot, live QA read-only preflight and documentation. |
| Out of scope | QA apply, frontend, production, Auth Admin, remote Auth users, Edge, Storage, RLS/policy/table-grant/history changes and CP-3B.1. |
| Acceptance | Exact pre-effect order; unauthorized/production/drift/offline gates fail closed; one apply; complete postcheck; matrix always rolls back; recovery drops only the target function once. |
| Validations | V1/CP-2B/V2 hashes, disposable apply/postcheck/matrix/recovery, negative gates, live QA function-absent preflight, private backup, full tests/agents/lint/build. |
| Rollback | Source revert before application; future QA recovery uses only the frozen atomic one-function drop and verifies the prestate digest. |
| Stop conditions | Missing explicit V2 authorization, target/hash/HEAD/backup drift, production link, unexpected function, SQL write during preflight, secret output or failed recovery. |
| Evidence | [`CP3B0A_QA_EXECUTION_PACKAGE.md`](./CP3B0A_QA_EXECUTION_PACKAGE.md) and [`CP3B0_EXACT_QA_AUTHORIZATION_V2.md`](./CP3B0_EXACT_QA_AUTHORIZATION_V2.md). |
| Expected commit | `security: prepare self-access context QA application` |
| Next gate | CP-3B.1 |

## CP-3B.0 QA application V2

| Field | Specification |
|---|---|
| Status | `DONE`; closed 2026-07-28 |
| Objective | Apply only the frozen zero-parameter self-context function to the authorized QA project and prove absence of collateral effects. |
| Result | One apply, one function created, QA matrix `PASS_ROLLED_BACK`, zero synthetic residue and zero recovery attempts. |
| Invariants | Portal rows, policies, table grants, Auth users, Edge, Storage and migration history unchanged; production, WordPress and SiteGround untouched. |
| Validation | Exact hashes and target; fresh HEAD-bound private backup; full pre-effect order; runner postcheck; independent read-only catalog/digest/residue verification; full regression. |
| Evidence | [`CP3B0_QA_APPLICATION_20260728.md`](./CP3B0_QA_APPLICATION_20260728.md). |
| Next gate | CP-3B.1, unblocked and not started |

## CP-3B.1 — Authentication and access lifecycle

| Field | Specification |
|---|---|
| Status | `UNBLOCKED_NOT_STARTED` |
| Objective | Implement the portal Auth lifecycle against narrow CP-2B boundaries. |
| User outcome | Clients can log in, recover/change passwords, handle expiry and receive safe pending, invitation, suspended or revoked outcomes. |
| Dependencies | CP-3A closed; CP-3B.0 deployed and proven in QA under a separate exact authorization; approved Auth DTOs; invitation/recovery URLs and anti-enumeration copy defined. |
| Agents | Primary `senior-fullstack-builder`; specialists `security-privacy-auditor`, `qa-e2e-specialist`, `supabase-guardian` read-only; reviewer `pr-quality-gate`. |
| In scope | Login, logout, recovery, password change, session expiry, pending review, invitation token handling, suspended/revoked states and anti-enumeration. |
| Out of scope | Public self-approval, email-to-client linkage, MFA enforcement, production users, membership administration and email provider delivery. |
| Likely files/modules | Portal Auth adapter/state machine/pages/StepFlows/tests and narrow existing endpoint clients. |
| Definition of Ready | Exact endpoint contracts, redirect allowlist, copy equivalence, token lifecycle, session policy, rate-limit behavior and synthetic test identities approved. |
| Implementation steps | Bind adapters; implement equal-response forms; handle one-time token/session transitions; add safe errors; test every state and replay/expiry path. |
| Acceptance | No enumeration signal; tokens absent from logs/storage beyond necessity; revoked/suspended users lose access; errors do not disclose membership. |
| Validations | Auth unit/integration tests, negative-state matrix, expiry/replay tests, baseline test/lint/build and secret scan. |
| Visual QA | Mobile/iPad/desktop, keyboard, password manager, live-region errors, focus restoration and expired-link recovery. |
| Security/privacy | PKCE/session controls where applicable, generic recovery response, short token lifetime, rate limiting and MFA-ready model. |
| Rollback | Revert the CP-3B.1 commit and remove only synthetic QA identities under the authorized cleanup plan. |
| Stop conditions | Unexpected Auth mutation, cross-client access, token in logs, redirect escape, missing cleanup authority or production identity. |
| Closeout documentation | Auth state diagram, negative matrix, cleanup evidence, unexecuted MFA debt and next gate. |
| Expected commit | `feat: implement client portal authentication lifecycle` |
| Next gate | CP-3B.2 |

## CP-3B.2 — Profile and properties

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Present account context, profile and properties through narrow read models and reviewed change requests. |
| User outcome | A client sees only their account/property data and can request a correction without directly rewriting CRM records. |
| Dependencies | CP-3B.1 closed; client-context/view contracts and reviewed-change workflow available. |
| Agents | Primary `senior-fullstack-builder`; specialists `frontend-ux-accessibility`, `security-privacy-auditor`; reviewer `pr-quality-gate`. |
| In scope | Account context, profile, property list/detail, change-request StepFlow, loading/empty/error/forbidden states. |
| Out of scope | Direct `clients`/`properties` updates, address normalization rewrite, staff approval UI and cross-client support access. |
| Likely files/modules | Portal account/profile/property adapters, pages, request forms, tests and presentation models. |
| Definition of Ready | Visible/editable classification mapped, DTO fields approved, review SLA/copy agreed and two-client negative fixtures available. |
| Implementation steps | Render narrow DTOs; add state-complete list/detail; submit idempotent reviewed requests; show receipt/status; test denial. |
| Acceptance | Only current-client resources appear; canonical records remain unchanged; resubmission is safe; forbidden differs from empty without leaking data. |
| Validations | Adapter/ownership tests, cross-client negative tests, request idempotency, test/lint/build and accessibility checks. |
| Visual QA | Compact mobile lists, flat detail views, first actionable field visible, iPad overflow and keyboard/error states. |
| Security/privacy | Data minimization, no hidden internal notes/IDs, server-derived client context and auditable reviewed changes. |
| Rollback | Revert UI commit; clean only synthetic requests using the exact QA cleanup procedure. |
| Stop conditions | Direct canonical write, user-supplied client ID trusted, internal/fiscal field exposure or request saved without receipt. |
| Closeout documentation | Field exposure map, denial evidence, reviewed-request behavior and next gate. |
| Expected commit | `feat: add portal profile and property views` |
| Next gate | CP-3B.3 |

## CP-3B.3 — Services and requests

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Expose service history and a real pending-review service-request lifecycle. |
| User outcome | Clients can inspect their services, submit/cancel eligible requests and see truthful review status. |
| Dependencies | CP-3B.2 closed; request RPC/Edge contracts, allowed transitions and idempotency rules verified. |
| Agents | Primary `senior-fullstack-builder`; specialists `business-rules-test-engineer`, `qa-e2e-specialist`; reviewer `pr-quality-gate`. |
| In scope | Service list/detail, request StepFlow, pending-review receipt, eligible cancellation, idempotency and retry feedback. |
| Out of scope | Auto-booking, staff scheduling, price commitment, invoice creation, direct `jobs/services` writes and simulated saves. |
| Likely files/modules | Portal service/request adapters, pages, forms, transition model and tests. |
| Definition of Ready | Transition table, required fields, duplicate key strategy, cancellation window and staff review ownership approved. |
| Implementation steps | Render service DTOs; build one-decision StepFlow; submit with idempotency key; surface authoritative status; implement eligible cancel; test retries. |
| Acceptance | One action creates at most one request; only allowed owner sees/cancels it; no booking/price promise; every write has authoritative feedback. |
| Validations | Business transition tests, retry/concurrency tests, cross-client denials, cleanup, test/lint/build. |
| Visual QA | Mobile StepFlow, disabled/loading/success/error/retry states, keyboard and concise request cards. |
| Security/privacy | Server ownership, bounded fields, free-text minimization, audit event and rate limit. |
| Rollback | Revert UI commit and clean exact synthetic request IDs; no canonical service/job mutation. |
| Stop conditions | Duplicate writes, direct canonical access, invented price/date, unsafe free text or uncleanable QA residue. |
| Closeout documentation | Transition evidence, idempotency proof, cleanup and next gate. |
| Expected commit | `feat: add client service request workflow` |
| Next gate | CP-3B.4 |

## CP-3B.4 — Invoices and private documents

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Provide read-only invoice views and expiring private document downloads. |
| User outcome | A client sees only their invoices/payment status and can download an authorized PDF through a 60-second signed URL. |
| Dependencies | CP-3B.3 closed; private bucket and signing boundary verified; no financial writes required. |
| Agents | Primary `senior-fullstack-builder`; specialists `business-rules-test-engineer`, `security-privacy-auditor`, `supabase-guardian`; reviewer `pr-quality-gate`. |
| In scope | Invoice list/detail, payment-state display, request-to-sign/download, expiry and safe missing/forbidden errors. |
| Out of scope | Invoice/payment edits, regeneration, numbering, fiscal close, public objects, permanent URLs and frontend signing keys. |
| Likely files/modules | Portal invoice DTOs/pages/download adapter/tests; no PDF generator or financial-table mutation. |
| Definition of Ready | Allowed fields, ownership chain, object path contract, 60-second TTL, audit event and expired-link behavior approved. |
| Implementation steps | Render read model; request authorization just-in-time; open signed URL without persisting it; handle expiry/retry; test owner/non-owner. |
| Acceptance | Cross-client invoice/document deny; URL expires at 60 seconds; bucket remains private; no financial row or sequence changes. |
| Validations | Two-client matrix, expiry/replay, object-not-found, audit check, unchanged financial counts/sequences, test/lint/build. |
| Visual QA | Compact invoice list/detail, clear download progress/expiry/error, mobile/iPad overflow and accessible status text. |
| Security/privacy | Server-derived ownership, private Storage, no URL analytics leakage, cache restrictions and minimal invoice DTO. |
| Rollback | Revert UI commit; delete only synthetic objects/fixtures under exact cleanup, preserving bucket and canonical invoices. |
| Stop conditions | Public object, URL over 60 seconds, direct storage listing, financial mutation, sequence drift or cross-client access. |
| Closeout documentation | TTL and denial evidence, financial invariants, cleanup and next gate. |
| Expected commit | `feat: add private portal invoice downloads` |
| Next gate | CP-3B.5 |

## CP-3B.5 — Members, security and legal acceptance

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Expose bounded membership administration, account security and versioned legal acceptance. |
| User outcome | A `client_admin` can invite/revoke members; members understand security and accept current portal terms separately from privacy/marketing/cookies. |
| Dependencies | CP-3B.4 closed; role matrix, invitation lifecycle, acceptance versions and legal copy specifications approved. |
| Agents | Primary `senior-fullstack-builder`; specialists `security-privacy-auditor`, `enterprise-agent-architect`; reviewer `pr-quality-gate`. |
| In scope | `client_admin`/`client_member`, invitation/revocation UI, account security, versioned terms, layered privacy and a separate email-adapter interface. |
| Out of scope | Email provider deployment, public signup, marketing opt-in bundling, cookie consent, production members and professional legal approval claim. |
| Likely files/modules | Portal member/security/legal adapters, pages, StepFlows, acceptance model and tests. |
| Definition of Ready | Exact role permissions, revocation semantics, acceptance version/copy, evidence fields and token-safe email interface approved. |
| Implementation steps | Enforce role UI; invite/revoke via narrow boundary; show security/session controls; record terms version; display privacy layers; stub provider-independent delivery port. |
| Acceptance | Members cannot administer; revocation is immediate; acceptance is versioned; privacy notice is informational; marketing/cookie consent stays separate. |
| Validations | Role matrix, invitation replay/expiry, revoke-session, version migration, accessibility, test/lint/build and security audit. |
| Visual QA | Role-aware member list, destructive confirmation, legal scroll/focus, mobile/iPad and full error/forbidden states. |
| Security/privacy | No raw token logs; minimal member data; audit events; legal acceptance is not converted into optional consent. |
| Rollback | Revert UI commit and clean synthetic invitations/memberships/acceptances under authorized cleanup. |
| Stop conditions | Role escalation, token exposure, bundled consent, ambiguous legal version or provider mutation. |
| Closeout documentation | Role/acceptance evidence, legal-review debt, email-adapter boundary and next gate. |
| Expected commit | `feat: add portal members and legal acceptance` |
| Next gate | CP-3C.1 |

## CP-3C.1 — Controlled QA identities and fixtures

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Create a separately authorized, deterministic synthetic dataset for final QA. |
| User outcome | No direct feature change; the team gains safe evidence for roles, states and cross-client isolation. |
| Dependencies | CP-3B.5 closed; exact QA identity, backup, manifest, fixtures, ledger and cleanup reviewed; independent human authorization. |
| Agents | Primary `qa-e2e-specialist`; specialists `supabase-guardian`, `security-privacy-auditor`; reviewer `pr-quality-gate`. |
| In scope | Controlled QA users, two synthetic clients, admin/member and pending/suspended/revoked states, exact private ledger and cleanup. |
| Out of scope | Real PII, production, public signup, canonical financial data and untracked manual fixtures. |
| Likely files/modules | Frozen QA fixture/cleanup tooling and private ignored ledger only; versioned changes require a separate reviewed gate. |
| Definition of Ready | QA triple identity, 9/9 private inputs if applicable, backup/manifest, exact IDs strategy, hashes, cleanup and authorization all pass. |
| Implementation steps | Preflight; record ledger; create only authorized identities/fixtures; verify expected counts/states; preserve cleanup handles. |
| Acceptance | Two clients and all planned roles/states exist, are synthetic and deterministic; no real/cross-environment data; cleanup is executable. |
| Validations | Target identity, hashes, backup, fixture counts, private-file tracking zero, production rejection and dry cleanup verification. |
| Visual QA | Not required beyond confirming identities can reach intended portal states; UI assertions belong to CP-3C.2/3. |
| Security/privacy | Synthetic names/emails, secrets only in ignored private files, least privilege and no values printed. |
| Rollback | Run exact ledger-bound cleanup, verify zero synthetic residue and restore only from backup if the approved recovery condition occurs. |
| Stop conditions | Target ambiguity, production appearance, missing backup/ledger, real PII, hash drift or cleanup not proven. |
| Closeout documentation | Sanitized counts, authorization reference, cleanup plan and next gate; never commit private IDs. |
| Expected commit | `test: prepare controlled client portal QA fixtures` |
| Next gate | CP-3C.2 |

## CP-3C.2 — End-to-end authorization QA

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Prove portal journeys and denial boundaries end to end with controlled QA identities. |
| User outcome | Evidence shows each client can use intended features and cannot reach another client's data or revoked states. |
| Dependencies | CP-3C.1 fixtures active; visible QA environment; exact cleanup and stop criteria available. |
| Agents | Primary `qa-e2e-specialist`; specialists `security-privacy-auditor`, `supabase-guardian`; reviewer `pr-quality-gate`. |
| In scope | Login, isolation, revoked/suspended, invitation replay, requests, cancellation, invoice download/expiry and cleanup. |
| Out of scope | Production smoke, load testing, real customer journeys and defect fixes unrelated to reproduced failures. |
| Likely files/modules | E2E tests/evidence tooling; existing portal UI and QA backend read/write boundaries. |
| Definition of Ready | Test matrix maps every role/resource/action; fixtures verified; browser/profile policy, cleanup and evidence locations approved. |
| Implementation steps | Run positive journeys; attempt cross-client and state denials; replay tokens; exercise request/download expiry; capture sanitized evidence; clean fixtures. |
| Acceptance | Every allow and deny matches the matrix; errors do not enumerate; one-time links cannot replay; cleanup leaves zero synthetic residue. |
| Validations | E2E matrix, RLS/Edge denial evidence, audit/rate-limit events, financial invariants, cleanup and regression suite. |
| Visual QA | Only interaction blockers discovered during E2E; full responsive/accessibility sign-off remains CP-3C.3. |
| Security/privacy | Redact tokens/IDs, do not retain signed URLs, isolate browser sessions and avoid screenshots containing secrets. |
| Rollback | Stop tests, revoke synthetic sessions and run exact cleanup; no product rollback unless a defect fix was separately approved. |
| Stop conditions | Cross-client success, revocation bypass, secret in evidence, cleanup failure, financial drift or production target. |
| Closeout documentation | Sanitized matrix, failures/debt, cleanup proof, unchanged invariants and next gate. |
| Expected commit | `test: prove client portal authorization journeys` |
| Next gate | CP-3C.3 |

## CP-3C.3 — Visual, accessibility and performance QA

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Validate complete portal states across devices, assistive interaction and performance budgets. |
| User outcome | The portal is usable on mobile, iPad and desktop, with keyboard/screen reader support and respectful motion. |
| Dependencies | CP-3C.2 passes; stable visible QA build; representative synthetic states; agreed budgets. |
| Agents | Primary `qa-e2e-specialist`; specialists `frontend-ux-accessibility`, `performance-gsap-motion`, `security-privacy-auditor`; reviewer `pr-quality-gate`. |
| In scope | 390x844, 768x1024, desktop; keyboard, semantics, screen-reader checks, reduced motion, overflow, full states and Core Web Vitals. |
| Out of scope | Decorative redesign, unbudgeted GSAP, business behavior changes and production optimization. |
| Likely files/modules | Portal components/styles/accessibility/performance tests and sanitized visual evidence. |
| Definition of Ready | Route/state checklist, devices, browser, budgets, visible-run rule and evidence retention approved. |
| Implementation steps | Run state/device matrix; inspect focus/semantics; test reduced motion; measure Web Vitals; fix only approved defects; rerun. |
| Acceptance | No horizontal overflow; one-decision StepFlows; no nested-card inflation; WCAG-critical checks pass; motion is progressive; budgets met or debt accepted. |
| Validations | Visible E2E, automated accessibility plus manual keyboard/screen-reader checks, performance traces, test/lint/build. |
| Visual QA | Required and visible by default; screenshots at exact viewports with no private data committed. |
| Security/privacy | Screenshots use synthetic/redacted data; performance tooling cannot capture secrets, tokens or signed URLs. |
| Rollback | Revert each bounded visual/performance fix; rerun the affected matrix. |
| Stop conditions | P0/P1 accessibility failure, overflow, regression in authorization, private evidence or unexplained performance breach. |
| Closeout documentation | Device/state matrix, accessibility/performance evidence, accepted debt and next gate. |
| Expected commit | `test: close portal visual accessibility and performance QA` |
| Next gate | CP-4.1 |

## CP-4.1 — WordPress source and deployment prerequisite

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Establish owned, recoverable WordPress source and deployment control before any public-site edit. |
| User outcome | No visible change; the public website becomes safely changeable and recoverable. |
| Dependencies | CP-3C.3 closed; hosting owner available; export/staging access separately authorized. |
| Agents | Primary `implementation-planner`; specialists `release-deployment-guardian`, `security-privacy-auditor`; reviewer `pr-quality-gate`. |
| In scope | Full export, database/files backup, owner, staging, deployment steps, rollback and integrity verification. |
| Out of scope | Editing WordPress, legal copy, portal link, DNS, production deploy or email. |
| Likely files/modules | External private backups plus versioned runbook/evidence only; never commit site database or uploads. |
| Definition of Ready | Exact site/host identity, authorized operator, private backup destination and restoration procedure approved. |
| Implementation steps | Export; hash/store privately; create/verify staging; document ownership/deploy/rollback; perform non-destructive restoration proof if authorized. |
| Acceptance | Source and database are recoverable; staging is isolated; owner and rollback are unambiguous; no public-site content changed. |
| Validations | Export integrity, private-file tracking zero, staging identity and rollback rehearsal/evidence. |
| Visual QA | Compare read-only production with staging baseline; no content-change sign-off. |
| Security/privacy | Backups remain encrypted/private; credentials and customer/form submissions never enter Git or reports. |
| Rollback | No runtime change; discard staging test and retain approved private backup according to retention. |
| Stop conditions | No owner, incomplete export, backup exposure, staging points to production DB or any unapproved content change. |
| Closeout documentation | WordPress deployment/rollback runbook, private backup reference and next gate. |
| Expected commit | `docs: establish WordPress deployment prerequisite` |
| Next gate | CP-4.2 |

## CP-4.2 — Public website and legal integration

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Connect the public site to the canonical portal and implement the specified legal/consent surfaces. |
| User outcome | Visitors find Área de clientes and receive clear layered notices with separate privacy, contract, marketing and cookie choices. |
| Dependencies | CP-4.1 closed; canonical portal URL live; copy/content spec approved; professional legal review status explicit. |
| Agents | Primary `implementation-planner`; specialists `seo-local-structured-data`, `security-privacy-auditor`, `frontend-ux-accessibility`, `release-deployment-guardian`; reviewer `pr-quality-gate`. |
| In scope | Client-area link, canonical URL, legal notice, privacy layers, cookies, portal terms, service conditions, first layers and consent separation. |
| Out of scope | Auto-creating/linking clients, bundled consent, unsupported legal approval claim and provider email. |
| Likely files/modules | Authorized WordPress theme/builder/forms/Complianz settings and versioned legal/deployment evidence. |
| Definition of Ready | Export/rollback pass, staging available, canonical link, exact copy versions, tracker inventory and legal-review marker approved. |
| Implementation steps | Change staging; add canonical link/legal surfaces; implement first layers; separate controls; test prior cookie blocking/trackers; review SEO/a11y; authorize deploy separately. |
| Acceptance | Link resolves canonically; forms do not create CRM clients; controls are unbundled; nonessential cookies block before consent; legal review remains pending unless evidenced. |
| Validations | Staging form/consent tests, cookie scan, SEO/canonical checks, responsive/accessibility QA and post-deploy smoke if authorized. |
| Visual QA | Mobile/iPad/desktop header/footer/forms/banner/panel, keyboard focus and consent withdrawal. |
| Security/privacy | Data minimization, exact processors/transfer wording, no dark patterns, no prechecked marketing and no email-based tenancy. |
| Rollback | Restore exact WordPress backup or revert deployment package; invalidate caches and re-smoke. |
| Stop conditions | Missing legal owner, unblocked tracker, form-to-client auto-link, no rollback, production edit without approval or privacy/contract bundling. |
| Closeout documentation | Content versions, consent/tracker evidence, legal-review debt, deployment/rollback result and next gate. |
| Expected commit | `docs: integrate public website and portal legal surfaces` |
| Next gate | CP-4.3 |

## CP-4.3 — Invitation email delivery adapter

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Connect invitations to a bounded, observable email provider adapter. |
| User outcome | Invited clients receive clear, secure, deliverable messages without token leakage. |
| Dependencies | CP-4.2 closed; provider/DPA/region approved; sending domain and templates owned; remote deployment separately authorized. |
| Agents | Primary `implementation-planner`; specialists `enterprise-agent-architect`, `security-privacy-auditor`, `release-deployment-guardian`, `qa-e2e-specialist`; reviewer `pr-quality-gate`. |
| In scope | Provider adapter, templates, domain setup, SPF/DKIM/DMARC, rate limits, audit, safe logging, retry/fallback and monitoring. |
| Out of scope | Marketing campaigns, raw token analytics, public invitations, broad provider credentials and production send before approval. |
| Likely files/modules | Server-only invitation adapter/function, templates, configuration contract, tests and operational runbook. |
| Definition of Ready | Provider/legal assessment, secret storage, domain records, template copy, retry/idempotency, redaction and rollback approved. |
| Implementation steps | Implement narrow port; configure secrets privately; authenticate domain; test sandbox delivery; verify redaction/rate limits; add alerts/fallback; separately deploy. |
| Acceptance | No token in logs/metrics; one invite produces bounded delivery; domain authentication passes; failures are auditable and safely retryable. |
| Validations | Unit/contract tests, provider sandbox, deliverability headers, replay/rate limit, secret scan and monitoring/fallback drill. |
| Visual QA | Mobile/desktop email clients, plain-text alternative, accessible link/copy and expiry explanation. |
| Security/privacy | Server-only secrets, purpose limitation, processor record, token minimization and retention boundaries. |
| Rollback | Disable adapter via approved server configuration, revoke provider key, restore previous function version and preserve audit. |
| Stop conditions | Token in log, unauthenticated domain, unknown processor/region, missing rate limit, secret in frontend or unapproved production send. |
| Closeout documentation | Provider/subprocessor record, DNS evidence, template version, runbook, deployment/rollback and next gate. |
| Expected commit | `feat: add secure portal invitation email adapter` |
| Next gate | CP-5.1 |

## CP-5.1 — Production readiness gate

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Prove that exact QA-validated artifacts can enter a restricted production pilot safely. |
| User outcome | No rollout yet; operational, security and support controls are ready before any customer is invited. |
| Dependencies | CP-4.3 closed; QA P0/P1 zero; exact production authorization available only after review. |
| Agents | Primary `release-deployment-guardian`; specialists `supabase-guardian`, `security-privacy-auditor`, `qa-e2e-specialist`, `enterprise-agent-architect`; reviewer `pr-quality-gate`. |
| In scope | Exact hashes, target identity, backups, rollback, secrets, observability, support, incident/breach response and independent go/no-go. |
| Out of scope | Deployment, customer invitation, public signup, schema drift and financial writes. |
| Likely files/modules | Release manifest, runbooks, monitoring/alert config specs and private backup references. |
| Definition of Ready | All prior gates closed; artifacts immutable; production owner/window; backups; stop thresholds; support/on-call and explicit authorization format defined. |
| Implementation steps | Freeze/hash artifacts; verify target; create/verify backup; inspect secrets/regions; rehearse rollback; validate monitoring/support; independent go/no-go. |
| Acceptance | Every control has owner/evidence; rollback time is known; no QA/prod drift; authorization is exact and not inferred. |
| Validations | Hash/identity/backup manifest, config/secret audit, restore drill, alerts, incident tabletop and complete regression evidence. |
| Visual QA | Verify exact candidate build at approved staging; production visual smoke belongs to CP-5.2. |
| Security/privacy | Least-privilege production roles, logging redaction, processor/transfer record, breach and rights procedures. |
| Rollback | Documented and rehearsed; no production effect occurs in this readiness gate. |
| Stop conditions | Hash drift, missing backup/owner/secret, unresolved P0/P1, target ambiguity, unsupported legal risk or failed restore. |
| Closeout documentation | Signed readiness checklist, immutable manifest, risk acceptance/debt and exact pilot authorization request. |
| Expected commit | `docs: close client portal production readiness gate` |
| Next gate | CP-5.2 |

## CP-5.2 — Restricted production pilot

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Release the exact candidate to a designated invite-only production cohort. |
| User outcome | Only named authorized pilot clients can use the portal while the team monitors safety and usability. |
| Dependencies | CP-5.1 PASS; exact production authorization, cohort, window, backup, rollback and on-call confirmed. |
| Agents | Primary `release-deployment-guardian`; specialists `supabase-guardian`, `security-privacy-auditor`, `qa-e2e-specialist`; reviewer `pr-quality-gate`. |
| In scope | Authorized deployment, designated invite-only cohort, production smoke, monitoring and rollback decision. |
| Out of scope | Public signup, broad client rollout, unlisted customers, feature work and invoice/payment/numbering writes. |
| Likely files/modules | Exact frozen release artifact and server configuration; private cohort/credentials never versioned. |
| Definition of Ready | Authorization names target/artifact/actions; backup/rollback verified; pilot users approved; support and thresholds staffed. |
| Implementation steps | Reverify identity/hash; deploy exact artifact; invite only cohort; smoke allow/deny/document/request flows; monitor; stop or continue by thresholds. |
| Acceptance | Only cohort enters; isolation and private downloads pass; no financial mutation; telemetry/support remain healthy; no P0/P1. |
| Validations | Production smoke with synthetic/designated accounts, cross-client denial, signed URL expiry, requests, alerts, financial invariants and access logs. |
| Visual QA | Mobile/iPad/desktop smoke on production with authorized pilot data and no evidence leakage. |
| Security/privacy | Minimal cohort, invite-only, redacted evidence, immediate revocation and incident/breach process active. |
| Rollback | Revoke pilot sessions/invites, restore prior application/function/config artifacts, validate data invariants and notify owners. |
| Stop conditions | Unauthorized client, cross-client access, P0/P1, financial drift, secret leakage, monitoring outage or rollback threshold reached. |
| Closeout documentation | Deployment, cohort count, smoke/monitoring/rollback decision and next gate; no private identities committed. |
| Expected commit | `release: record restricted client portal pilot` |
| Next gate | CP-5.3 |

## CP-5.3 — Production stabilization

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Stabilize the restricted pilot and close all release-blocking defects. |
| User outcome | Pilot clients receive reliable, accessible performance and a supported operating experience. |
| Dependencies | CP-5.2 remains within thresholds; support/telemetry data available; fixes separately scoped. |
| Agents | Primary `release-deployment-guardian`; specialists `qa-e2e-specialist`, `security-privacy-auditor`, `frontend-ux-accessibility`, `performance-gsap-motion`, `business-rules-test-engineer`; reviewer `pr-quality-gate`. |
| In scope | Error triage, bounded fixes, performance/accessibility, support workflow, metrics, docs and P0/P1 closure. |
| Out of scope | New features, wider rollout, unresolved-risk waiver and financial behavior changes. |
| Likely files/modules | Affected portal modules/tests, alerts/dashboards and operational/support documentation. |
| Definition of Ready | Pilot evidence classified; each defect reproducible and owned; fix/rollback/test scope approved. |
| Implementation steps | Use root-cause agent for reproducible failures; fix one bounded issue; regress; monitor; repeat; reconcile docs/metrics. |
| Acceptance | P0/P1 zero; error/performance/accessibility thresholds met; support ownership and SLO/alerts usable; no widened access. |
| Validations | Full regression, focused E2E, a11y/performance, security, financial invariants, support/incident drill, test/lint/build. |
| Visual QA | Repeat device/state matrix for every affected route; visible production checks only within authorization. |
| Security/privacy | Logs/evidence minimized; fixes cannot relax tenancy, rate limits, consent or document controls. |
| Rollback | Revert each fix independently or roll back pilot per CP-5.2 thresholds. |
| Stop conditions | Unexplained P0/P1, regression, alert blindness, rising error budget, privacy incident or scope requires broader rollout. |
| Closeout documentation | Stabilization metrics, resolved/open debt, support/SLO evidence and next gate. |
| Expected commit | `fix: stabilize restricted client portal pilot` |
| Next gate | CP-6 |

## CP-6 — Final smoke, handoff and project closeout

| Field | Specification |
|---|---|
| Status | `NOT STARTED` |
| Objective | Produce final technical, operational, legal-process and user handoff with evidence-backed roadmap closure. |
| User outcome | Clients and staff have a verified portal plus clear help, rights, security and support procedures. |
| Dependencies | CP-5.3 closed with P0/P1 zero; owners accept support, retention, rights and incident duties. |
| Agents | Primary `documentation-roadmap`; specialists `release-deployment-guardian`, `qa-e2e-specialist`, `security-privacy-auditor`; final reviewer `pr-quality-gate`. |
| In scope | Complete smoke, evidence package, user/operations manuals, runbooks, ROPA/retention/rights/breach handoff, debt and acceptance. |
| Out of scope | New feature work, unsupported legal approval claim, hidden debt and broader rollout beyond approved operating policy. |
| Likely files/modules | Canonical roadmap, user/operations manuals, runbooks, legal matrices, release log and final evidence index. |
| Definition of Ready | Stabilization evidence complete; document owners/versions known; final smoke plan and acceptance authority approved. |
| Implementation steps | Run final smoke; index sanitized evidence; finish manuals/runbooks; reconcile ROPA/retention/rights/breach actions; record debt/acceptance; close roadmap. |
| Acceptance | Isolation, revocation, invoice expiry, request review and consent links pass; P0/P1 zero; every operational/legal process has an owner. |
| Validations | Final E2E/security/a11y/performance smoke, docs link check, test/lint/build, private-file and secret scan, independent review. |
| Visual QA | Final mobile/iPad/desktop critical-journey smoke with keyboard/reduced-motion checks. |
| Security/privacy | Evidence redacted; retention/deletion/rights/breach procedures operational; professional legal approval is claimed only if recorded. |
| Rollback | Reopen the relevant prior gate for failed evidence; do not close the roadmap or broaden access. |
| Stop conditions | Any P0/P1, missing owner/evidence, rights/breach gap, secret/private artifact or unsupported completion claim. |
| Closeout documentation | User manual, operating manual, support/security/breach runbooks, final debt register, release log and canonical roadmap closure. |
| Expected commit | `docs: close Costa Clean client portal roadmap` |
| Next gate | None; project closeout or a separately approved new roadmap |

## Known debt carried into execution

- WordPress has no repository in current connected/local scope; CP-4.1 must
  obtain export, ownership, staging and rollback before edits.
- Legal content remains pending professional review; this roadmap does not claim
  professional legal approval.
- Email provider, processing region, subprocessor and domain-authentication
  choices remain open until CP-4.3.
- MFA is designed as ready but is not enforced by the completed CP-2 boundary.
- Production authorization, cohort, support owner and release window do not
  exist until CP-5's separate human gates.
