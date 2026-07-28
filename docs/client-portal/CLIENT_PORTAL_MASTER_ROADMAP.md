# Costa Clean Client Portal — Master Completion Roadmap

**Status:** ACTIVE — CP-2B complete, CP-3A next  
**Prepared:** 2026-07-28  
**Repository baseline:** `6c6b29a84614307a2c9d595acafd4bce435b01de`  
**Estimated weighted progress:** 55% complete / 45% remaining  
**Canonical execution order:** CP-3A → CP-3B → CP-3C → CP-4 → CP-5 → CP-6

> This percentage is weighted by scope and delivery risk. It is not an estimate of hours.

## 1. Product outcome

Deliver a secure, mobile-first client portal at `/portal` where each Costa Clean client can:

- authenticate and recover access safely;
- see only their own profile, properties, services, requests and invoices;
- request service changes without editing canonical operational records directly;
- download invoice PDFs through short-lived private access;
- manage permitted members and security states;
- accept versioned legal terms when the verified legal copy exists;
- use the portal on mobile, iPad and desktop without access to the internal CRM.

The final release must preserve the existing internal CRM, financial invariants, WordPress website and production data.

## 2. Current verified baseline

### Completed

- CP-0 — discovery and system mapping;
- CP-1 — security, tenancy and legal design;
- CP-2A — immutable source package and disposable proof;
- CP-2A.1 — QA-compatible dynamic Auth package;
- CP-2A.2 — Windows-compatible Supabase launcher;
- CP-2A.3 — bootstrap contract correction;
- CP-2A.4 — PostgreSQL secret transport and pre-effect gate;
- CP-2B — Supabase Cloud QA boundary validation.

### Backend QA now present

- 11 portal/security tables with RLS and `FORCE RLS`;
- one active internal staff membership;
- four frozen portal Edge Functions;
- private `invoice-documents` bucket;
- cross-client isolation validated by SQL and HTTP matrices;
- invitation token hashing, expiry, revocation, single-use and replay rejection validated;
- service requests validated as `pending_review`;
- invoice access contract validated with 60-second signed access;
- zero synthetic Auth users, fixtures, PDFs or Storage objects remaining after QA;
- production and WordPress untouched.

### Known debt that remains real

- invitation email delivery adapter is not implemented;
- legal copy still requires verified facts and professional review;
- WordPress export, backup, ownership and deployment procedure are prerequisites before public-site changes;
- no production portal release has been authorized;
- no public registration is approved.

## 3. Permanent guardrails

1. Never use `service_role` in frontend code or browser bundles.
2. Never use email as tenancy proof.
3. Never query canonical client, property, job, invoice, payment or financial tables directly from `/portal`.
4. Portal reads use approved portal RPC contracts.
5. Portal mutations use approved Edge Functions or trusted narrow RPCs.
6. Never use `db push`, `db pull` or `migration repair` for this project.
7. No production write without an independent gate, exact target, backup and rollback.
8. No WordPress edit before export, backup, staging and deployment ownership are documented.
9. Synthetic QA data only; no real PII in fixtures.
10. The implementer cannot approve its own work.
11. `NOT_EXECUTED` never equals `PASS`.
12. Each approved implementation block ends with tests, lint, build, commit and push.
13. Each roadmap status must be supported by repository or QA evidence.

## 4. Progress model

| Programme | Weight | Status |
|---|---:|---|
| CP-0 to CP-2B — discovery, security and backend QA | 55% | DONE |
| CP-3 — portal frontend and QA | 30% | NOT STARTED |
| CP-4 — website, legal and invitation delivery | 6% | NOT STARTED |
| CP-5 — production readiness and pilot | 6% | NOT STARTED |
| CP-6 — final smoke, handoff and closeout | 3% | NOT STARTED |

## 5. Agent operating rule

Use `project-continuation` to reconstruct the current repository state and select the next unlocked gate. Use specialists only for their approved role.

Recommended delivery chain:

```text
implementation-planner
→ senior-fullstack-builder
→ qa-e2e-specialist
→ frontend-ux-accessibility or domain specialist
→ security-privacy-auditor
→ pr-quality-gate
→ documentation-roadmap
→ release-deployment-guardian when release work begins
```

`bug-root-cause-investigator` is used for a reproducible defect, not as a generic builder. `supabase-guardian` remains read-only/local by default unless a separate remote gate is explicitly authorized.

---

# CP-3 — Portal frontend and visible QA

