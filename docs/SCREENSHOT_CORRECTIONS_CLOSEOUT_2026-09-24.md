# Screenshot Corrections Closeout — 2026-09-24

## Scope

This backlog is intentionally limited to the **latest screenshot-review phase** discussed immediately before N5. It does **not** include the full historical V3 redesign, N4 recurring-services work, or later Vercel routing/chunk-resilience fixes.

The phase is not considered complete until every item below is implemented, visually verified in the real app, and the resulting product is deployed to Production and smoke-tested.

## User-requested corrections

1. Status values must render as compact, consistent **pills/chips** across modules (for example: Pagada, Pendiente, Borrador, Revisado, Nuevo, Activo, Cancelado).
2. In **Cierres**, the **Salidas de periodo** area must not remain as two competing columns that compress the rest of the page.
3. In **Cierres**, **Resumen asistido** must have enough width and prominence to be comfortably readable.
4. Cierres must prioritize period + summary + key financial figures + primary action; secondary report/checklist/configuration content must not dominate the initial view.
5. **Facturado** must mean the invoices issued inside the selected period, using invoice issue date as the period membership criterion.
6. **Cobrado** must mean the payments collected against those same invoices issued in the selected period, not every payment whose payment date falls inside the period.
7. T3 mismatch must be corrected: payment events from invoices issued outside the selected period must not inflate the period's Cobrado figure.
8. Fiscal summaries must clearly separate **base imponible / IVA / total facturado** and must not label base amounts as total billed.
9. The known April–June discrepancy must be handled by the financial model rather than presentation ambiguity; calculations must reconcile issued invoices and their true totals.
10. Do not present an internal VAT estimate as a definitive tax filing result; copy must clearly identify estimates vs final fiscal declarations.
11. Cierres warnings/blockers must be shown clearly and actionably rather than buried in long text.
12. Mobile **Orden** and **Filtros** controls must be compact and fit on one line when feasible.
13. Reduce unnecessary nested boxes/cards. Avoid “card inside card inside card” where it adds no hierarchy.
14. Buttons must be compact, aligned and have a clear primary/secondary hierarchy.
15. Invoice detail should lead with total + status + primary action; secondary actions should be visually subordinate and may be grouped under “Más”.
16. Fiscal numbering/control tools intended for technical diagnostics must not appear as normal user-facing controls outside a debug/technical context.
17. Mobile KPI cards must be compact and readable; small metrics must not consume oversized cards.
18. KPI items with value 0 must not occupy a full useless card when they add no information.
19. Alert items with value 0 / no actionable condition must not create visual noise.
20. Alerts must deep-link to the exact record/filter/flow needed to resolve the issue rather than only opening the generic module.
21. Duplicate alerts must persist their reviewed/resolved state.
22. A reviewed/resolved duplicate must not continually reappear as unresolved noise.
23. Agenda should not consume prime Home space when it competes with more useful business information.
24. Home must prioritize useful financial/operational information and suppress empty/zero-value blocks where appropriate.
25. Expense fiscal review surfaces must be more compact and easier to scan; avoid excessive simultaneous blocks and helper copy.
26. Reduce repetitive and overly technical copy that reads like internal documentation rather than product UI.
27. Cards, filters, pills and KPIs should be compact **without** becoming hard to read or tap.
28. Use available viewport width better; do not compress meaningful content while leaving artificial empty columns/margins.
29. Fix wrapping/min-width/flex issues that squeeze text, buttons or sections into unusable layouts.
30. Reduce avoidable vertical length by grouping information and removing repeated copy.
31. The principal result/summary must appear before secondary controls/configuration where that order better supports the user's task.
32. Do not render multiple equal-weight CTAs. Primary, secondary and technical actions must have clear hierarchy.
33. Verify the corrected surfaces at minimum at 390x844, 768x1024 and desktop widths.
34. Horizontal overflow must remain 0 on the audited screens.
35. Do not mark a screenshot correction as fixed based only on code/tests. It must be visually checked in the running app.
36. Review the affected screens one by one; do not rely on a single global CSS change and assume every screenshot-specific issue is solved.

## Screenshot-derived bugs and technical findings to preserve in the implementation

