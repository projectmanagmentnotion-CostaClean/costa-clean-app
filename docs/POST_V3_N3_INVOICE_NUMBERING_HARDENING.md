# Post-V3 N3 — Fiscal Numbering Hardening

## Scope and safety

N3 establishes one canonical invoice-number allocator, separates QA-only
fixtures from product migrations, and verifies numbering and settlement
invariants. The work is on `codex/post-v3-n3-invoice-numbering-hardening`,
based on certified product head `0cd5a96820c63cce9b41e34584582543aee6f287`.
No Production migration, deployment, email, or Production business mutation
was performed. Production checks below were read-only. QA interaction used the
authenticated QA identity and the QA project `kpvvydthlxupjjqqdpxy`.

The product migration sources are under `supabase/migrations/`. All N2/N3
fixture, setup, probe, and teardown helpers are under `supabase/qa-migrations/`
and are not in the product migration path. The two N2 helper sources were
moved out of `supabase/migrations/`; their QA history was not rewritten.
`supabase/config.toml` and the referenced `scripts/ops/assert-db-push-locked.mjs`
are absent in this checkout, so this document is not authorization to apply
these migrations to Production. A separately reviewed and explicitly
authorized Production migration procedure is still required.

## Product changes

- `20260922160000_n3_single_authority_invoice_numbering.sql` removes the
  legacy `trg_set_invoices_codes` trigger while retaining its function and
  sequence as deprecated compatibility objects. The existing canonical
  `trg_sync_invoice_numbering` remains the sole allocator and retains the
  year-scoped advisory transaction lock and first-missing-number allocation.
  The allocator selects the first missing positive sequence only after the
  regularity assertion confirms there is no historical gap between consumed
  numbers; gaps block issuance for review rather than being silently reused.
  An empty fiscal year therefore starts at `001`, and the transaction-scoped
  year lock serializes concurrent allocation.
- Display numbers now include their fiscal year (`INV-2027-001`) to prevent
  the global display-code uniqueness rule from colliding at annual reset.
  The fiscal number remains year-qualified (`2027-001`). Parsers continue to
  accept legacy display codes such as `INV-0001`.
- Numberless drafts and cancelled drafts do not consume fiscal numbers.
  Reissuing a cancelled, unnumbered draft allocates a number. Once issued,
  cancellation preserves the fiscal number. Normal flows cannot renumber an
  invoice or change its fiscal year. Numbered/fiscal invoices cannot be
  hard-deleted; a never-issued, unnumbered draft may be removed.
- The numbering audit checks malformed or incomplete fiscal/display pairs,
  year mismatch, partial cancellation numbering, drafts carrying numbers,
  duplicate fiscal numbers, duplicate visible codes, and gaps between existing
  consumed fiscal sequence values. Every N3 migration that defines or replaces
  this audit preserves the gap-blocking rule, so sequential migration
  application does not expose an unguarded interval.
- `src/features/invoices/invoiceNumbering.ts` now parses both legacy and
  year-qualified display codes and flags fiscal/display year disagreement.
  Canonical fiscal values and storage enums are not changed by this UI parser.

No invoice, payment, quote-conversion, settlement, schema/RLS policy, or
production data contract was intentionally changed beyond the numbering
behavior explicitly described above.

## Migration provenance

The migration service assigns its own version timestamp. Do not alter remote
migration history to make it match local filenames.

