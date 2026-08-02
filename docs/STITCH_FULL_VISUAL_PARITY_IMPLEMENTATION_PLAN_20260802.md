# STITCH Full Visual Parity — Implementation Plan

**Status:** `READY_FOR_CODEX_IMPLEMENTATION`  
**Created:** 2026-08-02  
**Prototype branch:** `prototype/stitch-full-visual-parity`  
**Base branch:** `agent/stitch-fe-02-token-theme-fundamentals`

## 1. Goal

Translate the original Stitch UI into the existing Costa Clean React application with high visual fidelity while preserving data, behavior, navigation, authentication and protected business logic.

This is a visual prototype and must not be merged into `main` until human approval.

## 2. Mandatory sources

Codex must read, in order:

1. `AGENTS.md`
2. `docs/FRONTEND_GLOBAL_BLUEPRINT.md`
3. `docs/STITCH_FRONTEND_REALITY_ROADMAP_20260731.md`
4. `docs/STITCH_FE_01_REAL_FRONTEND_AUDIT_20260802.md`
5. `docs/STITCH_FE_02_THEME_TOKENS_20260802.md`
6. `docs/STITCH_VISUAL_PARITY_MASTER_SPEC_20260802.md`
7. this implementation plan
8. `docs/UX_APP_MANUAL.md`
9. `docs/CODEX_WORKFLOW.md`
10. `docs/APP_QUALITY_GATES.md`

## 3. Private source location

Place the four original ZIP exports locally under:

```text
.project-agent/private/stitch-source/
```

Extract them into:

```text
.project-agent/private/stitch-extracted/
```

The repository already ignores `.project-agent/private/`. Never commit the ZIPs, extracted HTML, private screenshots or remote asset downloads.

## 4. Implementation blocks

Every block must end with review, validation, commit and push.

### Block 1 — Source audit and visual inventory

Deliverables:

- exact screen inventory;
- canonical/superseded/rejected classification;
- route-to-screen map;
- component map;
- asset inventory;
- measurements extracted from HTML and screenshots;
- protected-logic statement.

No product UI change in this block.

### Block 2 — Assets, primitives and profile system

Target files:

- `src/design-system/stitch/stitchAssets.ts`
- `src/design-system/stitch/stitchVisualParity.css`
- shared avatar/image primitives created only when real reuse is proven;
- local SVG fallbacks under `public/ui-assets/`.

Deliverables:

- account, client and staff avatar fallbacks;
- property and empty-state fallbacks;
- Inter-based type scale;
- shell and layout metrics;
- visual-only helpers;
- no remote image URLs in JSX.

### Block 3 — Shell and navigation

Likely targets:

- `src/app/AppNav.tsx`
- `src/app/AppShell.tsx`
- shell CSS files;
- shared presentational components.

Required result:

- 64–80px desktop rail;
- 64px desktop top bar;
- 56–64px mobile top bar;
- mobile bottom dock;
- compact account/avatar, alert and theme controls;
- no giant navigation card;
- same `AppView`, callbacks and navigation outcomes.

### Block 4 — Splash, login and Home

Likely targets:

- boot/splash styles and presentational markup;
- `src/features/auth/auth.css` and presentational auth markup if required;
- `src/pages/HomePage.tsx`;
- dashboard CSS and presentational components.

Required result:

- Stitch-like splash and login;
- compact dashboard header;
- KPI strip;
- priorities and services visible above the fold;
- no repeated explanatory copy;
- no nested-card inflation.

### Block 5 — Clients, Properties and Workspaces

Likely targets:

- `src/pages/ClientsPage.tsx`
- `src/pages/PropertiesPage.tsx`
- client/property list components;
- `ClientWorkspace` and `PropertyWorkspace` presentational composition;
- related CSS.

Required result:

- dense desktop lists;
- compact mobile entity cards;
- visible avatar or company icon;
- compact identity block;
- KPI strip;
- next action;
- tabs and activity aligned with Stitch;
- all existing duplicate and unsaved-change behavior preserved.

### Block 6 — StepFlows

Scope:

