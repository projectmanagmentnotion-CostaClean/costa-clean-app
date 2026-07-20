# Full-Flow QA And Numbering Restoration Strategy

## Goal

Exercise every user-facing flow, final submit, button, and supported business rule with real persistence while guaranteeing that QA activity cannot alter production numbering or leave test records behind.

## Non-Negotiable Boundary

Production numbering must never be reset, decremented, renumbered, or repaired after QA. Rewinding a live counter can create duplicates under concurrency and can invalidate fiscal traceability. Cleanup by archiving a record also does not restore a consumed sequence value.

The safe meaning of "reset all numbering" is restoring an isolated QA datastore to its exact pre-run snapshot or discarding the disposable QA database branch. It is not an `UPDATE` against production records or sequences.

## Required Environment

1. Create a dedicated Supabase QA project or disposable database branch with the same schema, policies, functions, and build contract as production.
2. Seed it from a sanitized fixture set. Do not copy customer data, production sessions, tokens, or privileged credentials into QA reports.
3. Use a dedicated QA user and a QA-only public URL/anon key. Keep service-role credentials outside the browser runner.
4. Disable outbound email, payment, fiscal submission, and other external side effects, or route them to verified sandbox providers.
5. Record an environment fingerprint so the runner fails closed if the target is production or an unknown project.

## Baseline Snapshot

Before each run, capture a private machine-readable baseline for every numbered entity, including clients, properties, quotes, jobs, invoices, expenses, payments, and any other document family discovered in the schema inventory.

The baseline must include row counts, active and archived counts, maximum displayed number, sequence state where applicable, and a deterministic checksum of stable identifiers. It must not include tokens, cookies, or customer payloads.

## Execution Matrix

The runner should maintain a versioned inventory that maps every visible button and state transition to a test case. Each case records viewport, starting state, action, expected UI result, expected persisted result, allowed external side effect, and cleanup/restoration proof.

Run the matrix at mobile, tablet, and desktop widths. Cover create, edit, archive, restore, duplicate review, status transitions, document preview/export, validation failures, navigation, filters, alerts, and permission-denied states. Invoice emission, payment registration, and fiscal actions run only against sandbox integrations in the isolated environment.

Every created entity must carry a unique `qaRunId` where the product contract permits it. The runner must record every created identifier immediately and stop on an untracked write.

## Restoration

After the matrix finishes, destroy the disposable database branch or restore the complete pre-run snapshot atomically. Partial soft-delete cleanup is not sufficient for numbered documents because it can leave consumed numbers and sequence drift.

After restoration, compare the datastore against the baseline. The gate passes only when row counts, active/archive counts, numbering maxima, sequence state, and deterministic checksums all match. A mismatch is a critical failure and blocks further runs.

## Production Smoke Gate

Production validation remains read-only except for separately approved, non-numbered, reversible QA entities. It may verify authentication, navigation, rendering, queries, previews, and validation boundaries. It must not emit invoices, register payments, create fiscal records, or reset numbering.

## Implementation Gate

Before enabling this strategy, complete a read-only inventory of all numbered tables, generators, triggers, RPCs, and external side effects. Then provision the isolated environment and add environment-fingerprint, baseline, matrix, and restore verification commands. Schema, migration, RPC, and deployment work requires a separate explicitly approved sprint.
