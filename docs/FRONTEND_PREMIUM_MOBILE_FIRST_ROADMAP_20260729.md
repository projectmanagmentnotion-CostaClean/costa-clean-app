# Costa Clean Premium Mobile-First Frontend Roadmap

**Created:** 2026-07-29  
**Status:** `FMA-0 PREPARED_PENDING_REVIEW`  
**Scope:** frontend visual system, UX, responsive behavior and accessibility  
**Primary agent:** `senior-figma-mobile-first-auditor`

## Product direction

Costa Clean must feel:

- clean and visually calm;
- professional and trustworthy;
- modern without decorative fashion;
- minimalist without hiding operational capacity;
- intuitive and easy to learn;
- clear in purpose, state and next action;
- visually guided by hierarchy, proximity and sequence;
- consistent across modules and states;
- mobile-first for critical work;
- premium through precision, not excess.

The app must not overwhelm through excessive cards, colors, badges, icons, explanations, nested wrappers, oversized headers or equal-weight actions.

## Immutable safety boundary

This roadmap does not authorize changes to:

- routes or navigation contracts;
- Supabase schema, RLS, RPC, queries, Storage or Edge Functions;
- authentication or session behavior;
- invoice, quote, client, property, service, payment, expense or fiscal business logic;
- prices, taxes, numbering, rounding or calculations;
- production data, production deployment or remote writes;
- dependencies without a separate decision.

Visual implementation must preserve props, callbacks, data flow, permissions and observable consequences.

## Device strategy

### Mobile first

The target composition is designed first at:

- `360x800`;
- `390x844`;
- `430x932`.

Every critical workflow must be completable on mobile. The first viewport must communicate purpose, current state and one clear next action without visual overload.

### iPad

Validate:

- `768x1024`;
- `834x1194`;
- `1024x768`.

From `768px`, iPad may reuse the desktop shell or layout only when:

- no horizontal overflow exists;
- touch targets remain adequate;
- content is not compressed;
- columns are not forced;
- cards do not stretch meaninglessly;
- the first field or primary action stays visible;
- reading and focus order remain clear.

When those conditions fail, use a minimal tablet adaptation derived from mobile rather than a third independent product.

### Desktop

Validate at least `1366x900`. Desktop may add support context but must retain one dominant decision and avoid excessive content width.

## Agent sequence

```text
senior-figma-mobile-first-auditor
→ implementation-planner
→ senior-fullstack-builder
→ qa-e2e-specialist
→ pr-quality-gate
→ documentation-roadmap
```

The auditor works in `AUDIT_ONLY` mode for FMA-1. No visual implementation starts from assumptions or from screenshots alone.

## Roadmap

### FMA-0 — Agent installation and governance

**Goal:** install the specialist, route its use, register hashes and create the scoped roadmap.

**Deliverables:**

- project agent profile;
- `AGENTS.md` routing;
- 16-agent manifest;
- agent-pack validator update;
- this roadmap;
- exact first audit prompt.

**No frontend product code changes.**

### FMA-1 — Complete frontend audit

**Mode:** `AUDIT_ONLY`  
**Goal:** discover and classify 100% of frontend surfaces that are actually reachable or inspectable.

**Required evidence:**

- route and surface inventory;
- route-to-component map;
- user goal and primary action per screen;
- coverage matrix using `TESTED`, `CODE_REVIEW_ONLY`, `BLOCKED` or `NOT_DISCOVERED`;
- visible local QA when available;
- mobile, iPad and desktop baseline;
- normal, loading, empty, error, saving, saved, success, recovery, disabled, focus and reduced-motion states;
- P0-P3 findings;
- screenshots or traces only from authorized local/QA sessions;
- protected-logic statement;
- proposed sprint slices.

**Exit:** documented audit with an exact first implementation slice. No visual code changes.

### FMA-2 — Visual foundation

**Goal:** reconcile existing tokens and shared primitives before module-by-module polish.

Review typography, spacing, radius, borders, elevation, neutral/accent palette, semantic status colors, icon rules, buttons, inputs, focus, overlays and motion.

**Rule:** correct the existing system rather than create a parallel design system.

### FMA-3 — Shell and navigation

**Goal:** create a calm, predictable frame across mobile, iPad and desktop.

Review AppShell, headers, navigation, viewport overflow, mobile reachability, active state, secondary actions and logout boundary when affected.

**Special gate:** any changes to `App.tsx`, `AppShell.tsx`, `AppNav.tsx`, session handling or protected/public boundaries must satisfy the permanent production logout/login release gate.

### FMA-4 — Shared operational patterns

**Goal:** unify search, filters, list density, cards, tables, empty states, status, action menus, sheets, dialogs and feedback.

Search remains dominant. Advanced filters stay secondary and open on demand. Lists stay compact and scannable.

### FMA-5 — Module audit and implementation slices

Work one bounded module or shared pattern at a time. Likely groups:

1. Home and global workspaces;
2. Clients and properties;
3. Quotes and invoices;
4. Services and recurring work;
5. Payments and expenses;
6. Fiscal and reporting surfaces;
7. Client portal isolated surfaces;
8. Public intake and other public flows.

Order is determined by FMA-1 evidence, not by this provisional list.

### FMA-6 — Forms and StepFlows

**Goal:** ensure important create/edit flows expose the first real field immediately, group fields by intent and show clear review, saving, success and recovery states.

No flow may change the underlying persistence or business contracts as part of visual work.

