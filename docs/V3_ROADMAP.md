# Costa Clean App V3 — Roadmap

## V3-0E — Editorial SaaS Simplified clean final Stitch export

Current state: the existing Stitch project `6884707630640107069` contains the 13-screen Editorial SaaS Simplified final set. Obsolete frames were removed from the active canvas and excluded from the clean ZIP. V3-0E is human-approved; no production implementation was made in that gate.

- [x] Preserve only functional learnings from the rejected set.
- [x] Select Editorial SaaS Simplified as the sole V3 visual direction.
- [x] Complete and verify the 13-screen final Stitch inventory.
- [x] Remove/archive obsolete frames from the active Stitch canvas.
- [x] Export and inventory the clean ZIP with zero obsolete screens.
- [x] Document `V3_USEFUL_STITCH_FEATURE_BACKLOG` and classify proposals A/B/C/D.
- [x] Run regression gates required for this docs/export-only block.
- [x] Human final approval of the direction.
- [x] Complete screen-by-screen Stitch visual PASS at the approved anchors.

## V3-1R — Full structural redesign + invoice vertical slice — CLOSED

- [x] Add reversible V3 tokens, primitives and reduced-motion/safe-area rules.
- [x] Replace the V2 shell branch with a dedicated V3 shell chrome.
- [x] Replace the V2 invoice list/workspace tree with dedicated V3 components.
- [x] Add Design Guardian structural/token checks.
- [x] Preserve real PDF, settlement, lifecycle and deep-link contracts.
- [x] Complete authenticated visual QA at 390x844 and 430x932.
- [x] Complete 768x1024 regression and desktop no-regression.
- [x] Close V3-1R with QA evidence and final commit/push.

## V3-2A — Clients + real contact actions — CLOSED

- [x] Add dedicated `src/v3/clients/` list and full-screen client workspace.
- [x] Render only real client, property, service, quote, invoice, payment and recurring-plan relations.
- [x] Add guarded WhatsApp, `tel:` and `mailto:` actions with valid-number/email checks.
- [x] Connect contextual invoice and quote creation to existing financial/commercial flows with client prefills.
- [x] Preserve `?v3=1&view=clients&client=<id>` and list/back restoration.
- [x] Add dedicated-tree, deep-link, contact URL and workspace tests.
- [x] Complete authenticated QA at 390x844, 430x932 and 768x1024.
- [x] Close with lint, build, full tests, commit and push.

## V3-2B — Quotes / presupuestos — CLOSED

- [x] Add the dedicated `src/v3/quotes/` list and workspace tree.
- [x] Render real quote rows, statuses, totals, lines and client/property/job/invoice relations.
- [x] Preserve real quote PDF generation and add privacy-safe native share with local download fallback.
- [x] Connect conversion to the existing `accept_quote_workflow` with quote identity, lines, VAT, duplicate protection and invoice relation.
- [x] Preserve `?v3=1&view=quotes&quote=<id>` and list/back restoration.
- [x] Extend Design Guardian and add quote, share, deep-link and conversion tests.
- [x] Complete authenticated visual QA at `390x844`, `430x932` and `768x1024`.
- [x] Close with full tests, lint, build, commit and push.

## V3-2C — Leads / commercial workspace — CLOSED

- [x] Add the dedicated `src/v3/leads/` list, row and full-screen workspace tree.
- [x] Reuse real lead statuses, contact URL helpers, intake drafts, duplicate guards and write APIs.
- [x] Keep `ai_draft_status = reviewed` separate from any business lead-review state; no fake `reviewed_at` or `reviewed_by` was added.
- [x] Add real draft review, quote-from-draft, client conversion, edit/status, archive/restore and regeneration actions.
- [x] Preserve `?v3=1&view=leads&lead=<id>` and list/back restoration.
- [x] Extend Design Guardian and add lead list, deep-link and structural tests.
- [x] Complete authenticated QA at `390x844`, `430x932` and `768x1024`, including temporary fixture cleanup.
- [x] Close with full tests, lint, build, commit and push.

## V3-2 — Core entity workspaces

- Invoice, quote, client, lead and service list/workspace patterns.
- Keep real data adapters and business logic unchanged.
- Add visual QA and interaction evidence before expanding.

## V3-3 — Financial and secondary surfaces

- Apply the approved patterns to payments, expenses, alerts, closings and configuration.
- Preserve selection, downloads, exports, lifecycle and duplicate flows.

