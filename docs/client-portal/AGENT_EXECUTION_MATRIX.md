# Client Portal Agent Execution Matrix

Date: 2026-07-28

Status: governance active; CP-3A through CP-6 not started

`project-continuation` initiates every block by reconciling HEAD, evidence,
canonical roadmap, Definition of Ready and stop conditions. It does not enlarge
the permissions shown below. `bug-root-cause-investigator` is inserted only for
a reproducible failure and is never a generic implementer.

Commands are ceilings, not automatic authorization. Every row also permits
read-only Git inspection and `npm run qa:agents`. Remote commands require a
separate exact human gate even when the maximum risk is R3.

| Phase | Primary | Specialists | Independent auditor | Risk | Maximum permissions | Authorized commands | Prohibited actions | Required output evidence | Closure condition |
|---|---|---|---|---|---|---|---|---|---|
| CP-3A | `senior-fullstack-builder` | `frontend-ux-accessibility`, `qa-e2e-specialist`, `security-privacy-auditor` | `pr-quality-gate` | R2 local | Approved portal UI/tests/docs only | local dev/preview, targeted tests, `npm test`, lint, build | Remote writes, schema/Auth/Edge, WordPress, production | Route isolation, state matrix, viewport/a11y evidence, clean diff | All local gates pass; no backend/runtime contract drift |
| CP-3B.1 | `senior-fullstack-builder` | `security-privacy-auditor`, `qa-e2e-specialist`, `supabase-guardian` read-only | `pr-quality-gate` | R2; R3 only by separate QA gate | Portal Auth UI/adapters/tests; narrow QA reads | local tests; separately authorized QA browser/API tests | User creation without gate, production, enumeration, token logs | Auth lifecycle, replay/expiry, suspended/revoked and cleanup evidence | Anti-enumeration and denial matrix pass |
| CP-3B.2 | `senior-fullstack-builder` | `frontend-ux-accessibility`, `security-privacy-auditor` | `pr-quality-gate` | R2 | Profile/property read UI and reviewed request adapter/tests | local preview/tests, baseline gates | Direct `clients`/`properties` write, client-ID trust | Field exposure, two-client denial, request receipt/idempotency | Only narrow DTOs visible; canonical rows unchanged |
| CP-3B.3 | `senior-fullstack-builder` | `business-rules-test-engineer`, `qa-e2e-specialist` | `pr-quality-gate` | R2 | Services/read requests UI and approved narrow request calls | local tests; separately authorized QA E2E | Direct jobs/services writes, fake save, price/date promise | Transition, retry/idempotency, denial and cleanup matrix | One authoritative request per intent; no canonical mutation |
| CP-3B.4 | `senior-fullstack-builder` | `business-rules-test-engineer`, `security-privacy-auditor`, `supabase-guardian` | `pr-quality-gate` | R2 UI; R3 QA read/proof | Invoice read UI and signing-boundary client only | local tests; separately authorized QA download/expiry proof | Financial writes, public PDFs, permanent URLs, frontend signing secret | Cross-client deny, 60-second expiry, unchanged counts/sequences | Private owner-only download passes; finance untouched |
| CP-3B.5 | `senior-fullstack-builder` | `security-privacy-auditor`, `enterprise-agent-architect` | `pr-quality-gate` | R2 | Membership/security/legal UI and provider-independent interface | local preview/tests, baseline gates | Provider deploy, token logs, bundled consent, public signup | Role matrix, revoke/replay, acceptance versions, legal separation | Admin/member boundaries and versioned acceptance pass |
| CP-3C.1 | `qa-e2e-specialist` | `supabase-guardian`, `security-privacy-auditor` | `pr-quality-gate` | R3 | Exact authorized synthetic QA identities/fixtures and private ledger | Only command set named by future exact QA authorization | Production, real PII, untracked fixture, missing backup/cleanup | Target/hashes/backup/ledger, synthetic counts and cleanup plan | Fixtures verified and exact cleanup remains possible |
| CP-3C.2 | `qa-e2e-specialist` | `security-privacy-auditor`, `supabase-guardian` | `pr-quality-gate` | R3 QA | Authorized QA browser/API tests and exact cleanup | Visible E2E plus future authorized QA matrix/cleanup commands | Production, secret screenshots, residue, defect scope expansion | Allow/deny matrix, replay/expiry, requests/download, cleanup | All rows pass and synthetic residue is zero |
| CP-3C.3 | `qa-e2e-specialist` | `frontend-ux-accessibility`, `performance-gsap-motion`, `security-privacy-auditor` | `pr-quality-gate` | R2 | Approved UI/a11y/performance fixes and visible QA | visible local/QA browser tests, tests, lint, build | Headless-only sign-off, private evidence, business/Auth relaxation | Device/state, keyboard/screen-reader, reduced-motion and Web Vitals | No P0/P1, overflow or unexplained budget failure |
| CP-4.1 | `implementation-planner` | `release-deployment-guardian`, `security-privacy-auditor` | `pr-quality-gate` | R3 | Authorized private export/backup/staging proof and docs | Exact hosting export/verification commands named in future gate | WordPress edit, production deploy, committing backup/credentials | Export hash, backup location, staging identity, rollback runbook | Recoverable source and owned deployment procedure exist |
| CP-4.2 | `implementation-planner` | `seo-local-structured-data`, `security-privacy-auditor`, `frontend-ux-accessibility`, `release-deployment-guardian` | `pr-quality-gate` | R3 | Staging edits; production only by separate deployment approval | Staging tests/scans; exact approved deploy/rollback commands | Auto-linking clients, bundled consent, unapproved production edit | Canonical/SEO, forms, cookies, legal version, a11y and rollback | Staging passes; authorized deploy smokes or remains not executed |
| CP-4.3 | `implementation-planner` | `enterprise-agent-architect`, `security-privacy-auditor`, `release-deployment-guardian`, `qa-e2e-specialist` | `pr-quality-gate` | R3 | Server-only adapter/tests; provider/domain/deploy by exact gate | local/provider sandbox; exact authorized DNS/deploy commands | Marketing sends, frontend secrets, token logs, unapproved production mail | Provider/region, SPF/DKIM/DMARC, sandbox, redaction, retry/alerts | Secure delivery and rollback pass with no token leakage |
| CP-5.1 | `release-deployment-guardian` | `supabase-guardian`, `security-privacy-auditor`, `qa-e2e-specialist`, `enterprise-agent-architect` | `pr-quality-gate` | R3 | Readiness inspection, private backup/restore proof and release docs | Hash/identity/backup/monitoring checks named by gate | Deployment, customer invites, schema drift, inferred approval | Immutable manifest, backup/restore, secrets, alerts, incident/support | Independent go/no-go evidence is complete |
| CP-5.2 | `release-deployment-guardian` | `supabase-guardian`, `security-privacy-auditor`, `qa-e2e-specialist` | `pr-quality-gate` | R3 | Exact approved production artifact, designated cohort and smoke | Only deployment/invite/smoke/rollback commands in exact authorization | Force, public signup, unlisted clients, feature/finance changes | Target/hash, cohort count, smoke, monitoring, invariants, rollback decision | Pilot within thresholds; no unauthorized client or P0/P1 |
| CP-5.3 | `release-deployment-guardian` | `qa-e2e-specialist`, `security-privacy-auditor`, `frontend-ux-accessibility`, `performance-gsap-motion`, `business-rules-test-engineer` | `pr-quality-gate` | R2 fixes; R3 release checks | Bounded fixes/tests/monitoring/docs under pilot policy | targeted tests, visible QA, full baseline; exact approved deploy | Wider rollout, new features, weakened security/consent | Root cause, fix/regression, metrics, a11y/performance and support | P0/P1 zero; thresholds stable; debt explicit |
| CP-6 | `documentation-roadmap` | `release-deployment-guardian`, `qa-e2e-specialist`, `security-privacy-auditor` | `pr-quality-gate` | R1 docs; R3 smoke only by gate | Final read/smoke evidence and documentation reconciliation | authorized smoke, docs checks, tests, lint, build | Unsupported closure/legal approval, hidden debt, wider rollout | Final smoke index, manuals/runbooks, ROPA/retention/rights/breach owners | Independent acceptance; canonical roadmap truthfully closed |

## Permanent permission rules

- The implementer never acts as the independent auditor.
- R1 is read-only/documentation by default; R2 is bounded local implementation;
  R3 is remote/release risk and remains read-only until exactly authorized.
- `db push`, `db pull`, migration repair, force push, production writes,
  `service_role` in frontend, secret output, real PII fixtures and permanent
  document URLs are prohibited.
- WordPress is not edited until CP-4.1 proves export, backup, ownership, staging
  and rollback.
- Each closed approved block receives one reviewable commit and immediate push.
  `NOT_EXECUTED` is recorded as such and cannot close a required check.
