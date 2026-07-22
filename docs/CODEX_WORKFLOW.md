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