| Local source | Service version / name | Classification |
| --- | --- | --- |
| `supabase/qa-migrations/20260922131455_n2_zero_cost_qa_readiness.sql` | `20260922132814 / n2_zero_cost_qa_readiness` (with earlier N2 service hardening/snapshot entries `20260922134255` and `20260922134529`) | QA-only readiness and fixture helpers; relocated outside product path |
| `supabase/qa-migrations/20260922143036_n2_concurrent_settlement_qa_support.sql` | `20260922144144 / n2_concurrent_settlement_qa_support` | QA-only concurrent-settlement helpers; relocated outside product path |
| `supabase/migrations/20260922160000_n3_single_authority_invoice_numbering.sql` | `20260922153454 / n3_single_authority_invoice_numbering` | Product migration, applied to QA only |
| `supabase/qa-migrations/20260922163000_n3_invoice_numbering_qa_fixtures.sql` | `20260922153814 / n3_invoice_numbering_qa_fixtures` | QA-only restricted fixture operations |
| `supabase/qa-migrations/20260922164500_n3_fixture_cleanup_payments.sql` | `20260922154017 / n3_fixture_cleanup_payments` | QA-only cleanup of synthetic fixture payments |
| `supabase/qa-migrations/20260922170000_n3_fixture_fiscal_client.sql` | `20260922154101 / n3_fixture_fiscal_client` | QA-only selection of a fiscal-capable fixture client |
| `supabase/migrations/20260922161000_n3_cancelled_draft_and_numbering_audit.sql` | `20260922154927 / n3_cancelled_draft_and_numbering_audit` | Product corrective migration, applied to QA only |
| `supabase/qa-migrations/20260922172000_n3_fiscal_immutability_probe.sql` | `20260922155025 / n3_fiscal_immutability_probe` | QA-only authenticated immutable-number/delete probe |
| `supabase/qa-migrations/20260922172500_n3_snapshot_next_numbers.sql` | `20260922155027 / n3_snapshot_next_numbers` | QA-only before/after first-missing number snapshot |
| `supabase/qa-migrations/20260922173500_n3_qa_cleanup_guard_after_product_hardening.sql` | `20260922155348 / n3_qa_cleanup_guard_after_product_hardening` | QA-only exact-provenance cleanup guard restored after product hard-delete protection |
| `supabase/migrations/20260922180000_n3_restore_invoice_numbering_gap_guard.sql` | `20260922160650 / n3_restore_invoice_numbering_gap_guard` | Product corrective migration restoring the baseline gap-blocking assertion, applied to QA only |

The N2 source migration files are intentionally not deleted from QA history;
only their local source location changed. The helper functions are restricted
to the exact QA issuer and authorized QA identity, use exact synthetic
provenance markers, and are not shipped from the product migration directory.
No remote history was manually edited.

The live QA service ledger was read after application and matched the mapping
above. The pre-N3 QA/Production definitions matched exactly by function hash:
`set_invoices_codes=5148812cff490ef12d8782ba64df14b5`,
`sync_invoice_numbering=d32323da5f7442917869488aea9add36`, and
`assert_invoice_numbering_regular=3d17fdb1140180f9ba015d078fe00688`.
Post-N3 QA readback confirmed the legacy function hash remains unchanged and
the canonical trigger functions/builders/parser/audit/delete guard now have
live definitions; the authenticated QA scenarios exercised those definitions
end to end. Product source contracts additionally assert the trigger split,
gap rule, QA issuer/provenance boundaries, and forbidden sequence mutation.

The QA migration service originally applied the first N3 product sources
before the independent review identified the missing gap check. Those local
product migration definitions were then amended to keep the invariant in
every stage of a future sequential product-migration replay; the existing QA
migration history was not rewritten. The QA database received the separate
forward restoration migration `20260922160650`, and its final function
definition matches the corrected invariant. Production has not applied any
N3 migration.

## QA and invariant evidence

Authenticated QA runs were executed against the QA project only, without auth
bypass and with cleanup verified afterward. The runners do create controlled
synthetic QA fixture rows and remove them afterward; “zero real QA business-row
changes” means no pre-existing/non-fixture QA records were altered, not that
the QA database received no fixture writes.

- `npm run qa:n2:concurrency`: PASS. Two overlapping settlement calls for the
  same fixture invoice produced one payment, with no duplicate or overpayment.
  Fiscal mapping and legacy sequence returned to their baseline; no N2 residue
  or real QA business-row changes remained.
- `npm run qa:n3:numbering`: PASS. Ten concurrent issuance calls produced ten
  unique fiscal numbers and display codes; retries did not renumber; issued to
  cancelled retained numbering; a cancelled draft remained unnumbered and
  received a number only when reissued; direct draft-to-paid allocated once;
  a deliberately failed issue left no invoice residue or numbering gap; two
  concurrent settlements produced one payment; fiscal renumber/year change
  and hard delete were blocked; 2027 rollover yielded `2027-001` /
  `INV-2027-001`. QA fixture residue was zero, mapping hash was restored, the
  deprecated sequence returned to `109 / is_called=true`, and no real QA
  business rows changed.
- Focused suites: 31 passed after the final regressions were added.
- Full suite: 559 passed across 141 files.
- Project agents: 294/294 PASS. Lint: PASS. TypeScript and production build:
  PASS. `git diff --check`: PASS.
- The agent validator's built-in secret-indicator checks passed. A separate
  changed-file scan covered all 20 changed/added files and found zero
  indicators.