## V3-2D — Servicios / Jobs — CLOSED

- [x] Dedicated `src/v3/jobs/` list, row and full-screen workspace.
- [x] Real operational statuses, billing state, relations and lifecycle writes.
- [x] Completed unbilled services connect to the existing invoice prefill/create flow with duplicate protection.
- [x] Real work-report PDF with local download and native-share fallback.
- [x] Deep link/back restoration, existing create/edit contracts and authenticated visual QA.
- [x] Full tests, lint, build, commit and push.

## V3-3A — Home / Negocio hoy — CLOSED

- [x] Add the dedicated `src/v3/home/` executive Home tree behind `?v3=1`.
- [x] Use real invoiced-this-month, outstanding-receivables, open-quotes and completed-unbilled-jobs metrics.
- [x] Keep the secondary KPI set to exactly three compact decision actions.
- [x] Add a deterministic priority queue capped at three items with alert/incident deduplication.
- [x] Preserve existing KPI routing, alert decisions and operational action contracts.
- [x] Complete authenticated visual QA at `390x844`, `430x932` and `768x1024`.
- [x] Close with full tests, lint, build, commit and push.

## V3-3B — Payments + Expenses — CLOSED / CERTIFIED

- [x] Add dedicated `src/v3/payments/` list and payment workspace.
- [x] Add dedicated `src/v3/expenses/` list and expense workspace.
- [x] Preserve payment settlement, duplicate, expense support and fiscal contracts.
- [x] Complete authenticated visual QA at `390x844`, `430x932` and `768x1024`.
- [x] Provision the private `expense-receipts` bucket in QA with signed-URL access.
- [x] Close with exact QA cleanup, full tests, lint, build, commit and push.

V3-3B is closed after authenticated runtime QA and zero exact fixture residue.
The QA-only hard cleanup harness is `scripts/qa/cleanup-v3-3b-fixtures.mjs` and
never belongs to the product API or production cleanup path.

## V3-3C — Alerts + Closings — CLOSED / CERTIFIED

- [x] Add dedicated V3 alerts list/workspace using real alert decisions and routing.
- [x] Add unified V3 closing workspace for quarter/year periods using the existing deterministic summary engine.
- [x] Preserve fiscal incidence filters and save through existing quarterly/annual APIs only.
- [x] Keep fake settings, delivery/read claims, official certification and unsupported fiscal states out of the V3 tree.
- [x] Extend the static design guardian for alerts and closings.
- [x] Complete authenticated visual QA at `390x844`, `430x932` and `768x1024`.
- [x] Close with exact QA cleanup, full tests, lint, build, commit and push.

## V3-3D — Properties + mobile legacy audit — CLOSED / CERTIFIED

- [x] Native V3 property list, workspace, create and edit flows.
- [x] Persisted client, service, quote, invoice and payment relations certified.
- [x] Exact authenticated QA cleanup completed with residue `0`.
- [x] `MOBILE MAIN LEGACY SURFACES = 0`.

Next: `GLOBAL SELECTION SYSTEM V3`.

## V3-4A — Global Selection Foundation — CLOSED / CERTIFIED

- [x] UI-only selection foundation with visible selection, pruning, reset and eligibility.
- [x] Adopted only in V3 Invoices and Quotes.
- [x] Real settlement, PDF ZIP and CSV contracts certified.
- [x] Exact QA cleanup completed with residue `0`.
- [x] Mobile selection dock verified at `390x844`, `430x932` and `768x1024`.

Next: `V3-4B — SELECTION ADOPTION AUDIT`.

V3-4B audit result: selection remains adopted only in Invoices and Quotes.
Jobs, Expenses, Payments, Leads, Clients, Properties, Alerts and Closings were
audited and deliberately not adopted.

## V3-5 — iPad Adaptation — CLOSED / CERTIFIED

- [x] Add one adaptive V3 shell contract: bottom navigation below 1024px and
  compact navigation rail at 1024px and above.
- [x] Preserve the same `currentView`, More content and semantic active state.
- [x] Add tokenized iPad rail/content/selection geometry with no desktop master-detail.
- [x] Verify shell overflow and navigation visibility at the primary iPad sizes.
- [x] Complete authenticated visual certification for every required surface,
  forms, selection, deep links and mobile regression at `768x1024`, `834x1194`,
  `1024x1366`, `1024x768`, `1194x834`, `390x844` and `430x932`.
