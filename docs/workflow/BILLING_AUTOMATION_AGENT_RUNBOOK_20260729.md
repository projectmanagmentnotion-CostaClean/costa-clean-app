# Billing Automation Agent Runbook

Created: 2026-07-29

Roadmap: `docs/BILLING_AUTOMATION_ROADMAP_20260729.md`

## Purpose

Coordinate the manually invoked GitHub Copilot Custom Agents and Codex sessions required to execute the billing automation roadmap without mixing roles, weakening repository controls or allowing an implementer to approve its own work.

## Permanent rules

1. Read `AGENTS.md` and every mandatory document before acting.
2. Work on a branch different from `main`.
3. Diagnose the real implementation before editing.
4. One sprint or narrowly approved slice per branch/PR unless the roadmap explicitly combines them.
5. No production access by default.
6. No remote Supabase changes without an exact separate human authorization gate.
7. No agent may calculate money, tax, numbering or eligibility through unconstrained model output.
8. The implementer never performs the final PR quality decision.
9. `NOT_EXECUTED` never means `PASS`.
10. Close each approved work block with validation, commit and push.

## Agent sequence by work type

### Roadmap continuation

Use: `project-continuation`

Input:

- current roadmap path;
- latest completed sprint evidence;
- branch and PR state;
- known blockers.

Output:

- verified current position;
- next eligible sprint;
- unresolved dependencies;
- exact recommended agent.

### Sprint planning and audit

Use: `implementation-planner`

Required for Sprint 0 and before any sprint whose real implementation contract is not already fully documented.

The planner may edit Markdown planning documents only. It must not modify runtime code, dependencies, migrations or configuration.

### Full-stack implementation

Use: `senior-fullstack-builder`

Use only after a scoped plan and acceptance criteria exist. The builder may implement the approved slice, add tests and update directly related documentation. It must not broaden the sprint.

### Supabase and data boundaries

Use: `supabase-guardian`

Invoke for any table, view, RPC, RLS, Auth, Storage, migration, grant, idempotency or data ownership question.

Default mode is read-only. Source preparation does not authorize remote execution.

### Financial and operational rules

Use: `business-rules-test-engineer`

Invoke for:

- invoice numbering;
- tax and monetary precision;
- service eligibility;
- duplicate prevention;
- payment and invoice state transitions;
- recurring generation and idempotency;
- correction, cancellation and reversal behavior.

### UX and accessibility

Use: `frontend-ux-accessibility`

Invoke for:

- contextual concept search;
- invoice reuse StepFlow or overlay;
- client billing profile UI;
- pending-billing workspace;
- mobile/tablet/keyboard behavior;
- density and action hierarchy.

### QA

Use: `qa-e2e-specialist`

The QA agent must reproduce the requested behavior and distinguish:

- passed;
- failed;
- blocked;
- not executed.

It may add test code within the sprint scope but may not rewrite business logic to make tests pass.

### Security and privacy

Use: `security-privacy-auditor`

Required before merging work that changes:

- authorization boundaries;
- invoice documents or access URLs;
- audit payloads;
- communication credentials;
- automation permissions;
- client-specific concept/history queries;
- browser/server trust boundaries.

This agent reviews only and does not implement the corrections it requests.

### Documentation reconciliation

Use: `documentation-roadmap`

Invoke after implementation/QA to reconcile roadmap status, decisions, evidence and remaining debt. It must not mark unexecuted checks as complete.

### Independent pull-request gate

Use: `pr-quality-gate`

Required before merge. It reviews scope, diff, tests, CI, security, UX and documentation and emits the final P0-P3 verdict.

### Release readiness

Use: `release-deployment-guardian`

Invoke only when a sprint or phase is fully reviewed and the user explicitly requests release preparation or deployment. It does not convert a roadmap into production authorization.

### Future business automation agent

Use: `enterprise-agent-architect`

Invoke in Sprint 10 to design the trusted backend worker/agent, its tools, approvals, idempotency, audit trail, retry model and permission boundaries. It must not be used as a substitute for deterministic billing code.

## Sprint routing

