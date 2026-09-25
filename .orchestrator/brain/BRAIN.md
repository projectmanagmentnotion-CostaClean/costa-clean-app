# Brain

This is the initial canonical Project Brain for Costa Clean, migrated in Phase M2 from the canonical GitHub `main` snapshot. It is a reviewable documentation layer, not an execution authorization.

## Identity

- Project: Costa Clean CRM (`costa-clean-app`)
- Canonical source: GitHub `origin` / `main`
- Migration base: `368ed1f75ecda0c0f383c6df4ccffee216db76ce`
- Migration branch: `orchestrator/m2-canonical-brain`
- Brain version: 1
- Objective version: 1, explicitly pending human review

## Evidence policy

Claims are classified as `CONFIRMED_FACT`, `HISTORICAL_CLAIM_UNVERIFIED`, `INFERENCE`, `UNKNOWN`, or `CONFLICT`. Source prose and prior thread reports do not override repository evidence. The active local rebase in the original checkout is preserved as an uncertainty and was not touched.

## Operating rule

The Brain must be reviewed and accepted before any Costa Clean task is planned or executed. M2 creates no Planner run, Executor run, autonomous loop, remote mutation, deployment, or production access.