## CP-3A — Portal UI foundation and route isolation

**Status:** NEXT GATE  
**Primary agent:** `senior-fullstack-builder`  
**Specialists:** `frontend-ux-accessibility`, `security-privacy-auditor`  
**QA:** `qa-e2e-specialist`  
**Independent review:** `pr-quality-gate`

### Objective

Create a completely separate frontend boundary for `/portal` without changing the validated backend or exposing the internal CRM.

### In scope

- explicit `/portal` route detection before CRM auth bootstrap;
- independent `ClientPortalApp` and portal bootstrap;
- portal-specific auth and authorization state machine;
- typed RPC and Edge adapters;
- portal shell, header, desktop navigation and mobile navigation;
- base pages for home, profile, properties, services, requests, invoices and security;
- login, recovery, logout, expired session and access-state screens;
- development-only preview for all states;
- responsive and accessibility baseline;
- tests that block direct canonical table access and frontend secrets.

### Out of scope

- remote QA writes;
- real invitation acceptance;
- real service requests;
- real profile/property changes;
- real invoice downloads;
- new backend contracts;
- deployment;
- WordPress.

### Definition of Ready

- clean `main` synchronized with `origin/main`;
- CP-2B report present and backend artifacts unchanged;
- exact RPC and Edge contract map reviewed;
- existing CRM route/auth flow inspected;
- design tokens and reusable neutral primitives inventoried.

### Acceptance criteria

- `/portal` never renders CRM `AppShell` or internal `AuthPage`;
- CRM routes never render portal components;
- session existence is separated from portal authorization;
- all required access states are explicit;
- no direct `.from(...)` access to canonical tables under portal code;
- no `service_role` or secret in frontend or bundle;
- seven base pages render loading, empty, error and forbidden states;
- keyboard navigation, focus visibility and reduced motion pass;
- target viewports pass without horizontal overflow;
- full test suite, lint and build pass;
- QA remote writes remain zero.

### Rollback

Revert the CP-3A frontend commit. No backend or remote rollback should be required.

### Stop conditions

- backend contract requires unapproved change;
- route isolation cannot be achieved without breaking public/CRM routes;
- secret detected in bundle;
- direct canonical table access introduced;
- unresolved P0/P1 accessibility or auth-boundary defect.

### Expected commit

`feat: establish client portal UI and auth boundary`

---

## CP-3B.1 — Authentication and access lifecycle

**Status:** BLOCKED BY CP-3A  
**Primary agent:** `senior-fullstack-builder`  
**Specialists:** `security-privacy-auditor`, `supabase-guardian` read-only  
**QA:** `qa-e2e-specialist`  
**Review:** `pr-quality-gate`

### Outcome

A client can sign in, recover access and understand pending, suspended, revoked or expired states without account enumeration.

### Scope

- login and logout;
- recovery request with neutral response;
- recovery-session password update;
- session expiry handling;
- account context resolution;
- `pending_review`, `invitation_required`, `active`, `suspended`, `revoked` and `no_access` states;
- ephemeral invitation token parsing without localStorage;
- safe error mapping and retry.

### Acceptance criteria

- no raw Supabase errors shown;
- no confirmation that an email exists;
- double submit blocked;
- token absent from logs and persistent storage;
- suspended and revoked users cannot reach portal content;
- tests cover all state transitions and session changes.

### Stop conditions

- invitation contract mismatch;
- need for unapproved backend mutation;
- token or identity leakage;
- auth state can bypass membership status.

### Expected commit

`feat: connect client portal authentication lifecycle`

---

## CP-3B.2 — Profile and properties

**Status:** BLOCKED BY CP-3B.1  
**Primary agent:** `senior-fullstack-builder`  
**Specialists:** `frontend-ux-accessibility`, `security-privacy-auditor`  
**QA:** `qa-e2e-specialist`  
**Review:** `pr-quality-gate`

### Outcome

Clients can read their approved profile and properties and submit controlled change requests.

### Scope

- account/profile read model;
- property list and detail;
- loading, empty, error and forbidden states;
- controlled profile/property change request flows;
- explicit review/pending feedback;
- no direct canonical writes.

### Acceptance criteria

- RPC-only reads;
- all mutation requests pass through approved account actions;
- no optimistic success before server confirmation;
- cross-client identifiers cannot be requested or displayed;
- mobile and tablet detail views remain compact and scannable.

### Expected commit

`feat: connect client portal profile and properties`

---