- [x] Authenticated runner: `384/384` checks passed, `0` failed.
- [x] Horizontal overflow, responsive navigation overlap and selection geometry
  passed; production and Supabase remained untouched.

## V3-6 — Desktop Adaptation — CLOSED / CERTIFIED

- [x] Extend the single V3 shell with a token-backed desktop presentation layer
  from 1280px; no second router, module fork or default master-detail.
- [x] Expand the shared rail and content contract without changing navigation,
  selection allowlist or business writes.
- [x] Add automated guardian coverage for desktop forks, fake Settings and
  selection clones.
- [x] Authenticated desktop matrix and responsive regression: `1536/1536`
  checks passed across all required desktop, iPad and mobile viewports.
- [x] Tests: `666 passed | 4 skipped`; lint, build and `git diff --check` pass.
- [x] Production, Supabase, schema, storage and business contracts untouched.

## V3-6R — Financial Zero Legacy Presentation — CLOSED / CERTIFIED

- [x] Audit document created at `docs/V3_LEGACY_PRESENTATION_AUDIT.md`.
- [x] P0 `Nuevo servicio` migrated to `V3JobCreateFlow` with native V3
  presentation and preserved job write/duplicate contracts.
- [x] V3 navigation iconography foundation no longer uses improvised Unicode.
- [x] Re-audit V3 runtime reachability for invoice, quote, payment and expense
  list, workspace and create/edit surfaces. Required legacy DOM markers: `0`.
- [x] Confirm legacy implementations remain V2-only orchestration after the V3
  branch and are not V3 presentation dependencies.
- [x] Certify financial zero-legacy runtime and the associated QA/quality gates.
- [x] CRM zero-legacy closed for Clients, Leads, Properties and nested Services
  with authenticated E2E evidence and zero legacy runtime markers.
- [x] Static responsive safety audit passed; CRM reuses the certified V3 shell
  and primitives without introducing a second responsive architecture.
- [ ] Exact CRM viewport matrix (`390x844`, `768x1024`, `1280x800` and
  `1920x1080`) deferred to `V3-8 — Global E2E / Release` because the current
  controlled browser exposes no deterministic viewport resizing/CDP metrics.

`V3-6R CRM ZERO-LEGACY` is `CLOSED / CERTIFIED` with no application responsive
failure identified. `V3-6R GLOBAL` is now `CLOSED / CERTIFIED` after the global
shell/background/preload presentation gate passed. Do not start V3-7A yet.

### V3-6R GLOBAL — shell/background/preload zero-legacy — CLOSED / CERTIFIED

- [x] V3 owns `html`, `body`, `#root`, boot, auth restoration and shell canvas
  under `?v3=1`; the V2 canvas remains available outside the flag.
- [x] V3-native boot, error, AppView initial loading and deferred fallbacks use
  token-backed accessible states with reduced-motion behavior.
- [x] Global toast, recovery and theme feedback presentation remains compatible
  with the existing state/routing contracts and receives the V3 surface boundary.
- [x] Authenticated reload and non-destructive smoke passed on Home, Invoices,
  Clients, Services, Payments and Expenses in the controlled QA browser.
- [x] Static legacy marker, UUID/icon and responsive safety audit passed.

Evidence: `694 passed`, `4 skipped`, lint PASS, build PASS and `git diff --check`
PASS. Exact viewport matrix remains `DEFERRED TO V3-8`.

## Exit rule

V3-1R, V3-2A, V3-2B, V3-2C, V3-2D, V3-3A and V3-3B are closed with authenticated
QA evidence and no financial, route, auth or deep-link regression. V3-3C is closed
after its authenticated visual, snapshot persistence, exact cleanup and release
gates passed. V3-3D requires a separate approval. V3-5 and V3-6 are closed only
after their authenticated responsive matrices and regression gates pass.

## V3-7A — Client profile media + iconography — CLOSED / CERTIFIED

- [x] QA migration, `clients.profile_image_path`, private bucket and storage
  policies certified in `kpvvydthlxupjjqqdpxy`.
- [x] Authenticated fallback, upload, private signed display, reload,
  replacement, old-object cleanup, removal and fallback restoration certified.
- [x] Invalid MIME and 5 MB validation, accessibility, V3 confirmation and
  `V3Icon` camera/replace/trash coverage certified.
