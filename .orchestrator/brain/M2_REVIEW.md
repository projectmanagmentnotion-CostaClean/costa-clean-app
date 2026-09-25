# M2 review package

## What we believe Costa Clean is

Costa Clean is a React/Vite/TypeScript CRM for a professional cleaning business, with authenticated staff workflows, public/portal surfaces, and Supabase-backed operational domains.

## Current architecture

The code is organized around a React shell, V3 presentation/domain modules, feature APIs, Supabase integration, migrations, and Edge Functions. Vercel configuration is present. This is a repository-level model, not a claim that remote services are currently healthy.

## Current roadmap

The repository contains substantial historical V3, portal, financial, alert, and release documentation. The migration deliberately does not re-certify those documents. The only active gate created by M2 is `M2-HUMAN-REVIEW`.

## Current gate

`M2-HUMAN-REVIEW` is BLOCKED until the Brain is accepted or corrected by a human.

## Current objective

Review this Brain and define one bounded later objective. It is not permission to run Costa Clean.

## Confirmed completed work

- Canonical remote identity and base commit recorded.
- Isolated worktree created from remote `main`.
- Brain documents, state, gate, schemas, evidence, uncertainty register, and manifest created locally.
- No application code was changed.

## Known blockers

Human strategic review, active rebase in the original checkout, historical claims requiring recertification, and unknown current runtime health.

## Important decisions

The original checkout remains untouched. M2 uses the remote canonical base, keeps the migration local, forbids external side effects, and treats historical prose as non-authoritative until verified.

## Uncertainties requiring review

See `MIGRATION_UNCERTAINTIES.md`. Most importantly, the next product objective and product gate are not inferred from historical labels.

## Differences from previous documentation

This Brain centralizes identity, architecture, security, state, and uncertainty handling. It intentionally downgrades unverified historical PASS labels to evidence references rather than copying them into active state.

## What will happen if this Brain is approved

A later phase may create one bounded task contract with explicit acceptance criteria, baseline HEAD, allowed actions, forbidden actions, and verification. Approval of this package alone does not execute that task.

## What Codex will be allowed to do next

Only the actions stated in the later accepted task. The orchestrator must revalidate Brain hashes and the baseline before execution, preserve crash-safe state, and stop for any approval-required action.