## CP-3B.3 — Services and requests

**Status:** BLOCKED BY CP-3B.2  
**Primary agent:** `senior-fullstack-builder`  
**Rules specialist:** `business-rules-test-engineer`  
**QA:** `qa-e2e-specialist`  
**Security:** `security-privacy-auditor`  
**Review:** `pr-quality-gate`

### Outcome

Clients can review their services and create idempotent service requests that enter `pending_review`.

### Scope

- service list and detail;
- service request StepFlow;
- property/service selection constrained to portal context;
- idempotency key lifecycle;
- pending, accepted, rejected and cancelled display states where supported;
- safe cancellation through the approved server boundary;
- feedback and retry without duplicate requests.

### Acceptance criteria

- no service request writes directly to canonical operational tables;
- double submit and retry cannot create duplicates;
- every success is based on server response;
- invalid cross-client property/service combinations are rejected;
- business rules and state transitions have deterministic tests.

### Expected commit

`feat: connect client portal services and requests`

---

## CP-3B.4 — Invoices and private documents

**Status:** BLOCKED BY CP-3B.2  
**Primary agent:** `senior-fullstack-builder`  
**Security:** `security-privacy-auditor`, `supabase-guardian` read-only  
**Rules:** `business-rules-test-engineer`  
**QA:** `qa-e2e-specialist`  
**Review:** `pr-quality-gate`

### Outcome

Clients can read invoice information and download an authorized private PDF without modifying financial records.

### Scope

- invoice list and detail;
- read-only totals, issue date and status;
- server-generated 60-second document access;
- expired-link retry;
- missing-document and forbidden states;
- download audit contract;
- safe mobile invoice presentation.

### Acceptance criteria

- no financial mutation;
- no invoice numbering or sequence write;
- signed URL never stored persistently or logged;
- URL expiry and retry verified;
- cross-client invoice/document access denied;
- zero direct bucket access from unauthorised context.

### Expected commit

`feat: connect private client invoice access`

---

## CP-3B.5 — Members, security and legal acceptance

**Status:** BLOCKED BY CP-3B.1  
**Primary agent:** `senior-fullstack-builder`  
**Security:** `security-privacy-auditor`  
**Architecture:** `enterprise-agent-architect` for email adapter design only  
**QA:** `qa-e2e-specialist`  
**Review:** `pr-quality-gate`

### Outcome

Client administrators can manage permitted members and clients can see account security and verified legal requirements.

### Scope

- client admin/member role presentation;
- invite creation contract;
- invite revocation;
- member status display;
- security page and session controls;
- legal version/status components;
- blocking state for required acceptance;
- placeholder marker `PENDING_VERIFIED_LEGAL_COPY` until approved content exists.

### Out of scope

- production email delivery;
- invented legal wording;
- public self-registration;
- MFA enforcement unless separately authorized.

### Acceptance criteria

- members cannot manage other members unless role permits;
- revoked and replayed invitations fail;
- token never appears in logs;
- legal acceptance is not enabled with placeholder copy;
- email delivery remains visibly `NOT IMPLEMENTED` until CP-4.3.

### Expected commit

`feat: add client portal members and security surfaces`

---

## CP-3C.1 — Controlled QA identities and fixtures

**Status:** BLOCKED BY CP-3B COMPLETE  
**Primary agent:** `qa-e2e-specialist`  
**Security:** `security-privacy-auditor`, `supabase-guardian`  
**Review:** `pr-quality-gate`

### Objective

Create a separately authorized, ledger-owned QA package for visible portal testing.

### Required QA states

- active client admin A;
- active member A;
- active client admin B;
- active member B;
- pending user;
- suspended member;
- revoked member;
- unverified user;
- invitation recipient;
- suspended internal staff boundary where needed.

### Acceptance criteria

- new explicit authorization;
- fresh backup bound to exact HEAD;
- no real PII;
- exact IDs and UUIDs in private ledger;
- two isolated synthetic clients;
- exact cleanup and zero-residue proof;
- production rejected.

### Expected commit

`test: prepare controlled client portal QA identities`

---

## CP-3C.2 — End-to-end authorization QA

**Status:** BLOCKED BY CP-3C.1  
**Primary agent:** `qa-e2e-specialist`  
**Security:** `security-privacy-auditor`  
**Review:** `pr-quality-gate`

### Flows

