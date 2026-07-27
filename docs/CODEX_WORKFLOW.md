# Codex Workflow

## Purpose

This document defines the mandatory working method for Codex and any AI coding agent operating in this repository.

## Non-Negotiable Rules

- No blind coding.
- Read the mandatory documents before touching code.
- Diagnose the real implementation before proposing changes.
- Produce a plan before editing files.
- Work in small, safe changes.
- Do not perform unrelated refactors.
- Do not touch critical logic without explicit request.
- Verify with `npm run lint` and `npm run build`.
- Commit and push when closing the work block.
- Supabase `db push`, migration repair, history writes, and new migration apply are blocked until the migration-history gate is explicitly reopened.

## Supabase DB Push Lock

- Never run `npx supabase db push` or `supabase db push` in this repository.
- `npm run db:push` and `npm run supabase:db:push` are intentional fail-closed guards, not deployment commands.
- Do not create or modify `supabase_migrations.schema_migrations` without a sprint that explicitly authorizes metadata writes.
- Do not move, rename, squash, or mark migration files as applied merely to make CLI output look clean.
- Read [DB_PUSH_LOCK.md](DB_PUSH_LOCK.md) and [SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md](SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md) before any Supabase CLI planning.
- The canonical manifest is documentary only. Logical aliases are not active migration versions and must not be renamed, registered or marked applied without a proven disposable transition.
- A migration repair gate must validate an exact disposable ref, exclude QA/production, prove discard/restore first and stop honestly when the private disposable configuration is absent.

## Normal Operation After Gate 5

- The mandatory final roadmap closed on 2026-07-23. Normal scoped maintenance may proceed under this workflow.
- Reopen a new roadmap before any cross-domain feature, tenancy/role change, Auth-provider or user-administration change, schema/RLS/RPC/migration action, database-push unlock, financial/fiscal full-submit, production security incident or proof-of-human provider integration.
- Production logout/login is now a permanent release gate for changes to `App.tsx`, `AppShell.tsx`, `AppNav.tsx`, Supabase session handling or protected/public route boundaries.
- Any such change must prove one logout control per viewport, duplicate-call prevention, generic failure handling, `SIGNED_OUT`, protected-content removal and public-route isolation.
- See [READY_FOR_NORMAL_OPERATION_20260723.md](READY_FOR_NORMAL_OPERATION_20260723.md) for operating limits and reopen conditions.

## Client Portal Roadmap Lock - 2026-07-23

- [CLIENT_PORTAL_SECURITY_LEGAL_ROADMAP_20260723.md](CLIENT_PORTAL_SECURITY_LEGAL_ROADMAP_20260723.md) is the active scoped roadmap for the future customer portal.
- Gates CP-0 and CP-1 are documentation-only and closed. CP-2A through
  CP-2A.4 are the immutable source/proof chain; CP-2B later executed that exact
  V5 package only in QA under a separate explicit authorization.
- CP-2B is closed in QA. Stop before CP-3: no portal frontend, production,
  website or legal publication work is authorized by the QA result.
- The current canonical `authenticated` read model is internal-workspace-wide. No customer Auth user may be created until a QA-proven explicit `internal_staff_memberships` boundary replaces every any-authenticated canonical policy and legacy RPC guard.
- Email equality is never identity proof and never creates or links a client. Only an exact staff-selected invitation or explicit staff approval may create `client_portal_memberships`.
- Portal browser code may use only the publishable Supabase key plus the user session. `service_role`, invite peppers, recovery secrets and document-signing authority remain trusted-server only.
- Invoice documents must use a separate private bucket, opaque object keys, fresh ownership checks and short-lived access. Public/permanent PDF URLs are prohibited.
- Customer service requests never create jobs, quotes, invoices, payments or schedule commitments without internal review.
- CP-2B requires a new prompt naming exact QA ref `kpvvydthlxupjjqqdpxy` and accepting every immutable hash in [client-portal/CP2B_EXACT_QA_AUTHORIZATION.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION.md). Production ref `wfxnwfcdjainpojhbdri` must be rejected.
- CP-2A.1 supersedes the execution mechanics, not the frozen evidence. A future CP-2B must name the exact final commit and accept [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V2.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V2.md) plus `scripts/client-portal/cp2b_qa_package_v2.manifest.json`. The V1 document cannot authorize V2.
- Never invoke `run-cp2b-qa-v2.mjs --execute` from a generic npm task. It requires an explicit command, exact authorization controls, clean authorized HEAD, triple QA identity, verified private backup, nine private inputs, empty ledger, and production rejection.
- CP-2A.2 closes the Windows `.cmd` launcher defect without changing any original/V2 artifact. V3 uses [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V3.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V3.md), `scripts/client-portal/cp2b_qa_package_v3.manifest.json`, and authorization ID `CP2B-V3-AUTHORIZATION-PENDING`.
- V1/V2 authorization cannot authorize V3. A future CP-2B must name the exact clean CP-2A.2 commit and accept every V3, reused V2, original, and migration hash in a new prompt.
- Never invoke `run-cp2b-qa-v3.mjs --execute` from a generic npm task. CP-2A.2 ran only version/project-list/plan/preflight and negative gate proofs; QA and production writes remain zero.
- The first authorized V3 attempt stopped cleanly because the frozen apply wrapper exposed `(user_id, staff_role, status)` while the migration requires `(user_id, role)` and activates every bootstrap row. Recovery removed all ten synthetic Auth users and left zero schema/data/Storage/Edge residue; the private blocked ledger is retained.
- CP-2A.3 prepares a separate V4 correction that bootstraps the confirmed real staff identity and leaves synthetic suspended staff to the frozen V2 fixtures. Original, V2 and V3 artifacts remain immutable.
- CP-2A.3 is closed: the frozen authenticated CP-2A.2 proof passed through an authorized private-auth process without exposing authentication, and the local/disposable V4 proof passed with zero remote writes.
- Never invoke `run-cp2b-qa-v4.mjs --execute` from a generic npm task. CP-2A.3 authorizes only local/disposable proof, V4 plan and V4 preflight.
- CP-2A.4 closes the V4 PostgreSQL secret-order defect with a separate V5 transport. The database URL is converted to a minimal `PG*` child environment before the frozen launcher sees arguments, and a live read-only QA/staff/prestate gate completes before any ledger or Auth effect.
- CP-2B V5 executed once against exact QA and passed. Its completed ledger,
  independent zero-residue reconciliation and remaining harness debt are
  recorded in
  [client-portal/CP2B_V5_QA_EXECUTION_20260727.md](client-portal/CP2B_V5_QA_EXECUTION_20260727.md).
