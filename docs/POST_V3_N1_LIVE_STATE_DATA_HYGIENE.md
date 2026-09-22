# Post‑V3 N1 — Live state, data hygiene and header

## Scope and safety

This sprint is on `codex/post-v3-n1-live-state-data-integrity`, based on post-release documentation commit `5da9b7a50a88488e186947bd8aab306a12228b1d`; the deployed product SHA remains `727ecfd29d1a888deb4d064f3528ea5671ac9024`. No Production deployment, schema change, or data mutation was performed. Production inspection was read-only. QA received one additive migration enabling Postgres Changes for internal V3 operational tables only; public intake and portal tables were deliberately excluded.

## Diagnosis and changes

- Module detail was encoded in query parameters (`invoice`, `quote`, `property`, and related keys) and remained there when `view` changed. Invoice/quote/payment deep-link filters also lived in the shared shell. Leaving a module now removes its transient entity parameters and clears only that module's selected-entity filter; safe list filters remain. Browser history keeps its view entries and does not retain the old entity key when navigating normally.
- REST list reads previously made one un-ranged request. They now fetch 500-row ranges until a short page arrives, deduplicate primary-key overlap between pages, and fail closed if a server repeats a full page. All current list ordering is deterministic for each request; Realtime invalidations, focus/reconnect refresh and the 60-second visible fallback reconcile cross-request changes. PostgREST range paging is not a database snapshot, so concurrent changes can cause a brief duplicate/shift during a traversal; key deduplication and the follow-up canonical refresh prevent that from persisting as the settled list.
- Returning to a module now queues a refresh even when its data had already been loaded. Refreshes are serialized, preserve existing rendered data while refreshing, and keep the full-page loading state for first load only. Domain loaders report success/failure so a failed read is labeled `Error al actualizar`, not “Actualizado ahora”; failed attempts remain throttled to avoid hammering the backend. Existing mutation callbacks remain the invalidation path. Focus, visibility, reconnect and Realtime paths refresh the current or affected loaded domains; the visible-tab safety fallback is 60 seconds and foreground refresh is throttled to 30 seconds. One shared channel is used and removed on unmount.
- The header now renders the single `V3BrandLockup` at the left and a distinct accessible current-screen status label at the right. The navigation rail no longer duplicates the brand mark. Header lockup uses a 48px mark and retains the certified navigation palette.

## Realtime table decision

One shared channel subscribes to `INSERT`, `UPDATE` and `DELETE` as invalidation signals, then refetches canonical read models rather than locally merging complex finance data. QA's `supabase_realtime` publication initially contained none of these tables. The idempotent migration `supabase/migrations/20260922091209_n1_enable_internal_app_realtime.sql` adds core operational tables: clients, properties, leads, lead drafts, quotes and quote lines, jobs and job lines, invoices and invoice lines, payments, expenses, recurring invoice plans, quarterly closings and annual closings. The second migration `supabase/migrations/20260922093632_n1_enable_internal_intake_notifications_realtime.sql` adds `intake_submissions`, which the internal app already consumes solely for staff notification inserts; it does not alter public intake writes or schema. Post-migration QA verification found all 16 subscribed tables in the publication. Production publication was queried read-only and remains unchanged (zero of these tables enabled); apply these migrations to Production only through a separately authorized release/database gate.

## Data audit and hygiene

Sanitized aggregate reads on 2026-09-22 found:

| Entity | Production active | QA active |
|---|---:|---:|
| Clients | 26 | 8 |
| Properties | 28 | 2 |
| Leads | 47 | 2 |
| Quotes | 12 | 0 |
| Jobs | 59 | 0 |
| Invoices | 69 | 8 |
| Payments | 69 | 0 |
| Expenses | 37 | 1 |
| Recurring plans | 0 | 0 |
| Closings | 3 (2 quarterly, 1 annual) | 0 |

The audited relationship checks returned zero property/client, quote/property/client, job/property/client, invoice/property/client mismatches; zero payments without an invoice; and zero quote/job/invoice lines without a parent, in both environments. No deterministic relink or archive candidate was found in those checks. Counts and checks were aggregate-only; no IDs or personal/business payloads are included here. The historical PRO-0018 correction was not revisited.