- login and logout;
- password recovery;
- pending review;
- active admin/member access;
- suspended and revoked denial;
- invitation acceptance and replay rejection;
- profile/property reads;
- service request and idempotent retry;
- invoice list/detail;
- 60-second PDF download and expiry;
- cross-client negative tests;
- exact cleanup.

### Acceptance criteria

- all positive flows pass;
- all cross-client and status denials pass;
- no sensitive data in screenshots or logs;
- synthetic residue zero after testing;
- no production interaction.

### Expected commit

`test: validate client portal end-to-end in QA`

---

## CP-3C.3 — Visual, accessibility and performance QA

**Status:** BLOCKED BY CP-3C.2  
**Primary agent:** `frontend-ux-accessibility`  
**QA:** `qa-e2e-specialist`  
**Performance:** `performance-gsap-motion`  
**Security:** `security-privacy-auditor`  
**Review:** `pr-quality-gate`

### Viewports

- 320×568;
- 375×667;
- 390×844;
- 768×1024;
- 820×1180;
- 1024×768;
- 1280×720;
- 1440×900.

### Acceptance criteria

- no horizontal overflow;
- keyboard-only completion of critical flows;
- focus visible and logical;
- labels, landmarks, headings and `aria-live` correct;
- 200% zoom usable;
- reduced motion supported;
- touch targets usable;
- loading, empty, error and forbidden states visible;
- animations do not block content;
- bundle and route performance documented;
- no unsupported claim of full WCAG compliance.

### Expected commit

`test: complete client portal visual and accessibility QA`

---

# CP-4 — Website, legal and invitation delivery

## CP-4.1 — WordPress source and deployment prerequisite

**Status:** BLOCKED — REQUIRED BEFORE WEBSITE EDITS  
**Primary agent:** `implementation-planner`  
**Release:** `release-deployment-guardian`  
**Security:** `security-privacy-auditor`  
**Review:** `pr-quality-gate`

### Deliverables

- current WordPress export or reproducible backup;
- plugin/theme inventory;
- SiteGround ownership and access procedure;
- staging method;
- canonical portal URL decision;
- deployment and rollback runbook;
- pre/post-change smoke checklist.

### Stop condition

No public website change without a verified backup and rollback path.

---

## CP-4.2 — Public website and legal integration

**Status:** BLOCKED BY CP-4.1 AND VERIFIED LEGAL FACTS  
**Primary agent:** `senior-fullstack-builder` or approved WordPress implementer  
**SEO:** `seo-local-structured-data`  
**Security/privacy:** `security-privacy-auditor`  
**Release:** `release-deployment-guardian`  
**Review:** `pr-quality-gate`

### Scope

- add `Área de clientes` link to canonical portal URL;
- update first-layer privacy notices;
- connect privacy, cookies, portal terms and service conditions;
- separate contract/privacy controls from optional marketing consent;
- verify Complianz prior blocking and actual trackers;
- preserve current SEO and public conversion routes.

### Acceptance criteria

- staging evidence before production;
- links and consent surfaces work on mobile and desktop;
- legal copy marked pending until professionally reviewed;
- no website form automatically creates or links a CRM client;
- rollback tested or independently verified.

---

## CP-4.3 — Invitation email delivery adapter

**Status:** NOT STARTED  
**Architecture:** `enterprise-agent-architect`  
**Implementation:** `senior-fullstack-builder`  
**Security:** `security-privacy-auditor`  
**QA:** `qa-e2e-specialist`  
**Release:** `release-deployment-guardian`  
**Review:** `pr-quality-gate`

### Scope

- choose approved SMTP/email provider path;
- define least-privilege delivery tool;
- templates and localization;
- domain identity and SPF/DKIM/DMARC verification;
- rate limits, retries and idempotency;
- no invitation token in logs;
- audit and delivery status;
- fallback and operational monitoring.

### Acceptance criteria

- test-domain delivery evidence;
- no raw secrets or invitation token logged;
- duplicate event does not send uncontrolled duplicate invitations;
- failure is recoverable and visible to staff;
- provider and data-processing facts documented.

---

# CP-5 — Production release

## CP-5.1 — Production readiness gate

**Status:** BLOCKED BY CP-3 AND CP-4  
**Primary agent:** `release-deployment-guardian`  
**Supabase:** `supabase-guardian`  
**Security:** `security-privacy-auditor`  
**QA:** `qa-e2e-specialist`  
**Documentation:** `documentation-roadmap`  
**Review:** `pr-quality-gate`

### Required evidence