- Never invoke `run-cp2b-qa-v5.mjs --execute` again without a new exact
  authorization. The completed run is not reusable and does not authorize
  CP-3 or production.
- CP2B ledgers/backups/catalogs/Edge env files belong only under `.git/cp2b-private/` or another private ignored location. They must never be staged, printed, or searched by email.
- WordPress/SiteGround integration is CP-4. No public website repository was found in the connected owner or local workspaces; obtain a versioned export/backup and controlled deployment procedure before modifying it.
- Legal content remains `pending professional legal approval` until verified controller/provider facts and human legal review exist.

## Mandatory Documents

Before any code modification, read:

1. `AGENTS.md`
2. `docs/UX_APP_MANUAL.md`
3. `docs/CODEX_WORKFLOW.md`
4. `docs/APP_QUALITY_GATES.md`
5. `docs/APP_TRANSFORMATION_ROADMAP.md`

## Required Sequence

1. Inspect the real repository structure.
2. Identify the current implementation files involved.
3. Diagnose the current behavior from code.
4. Define scope, non-goals, and risks.
5. Present a plan.
6. Make the smallest safe change set.
7. Run verification commands.
8. Review git diff and git status.
9. Commit.
10. Push.

## Diagnosis First

Diagnosis must happen before implementation.

Diagnosis includes:

- reading the actual files involved
- understanding current data flow
- identifying current UI and state boundaries
- noting constraints around routes, Supabase, auth, and critical business logic

If a risk is outside current sprint scope, document it rather than fixing it opportunistically.

## Planning Rule

No file edits should start before a plan exists.

A valid plan should define:

- target outcome
- files likely involved
- what will not be touched
- validation steps

## Small-Change Rule

Preferred approach:

- small patch sets
- narrow scope
- easy review
- easy rollback

Avoid:

- broad rewrites
- speculative cleanup
- hidden side effects
- multi-domain changes in one block

## Protected Areas

Unless explicitly requested, do not modify:

- routes
- Supabase
- auth
- invoices
- quotes
- clients
- services
- critical domain logic

## Refactor Rule

No unrelated refactors.

If existing code is imperfect but not required for the requested change, leave it unchanged and document the issue if relevant.

## Verification Rule

Before closeout, run:

- `npm run lint`
- `npm run build`

If either fails, report the failure clearly and do not pretend the block is complete.

## Git Closeout Rule

Every closed work block should end with:

- reviewed git status
- intentional commit
- push to the active remote branch

## Expected Behavior Of Codex

Codex should behave as an implementation partner with repository discipline:

- evidence first
- constrained scope
- explicit tradeoffs
- honest verification
- no invented certainty

## Universal Correction And Release Integration

For correction and release work, this repository adopts the universal control layer without replacing Costa Clean's stricter rules:

- [UNIVERSAL_CORRECTION_SYSTEM.md](UNIVERSAL_CORRECTION_SYSTEM.md) defines intake, classification, diagnosis, correction, proportional validation and rollback.
- [UX_UI_CORRECTION_SYSTEM.md](UX_UI_CORRECTION_SYSTEM.md) governs visual and experience corrections.
- [UNIVERSAL_RELEASE_SYSTEM.md](UNIVERSAL_RELEASE_SYSTEM.md) governs release classification and traceable publication.
- [CODEX_UNIVERSAL_CORRECTOR_PROTOCOL.md](CODEX_UNIVERSAL_CORRECTOR_PROTOCOL.md) provides reusable Codex prompts.
- [UNIVERSAL_RISK_ZONES.md](UNIVERSAL_RISK_ZONES.md) is the generic risk baseline; [RISK_MAP.md](RISK_MAP.md) remains authoritative for Costa Clean specifics.
- [UNIVERSAL_RELEASE_LOG.md](UNIVERSAL_RELEASE_LOG.md) records universal-system releases.

When rules differ, `AGENTS.md`, this workflow, the app quality gates and explicit sprint constraints take precedence. None of these documents authorizes production, Supabase, financial, fiscal, auth or deployment changes by itself.