`src/app/dataHygiene.ts` provides a deterministic planner and dry-run reporting. Archiving requires a clearly stale, non-fiscal, non-settled, non-historical record without active references and with archive support. Fiscal/history entities are also excluded from automatic relinking; unresolved cases remain manual review. The live audit yielded zero candidates. The previous injectable `APPLY_QA` callback was removed after independent review identified that a claimed project reference cannot prove where arbitrary callback code writes. Empty QA apply is a no-op; non-empty `APPLY_QA` now fails closed until a concrete, QA-bound transactional mutation-and-audit endpoint is implemented and reviewed. No QA business writes, audit writes, archives, or relinks occurred. Live idempotency after a real cleanup remains not applicable until a candidate exists.

## Verification

- Authenticated, visible Edge QA used the isolated local profile and QA project configuration; auth bypass was not used. The initial full runner checked 1,848/1,848 surface/action assertions over its matrix, including 320px mobile, iPad and desktop sizes. After the final narrow-header cascade correction, the authenticated invoice surface was re-opened at 320×568: all 12 audit checks passed, including header visibility, no horizontal overflow and shell/navigation visibility; the retained private screenshot shows the full “Facturas” pill and Costa Clean lockup. The focused full 320px runner was interrupted during its Jobs step after stalling. No QA business submit was performed.
- Tests: 501 passed across 133 files (baseline was 479; 22 added test cases cover REST range paging/overlap/order tie-break, navigation reset, hygiene rules, sync status, refresh scopes and header governance).
- Agents: 294/294 PASS; lint PASS; TypeScript/build PASS; diff check PASS.
- The QA advisor scan returned existing database-linter findings, including unrelated portal/policy/function warnings and duplicate invoice indexes. N1 did not modify those objects; they are outside this change's scope.
- Independent review initially returned CHANGES REQUESTED (P1/P2 findings), leading to removal of the injectable QA mutation callback, manual-only fiscal/history relinking, retries for failed initial reads, complete pagination for lead drafts/job lines, and the second migration for staff intake notifications. A follow-up then found two P2s: narrow-header CSS cascade order and archive safety depending on omitted facts. Both are resolved: the 320px header rule now follows base styles and was visually rechecked; archive safety requires explicit false/true facts and has a regression test. The final independent re-review confirms those two findings resolved and reports no remaining findings in this focused re-review (P0/P1/P2/P3 = 0/0/0/0). This was a narrow follow-up, not a fresh re-execution of every initial review dimension.

## Follow-up

Before Production can receive the Realtime publication migrations, review the exact SQL through the standard database release gate. Data cleanup remains disabled for Production pending separate explicit authorization. The N1.1B section below supersedes the original empty-apply limitation for QA only; Production cleanup and deployment remain outside authorization.

## N1.1B — authenticated QA transactional hygiene adapter

N1.1B ran on `codex/post-v3-n11-hygiene-transactional-adapter`, source HEAD `9d9bfad87fcef6fa837076ea80a0e10ad5e5660e`. The only database target changed was CostaClean QA (`kpvvydthlxupjjqqdpxy`). The four repository migration files are aligned by migration name with exactly one QA history row each: `n11a_app_internal_staff_authorization` (QA version `20260922104759`), `n11_transactional_data_hygiene_adapter` (`20260922111338`), `n11b_role_scoped_authorization_and_literal_hygiene_prefixes` (`20260922113953`), and `n11c_testable_internal_staff_role_predicates` (`20260922115842`). No Production migration or deployment was performed.

### APP-owned authorization

- `public.internal_staff_memberships` remains the only membership source; N1.1B did not insert, update, or delete membership rows as an authorization change.
- General write guards allow active, non-revoked `owner`, `admin`, `operator`, and `finance` roles. Financial write guards allow only `owner`, `admin`, and `finance`; `readonly` is denied by both.
- Authenticated QA was recovered in the isolated Edge profile without bypass. `/auth/v1/user` returned success. Real-token calls to the existing `create_client` and `save_quote_with_lines` RPCs used deliberately invalid null payloads and both reached payload validation (HTTP 400); no business write was accepted.
- The live SQL contract matrix passed for allowed/disallowed role sets, suspended/revoked membership, no membership, null UID, Production issuer context, anonymous apply (HTTP 401), and readonly adapter apply. All simulated role/status mutations were transaction-local and rolled back; the membership row fingerprint was unchanged.
- General, financial, legacy app-write, and Portal independence checks remain separate: the two public app write guards route to `app_private`; no Portal-private dependency was found in those guards. The hygiene adapter is callable only through its authenticated public wrapper, and the legacy implementation is not executable by API roles.