### FMA-7 — iPad and desktop adaptation

**Goal:** verify that the mobile solution scales without creating a heavy tablet-only architecture.

Audit both portrait and landscape iPad, then desktop width, content max-width, column balance and secondary context.

### FMA-8 — Accessibility, states and final polish

**Goal:** close focus, keyboard, labels, errors, contrast, touch targets, reduced motion, state coverage, visual consistency and remaining P2/P3 debt.

### FMA-9 — Independent final gate

Required:

- `npm run qa:agents`;
- `npm run lint`;
- relevant tests;
- `npm run build`;
- visible visual QA in required viewports;
- before/after evidence;
- independent `qa-e2e-specialist` review;
- independent `pr-quality-gate` verdict;
- documentation reconciliation;
- commit and push per closed block.

## Master audit prompt

```text
Use the `senior-figma-mobile-first-auditor` agent in `AUDIT_ONLY` mode.

Perform a complete, evidence-based audit of 100% of the frontend surfaces discoverable in Costa Clean. The target is a clean, professional, modern, minimalist, visually calm, intuitive, easy-to-use, clear and guided app that does not overwhelm the user.

Do not implement visual changes in this run.

Mandatory preparation:
1. Read `AGENTS.md`.
2. Read `docs/UX_APP_MANUAL.md`.
3. Read `docs/CODEX_WORKFLOW.md`.
4. Read `docs/APP_QUALITY_GATES.md`.
5. Read `docs/APP_TRANSFORMATION_ROADMAP.md`.
6. Read `docs/UX_UI_CORRECTION_SYSTEM.md`.
7. Read `docs/FRONTEND_PREMIUM_MOBILE_FIRST_ROADMAP_20260729.md`.
8. Inspect the current Git branch and repository state before doing anything else.

Audit scope:
- all public and authenticated routes discovered;
- internal CRM and isolated client portal surfaces;
- shells, navigation and page headers;
- lists, search, filters, tables and cards;
- detail screens;
- create/edit forms and StepFlows;
- modals, drawers, sheets, popovers and menus;
- shared frontend primitives and design tokens;
- normal, hover, focus, disabled, loading, empty, error, saving, saved, success and recovery states;
- keyboard, reduced motion and touch behavior.

Coverage rules:
- build a route-and-surface inventory before conclusions;
- map each route to its files, user goal, primary action and major states;
- classify every row as `TESTED`, `CODE_REVIEW_ONLY`, `BLOCKED` or `NOT_DISCOVERED`;
- do not claim 100% coverage when a route, role, state, dataset or session is inaccessible;
- use visible local QA by default;
- use only synthetic or authorized QA data;
- do not access production or create remote effects;
- do not version `.auth/`, browser profiles, cookies, tokens, private screenshots or personal data.

Mobile-first order:
1. Audit and define the target composition first at `360x800`, `390x844` and `430x932`.
2. Validate iPad at `768x1024`, `834x1194` and `1024x768`.
3. The iPad layout may reuse desktop from `768px` only when there is no overflow, compressed content, forced columns, small touch targets, meaningless stretching or loss of reading/focus order.
4. Validate desktop at `1366x900` without allowing excessive width or secondary context to compete with the main decision.

Visual direction:
- one clear reading per screen;
- one dominant primary action;
- purpose, current state and next action visible quickly;
- neutral, calm base surfaces with restrained accent use;
- visual guidance through hierarchy, proximity and sequence rather than long explanations;
- fewer cards, nested wrappers, borders, shadows, badges, colors and decorative icons;
- compact, scannable operational lists;
- filters secondary to search;
- buttons close to their consequence;
- first real field visible immediately in mobile/iPad forms;
- no card-inside-card unless it represents a genuinely separate decision;
- space between different intents without inflating every block or increasing scroll;
- premium consistency in typography, spacing, alignment, iconography, states and feedback.

Preserve without exception:
- routes and navigation contracts;
- Supabase schema, SQL, RLS, RPC, queries, Auth, Storage and Edge Functions;
- props, callbacks and data contracts;
- invoices, quotes, clients, properties, services, payments, expenses and fiscal logic;
- prices, tax, numbering, rounding and calculations;
- existing dependencies;
- production and remote environments.

For every finding include:
- priority `P0`, `P1`, `P2` or `P3`;
- route and component;
- viewport and state;
- exact evidence;
- user impact;
- recommended minimal correction;
- likely files;
- implementation risk;
- validation needed.

Group the proposed work into safe sprints by shared system before isolated screen polish. Separate visual foundation, shell/navigation, shared primitives, lists/search/filters, details, forms/StepFlows, module slices, iPad/desktop adaptation, accessibility/states and final QA.

Required output:
- verdict;
- frontend inventory;
- coverage matrix;
- route-to-component map;
- mobile-first diagnosis;
- iPad adaptation decision;
- desktop verification;
- current and target visual system;
- accessibility and state coverage;
- P0-P3 backlog;
- sprint roadmap;
- protected-logic statement;
- validations executed and not executed;
- exact first implementation slice;
- exact next prompt for `implementation-planner`.

Stop after the audit and roadmap. Do not edit frontend product code in FMA-1.
```

## FMA-0 closeout status

- Agent source PR: pending independent review and CI.
- App installation branch: prepared.
- Product frontend code changed: `0`.
- Supabase/Auth/SQL/production effects: `0`.
- Next action after merge: run the master prompt in `AUDIT_ONLY` mode.
