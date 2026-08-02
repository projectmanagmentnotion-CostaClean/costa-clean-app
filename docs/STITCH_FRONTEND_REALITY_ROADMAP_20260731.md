# Stitch Frontend Reality Roadmap

**Created:** 2026-07-31  
**Status:** `ACTIVE — DOCUMENTATION AND IMPLEMENTATION PROGRAM`  
**Scope:** translate the approved Google Stitch work into the real Costa Clean CRM frontend without replacing the current architecture or business logic.  
**Canonical frontend specification:** [`FRONTEND_GLOBAL_BLUEPRINT.md`](FRONTEND_GLOBAL_BLUEPRINT.md)

---

## 1. Purpose

This roadmap is the implementation bridge between:

1. the current production-shaped Costa Clean CRM repository;
2. the approved visual direction created in Google Stitch;
3. the existing UX, StepFlow, accessibility, QA and repository governance rules.

The Stitch export is not production code. It is a visual and interaction reference that must be interpreted against the real React, TypeScript, Supabase and view-state architecture already present in this repository.

The program must modernize the frontend incrementally while preserving every existing contract that was not explicitly authorized for change.

---

## 2. Governing documents

Every implementation block under this roadmap must read and obey:

1. `AGENTS.md`
2. `docs/FRONTEND_GLOBAL_BLUEPRINT.md`
3. `docs/UX_APP_MANUAL.md`
4. `docs/CODEX_WORKFLOW.md`
5. `docs/APP_QUALITY_GATES.md`
6. `docs/APP_TRANSFORMATION_ROADMAP.md`
7. this roadmap

When guidance conflicts, the real repository behavior, explicit sprint constraints, `AGENTS.md`, security gates and business rules take precedence over visual mockups.

---

## 3. Source audit

The Stitch handoff reviewed for this roadmap contained:

- 6 ZIP packages;
- 58 exported `code.html` screens;
- 59 `screen.png` files;
- 7 `DESIGN.md` variants;
- 1 short technical handoff;
- duplicate and superseded versions of several screens.

Two visual captures were corrupt or incomplete:

- `inicio_cockpit/screen.png`;
- `m_dulo_de_facturas_escritorio/screen.png`.

Their HTML remains usable as structural evidence, but neither image may be treated as visual acceptance evidence.

### 3.1 Artifact quality classification

| Artifact family | Decision | Reason |
|---|---|---|
| Splash, login, Home and base client directory | **Adapt** | Direction is compatible, but must use current auth, shell and live data contracts. |
| Corrected client and property workspaces | **Adapt** | Useful hierarchy and responsive references; tabs, actions and data must follow current workspace implementations. |
| Early client/property workspace versions | **Reject as canonical** | Contain real-estate-management concepts, excessive imagery or alternative navigation. |
| Creation flows | **Adapt** | Step hierarchy is useful; current forms, validation, duplicate handling and persistence remain authoritative. |
| Quotes, jobs, invoices and collections modules | **Adapt** | Useful master-detail and mobile patterns; current module state machines and document behavior remain authoritative. |
| Alerts | **Adapt** | Compatible with current alert rules and reviewed state; invented alert causes are rejected. |
| Expenses | **Rewrite against real module** | Several exports use “Aura Maritime CRM”, fleet or maritime operations and unsupported automation. |
| Fiscal closing | **Adapt carefully** | Executive reading is useful; current deterministic calculations and caution language remain authoritative. |
| `DESIGN.md` version describing port authorities, logistics managers or cleaning fleets | **Reject** | It is a domain hallucination and not Costa Clean. |
| “Maritime Professional” visual direction | **Accept after normalization** | Maritime refers only to brand atmosphere: clean, calm, Mediterranean, technical and trustworthy. |

### 3.2 Stitch code policy

Exported HTML must never be copied wholesale into `src/`.

It may be used for:

- visual hierarchy;
- spacing and responsive intent;
- content grouping;
- component discovery;
- microcopy candidates;
- empty, loading, error and success states;
- comparison during visual QA.

It must not define:

- routing;
- data structures;
- persistence;
- Supabase integration;
- business state transitions;
- invoice numbering;
- tax rules;
- permissions;
- generated documents;
- domain entities.

---

## 4. Real repository baseline

The current application already has:

- React 19, TypeScript, Vite and Vitest;
- authenticated and public standalone boundaries;
- Supabase session management;
- internal view-state navigation via `AppView`;
- a responsive `AppShell` and `AppNav`;
- dark and light themes;
- StepFlow and action overlays;
- unsaved-change guards;
- duplicate detection and review;
- modules for Leads, Clients, Properties, Quotes, Jobs, Invoices, Payments, Expenses, Alerts and Fiscal Closing;
- recurring invoice plans;
- document views and export behavior;
- extensive QA and security gates.

The implementation must improve this system, not replace it.

### 4.1 Internal navigation reality

Authenticated modules use the current internal view contract:

- `dashboard`
- `alerts`
- `leads`
- `clients`
- `properties`
- `quotes`
- `jobs`
- `invoices`
- `payments`
- `expenses`
- `fiscal_closing`
- legacy fiscal aliases when required

Stitch route names such as `/clients/:id` or `/collections/:id` are conceptual information architecture only. A URL-router migration is outside this roadmap unless separately authorized.

### 4.2 Public standalone reality

Public routes remain isolated from the internal shell and are governed by the current standalone route resolver. They must not be folded into authenticated navigation.

---

## 5. Immutable safety boundary

This roadmap does not authorize:

- Supabase schema changes;
- SQL, migration, RLS or RPC changes;
- authentication changes;
- route-contract migration;
- invoice numbering or fiscal calculation changes;
- quote pricing changes;
- persistence rewrites;
- production data changes;
- client portal changes;
- new provider integrations;
- automatic email or WhatsApp sending;
- automatic duplicate merging;
- automatic OCR;
- automatic bank reconciliation;
- services recurring functionality;
- employee, payroll, attendance or inventory modules;
- property investment, valuation or profitability features;
- automatic tax filing or legal conclusions.

Each implementation sprint must repeat the relevant protected areas in its non-goals.

---

## 6. Program principles

1. **Reality before mockup.** Diagnose the current component, state and data flow before editing.
2. **Pattern before module.** Consolidate shared primitives before isolated visual polish.
3. **Mobile first.** Validate first at `390x844`, then `768x1024`, `1024x768/1024` and desktop.
4. **One screen, one decision.** One dominant action per state.
5. **Preserve density.** Do not inflate operational lists or create card-inside-card compositions.
6. **No silent semantic drift.** Visible “Cobros” may map to internal `payments`; technical names remain unchanged.
7. **No fake completion.** Loading, errors and empty states must reflect real state.
8. **No broad rewrite.** Each block must be reviewable, reversible and independently validated.
9. **Evidence required.** Visual claims require running-app evidence at the specified viewports.
10. **Commit and push per block.** Every completed sprint closes with validation, commit and push.

---

## 7. Delivery strategy

The program is split into gated implementation blocks. A block may be divided into smaller commits, but no later block starts until the current exit gate is met.

### Status values