| Sprint | Lead | Required supporting agents | Independent gate |
|---|---|---|---|
| 0 Evidence audit | `implementation-planner` | `supabase-guardian`, `business-rules-test-engineer`, `documentation-roadmap` | `pr-quality-gate` |
| 1 Created-at standard | `senior-fullstack-builder` | `frontend-ux-accessibility`, `qa-e2e-specialist` | `pr-quality-gate` |
| 2 Concept suggestions | `senior-fullstack-builder` | `frontend-ux-accessibility`, `business-rules-test-engineer`, `qa-e2e-specialist` | `pr-quality-gate` |
| 3 Similar-invoice draft | `senior-fullstack-builder` | `business-rules-test-engineer`, `supabase-guardian`, `qa-e2e-specialist` | `pr-quality-gate` |
| 4 State/payment coherence | `business-rules-test-engineer` | `senior-fullstack-builder`, `qa-e2e-specialist` | `pr-quality-gate` |
| 5 Pending billing | `senior-fullstack-builder` | `business-rules-test-engineer`, `supabase-guardian`, `security-privacy-auditor`, `qa-e2e-specialist` | `pr-quality-gate` |
| 6 Client billing profiles | `senior-fullstack-builder` | `supabase-guardian`, `business-rules-test-engineer`, `frontend-ux-accessibility` | `pr-quality-gate` |
| 7 Recurring draft generation | `senior-fullstack-builder` | `business-rules-test-engineer`, `supabase-guardian`, `enterprise-agent-architect`, `qa-e2e-specialist` | `pr-quality-gate` |
| 8 Audit/activity | `senior-fullstack-builder` | `documentation-roadmap`, `security-privacy-auditor`, `frontend-ux-accessibility` | `pr-quality-gate` |
| 9 PDF and communication | `senior-fullstack-builder` | `security-privacy-auditor`, `supabase-guardian`, `qa-e2e-specialist` | `pr-quality-gate` |
| 10 Worker/agent architecture | `enterprise-agent-architect` | `security-privacy-auditor`, `business-rules-test-engineer`, `supabase-guardian` | `pr-quality-gate` |
| 11 Integrated QA/release | `qa-e2e-specialist` | `documentation-roadmap`, `security-privacy-auditor`, `frontend-ux-accessibility`, `release-deployment-guardian` | `pr-quality-gate` |

## Branch and PR convention

Recommended branch names:

- `codex/billing-s0-audit`
- `codex/billing-s1-created-at`
- `codex/billing-s2-concept-suggestions`
- `codex/billing-s3-similar-invoice`
- `codex/billing-s4-state-payment`
- `codex/billing-s5-pending-billing`
- `codex/billing-s6-client-profiles`
- `codex/billing-s7-recurring-drafts`
- `codex/billing-s8-audit-activity`
- `codex/billing-s9-documents-communications`
- `codex/billing-s10-agent-architecture`
- `codex/billing-s11-integrated-qa`

Every PR description should include:

- sprint objective;
- in-scope and out-of-scope;
- files changed;
- data/API impact;
- validations executed;
- validations not executed;
- security/UX/business-rule evidence;
- rollback;
- roadmap status update.

## Stop conditions

Stop and report `BLOCKED` when:

- the working tree contains unrelated changes that cannot be isolated;
- the current branch is `main` and a write is required;
- a database/RLS/RPC/migration change is required but no separate gate exists;
- a fiscal/business rule is ambiguous and materially changes money, numbering or legal output;
- the source invoice reuse flow cannot be traced end-to-end;
- required credentials or private QA inputs are missing;
- a test/build failure predates the sprint and prevents trustworthy validation;
- the task would interfere with the active client portal security roadmap.

Do not stop for minor details that can be represented as explicit assumptions or documented debt without changing correctness.

## Sprint closeout template

```text
VERDICT:
SPRINT:
OBJECTIVE:
BRANCH:
COMMITS:
PUSH:
FILES_CHANGED:
DATA_API_IMPACT:
VALIDATIONS_EXECUTED:
VALIDATIONS_NOT_EXECUTED:
QA_RESULTS:
SECURITY_REVIEW:
BUSINESS_RULE_REVIEW:
UX_ACCESSIBILITY_REVIEW:
P0_FINDINGS:
P1_FINDINGS:
P2_FINDINGS:
P3_FINDINGS:
ROLLBACK:
ROADMAP_UPDATE:
NEXT_ELIGIBLE_SPRINT:
```