- [x] Exact isolated fixture cleanup completed externally: DB residue `0` and
  Storage residue `0`.
- [x] Production and production Supabase remain untouched.

Fixture evidence: marker `QA V3-7A CLIENT MEDIA`, client `CLIENT-DRAFT`, display
code `CLI-0126`, created at `2026-09-14T13:44:02.77365Z`; the guarded cleanup
deleted exactly one client after the media pointer was `NULL`.

The exact viewport matrix is deferred to `V3-8`; this gate claims static
responsive safety only.

## V3-7B — Final functional parity audit — CLOSED / CERTIFIED

- [x] Audit Home, Alerts, Closings, Leads, Clients/media, Properties, Jobs,
  Quotes, Invoices, Payments, Expenses, recurring plans, navigation,
  search/filter, duplicates, selection/export, notifications, auth, recovery
  and relationships against the existing contracts.
- [x] Classify every audited capability A/B/C/D with zero unknown rows in
  `docs/V3-7B_FUNCTIONAL_PARITY_AUDIT.md`.
- [x] Close the one real gap found: native V3 recurring-plan list, workspace,
  create/edit, duplicate review, pause/resume/archive and invoice generation.
- [x] Reuse existing recurring RPC wrappers, persistence mapping, schedule
  helpers and `V3DuplicateReviewSheet`; no schema, route or legacy wrapper was
  added.
- [x] Add focused native-surface coverage and pass the full test, lint, build
  and diff gates.
- [x] No QA writes or production access; exact viewport certification remains
  deferred to `V3-8 — Global E2E / Release`.

Next: `V3-8 — GLOBAL E2E / RELEASE`.

## V3-8 — Global E2E / Release — CLOSED / CERTIFIED

- [x] Add the Playwright release harness with explicit viewport, QA backend and
  production-request guards.
- [x] Confirm Playwright managed Chromium is present.
- [x] Run the authenticated read-only release matrix at `390x844`, `768x1024`,
  `1280x800` and `1920x1080`.
- [x] Certify module navigation and console/network cleanliness in the
  authenticated read-only run.
- [x] Assert shell breakpoints, hydrated deep links/back, client media,
  recurring empty state, relations, keyboard smoke, reduced motion, PWA
  assets, QA deltas and zero legacy runtime markers.
- [x] Close the authentication blocker using the existing ignored QA profile.

V3-8 is `CLOSED / CERTIFIED`: authenticated release E2E passed `5/5`, required
existing-record deep links and cross-module relations passed, Quotes/Jobs/
Payments/recurring persisted runtime were correctly classified N/A for the
zero-record QA baseline, and external pre/post comparison certified DB delta
`0` and Storage delta `0`. No credentials, tokens, cookies, QA writes or
production access were used. See `docs/V3-8_RELEASE_CERTIFICATION.md`.

## V3-9 — Final default production activation — CLOSED / CERTIFIED

- [x] Preserve V2 as the reversible `?v2=1` diagnostic fallback while making V3
  the default presentation.
- [x] Keep `?v3=1` backwards compatible and give `v2=1` precedence when both
  parameters are present.
- [x] Add focused activation and deep-link flag coverage.
- [x] Deploy only the certified activation commit to the canonical Vercel
  project in Production.
- [x] Verify the canonical deployment identity, production backend target and
  rollback deployment.
- [x] Complete authenticated read-only production smoke across V3 modules,
  representative deep links, hard reload and back navigation.
- [x] Complete responsive smoke at `390x844` and `1280x800` with root overflow
  `0`.
- [x] Verify zero production writes, fixture writes, media uploads, migrations
  and QA backend requests during activation.
- [x] Close with tests, lint, build, diff, documentation, commit and push.

V3-9 is `CLOSED / CERTIFIED`. V3 is active by default in production; V2 remains
available only through the diagnostic `?v2=1` escape hatch. Evidence:
`docs/V3-9_PRODUCTION_ACTIVATION.md`.

## V3-10C1 — Core certified findings correction — CLOSED / CERTIFIED

- [x] Restore the canonical Costa Clean login logo without changing the auth contract.
- [x] Raise shared contact and ghost action geometry to the `--v3-touch-min` 44px contract.
- [x] Replace V3-reachable blocking document alerts with the existing accessible toast/status path.
- [x] Add focused brand, touch-target and document-feedback regression coverage.
- [x] Re-run the authenticated read-only 8-viewport runtime matrix with zero production requests,
  QA mutations, errors, overflow, UUID leaks, Unicode-as-icon matches and legacy markers.
