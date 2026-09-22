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

Before Production can receive the Realtime publication migrations, review the exact SQL through the standard database release gate. Data cleanup remains disabled for Production pending separate explicit authorization. Non-empty QA cleanup remains deliberately blocked pending a concrete QA-bound transactional mutation-and-audit endpoint; do not claim cleanup execution/idempotency for a non-empty plan. Production cleanup and deployment remain outside authorization.