- `NOT_STARTED`
- `READY`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`
- `DONE_WITH_DOCUMENTED_DEBT`

---

# STITCH-FE-00 — Governance and canonical specification

**Status:** `DONE` when this roadmap and `FRONTEND_GLOBAL_BLUEPRINT.md` are merged.

### Objective

Create one repository-backed source of truth that resolves contradictions between Stitch, existing design documents and real frontend behavior.

### Deliverables

- canonical frontend blueprint;
- active implementation roadmap;
- artifact acceptance/rejection rules;
- mandatory agent read-order integration;
- explicit protected-boundary statement.

### Product code changes

`0`

### Exit gate

- documentation is linked from agent governance;
- no claim that Stitch HTML is production-ready;
- no Supabase, auth, route or business changes.

---

# STITCH-FE-01 — Frontend inventory and visual baseline

**Status:** `READY`

### Objective

Audit the current running frontend against the canonical blueprint before changing visual code.

### Required outputs

- route/view-to-component inventory;
- current tokens and CSS ownership map;
- shared-component inventory;
- module/state coverage matrix;
- baseline screenshots;
- overflow and accessibility findings;
- mapping of each accepted Stitch surface to real files;
- P0–P3 findings;
- exact first implementation slice.

### Minimum viewports

- `390x844`
- `768x1024`
- `1024x768`
- `1440x900` or the closest supported desktop viewport

### Non-goals

- no product frontend changes;
- no screenshot-only conclusions;
- no production writes.

### Exit gate

- every authenticated and public surface is `TESTED`, `CODE_REVIEW_ONLY`, `BLOCKED` or `NOT_DISCOVERED`;
- exact affected files are documented;
- no unsupported “100% audited” claim.

---

# STITCH-FE-02 — Token and theme convergence

### Objective

Reconcile the existing CSS variables and themes with the normalized Maritime Professional system.

### Primary targets

- `src/index.css`
- `src/App.css`
- `src/app/theme.ts`
- existing design-system CSS and primitives

### Deliverables

- semantic surface, text, border, brand and status tokens;
- dark/light parity;
- typography hierarchy;
- spacing and radius scale;
- focus and interaction tokens;
- controlled elevation and motion values;
- compatibility aliases for existing styles.

### Stitch references

- normalized `DESIGN.md`;
- splash/login/Home palette;
- corrected workspace surfaces.

### Rules

- correct the current token system rather than create a parallel one;
- no blind global replacement;
- retain existing theme preference and no-flash behavior;
- Inter is the target family with safe system fallbacks; do not add font binaries.

### Exit gate

- no material contrast regression;
- dark and light modes tested;
- no module business logic changed;
- lint, tests and build pass.

---

# STITCH-FE-03 — App Shell and responsive navigation

### Objective

Translate the approved shell hierarchy into the current `AppShell` and `AppNav` without changing view contracts.

### Primary targets

- `src/app/AppShell.tsx`
- `src/app/AppNav.tsx`
- shell CSS files
- viewport-state hooks
- existing navigation tests

### Deliverables

- calm desktop sidebar;
- compact tablet behavior;
- mobile dock and accessible “Más” sheet;
- correct active states;
- consistent account, alerts, theme and logout surfaces;
- safe-area support;
- no horizontal overflow;
- contextual back behavior preserved.

### Special release gate

Any change to shell, session or protected/public boundaries must satisfy the repository’s permanent logout/login gate.

### Exit gate

- exactly one logout control per viewport;
- current view and back target remain correct;
- public routes remain isolated;
- `390`, `768`, `1024` and desktop evidence passes.

---

# STITCH-FE-04 — Shared operational primitives

### Objective

Consolidate reusable patterns before module migrations.

### Patterns

- page and executive headers;
- primary/secondary action hierarchy;
- KPI cards;
- status and severity badges;
- search;
- quick filters;
- advanced filter sheet;
- context filter bar;
- compact entity list;
- master-detail layout;
- workspace header and tabs;
- related entity cards;
- bottom sheets;
- dialogs;
- StepFlow footer;
- empty, error, saving, saved and success states;
- skeletons;
- toasts;
- timelines;
- duplicate review.

### Primary targets

- `src/components`
- `src/design-system`
- `src/shared`
- shared shell and feature CSS

### Rules

- reuse first;
- preserve list density;
- advanced filters open on demand;
- skeletons match final structure;
- do not migrate all modules in one commit.

### Exit gate

- reference integrations prove the primitives;
- no duplicate component system is introduced;
- keyboard and reduced-motion behavior pass.

---

# STITCH-FE-05 — Splash, authentication and Home

### Objective

Bring the entry experience and daily cockpit to the canonical visual hierarchy.

### Surfaces

- boot/splash;
- login;
- theme feedback;
- Home / Cockpit Diario.

### Primary targets

- `src/App.tsx`
- `src/features/auth/AuthPage.tsx`
- `src/pages/HomePage.tsx`
- Home feature components
- related CSS and tests

### Required behavior

- preserve real auth bootstrap and failure recovery;
- Home shows meaningful priorities, not decorative metrics;
- alerts, operational state and financial summaries remain data-driven;
- action labels describe consequences.

### Exit gate

- auth boundary regression tests pass;
- no fake zero values while loading;
- Home updates from real current data;
- mobile first viewport exposes purpose, state and next action.

---

# STITCH-FE-06 — Leads

### Objective

Align the lead directory, creation, duplicate review and conversion experience.

### Primary targets

- `src/pages/LeadsPage.tsx`
- lead list and create components
- duplicate engine integration
- associated CSS and tests

### Requirements

- compact searchable list;
- status and origin clarity;
- explicit lead-to-client conversion;
- no automatic property, quote, service or message creation;
- date and time metadata where available.

### Exit gate

- conversion preserves data and opens the correct client;
- duplicate review is non-destructive;
- mobile list remains scannable.

---

# STITCH-FE-07 — Clients and Client Workspace

### Objective

Translate the corrected Stitch client workspace into the real existing workspace.

### Canonical tabs

1. Resumen
2. Propiedades
3. Servicios
4. Presupuestos
5. Facturas
6. Cobros
7. Actividad / Notas

### Primary targets

- `src/pages/ClientsPage.tsx`
- `src/features/clients/ClientWorkspace.tsx`
- `src/features/clients/useClientWorkspaceNavigation.ts`
- client list/create/edit components
- recurring invoice plan surfaces

### Requirements

- identity, fiscal completeness and contact are clear;
- one dynamic primary action;
- “Más acciones” for secondary actions;
- pending balance, next service and recurring invoice context are coherent;
- preserve URL/history-like workspace state implemented by current navigation helper;
- no team-management or property-investment concepts.

### Exit gate

- client list and workspace share the same data;
- all relations open and return correctly;
- dirty state is protected;
- mobile, tablet and desktop states are verified.

---

# STITCH-FE-08 — Properties and Property Workspace

### Objective

Implement the corrected operational property workspace.

### Canonical tabs

1. Resumen
2. Servicios
3. Presupuestos
4. Facturas
5. Cobros
6. Actividad / Notas

### Primary targets

- `src/pages/PropertiesPage.tsx`
- property workspace and navigation helpers
- property list/create/edit components
- related CSS and tests

### Requirements

- property is operational context, not an investment asset;
- photo is secondary;
- client, address, type, operational notes, next service, documents and balance dominate;
- creation from a client inherits and locks client context;
- duplicate detection remains explicit.

### Exit gate

- no patrimonial terminology remains;
- client/property return context works;
- empty and related-data states pass.

---

# STITCH-FE-09 — Quotes and commercial document flow

### Objective

Apply the approved quote module, detail, document and contextual creation hierarchy.

### Primary targets

- `src/pages/QuotesPage.tsx`
- quote list/detail/document components
- `QuoteCreateFlow`
- major edit and duplicate review surfaces

### Requirements

- commercial total remains without VAT;
- visible note: “Precios sin IVA”;
- review-condition note remains visible;
- accepted quote does not create a service automatically;
- one state-dependent primary action;
- document and detail remain consistent.

### Exit gate

- draft → sent → accepted flow passes;
- accepted → create service preserves context and lines;
- duplicate and similar-quote paths are safe;
- document opens and closes without losing context.

---

# STITCH-FE-10 — Services and Job Workspace

### Objective

Translate the service agenda and workspace while preserving current operational state logic.

### Canonical workspace tabs

1. Resumen
2. Operativa
3. Facturación
4. Actividad / Notas

### Primary targets

- `src/pages/JobsPage.tsx`
- job workspace and navigation helpers
- `JobCreateFlow`
- job status components
- related CSS and tests

### Requirements

- priority, list and compact agenda remain operational;
- state transitions use current contracts;
- quote origin, property, client and invoice relationships remain visible;
- completed without invoice exposes “Crear factura”;
- no employees, attendance, hours, payroll or inventory;
- recurring services remain unavailable.

### Exit gate

- scheduled → in progress → completed works;
- invoice creation inherits context;
- mobile agenda remains readable;
- no unsupported personnel controls appear.

---

# STITCH-FE-11 — Invoices and legal documents

### Objective

Implement the collection-first invoice hierarchy without changing fiscal logic.

### Primary targets

- `src/pages/InvoicesPage.tsx`
- invoice detail/document components
- `InvoiceCreateFlow`
- payment summary and numbering audit surfaces
- bulk selection and correction flows

### Requirements

- documentary and financial states remain separate;
- base, VAT and legal total are exact;
- document access is independent from collection actions;
- numbering problems remain fail-closed;
- one state-dependent primary action;
- no financial state is embedded as legal invoice content.

### Exit gate

- service → draft invoice → issued invoice passes;
- current document behavior and A4 output remain valid;
- numbering and duplicate gates pass;
- no rounding or total regression.

---

# STITCH-FE-12 — Collections (“Cobros” UI)

### Objective

Apply the approved collections audit view while retaining internal `payments` contracts.

### Primary targets

- `src/pages/PaymentsPage.tsx`
- payment list/detail/create components
- payment filters and labels
- invoice payment state helpers

### Terminology rule

- visible customer income: **Cobro / Cobros**;
- internal technical names: unchanged;
- expense outflow context may use **Pago**.

### Requirements

- collection originates from a real invoice;
- partial and total collections update balances;
- over-collection is blocked;
- duplicate review is explicit;
- collections never edit invoice lines, base, VAT or legal total.

### Exit gate

- partial and final collection scenarios pass;
- all related surfaces show the same balance;
- no technical rename breaks contracts.

---

# STITCH-FE-13 — Center of Alerts

### Objective

Apply the actionable alert hierarchy using real alert rules only.

### Buckets

- Críticas
- Requieren acción
- Seguimiento
- Revisadas

### Primary targets

- `src/pages/AlertsCenterPage.tsx`
- alert rule and type files
- Home alert summary
- reviewed-state persistence
- related CSS and tests

### Requirements

- every alert has a real cause and related entity;
- resolving the cause resolves or obsoletes the alert;
- postponement and reviewed states are traceable;
- no maritime-temperature, fleet or invented AI alerts;
- one primary action per alert.

### Exit gate

- Home and Alert Center counters stay synchronized;
- return context is preserved;
- error resolution does not show false success.

---

# STITCH-FE-14 — Expenses

### Objective

Rewrite the Stitch expense concepts against the real Costa Clean expense module.

### Primary targets

- `src/pages/ExpensesPage.tsx`
- expense create/detail/document components
- expense filters, duplicate and review logic
- Alert Center and Home summaries

### Requirements

- all “Aura Maritime CRM”, fleet and port language is removed;
- documentary state and review state remain separate;
- base + VAT = total validation remains deterministic;
- “Preparado para cierre” does not mean legally deductible;
- document upload is manual unless the real product already supports more;
- duplicate review never merges automatically.

### Exit gate

- create, edit, document, duplicate, review, exclude and prepare paths pass;
- alerts update from the same expense;
- mobile filter and document states are verified.

---

# STITCH-FE-15 — Fiscal Closing

### Objective

Apply the executive, cautious fiscal closing hierarchy to the existing deterministic engine.

### Primary targets

- `src/pages/FiscalClosingPage.tsx`
- fiscal period resolver and closing summaries
- quarterly/annual compatibility surfaces
- export and snapshot components where they already exist
- Home and Alert Center integration

### Requirements

- one engine for month, quarter, year and range;
- factured, collected and pending values remain separate;
- registered, prepared, excluded and pending expenses remain separate;
- VAT difference and economic result are preliminary;
- no automatic filing or legal guarantee;
- missing payroll/hours or other absent data must be stated, not invented;
- legacy quarterly/annual view aliases remain compatible.

### Exit gate

- current calculations are unchanged;
- period changes update all sections coherently;
- blockers and warnings are differentiated;
- export failure never appears complete;
- changes after snapshot are visible.

---

# STITCH-FE-16 — Public standalone surfaces

### Objective

Align public intake and public quiz visually without coupling them to the authenticated shell.

### Primary targets

- public standalone route resolver;
- public quote request page and StepFlow;
- public quiz page and experience;
- auth-independent styling.

### Requirements

- public intake remains manual-review;
- no automatic quote, email or WhatsApp sending;
- public quiz remains isolated;
- no authenticated module imports are introduced into standalone bootstrap;
- portal work remains outside this roadmap.

### Exit gate

- public routes build independently;
- authenticated shell is not loaded unnecessarily;
- submission and error states are safe and accessible.

---

# STITCH-FE-17 — Global mobile, tablet and accessibility hardening

### Objective

Close cross-module responsive and accessibility debt after all module slices.

### Required checks

- no horizontal overflow;
- first actionable field visible in mobile flows;
- bottom sheets, dialogs and overlays restore focus;
- no nested-card inflation;
- touch targets at least 44px;
- readable metadata;
- reduced motion;
- keyboard navigation;
- dark/light contrast;
- screen-reader labels;
- document views usable on small screens;
- tablet is not desktop compressed.

### Exit gate

- P0/P1 open: `0`;
- unresolved P2/P3 documented with owner and impact;
- physical-device limitations stated honestly.

---

# STITCH-FE-18 — Final regression and production-readiness gate

### Objective

Prove that the frontend translation is complete, coherent and safe.

### Mandatory validation

- `npm run qa:agents`
- `npm run lint`
- relevant targeted tests
- full `npm test`
- `npm run build`
- visible authenticated QA
- public route QA
- dark/light QA
- `390`, `768`, `1024` and desktop QA
- Golden Path
- duplicate flows
- unsaved-change flows
- invoice documents
- partial and final collection
- expense-to-closing propagation
- alert resolution
- fiscal closing update and export behavior
- independent QA review
- independent PR quality gate

### Final verdicts

- `APPROVED`
- `APPROVED_WITH_DOCUMENTED_DEBT`
- `REQUIRES_CORRECTIONS`

No final approval is allowed with P0 or P1 findings.

---

## 8. Golden Path regression contract

Every module implementation after STITCH-FE-08 must preserve:

Client  
→ Property  
→ Quote  
→ Quote accepted  
→ Service  
→ Service completed  
→ Invoice  
→ Invoice issued  
→ Partial collection  
→ Final collection  
→ Balance closed  
→ Alerts updated  
→ Expense and fiscal summaries coherent when applicable.

Validated example:

- quote commercial total: `330,00 €` without VAT;
- invoice base: `330,00 €`;
- VAT 21%: `69,30 €`;
- legal total: `399,30 €`;
- first collection: `200,00 €`;
- remaining: `199,30 €`;
- final collection: `199,30 €`;
- final remaining: `0,00 €`.

---

## 9. Per-sprint working contract

Every sprint prompt must contain:

- objective;
- real files to inspect first;
- Stitch reference screens;
- current-state diagnosis;
- non-goals;
- protected boundaries;
- expected minimal change;
- required tests;
- required visual viewports;
- documentation update;
- commit and push instruction.

Every sprint closeout must report:

- branch;
- initial and final HEAD;
- files changed;
- behavior changed;
- behavior explicitly preserved;
- tests run and results;
- visual QA evidence;
- P0–P3 findings;
- commit;
- push;
- exact next sprint recommendation.

---

## 10. Completion definition

The Stitch-to-reality program is complete only when:

- the canonical blueprint is implemented rather than merely documented;
- no rejected Stitch domain concepts remain;
- all real modules follow the shared system;
- internal navigation and business contracts remain intact;
- mobile, tablet and desktop are validated;
- dark and light themes are coherent;
- dynamic primary actions are state-correct;
- loading, empty, error, saving and success states are real;
- documents and economic values remain correct;
- alerts reflect real causes;
- expenses feed fiscal closing consistently;
- public flows remain isolated;
- no P0 or P1 remains;
- final documentation matches the implemented frontend;
- every closed block is committed and pushed.