- [x] Preserve V3Q-P3-002 as historical `RESOLVED_BY_EVIDENCE`; no product fix claimed.
- [x] Close with tests, lint, build, diff, documentation, independent review, commit and push.

Evidence: `docs/V3-10C1_CORE_CORRECTIONS.md`.

## V3-10C2 — Global visual system refinement — CLOSED / CERTIFIED

- [x] Audit shared V3 tokens, primitives, shell, controls, sheets and responsive frame.
- [x] Separate canonical brand primitives from semantic action/status tokens.
- [x] Normalize semantic typography, spacing, radius, elevation and icon geometry tokens.
- [x] Reduce redundant borders and nested visual chrome without changing module logic.
- [x] Preserve the C1 44px target, focus, Escape, reduced-motion and routing contracts.
- [x] Capture private before/after visual evidence at the required anchor viewports.
- [x] Add focused global design-system regression coverage.
- [x] Complete independent `pr-quality-gate` review and final 8-view runtime gate.
- [x] Close with tests, lint, build, diff, documentation, commit and push.

Evidence: `docs/V3-10C2_GLOBAL_VISUAL_SYSTEM.md`.

Next: `V3-10C3` must complete final authenticated runtime verification before
any product implementation in a later module.

## V3-10C3 — Home + CRM module refinement — CLOSED / CERTIFIED

- [x] Audit Home, Clients, Leads, Properties and shared CRM composition.
- [x] Move existing attention/search tasks ahead of secondary KPI summaries.
- [x] Refine responsive property media and CRM row composition without changing contracts.
- [x] Add focused module composition regression coverage.
- [x] Complete pre-auth diff, contract-freeze, relationship, search, empty-state,
  accessibility, property-media and responsive source audits.
- [x] Record the exact authenticated replay checklist.
- [x] Complete authenticated before/after visual evidence and 8-view runtime gate.
- [x] Complete independent `pr-quality-gate` after authenticated evidence.
- [x] Complete pre-auth tests, lint, build and diff validation.
- [x] Commit/push the implementation checkpoint (`4e3e1ed`).
- [x] Commit/push the certification closeout after authenticated QA.

Evidence: `docs/V3-10C3_HOME_CRM_REFINEMENT.md` and
`docs/V3-10C3_AUTHENTICATED_RUNTIME_CERTIFICATION.md`.

## V3-10C4 — Finance refinement — CLOSED / CERTIFIED

- [x] Complete read-only finance architecture and protected-contract discovery.
- [x] Record invoice, quote, payment and expense findings and priorities.
- [x] Prepare bounded implementation batches and future authenticated matrix.
- [x] Reconcile the authoritative scope, read-only QA preparation evidence and
  standalone findings ledger after C3 certification.
- [x] C4.1: refine the shared finance hierarchy without changing finance contracts.
- [x] C4.2: invoices and Invoice Workspace — settlement clarity, financial
  hierarchy and action grouping certified through final authenticated read-only
  QA at `390x844`, `768x1024` and `1440x900`.
- [x] C4.3: quotes and Quote Workspace — certified presentation: status,
  Base/IVA/Total hierarchy, explicit conversion confirmation and document/action
  grouping. Authenticated list QA passed at `390x844`, `768x1024` and `1440x900`;
  workspace actions are N/A because the controlled QA baseline has no visible
  quote record. Independent `pr-quality-gate` review passed.
- [x] C4.4: payments — presentation, authenticated read-only QA and independent
  gate complete. The versioned CP-2A.5 / V6 package supplies exact process-
  scoped Git trust, disables system Git configuration and uses a private
  profile without changing frozen V3/V4/V5 artifacts.
- [x] C4.5: expenses — workspace financial hierarchy, document/review grouping
  and create/edit composition certified through authenticated read-only QA at
  `320x568`, `390x844`, `768x1024` and `1440x900`; attachment-open states are
  N/A because the available QA row has no document.
- [x] C4.6: final cross-module certification — authenticated read-only replay,
  protected-contract audit, documentation and detached independent review
  completed with PASS.