### QA-only hygiene adapter evidence

The adapter is limited to synthetic draft quotes and two mutating actions: deterministic relation relink and stale-draft soft archive. Ambiguous cases produce manual review. The QA issuer is taken from the signed JWT issuer claim and compared to the fixed QA issuer; no caller-supplied environment or project reference is accepted.

- Non-empty dry run: 3 actions (1 relink, 1 archive, 1 manual review), plan ID `ec448c2a-34e7-425c-989c-aaf1136e2c63`, SHA-256 `e7133ff011b9d2a20a2a9fa78dae181436854ad41674177ea9cbdf09a76fd505`.
- First apply: relinks `1`, archives `1`, manual reviews `1`; private audit contains one run and three action rows. Replaying the same plan/hash returned `already_applied` with `0/0/0` additional actions.
- Hash tampering failed with `22023`. A stale plan failed with `40001` and left no run/action rows or unexpected target change.
- A controlled QA-only trigger raised `ZX001` after the quote mutation and before audit completion. The transaction rolled back both business and audit changes (`partial_state_after_failure = 0`); the temporary trigger/function were removed.
- The ambiguity fixture was recorded as manual review, never auto-relinked. A lookalike ID with hyphens in place of underscores was rejected by the corrected literal-prefix guard.
- Teardown soft-archived only the 2 synthetic clients, 1 synthetic property, and 4 synthetic quotes after confirming no non-synthetic dependents. No hard deletes occurred. All prefixed QA fixtures are archived; the final plan is empty. The private audit evidence remains (1 run, 3 actions).
- QA final aggregate audit: logical orphans `0`, relation mismatches `0`, active synthetic fixture rows `0`.

The test-only QA business data was intentionally created and mutated under the `QA_HYGIENE_N11_` namespace. The adapter’s successful changes were exactly one relink and one soft archive; stale/rollback probes were restored, and all fixtures were then soft-archived. This is not a zero-QA-write result.

### Production read-only audit and test status

Production (`wfxnwfcdjainpojhbdri`) was queried read-only after QA cleanup. Aggregate results: logical orphans `0`, relation mismatches `0`, and qualified archive candidates `0`. Five active draft quotes had no downstream job/invoice/recurring-plan reference, but absence of references alone does not prove that a quote is clearly stale; they were not classified as cleanup candidates and were not modified. Production mutations, migrations, and deployment remained `0`.

The committed database contract suite is `supabase/tests/n11b_role_scoped_authorization_and_literal_prefixes_test.sql` (pgTAP, 27 assertions). Its final assertion queries `pg_constraint` for the exact APP-private audit relation and named fixture-prefix constraint. This machine had no Docker/psql or linked local database, and the QA project does not have pgTAP enabled, so that exact pgTAP file was not run and pgTAP was not enabled remotely. Instead, all 27 equivalent live QA assertions were executed in a rollback-only SQL block against the installed functions, privileges, constraints, and catalog definitions; the block passed. Focused Vitest migration-contract tests also pass. This is executable QA evidence, but not a claim that the pgTAP runner itself was run.

### Final N1 handoff to N2

- `N1_STATUS=PASS`
- `PRODUCTION_CLEANUP_REQUIRED=NO`
- `PRODUCTION_CLEANUP_STATUS=NOT_REQUIRED`
- `N2_READY=YES`

The five unattached draft quotes were reviewed read-only and retained because each still has a valid lead or client/property relationship; none is an archive candidate. The QA-only cleanup planner is not to be installed in Production merely to produce an empty plan. N2.0B's separate zero-cost QA readiness is tracked in `docs/POST_V3_N2_ZERO_COST_QA_READINESS.md` and remains blocked until authenticated cleanup/rollback proof completes.
