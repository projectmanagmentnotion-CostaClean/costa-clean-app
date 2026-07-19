# QA Sandbox Strategy

## Current Position

The default authenticated QA path remains `dry-run`.

`write-and-clean` is a constrained exception for a small subset of end-user flows that can:

- stamp a unique `qaRunId`
- find the created row deterministically
- apply a fixed cleanup payload
- emit private cleanup artifacts

## What Is Still Not Sandbox-Safe

The following domains are not sandbox-safe in this sprint:

- invoice emission
- payment creation
- fiscal closing mutations
- auth flows
- route or schema changes
- jobs without a dedicated cleanup contract

## Guardrails

- visible browser by default
- no private QA artifacts in git
- production-like targets require `QA_ALLOW_WRITE_CLEAN=1`
- if cleanup lookup is not deterministic, the flow must stop as `cleanup-not-available`
- no ad hoc SQL, migrations, RPC changes, or auth bypasses inside QA runs

## Submit Safety Update - 2026-07-19

- Client and property writes are the only currently live-proven write-and-clean paths.
- Quote and expense remain conditional until the build containing their confirmation and responsive-flow fixes is authenticated and exercised live.
- Invoice, payment, job, and fiscal mutation attempts are intercepted before opening a write form.
- Expected skip reasons are explicit: `production-build-outdated`, `invoice-write-not-safe`, `payment-write-not-safe`, `fiscal-write-not-safe`, or `cleanup-not-available`.
- Cleanup success requires a non-empty affected-row representation, preventing a missing row from being reported as cleaned.