Production was checked read-only after QA. It still has 69 invoices, zero
duplicate fiscal-number groups, zero duplicate display-code groups, zero
numbering-pair mismatches, both pre-existing numbering triggers active, and
zero September N2/N3 migration-history entries. The legacy trigger/function
definitions have not been changed in Production. Pre-N3 Production hashes
remain `set_invoices_codes=5148812cff490ef12d8782ba64df14b5`,
`sync_invoice_numbering=d32323da5f7442917869488aea9add36`, and
`assert_invoice_numbering_regular=3d17fdb1140180f9ba015d078fe00688`, matching
QA before the sprint. The retired function and legacy sequence remain
referenced by historical/manual import tooling (`scripts/import-historical-invoices.mjs`)
and QA baseline snapshots; `set_invoices_codes()` is dormant after its trigger
is removed. No active canonical numbering path calls `nextval` or `setval`.
This confirms N3 has not been applied there.

## Review and release status

An earlier review found two P1 issues and three P2 evidence gaps. Cancelled-
draft reissue and client parser compatibility were corrected and covered by
tests; migration provenance, live immutability/delete behavior, and
before/after sequence restoration were documented and exercised above.

A fresh review then found that the replacement audit had omitted the
pre-existing no-gaps-before-issuance invariant (P1), and that emergency QA
cleanup failure could be masked by a primary test failure (P2). The gap guard
is now present in all three product migration definitions, with
the final forward migration retained for an already-updated QA database; a
regression test checks every definition. The runner now reports cleanup
failure and failed fixture run IDs alongside the primary error, including
missing/nonzero cleanup residue, also with regression coverage.

Fresh independent review of the final working tree: **PASS**, P0=0, P1=0,
P2=0, P3=0. The reviewer confirmed the gap guard is present in all three
transactional product migrations and the emergency QA cleanup path reports
RPC/throw/residue failures with affected run IDs. This is a working-tree
review; the commit and push are recorded by Git after this report update.

Production migration/deployment: **not performed**. QA migration application
and authenticated tests were limited to project `kpvvydthlxupjjqqdpxy`.
Production migration remains a separate explicit authorization gate.

## Future Production migration plan — not authorized or executed

1. **Preconditions:** obtain separate exact Production authorization; confirm
   the target is `wfxnwfcdjainpojhbdri`; verify a clean reviewed commit and no
   migration-history collision; rerun the read-only invoice counts, trigger
   definitions, unique-index/dependency audit, and the no-gap assertion for
   every fiscal year. Require duplicate fiscal/display groups, malformed or
   year-mismatched codes, numbered drafts, and issued/paid invoices missing
   either number to remain zero. Confirm the QA final migration versions and
   the migration sources to be applied are the approved ones.
2. **Apply:** apply the three transactional product migrations in order using
   the approved migration runner. Each audit definition already contains the
   gap guard, so the safety invariant holds after every individual commit.
   The first migration retires only `trg_set_invoices_codes`, installs the
   year-qualified display builder/parser compatibility, and retains the
   legacy function/sequence. The canonical trigger remains the only active
   allocator. Later migrations harden transition/audit semantics and restore
   the complete assertion. Do not apply anything from `supabase/qa-migrations/`.
3. **Post-migration assertions:** read-only verify the legacy trigger is
   absent, exactly one canonical numbering trigger is active, the old sequence
   is unchanged, fiscal/display unique indexes remain valid, all numbering
   invariants still return zero anomalies, and function definitions match
   the approved final migration. Then run a read-only UI smoke; do not create
   a real Production invoice as a migration test.
4. **Failure/rollback:** each SQL migration is transaction-wrapped, so a
   statement failure rolls back that migration and stops the sequence. Before
   any new fiscal issuance, resolve the migration failure and reapply only
   after review. After issuance under the new format, do not blindly restore
   the retired trigger, reset the sequence, renumber, or hard-delete invoices.
   Freeze invoice issuance if needed and use a separately reviewed forward
   corrective migration that preserves all assigned fiscal numbers. Database
   restore is an exceptional separately authorized recovery, not the routine
   rollback mechanism. Vercel/application deployment is a separate gate.

The repository's normal product migration location is `supabase/migrations/`.
This checkout lacks `supabase/config.toml` and the `assert-db-push-locked.mjs`
script referenced by package push aliases, so those aliases are not a usable
Production safety mechanism here. The Production plan therefore requires a
verified approved migration runner and explicit preflight; this is a recorded
tooling limitation, not permission to bypass it.
