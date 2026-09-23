# POST-V3 Global Release Certification

Status: pre-production certification complete. This document does not authorize or execute Production migration, deployment, authentication change, secret change, or business mutation.

## Locked release

- Production baseline: `727ecfd29d1a888deb4d064f3528ea5671ac9024`
- Certified product target: `d96e1426d85dee4bb93537a9d4e6bdf6318b5509`
- Branch: `codex/post-v3-n21-atomic-business-graph`
- QA project: `kpvvydthlxupjjqqdpxy`
- Production project: `wfxnwfcdjainpojhbdri`
- Canonical Production domain: `https://app.costacleanbcn.com`

The local and remote target SHA matched exactly. The certification worktree was clean before this documentation-only commit.

## Product migration manifest

Exactly 11 product migrations are added between the deployed baseline and the target, in execution order:

1. `20260922091209_n1_enable_internal_app_realtime.sql`
2. `20260922093632_n1_enable_internal_intake_notifications_realtime.sql`
3. `20260922104759_n11a_app_internal_staff_authorization.sql`
4. `20260922111338_n11_transactional_data_hygiene_adapter.sql`
5. `20260922113953_n11b_role_scoped_authorization_and_literal_hygiene_prefixes.sql`
6. `20260922115842_n11c_testable_internal_staff_role_predicates.sql`
7. `20260922160000_n3_single_authority_invoice_numbering.sql`
8. `20260922161000_n3_cancelled_draft_and_numbering_audit.sql`
9. `20260922180000_n3_restore_invoice_numbering_gap_guard.sql`
10. `20260922200501_n21_atomic_business_graph.sql`
11. `20260923103000_n21_existing_job_quote_guard.sql`

No shared product migration was modified. The static review found no unbounded delete or update. The only destructive-looking statements are bounded contract operations: trigger replacement, constraint replacement in the hygiene adapter, function replacement/rename, and guarded fiscal deletion. Security-definer functions set an explicit safe search path. N2.1 uses row locks for operation and invoice serialization.

## QA-only exclusion

Exactly 10 QA-only migrations remain outside the Production plan:

1. `20260922131455_n2_zero_cost_qa_readiness.sql`
2. `20260922143036_n2_concurrent_settlement_qa_support.sql`
3. `20260922163000_n3_invoice_numbering_qa_fixtures.sql`
4. `20260922164500_n3_fixture_cleanup_payments.sql`
5. `20260922170000_n3_fixture_fiscal_client.sql`
6. `20260922172000_n3_fiscal_immutability_probe.sql`
7. `20260922172500_n3_snapshot_next_numbers.sql`
8. `20260922173500_n3_qa_cleanup_guard_after_product_hardening.sql`
9. `20260923120000_n21_func_fixture_teardown_qa.sql`
10. `20260923133000_n21_failure_injection_qa.sql`

Deployment tooling and repository checks keep `supabase/migrations` and `supabase/qa-migrations` separate; no Production plan references the QA path.

## Production read-only prestate

Production was queried read-only. Its migration ledger contains the pre-existing historical chain but none of the 11 locked target versions. The expected prestate is therefore `NOT_APPLIED` for the new product migrations, with no unexplained drift.

Observed compatibility detail: `public.internal_staff_memberships` already exists with the expected columns and constraints, while its legacy read policy references `portal_private`. This is a known shared historical relation. N11 creates the canonical `app_private` authorization helpers and does not silently rewrite that legacy policy during certification. No Production repair was performed.

Production prestate observations:

- N1 Realtime publication membership for the internal tables: `0`.
- N2.1 operation tables: absent.
- N2.1 business-graph RPCs: absent.
- N3 numbering allocator already exists from the deployed historical base.
- Active `app_private` staff helpers: absent before the target migrations.

## QA reconciliation

QA contains the product effects under its QA-applied migration timestamps and the QA-only support ledger. The actual QA objects match the target contracts: N1 invalidation, N3 numbering, N2.1 graph and settlement RPCs, guarded teardown, and failure-injection support. Migration history was not rewritten. Final QA provenance residue is zero and the fiscal sequence remained unchanged.

## Integrated certification evidence

- N1: detail reset, re-entry root, focus/visibility/reconnect refresh, Realtime invoice/job/payment, subscription cleanup, visible polling, header and one-logo contracts: PASS.
- N3: draft unnumbered, single allocator, issue/reissue, failed-issue gap zero, concurrent numbering, cancelled-draft behavior, hard-delete and renumbering guards: PASS.
- N2.1: AUTO_CREATE, EXISTING_JOB, FROM_QUOTE zero/one/multi-job, line parity, lineage, idempotency, rollback, settlement and Mark Paid: PASS.
- Graph invariants: all mismatch, orphan, duplicate-operation, duplicate-job, and overpayment counters are zero.
- Historical compatibility: no bulk backfill; historical invoices without jobs remain supported.
- Recurring compatibility: PASS; no recurring redesign or duplicate generation.
- Responsive authenticated QA: 390x844, 820x1180, and 1440x900 PASS with write-and-clean fixtures.
- QA fixture residue: zero; real QA business rows changed by certification: zero.
- Automated gates: 561 tests passed, 0 skipped; agents 294/294; lint, TypeScript, build, diff check, and secret scan PASS.

## Release order plan — not executed

1. Reconfirm exact target SHA, clean worktree, and Production rollback deployment.
2. Apply only the 11 product migrations in the ordered manifest using the approved migration runner; never glob `supabase/qa-migrations`.
3. Run read-only post-migration assertions for ledger, functions, triggers, policies, grants, Realtime publication, numbering, graph integrity, settlement, and duplicate/mismatch counters.
4. Deploy exactly the certified product SHA to the existing Vercel Production project.
5. Run authenticated, narrowly controlled smoke with explicit business-write authorization, including invoice issue and settlement.
6. Verify Realtime in a second authenticated context, logs, console errors, page errors, and final financial state.

This sequence is a plan only. It was not executed in this certification.

## Post-migration verification plan

Verify the migration ledger contains exactly the ordered product versions; assert the canonical RPC definitions and safe search paths; inspect trigger definitions and ACLs; verify publication membership for the N1 table set; assert one active invoice allocator; run duplicate fiscal-number, graph mismatch, orphan payment, duplicate operation, and overpayment queries; verify `save_invoice_business_graph` and `settle_invoice_business` behavior through controlled authorized smoke.

## Post-deploy smoke plan

Authenticate normally, open Home, Facturas, and Servicios, verify shell/branding, run read-only list/detail/preview checks, then perform only the explicitly authorized controlled sequence: AUTO_CREATE invoice, issue, Mark Paid, Existing Job, From Quote, and second-context Realtime observation. Verify responsive sanity at 390x844, 820x1180, and 1440x900, plus console/network/page errors. Do not perform any additional business mutation.

## Rollback and forward-fix plan

App rollback means promoting the previously captured Vercel deployment for `727ecfd29d1a888deb4d064f3528ea5671ac9024`. Database changes are not treated as safely reversible: additive schema/function changes and guards require a tested forward-fix migration if a defect is found. Do not invent destructive rollback SQL, rewrite migration history, renumber invoices, or delete business data. A failed Production smoke stops certification and uses the captured app deployment as the rollback reference while the database remains under forward-fix review.

## Authorization boundary

Production release authorization is still required. Any later authorization must identify the exact product SHA `d96e1426d85dee4bb93537a9d4e6bdf6318b5509`, the exact ordered 11-migration list, the existing Vercel project/deployment target, and the controlled smoke scope. No Production migration, deployment, data cleanup, Auth mutation, or secret mutation was performed here.