Evidence: `docs/V3-10C4_FINANCE_DISCOVERY.md`,
`docs/V3-10C4_FINANCE_IMPLEMENTATION_PLAN.md` and
`docs/V3-10C4_FINDINGS.md`, plus
`docs/V3-10C4-1_SHARED_FINANCE_HIERARCHY.md`,
`docs/V3-10C4-2_INVOICES_REFINEMENT.md`,
`docs/V3-10C4-3_QUOTES_REFINEMENT.md`,
`docs/V3-10C4-5_EXPENSES_REFINEMENT.md` and
`docs/V3-10C4-6_FINANCE_FINAL_CERTIFICATION.md`.

Next: C5 preparation is complete; C5 product implementation remains not
started.

## V3-10C5 — Operations refinement — CLOSED / CERTIFIED

- [x] Complete read-only architecture and protected-contract discovery for
  Services/Jobs, Service Workspace, Work Report, Alerts, Closings and
  Recurring Plans.
- [x] Record current state, relationship, search/filter, accessibility and
  responsive-source findings with O-C5-P1/P2/P3 severity.
- [x] Prepare bounded implementation batches and the future authenticated
  eight-viewport runtime matrix.
- [x] C5.1: certify shared operational row hierarchy, contextual status
  conventions, human-safe Services fallbacks and 44px filter-tab geometry
  through authenticated read-only QA.
- [x] C5.2: Services, Service Workspace and Work Report — CLOSED / CERTIFIED.

- [x] C5.3: Alerts module composition — CLOSED / CERTIFIED.
- [x] C5.4: Closings module composition — CLOSED / CERTIFIED.
- [x] C5.5: Recurring Plans module composition — CLOSED / CERTIFIED.
- [x] C5.6: final cross-module runtime and responsive certification — CLOSED /
  CERTIFIED. Authenticated QA passed at `320x568`, `390x844`, `768x1024` and
  `1440x900` for available Operations states; missing service/work-report and
  recurring populated rows were recorded as N/A without writes. Fresh detached
  independent review returned PASS with P0/P1/P2/P3 = `0/0/0/0`.

Evidence: `docs/V3-10C5_OPERATIONS_DISCOVERY.md`,
`docs/V3-10C5_OPERATIONS_IMPLEMENTATION_PLAN.md` and
`docs/V3-10C5-1_SHARED_OPERATIONS_HIERARCHY.md`,
`docs/V3-10C5-2_SERVICES_WORKSPACE_WORK_REPORT.md`,
`docs/V3-10C5-3_ALERTS_REFINEMENT.md`,
`docs/V3-10C5-3_INDEPENDENT_REVIEW.md`,
`docs/V3-10C5-4_CLOSINGS_REFINEMENT.md` and
`docs/V3-10C5-4_INDEPENDENT_REVIEW.md`,
`docs/V3-10C5-5_RECURRING_PLANS_REFINEMENT.md` and
`docs/V3-10C5-5_RUNTIME_EVIDENCE.md`, and
`docs/V3-10C5-6_OPERATIONS_FINAL_CERTIFICATION.md`.

Next: V3-10C5 is closed. No next phase was started by this gate.

## Post-C5 — Global Recertification — NOT STARTED

The C1–C5 product slices are individually `CLOSED / CERTIFIED`, and the
current candidate is committed and pushed at `21d247b`. The last documented
production activation remains the V3-9 source/deployment at `50bf05a8` /
`dpl_BtBXiCoBwfwUFF4ghn5wtUKji4x7`. Because C1–C5 were certified after that
activation and were not deployed by their gates, one combined authenticated
release-candidate replay is required before any production promotion.

- [ ] Reconcile Home, CRM, Finance and Operations as one candidate HEAD.
- [ ] Replay the full eight-viewport authenticated read-only matrix.
- [ ] Verify runtime, accessibility, legacy/UUID/icon and production-request
  invariants with truthful N/A handling for unavailable QA records.
- [ ] Reconfirm protected business-contract drift is `0`.
- [ ] Obtain a fresh independent structured review with P0/P1/P2/P3 = `0/0/0/0`.
- [ ] Keep production deployment and Supabase changes out of this phase.

Evidence and acceptance criteria: `docs/V3_POST_C5_GLOBAL_RECONCILIATION.md`.

This is a defined gate, not an implementation phase. Do not invent or start
V3-10C6, do not start a new product slice, and do not deploy automatically.