- exact QA-proven hashes;
- production target identity;
- fresh production backup;
- migration and rollback runbook;
- production secrets present without exposure;
- observability and alerting;
- support and incident ownership;
- legal/provider facts reconciled;
- P0/P1 zero;
- explicit human authorization.

### Stop conditions

- any target ambiguity;
- missing backup;
- unreviewed production migration;
- open P0/P1;
- missing incident owner;
- public registration accidentally enabled.

---

## CP-5.2 — Restricted production pilot

**Status:** BLOCKED BY CP-5.1  
**Primary agent:** `release-deployment-guardian`  
**QA:** `qa-e2e-specialist`  
**Security:** `security-privacy-auditor`  
**Review:** `pr-quality-gate`

### Scope

- invite-only designated pilot;
- controlled real client list approved by owner;
- no public self-registration;
- production smoke tests;
- access, revocation, request and invoice download proof;
- monitoring and rollback thresholds.

### Acceptance criteria

- only designated users have access;
- no cross-client leakage;
- support path active;
- error and latency thresholds monitored;
- rollback criteria explicit;
- no invoice/payment/numbering mutation from the portal.

---

## CP-5.3 — Production stabilization

**Status:** BLOCKED BY PILOT EVIDENCE  
**Primary agent:** `project-continuation`  
**Bug work:** `bug-root-cause-investigator`  
**QA:** `qa-e2e-specialist`  
**UX/performance:** relevant specialists  
**Review:** `pr-quality-gate`

### Scope

- resolve pilot defects by cause, not patches;
- improve performance and accessibility from measured evidence;
- document support patterns and operational metrics;
- close all P0/P1 and approved P2 findings;
- prepare controlled expansion decision.

---

# CP-6 — Final smoke, handoff and closeout

**Status:** NOT STARTED  
**Primary agent:** `documentation-roadmap`  
**Release:** `release-deployment-guardian`  
**QA:** `qa-e2e-specialist`  
**Security:** `security-privacy-auditor`  
**Final review:** `pr-quality-gate`

### Deliverables

- final production smoke report;
- client user manual;
- internal operations manual;
- invitation and support runbooks;
- incident and rollback runbooks;
- permissions and environment inventory;
- maintenance/update procedure;
- documented debt and ownership;
- privacy operational handoff for retention, rights and breaches;
- final roadmap reconciliation;
- final acceptance record.

### Final completion criteria

- critical user journeys pass in production;
- cross-client isolation and revocation verified;
- invoice download expiry verified;
- request-to-review workflow verified;
- legal links and consent surfaces present;
- P0/P1 zero;
- private files and secrets outside Git;
- production backup and rollback remain usable;
- manuals reflect the released product;
- all remaining debt has an owner and next action;
- project marked complete only after independent review.

### Expected commit

`docs: close client portal delivery and handoff`

---

# 6. Gate execution template

Every gate must start with:

```text
GATE:
BASE HEAD:
TARGET BRANCH:
CURRENT STATUS:
DEPENDENCIES:
IN SCOPE:
OUT OF SCOPE:
AGENT ROLES:
REMOTE ACTIONS AUTHORIZED:
REMOTE ACTIONS PROHIBITED:
DEFINITION OF READY:
ACCEPTANCE CRITERIA:
VALIDATIONS:
STOP CONDITIONS:
ROLLBACK:
EXPECTED COMMIT:
```

Every gate must close with:

```text
VERDICT: PASS | BLOCKED | FAIL
INITIAL HEAD:
FINAL HEAD:
REMOTE HEAD:
WORKTREE:
SCOPE COMPLETED:
VALIDATIONS EXECUTED:
VALIDATIONS NOT EXECUTED:
P0 FINDINGS:
P1 FINDINGS:
P2 FINDINGS:
P3 FINDINGS:
QA REMOTE WRITES:
PRODUCTION WRITES:
SECRETS VERSIONED:
REAL PII ADDED:
COMMIT:
PUSH:
ROADMAP UPDATE:
NEXT GATE:
```

# 7. Immediate next action

Open **CP-3A — Portal UI foundation and route isolation** only after:

- the agent pack installation block is reconciled;
- `main` and `origin/main` are identical and clean;
- the roadmap/agent documentation changes are merged without conflict;
- baseline tests, lint and build pass;
- CP-2B backend artifacts remain unchanged.

Do not start CP-3B, CP-4, CP-5 or CP-6 before CP-3A has independent evidence and a clean closeout.