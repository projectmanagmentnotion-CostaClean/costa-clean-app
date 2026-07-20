# QA Sandbox Seed Data Plan

## Purpose

Define the smallest deterministic dataset needed to exercise real submits and downstream relationships in the isolated QA sandbox. This document does not create data.

## Naming And Ownership

- Stable baseline records use `QA-DEMO-*` identifiers and remain after each successful reset.
- Per-run records use `QA-AUTO-<qaRunId>` and must disappear after reset.
- Use synthetic names, addresses, emails, tax identifiers, amounts, and dates only.
- All relationships remain inside the sandbox dataset.

## Minimum Baseline

| Fixture | Minimum fields | Required relationships | Reset policy |
| --- | --- | --- | --- |
| Residential client | Name, synthetic email/phone, active status | Owns basic property | Preserve baseline |
| Company client | Legal name, synthetic tax data, billing contact | Owns tourist property | Preserve baseline |
| Basic property | Name, synthetic address, city, client ID | Residential client | Preserve baseline |
| Tourist property | Name, synthetic address, access notes, client ID | Company client | Preserve baseline |
| One-off service template | Name, duration, sandbox price/tax metadata | None | Preserve baseline |
| Recurring service template | Name, cadence, duration, sandbox price/tax metadata | None | Preserve baseline |
| Draft quote | Client, property, line, quantity, draft status | Residential baseline | Preserve baseline |
| QA expense | Supplier, date, amount, category, notes | Optional property/job | Recreate with snapshot |
| Sandbox invoice | Sandbox series, client, property, lines, draft state | Company baseline | Sandbox only; snapshot reset |
| Sandbox payment | Invoice, amount, date, sandbox method | Sandbox invoice | Sandbox only; snapshot reset |

## Flow-Created Data

The action matrix creates fresh client, property, quote, expense, job, recurring schedule, invoice, payment, and cancellation records using one `qaRunId`. Each ID is captured before the next dependent step. No flow may select a production-like or unlabelled record.

## Relationship Chain

The canonical full-flow chain is:

```text
client -> property -> quote -> job/service -> invoice -> payment
                           -> recurring schedule
                           -> expense
```

Tests must verify both forward visibility and reverse context after each submit. Examples include the new property appearing in client context, the accepted quote being selectable by the job flow, and the sandbox invoice showing its payment after registration.

## Baseline Verification

Before use, the seed command must publish a private manifest containing fixture keys, stable IDs, relationship IDs, counts, and checksums. It must not include secrets or real customer payloads. Running seed twice must be idempotent or fail with a clear duplicate-baseline error.

## Deferred Work

No seed script or data is created in this sprint because no QA project exists. Schema-specific required fields and sandbox series configuration must be derived from a read-only inventory after the project is provisioned.