- client/property/quote/service/invoice/collection creation flows;
- automation flow;
- duplicate and unsaved-change states.

Required result:

- mobile full-height flow;
- desktop modal or split panel;
- first actionable field above the fold;
- sticky footer;
- visual progress;
- same fields, validation, persistence and consequences.

### Block 7 — Services, Quotes, Invoices and Collections

Required result:

- Stitch master-detail layout;
- search/list pane 360–400px desktop;
- selected row with cyan edge;
- detail pane with entity header, state, tabs and primary action;
- document/summary panel where relevant;
- mobile composition derived from exported screens;
- no changes to state machines, totals, numbering or documents.

### Block 8 — Alerts, Expenses and Fiscal Closing

Required result:

- compact control/list/detail composition;
- deterministic alert causes only;
- expense detail using real data;
- executive fiscal reading;
- existing calculations and caution language unchanged;
- no automatic filing or unsupported accounting behavior.

### Block 9 — Responsive, accessibility and final parity QA

Viewports:

- `390x844`
- `430x932`
- `768x1024`
- `1024x768`
- `1366x900`
- `1440x900`

Validate:

- no horizontal overflow;
- no overlap;
- safe-area support;
- 44px minimum touch targets;
- focus-visible;
- dark/light;
- loading/empty/error/success;
- first useful content above fold;
- screenshots compared with Stitch references;
- functional invariance.

## 5. Allowed changes

Allowed:

- CSS and visual tokens;
- local visual assets;
- presentational JSX regrouping;
- wrappers and component extraction;
- visual ordering when functional ordering is unchanged;
- icon and typography normalization;
- responsive layout changes;
- visual state components.

## 6. Forbidden changes

Forbidden:

- Supabase queries, mutations, schema, RLS, RPC, SQL or migrations;
- auth/session behavior;
- route or `AppView` changes;
- public prop/callback contract changes;
- validation changes;
- financial or fiscal calculations;
- numbering, tax, rounding or document semantics;
- mocks replacing real application data;
- new domain entities;
- remote writes for visual QA;
- unrelated refactors;
- new dependencies without separate approval.

## 7. Git policy

- Work only on `prototype/stitch-full-visual-parity`.
- Push after every completed block.
- Do not commit private Stitch source exports.
- Open a draft PR with base `agent/stitch-fe-02-token-theme-fundamentals`.
- Do not target `main`.
- Do not merge the prototype PR.

Suggested commit sequence:

```text
docs(frontend): inventory canonical Stitch sources
feat(frontend): add Stitch assets and visual primitives
prototype(frontend): rebuild shell and navigation from Stitch
prototype(frontend): migrate splash login and home visuals
prototype(frontend): migrate clients properties and workspaces
prototype(frontend): migrate guided creation flows
prototype(frontend): migrate operational master-detail modules
prototype(frontend): migrate alerts expenses and fiscal closing
qa(frontend): close Stitch visual parity prototype
```

## 8. Validation

At each block:

```bash
pnpm exec eslint <modified-ts-tsx-files>
pnpm run build
git diff --check
git diff --stat
```

Run relevant focused tests. Reproduce global pre-existing failures without fixing unrelated debt.

Classify results as:

- `PASS`
- `FAIL_PREEXISTING`
- `FAIL_NEW`
- `BLOCKED`
- `NOT_EXECUTED`

Never close a block with `FAIL_NEW`.

## 9. Definition of visual acceptance

The prototype passes when:

- it is immediately recognizable as the Stitch design;
- the old oversized shell is gone;
- desktop and mobile navigation match the Stitch hierarchy;
- lists and workspaces match Stitch density;
- avatars and assets are visible;
- modules use the expected master-detail composition;
- dark/light are coherent;
- all existing actions still lead to the same outcomes;
- no protected logic changed.

## 10. Progress log

- Block 2 now includes property avatar support and property-specific fallback assets in the shared Stitch primitive layer.
- Block 6 now includes presentational StepFlow compositions for client and property creation, with the first actionable fields kept at the top of the flow.
- This branch remains visual-only; protected routes, data and business semantics stay untouched.