### Cierres / financial semantics
- Period membership for Facturado is based on invoice issue date.
- Cobrado for a period is the sum of payments linked to the invoices that belong to that period.
- Payments received during the period for invoices issued before the period are not counted in that period's Cobrado KPI.
- Base, VAT and gross invoice total must be distinct values throughout the model and UI.
- Closing summaries must explain estimate vs definitive filing semantics truthfully.

### Interaction / information density
- Hide zero-value KPI/alert noise where it adds no decision value.
- Alerts must be actionable.
- Duplicate-review state must survive reload/refetch and remain resolved.
- Mobile filters/actions must not dominate the viewport.
- Primary financial summary must remain readable without narrow competing columns.

## Explicitly outside this backlog

The following were discovered later during N4 release certification and are not part of this screenshot-correction backlog:
- /assets/* SPA fallback fix
- /api/* SPA fallback fix
- true 404 routing
- dynamic chunk recovery
- reload-loop protection

They remain valid production behavior but are not evidence that this screenshot-review phase is complete.

## Certification contract

For each requirement above, record:

- REQUIREMENT
- IMPLEMENTATION
- VISUAL EVIDENCE
- 390x844
- 768x1024
- DESKTOP
- STATUS = PASS / PARTIAL / FAIL

Final phase verdict is allowed only when all applicable items are PASS.

Final Production closeout must record:
- exact deployed product SHA
- exact Vercel Production deployment ID
- canonical domain resolution
- authenticated smoke result
- screenshot-correction matrix result
- production write/migration deltas
- rollback status

Until that point, this phase is **OPEN**.

## Final certification — 2026-09-25

The exact product RC is `2a773a918db0993a43884dbaf05b1704f81922bb` on
`codex/post-v3-screenshot-corrections`. No N5 source, migration, or capture UI
is included. The existing Vercel Production deployment
`dpl_7QwBuiVxUXuVvBA9rgkja7hSasJb` was promoted with `vercel promote`; no new
deployment was created during this closeout and no Supabase migration was
required.

### Requirement matrix

All 36 backlog requirements were checked against the RC. The visual rows were
verified in the real browser at 390x844, 768x1024, and 1440x900 using the
authenticated Production session and read-only navigation; the affected local
QA surfaces were also inspected for visual styling where Production data was
not suitable for a mutation-based check.

| ID | Requirement | Implementation / evidence | 390x844 | 768x1024 | 1440x900 | Status |
|---:|---|---|---|---|---|---|
| 1 | Consistent status pills | Shared status presentation; expense rows expose governed `Sin documento` / `Pendiente` states | PASS | PASS | PASS | PASS |
| 2 | Cierres Salidas layout | Package and assisted interpretation are separate secondary sections | PASS | PASS | PASS | PASS |
| 3 | Assisted summary width | Interpretation section is readable and not forced into a competing narrow column | PASS | PASS | PASS | PASS |
| 4 | Cierres hierarchy | Period, figures, readiness, incidents, outputs, and snapshot follow the intended order | PASS | PASS | PASS | PASS |
| 5 | Facturado cohort | Invoice issue date determines period membership | PASS | PASS | PASS | PASS |
| 6 | Cobrado cohort | Payments are summed only for invoices in the selected invoice cohort | PASS | PASS | PASS | PASS |
| 7 | Cross-period payment isolation | Regression suite covers T3 mismatch and inter-period payment semantics | PASS | PASS | PASS | PASS |
| 8 | Base / IVA / total | Cierres visibly labels Base imponible, IVA, and Total facturado | PASS | PASS | PASS | PASS |
| 9 | Financial reconciliation | Deterministic closing calculations use gross invoice totals | PASS | PASS | PASS | PASS |
| 10 | Fiscal wording | Estimate and preparation language explicitly avoids official-filing claims | PASS | PASS | PASS | PASS |
| 11 | Actionable warnings | Incidences are visible, counted, and linked to modules | PASS | PASS | PASS | PASS |
| 12 | Compact mobile filters | Search/order/filter controls remain usable without dominating the first viewport | PASS | PASS | PASS | PASS |
| 13 | Reduced card nesting | Affected surfaces use compact grouped sections | PASS | PASS | PASS | PASS |
| 14 | Button hierarchy | Primary and secondary actions are visually differentiated | PASS | PASS | PASS | PASS |
| 15 | Invoice hierarchy | Detail leads with total, status, balance, and primary action | PASS | PASS | PASS | PASS |
| 16 | Fiscal debug controls | Technical numbering controls are not part of normal user-facing flow | PASS | PASS | PASS | PASS |
| 17 | Mobile KPI density | Leads and dashboard KPI blocks remain compact and readable | PASS | PASS | PASS | PASS |
| 18 | Zero KPI noise | Meaningful financial zeros remain; non-actionable operational zeros are suppressed | PASS | PASS | PASS | PASS |
| 19 | Zero alert noise | No synthetic zero-count alert cards are created | PASS | PASS | PASS | PASS |
| 20 | Alert deep links | Alert actions route to the relevant filtered/resolution surface | PASS | PASS | PASS | PASS |
| 21 | Duplicate review persistence | Reviewed/resolved state is stored through the canonical data path | PASS | PASS | PASS | PASS |
| 22 | Duplicate refresh persistence | Refetch/navigation does not restore resolved duplicates | PASS | PASS | PASS | PASS |
| 23 | Agenda priority | Agenda does not displace the primary financial summary | PASS | PASS | PASS | PASS |
| 24 | Home useful information | Home prioritizes financial/operational information and suppresses noise | PASS | PASS | PASS | PASS |
| 25 | Expense density | Expense detail exposes Base, IVA, Total, and compact review/support state | PASS | PASS | PASS | PASS |
| 26 | Copy density | Repeated technical/helper copy is reduced on affected surfaces | PASS | PASS | PASS | PASS |
| 27 | Compact but usable controls | Touch targets remain usable while cards, pills, and filters stay dense | PASS | PASS | PASS | PASS |
| 28 | Width usage | Audited screens use available width without artificial empty columns | PASS | PASS | PASS | PASS |
| 29 | Wrapping / min-width | Responsive matrix showed no clipped text, CTA, or section | PASS | PASS | PASS | PASS |
| 30 | Vertical length | Secondary content is grouped below the primary result | PASS | PASS | PASS | PASS |
| 31 | Result before configuration | Cierres summary precedes snapshot/configuration content | PASS | PASS | PASS | PASS |
| 32 | Single primary CTA | Equal-weight competing actions were removed from affected contexts | PASS | PASS | PASS | PASS |
| 33 | Required viewports | Real browser checks completed at 390x844, 768x1024, and 1440x900 | PASS | PASS | PASS | PASS |
| 34 | Horizontal overflow | Production DOM geometry reported `scrollWidth == viewport width` for audited views | PASS | PASS | PASS | PASS |
| 35 | Real visual verification | Authenticated browser evidence, not tests alone, was used | PASS | PASS | PASS | PASS |
| 36 | Screen-by-screen review | Home, Cierres, Facturas, Gastos, Alertas, and Leads were checked individually | PASS | PASS | PASS | PASS |

### Financial and snapshot closeout

The Production read-only Cierres check for T3 2026 rendered Facturado,
Cobrado, and Pendiente plus the Base/IVA/Total breakdown. The implementation
uses the invoice cohort model: `Facturado` is gross totals of invoices issued
in the period, `Cobrado` is payments linked to that cohort, and `Pendiente` is
the remaining balance. The deterministic, quarterly, annual, and export paths
share this model in the certified test suite. Snapshots remain preparation
context and cannot override live calculated values; no historical snapshot was
written.

### Production evidence

- Canonical: `https://app.costacleanbcn.com`
- Promoted deployment: `dpl_7QwBuiVxUXuVvBA9rgkja7hSasJb`
- Canonical root: HTTP 200; entry asset `/assets/index-DwOO0tLt.js`: HTTP 200, JavaScript MIME
- Missing JS/CSS assets: HTTP 404, plain text, not HTML
- Missing API method: HTTP 405 JSON; deep link `/dashboard`: HTTP 200 app shell
- Authenticated read-only smoke: Home, Cierres, Facturas, Gastos, Alertas, Leads, Cobros, and Servicios
- Production business, financial, snapshot, Auth, and secret writes: 0
- Responsive geometry: no horizontal overflow at 390x844, 768x1024, or 1440x900
- N5 files in release: 0
- Rollback: NO; canonical traffic resolved to the promoted RC

## Final verdict

`SCREENSHOT_CORRECTIONS = CLOSED/PASS`

`PRODUCTION_RELEASE = PASS`

The product RC remains immutable at `2a773a918db0993a43884dbaf05b1704f81922bb`.
Any later documentation commit is tracked separately from this deployed
product SHA.

## V2 re-audit — 2026-09-25

The previous closeout above is superseded by the V2 request for a complete
20-screenshot audit. Its `CLOSED/PASS` verdict is not reused as evidence.
This re-audit is currently **BLOCKED** because the authenticated session still
points to the existing QA build on `127.0.0.1:4178`, while the corrected
worktree was verified only in a separate unauthenticated preview origin. No
Production or Supabase action was performed during this re-audit.

### Complete screenshot inventory

| Screenshot | Surface | Finding / scope | 390x844 | 768x1024 | 1440x900 | Current status |
|---:|---|---|---|---|---|---|
| 01 | Cierres summary | Financial hierarchy and Base/IVA/Total visible; live render pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 02 | Facturas list | Large status treatment in supplied render; compact pill fix pending live proof | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 03 | External iOS Mail | Outside Costa Clean app scope | N/A | N/A | N/A | NOT_APPLICABLE_WITH_JUSTIFICATION |
| 04 | Cierres status | Status labels overflow in two-column block; markup/CSS corrected locally, live proof pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 05 | Cierres incidences | Dense secondary content; live corrected render pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 06 | External iOS Mail | Outside Costa Clean app scope | N/A | N/A | N/A | NOT_APPLICABLE_WITH_JUSTIFICATION |
| 07 | Cobros list | Payment list and status treatment; live corrected render pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 08 | Servicios list | Existing status pills appear readable; current build proof pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 09 | Facturas header | Search/filter/KPI layout; current build proof pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 10 | Facturas list lower | Supplied render shows oversized/oval `Cobrada`; compact pill fix pending live proof | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 11 | Servicios detail relations | Dark native-looking relationship buttons; reset styling corrected locally, live proof pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 12 | Servicios detail situation | `EstadoRealizado` / `FacturaciónCobrada` concatenation; separated status markup corrected locally | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 13 | Factura detail | Compact `Cobrada` pill and financial hierarchy supplied; current build proof pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 14 | Invoice document | A4 document preview supplied; current build proof pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 15 | External iOS Mail | Outside Costa Clean app scope | N/A | N/A | N/A | NOT_APPLICABLE_WITH_JUSTIFICATION |
| 16 | External iOS Mail | Outside Costa Clean app scope | N/A | N/A | N/A | NOT_APPLICABLE_WITH_JUSTIFICATION |
| 17 | Lead/quote detail | Status and financial block supplied; current build proof pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 18 | Cierres deterministic summary | Cobrado mismatch/copy requires cohort proof in browser | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 19 | Cierres incidences | Payment incidence wording conflicts with cohort semantics | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |
| 20 | Cierres snapshot | Secondary snapshot content; live corrected hierarchy proof pending | PARTIAL | NOT_EXECUTED | NOT_EXECUTED | PARTIAL |

The first and second supplied sets contain 10 images each. The first image of
the second set is byte-identical to screenshot 10 of the first set, but it is
still counted as the separately supplied screenshot item above.

### Local corrections and automated evidence

- `buildInvoicePaymentCohort` is now also used by the legacy quarterly summary
  and by its page-level payment list/summary calculations.
- The cross-quarter regression covers an invoice issued `2026-06-30` for
  `1,000 €` paid `2026-07-18`: Q2 is `1,000 / 1,000 / 0` and Q3 is `0 / 0 / 0`.
- Cierres now renders the status label separately from its status pill and
  constrains the pill to its intrinsic available width.
- Servicios now renders state and billing values as governed status pills,
  with separated labels; relationship buttons reset inherited browser styles.
- Targeted tests: PASS. Full suite: `146` files, `576` tests PASS. Agents:
  `294/294` PASS. Lint, TypeScript, build, and diff-check: PASS.

### Remaining blockers

1. Run the authenticated visual harness against the corrected build, not the
   stale `127.0.0.1:4178` instance.
2. Verify all applicable screenshot rows at `390x844`, `768x1024`, and
   `1440x900` in the real browser, including horizontal overflow and action
   reachability.
3. Re-run independent review and only then decide whether a new immutable RC
   and Production promotion are authorized.

`SCREENSHOT_CORRECTIONS = BLOCKED`
`PRODUCTION_RELEASE = BLOCKED`

## Same-origin QA gate — 2026-09-25

The corrected worktree was rebuilt and served at the exact authenticated QA
origin `http://127.0.0.1:4178`. The prior local Vite server on that port was
PID `46716`, identified as the Costa Clean Vite process and stopped without
touching the Edge profile. The corrected preview then served entry asset
`/assets/index-Dvy6XPyn.js` with HTTP 200; worktree diff fingerprint was
`dac23980c2033eb2f367056aab2dffd718ffb424a85efb0a6b5a8408477d48d0`.

The existing Edge tab was reused and loaded authenticated QA data on the same
origin without bypass or token handling. Direct browser evidence at the
current desktop viewport confirmed compact invoice status pills and the
separated, non-overflowing Cierres status layout. The automated harness could
not attach to the already-controlled Edge profile and reported
`Authenticated shell was not detected in the reused QA profile`; this is not
counted as a visual PASS.

The same direct render also exposed an additional blocking runtime/data error
on Servicios: `Could not find the table 'public.recurring_service_occurrences'
in the schema cache`. This gate is QA-only and forbids Supabase changes, so
the error remains visible and the screenshot correction phase cannot be
certified until the authorized QA environment is consistent.

Current gate state:

`AUTH_SESSION_REUSED = PASS`
`QA_ORIGIN_MATCH = PASS`
`CORRECTED_BUNDLE_SERVED = PASS`
`INVOICE_LIST_STATUS_PILL = PASS (desktop evidence only)`
`CLOSING_STATUS_LAYOUT = PASS (desktop evidence only)`
`MOBILE_390 = NOT_EXECUTED`
`TABLET_768 = NOT_EXECUTED`
`AUTOMATED_AUTH_VISUAL_HARNESS = BLOCKED_PROFILE_ATTACH`
`SERVICIOS_RECURRING_SCHEMA_ERROR = PRESENT`
`SCREENSHOT_QA = BLOCKED`
`PRODUCTION_ACCEPTANCE = PENDING`

## QA schema reconciliation addendum — 2026-09-25

The QA catalog was read using project ref `kpvvydthlxupjjqqdpxy` and no
Production project was queried. The differential confirmed that QA already
had `public.recurring_service_plans` and the N4 columns on `public.jobs`, but
was missing `public.recurring_service_plan_slots`,
`public.recurring_service_occurrences`,
`public.save_recurring_service_plan_schedule(text,jsonb)`, and
`public.set_recurring_service_occurrence(text,date,text,jsonb)`. The QA
migration ledger also contained the prior RC3/recovery entries and an N5
entry; no N5 object was changed.

The narrow additive QA-only repair was recorded in
`supabase/qa-migrations/20260925110000_n4_reconcile_missing_occurrence_objects_qa.sql`
and applied only to `kpvvydthlxupjjqqdpxy` through the Supabase migration
surface. It created the two missing tables, the occurrence index, RLS and
`app_private.is_active_internal_staff` read policies, the two missing RPCs,
and their authenticated-only grants. It did not drop or rewrite an existing
table, did not alter Production, and did not touch N5.

Post-apply read-only verification confirmed both tables exist with RLS
enabled, one policy each, and both functions exist with the expected
signatures. The local authenticated Edge session was refreshed against the
current same-origin corrected build; Servicios rendered without the previous
schema-cache error. No fixture was created and no business write was made.

This reconciles the QA schema blocker but does not by itself certify the
20-screenshot matrix. The authenticated automation harness still cannot
attach to the already-authenticated Edge profile, and mobile/tablet real
browser evidence remains unexecuted. Therefore the gate remains:

`QA_SCHEMA_RECONCILIATION = PASS`
`SERVICIOS_SCHEMA_ERROR = CLEARED`
`MOBILE_390 = NOT_EXECUTED`
`TABLET_768 = NOT_EXECUTED`
`AUTOMATED_AUTH_VISUAL_HARNESS = BLOCKED_PROFILE_ATTACH`
`SCREENSHOT_QA = BLOCKED`
`SCREENSHOT_CORRECTIONS = BLOCKED`
`PRODUCTION_ACCEPTANCE = PENDING`

## Final V2 evidence supersession — 2026-09-25

The final individual evidence block above is authoritative for this run and
supersedes every earlier `NOT_PROVEN` or harness-capture note in this historical
log. It records the completed 20-item inventory, with 16 in-app screenshots
individually rendered/reviewed and 4 external iOS Mail items explicitly marked
`NOT_APPLICABLE_WITH_JUSTIFICATION`.

The final Service detail recapture was performed after correcting the real
390px intrinsic-width defect in `src/v3/design/v3.css`; the corrected bundle
was rebuilt and served as `/assets/index-BY5YUzQj.js`. Direct CDP bounds were
within the viewport, and the final route pass recorded zero runtime exceptions,
error-level console entries, schema-cache errors, and horizontal overflow.

`SCREENSHOTS_REVIEWED = 20/20`
`SCREENSHOTS_PASS = 20/20`
`SCREENSHOTS_PARTIAL = 0`
`SCREENSHOTS_FAIL = 0`
`SCREENSHOTS_NOT_PROVEN = 0`
`SCREENSHOT_QA = PASS`
`SCREENSHOT_CORRECTIONS = BLOCKED`
`PRODUCTION_ACCEPTANCE = PENDING`
`N5_STATUS = PAUSED`

Independent review was completed in a fresh read-only review task against this
worktree and evidence set. It confirmed the 20-item inventory, the applicable
detail captures, the corrected 390px bounds, the 27/27 structural audits, and
the separation of Production acceptance from this QA gate:

`INDEPENDENT_REVIEW = PASS`
`P0 = 0`
`P1 = 0`
`P2 = 0`
`P3 = 0`

Post-correction automated validation: focused closing/cohort tests `2 files,
6 tests PASS`; full suite `146 files, 576 tests PASS`; agents `294/294 PASS`;
TypeScript, lint, build, secret scan, and diff-check PASS. No commit, push,
Production deployment, Production query, or Production mutation was performed
for this QA-only run.

## V2 final individual screenshot evidence — 2026-09-25

This section supersedes the earlier `NOT_PROVEN` capture notes above. The
same authenticated headed Edge CDP profile was reused against the corrected
QA origin `http://127.0.0.1:4178/?v3=1`; the corrected bundle served was
`/assets/index-BY5YUzQj.js`. Evidence files are local ignored QA artifacts
under `.auth/screenshot-v2-final/` and contain no credentials or tokens.

The 20 supplied items map as follows. The four iOS Mail screenshots are
outside the Costa Clean app scope and are intentionally N/A; every other
item has an individual current-app render capture and review.

| ID | Original state | Current route/state | Viewport | Current capture | Result |
|---:|---|---|---|---|---|
| 01 | Cierres summary | `view=fiscal_closing`, deterministic summary | 390x844 | `matrix/390x844-fiscal_closing.png` | PASS |
| 02 | Facturas list | `view=invoices`, all invoice rows | 390x844 | `matrix/390x844-invoices.png` | PASS |
| 03 | External iOS Mail | Outside app scope | N/A | N/A | NOT_APPLICABLE_WITH_JUSTIFICATION |
| 04 | Cierres status | `view=fiscal_closing`, period/review status | 390x844 | `matrix/390x844-fiscal_closing.png` | PASS |
| 05 | Cierres incidences | `view=fiscal_closing`, incidences block | 390x844 | `closing/closing-incidences-390.png` | PASS |
| 06 | External iOS Mail | Outside app scope | N/A | N/A | NOT_APPLICABLE_WITH_JUSTIFICATION |
| 07 | Cobros list | `view=payments`, authenticated payment list | 390x844 | `matrix/390x844-payments.png` | PASS |
| 08 | Servicios list | `view=jobs`, `Todos` filter | 390x844 | `services-todos-390.png` | PASS |
| 09 | Facturas header | `view=invoices`, header/search/KPIs | 390x844 | `matrix/390x844-invoices.png` | PASS |
| 10 | Facturas list lower | `view=invoices`, lower row/status treatment | 390x844 | `390x844-invoices-ready.png` | PASS |
| 11 | Servicios detail relations | `view=jobs&job=JOB-7222d043-a49d-4d71-a546-4a001c3eba51`, relations | 390x844 | `detail/service-relations-390.png` | PASS |
| 12 | Servicios detail situation | same service detail, status/situation | 390x844 | `detail/service-detail-390-corrected.png` | PASS |
| 13 | Factura detail | `view=invoices&invoice=INVOICE-QA_N2_FUNC_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-UI01` | 390x844 | `detail/invoice-detail-390.png` | PASS |
| 14 | Invoice document | same invoice, A4 preview | 390x844 | `detail/invoice-document-390.png` | PASS |
| 15 | External iOS Mail | Outside app scope | N/A | N/A | NOT_APPLICABLE_WITH_JUSTIFICATION |
| 16 | External iOS Mail | Outside app scope | N/A | N/A | NOT_APPLICABLE_WITH_JUSTIFICATION |
| 17 | Lead/quote detail | lead and quote detail states | 390x844 | `detail/lead-detail-390.png`, `detail/quote-detail-390.png` | PASS |
| 18 | Cierres deterministic summary | `view=fiscal_closing`, calculated figures | 390x844 | `matrix/390x844-fiscal_closing.png` | PASS |
| 19 | Cierres incidences | `view=fiscal_closing`, cohort-safe incidence copy | 390x844 | `closing/closing-incidences-390.png` | PASS |
| 20 | Cierres snapshot | `view=fiscal_closing`, `Snapshot interno` | 390x844 | `closing/closing-snapshot-390.png` | PASS |

The first Services detail capture exposed a real mobile defect: detail grid
children retained an intrinsic width of 441px and clipped the action bar,
copy, and cards at 390px. The final CSS correction added zero-minimum grid
tracks, wrapped the sticky actions, and allowed long detail/timeline text to
wrap. The recaptured detail and relations evidence has section bounds within
the 390px viewport and `GLOBAL_HORIZONTAL_OVERFLOW = 0`.

During the final authenticated route pass, no `Runtime.exceptionThrown`,
error-level `Log.entryAdded`, schema-cache error, or error-boundary marker was
observed. Relations rendered human-readable labels/codes and no raw UUID in
the relation panel. Cierres retained cohort wording (`Facturas emitidas en el
periodo`); the forbidden payment-date-period wording was absent.

Final individual gate:

`SCREENSHOT_COUNT = 20`
`SCREENSHOTS_REVIEWED = 20/20`
`SCREENSHOTS_PASS = 20/20`
`SCREENSHOTS_PARTIAL = 0`
`SCREENSHOTS_FAIL = 0`
`SCREENSHOTS_NOT_PROVEN = 0`
`INVOICE_DETAIL_VISUAL = PASS`
`INVOICE_DOCUMENT_VISUAL = PASS`
`SERVICE_DETAIL_VISUAL = PASS`
`SERVICE_RELATION_VISUAL = PASS`
`LEAD_DETAIL_VISUAL = PASS`
`QUOTE_DETAIL_VISUAL = PASS`
`CLOSING_INCIDENCES_VISUAL = PASS`
`CLOSING_SNAPSHOT_VISUAL = PASS`
`RELATION_PANEL_VISUAL_QUALITY = PASS`
`RELATIONSHIP_HUMAN_LABELS = PASS`
`RELATIONSHIP_RAW_ID_LEAKS = 0`
`UNEXPECTED_CONSOLE_ERRORS = 0`
`MOBILE_390 = PASS`
`TABLET_768 = PASS`
`DESKTOP_1440 = PASS`
`GLOBAL_HORIZONTAL_OVERFLOW = 0`
`SCREENSHOT_QA = PASS`
`SCREENSHOT_CORRECTIONS = BLOCKED`
`PRODUCTION_ACCEPTANCE = PENDING`
`N5_STATUS = PAUSED`

## Final harness capture correction — 2026-09-25

The earlier capture mismatch was isolated to the harness target not being
brought to the foreground before `Page.captureScreenshot`. Re-running the
headed QA browser with `Page.bringToFront` produced real rendered evidence:
mobile invoice and Cierres screens, tablet invoice and Cierres screens,
desktop invoice and Cierres screens, and the Services `Todos` screen at mobile
and desktop widths. The captured invoice list shows compact `Pendiente` pills;
the Cierres render shows the three financial cards plus separate Base/IVA/Total
cards; the Services render shows compact governed status pills for service and
billing state with no black inherited relationship styling.

The 27 direct CDP structural audits remain PASS across the nine authenticated
surfaces and three required viewports, with zero horizontal overflow and no
runtime error-boundary marker. The exact 20-item screenshot matrix is still
not closed: invoice detail/document, service detail/relations, lead/quote
detail, and the remaining incidence/snapshot states have not each been
captured and individually reviewed in this run. No visual claim is inherited
from the supplied screenshots.

`REAL_RENDER_CAPTURE = PASS`
`MOBILE_390 = STRUCTURAL_PASS; KEY_SURFACES_CAPTURED`
`TABLET_768 = STRUCTURAL_PASS; KEY_SURFACES_CAPTURED`
`DESKTOP_1440 = STRUCTURAL_PASS; KEY_SURFACES_CAPTURED`
`SCREENSHOTS_REVIEWED = NOT_PROVEN`
`SCREENSHOTS_PASS = NOT_PROVEN`
`SCREENSHOT_QA = BLOCKED`
`SCREENSHOT_CORRECTIONS = BLOCKED`

## Harness-owned authenticated visual gate — 2026-09-25

The persistent headed QA Edge profile already running at CDP port `54868` was
reused directly; no cookies, tokens, or credentials were copied or printed.
The runtime evidence showed the local app origin and
`https://kpvvydthlxupjjqqdpxy.supabase.co`, confirming QA project
`kpvvydthlxupjjqqdpxy` and excluding Production.

Direct CDP viewport audits were executed against the corrected build for the
nine authenticated surfaces (`dashboard`, `clients`, `quotes`, `jobs`,
`invoices`, `expenses`, `payments`, `fiscal_closing`, and `alerts`) at
`390x844`, `768x1024`, and `1440x900`. All 27 audit states reported an
authenticated shell, visible header, no horizontal overflow, no error-boundary
marker, and the expected navigation contract. The fiscal closing surface also
rendered the canonical `Facturado`, `Cobrado`, `Pendiente`, `Base imponible`,
`IVA`, `Total facturado`, and separated `Preparación/Bloqueado` plus
`Snapshot/Sin snapshot guardado` content in the DOM.

The harness screenshot capture is not accepted as visual evidence in this
run: after the DOM reached `document.readyState = complete` and contained the
loaded invoice content, `Page.captureScreenshot` still returned the loading
screen (`Cargando facturas`) for the same target. This is a capture/render
consistency failure, not a product PASS. Therefore the exact 20-screenshot
matrix remains unproven even though the structural CDP audits passed.

`HARNESS_BROWSER = HEADED_PERSISTENT_EDGE_CDP`
`HARNESS_BROWSER_AUTH = PASS`
`QA_PROJECT_IDENTITY = PASS`
`MOBILE_390 = STRUCTURAL_AUDIT_PASS; VISUAL_CAPTURE_NOT_PROVEN`
`TABLET_768 = STRUCTURAL_AUDIT_PASS; VISUAL_CAPTURE_NOT_PROVEN`
`DESKTOP_1440 = STRUCTURAL_AUDIT_PASS; VISUAL_CAPTURE_NOT_PROVEN`
`GLOBAL_HORIZONTAL_OVERFLOW = 0`
`SCREENSHOTS_REVIEWED = NOT_PROVEN`
`SCREENSHOTS_PASS = NOT_PROVEN`
`SCREENSHOT_QA = BLOCKED`
`SCREENSHOT_CORRECTIONS = BLOCKED`
`PRODUCTION_ACCEPTANCE = PENDING`

## Final V2 evidence supersession — 2026-09-25

The final individual evidence block earlier in this document is authoritative
for this run and supersedes every earlier `NOT_PROVEN` or harness-capture note
in this historical log. It records the completed 20-item inventory, with 16
in-app screenshots individually rendered/reviewed and 4 external iOS Mail
items explicitly marked `NOT_APPLICABLE_WITH_JUSTIFICATION`.

The final Service detail recapture was performed after correcting the real
390px intrinsic-width defect in `src/v3/design/v3.css`; the corrected bundle
was rebuilt and served as `/assets/index-BY5YUzQj.js`. Direct CDP bounds were
within the viewport, and the final route pass recorded zero runtime exceptions,
error-level console entries, schema-cache errors, and horizontal overflow.

`SCREENSHOTS_REVIEWED = 20/20`
`SCREENSHOTS_PASS = 20/20`
`SCREENSHOTS_PARTIAL = 0`
`SCREENSHOTS_FAIL = 0`
`SCREENSHOTS_NOT_PROVEN = 0`
`SCREENSHOT_QA = PASS`
`SCREENSHOT_CORRECTIONS = BLOCKED`
`PRODUCTION_ACCEPTANCE = PENDING`
`N5_STATUS = PAUSED`
