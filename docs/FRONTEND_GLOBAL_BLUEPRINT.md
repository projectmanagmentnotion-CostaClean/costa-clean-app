# Costa Clean Frontend Global Blueprint

**Status:** `CANONICAL FRONTEND SOURCE OF TRUTH`  
**Created:** 2026-07-31  
**Applies to:** authenticated CRM, public standalone flows and every future frontend implementation sprint.  
**Implementation roadmap:** [`STITCH_FRONTEND_REALITY_ROADMAP_20260731.md`](STITCH_FRONTEND_REALITY_ROADMAP_20260731.md)

---

## 1. Authority and purpose

This document defines the global frontend contract for Costa Clean CRM after reconciling:

- the real repository implementation;
- the approved Google Stitch prototype;
- existing UX and StepFlow rules;
- accessibility and responsive requirements;
- current business, financial and fiscal constraints.

It is not a description of an imaginary replacement application. It is the target system for incrementally evolving the current frontend.

### Source priority

When sources conflict, use this order:

1. explicit human authorization and sprint scope;
2. `AGENTS.md`, security gates and protected repository contracts;
3. current business logic and real data flow;
4. this blueprint;
5. `UX_APP_MANUAL.md` and other repository design documentation;
6. accepted Stitch visual references;
7. exported Stitch HTML.

Stitch never overrides real application behavior.

---

## 2. Product definition

Costa Clean CRM is an internal operational system for a cleaning-services business.

It manages:

- leads;
- clients;
- properties as service locations;
- quotes;
- jobs/services;
- invoices;
- collections from clients;
- expenses;
- operational alerts;
- recurring invoice plans;
- fiscal-closing preparation;
- public quote intake;
- public training/manual quiz.

It is not:

- a property investment platform;
- a luxury real-estate management product;
- a port, maritime logistics or fleet system;
- an employee attendance or payroll product;
- an inventory system;
- a full accounting suite;
- a tax-filing platform.

“Maritime Professional” describes the visual atmosphere only: Mediterranean clarity, clean surfaces, controlled calm, technical precision and trust.

---

## 3. Technical reality

### 3.1 Stack

- React 19
- TypeScript
- Vite
- Vitest
- Supabase client
- CSS-based design system
- GSAP available for approved motion only

### 3.2 Authenticated navigation

Authenticated navigation is currently controlled by the `AppView` contract and shell state, not by a new URL router.

Canonical visible modules:

- Inicio
- Leads
- Clientes
- Propiedades
- Presupuestos
- Servicios
- Facturas
- Cobros
- Gastos
- Cierre fiscal

Global control:

- Centro de alertas

Technical view identifiers such as `payments` remain unchanged even when the visible label is “Cobros”.

### 3.3 Public standalone surfaces

Public experiences are isolated from the internal shell. Their current route resolver and bootstrap boundaries remain authoritative.

No visual sprint may merge public and authenticated bundles or weaken auth isolation.

---

## 4. Global UX principles

### 4.1 One screen, one decision

Every screen must make these clear:

1. where the user is;
2. current state;
3. what requires attention;
4. the next best action.

Only one action may dominate visually.

### 4.2 Functional minimalism

Minimalism means:

- fewer simultaneous decisions;
- fewer nested surfaces;
- less duplicated explanation;
- clearer consequences;
- compact operational lists;
- support context revealed on demand.

It does not mean hiding important operational data.

### 4.3 Decision layers

A screen has no more than three layers:

1. **Decision:** state, risk, primary action.
2. **Support:** meaningful metrics, short warnings, related context.
3. **Optional detail:** logs, extended notes, secondary breakdowns.

### 4.4 Proximity

Actions must appear near their consequence.

Examples:

- “Crear factura” belongs beside a completed service;
- “Registrar cobro” belongs beside an issued invoice and its remaining balance;
- “Completar ficha fiscal” belongs beside the blocking fiscal state;
- “Crear servicio” belongs beside an accepted quote.

### 4.5 State truth

The UI must never present:

- `0` while real data is still loading;
- success after a failed write;
- an empty state before the query is known to be empty;
- a resolved alert whose cause still exists;
- a paid invoice with a non-zero remaining balance;
- a fiscal result as definitive when data is incomplete.

---

## 5. Visual identity — Maritime Professional

### 5.1 Core palette

The repository’s existing semantic variables are the compatibility layer. New work must consolidate rather than replace them.

#### Dark mode

- App background: `#06101D`
- Solid primary surface: approximately `#0B1628`
- Raised surface: deep navy, visually separated from the base
- Primary brand/action: `#38BDF8`
- Secondary cyan: `#22D3EE`
- Deep brand blue: `#0F3C8A`
- Primary text: near white
- Muted text: accessible slate
- Success: `#34D399`
- Warning: `#FACC15`
- Danger: `#FB7185`

#### Light mode

- App background: approximately `#F4F9FC`
- Surface: white or very pale blue
- Primary text: deep navy
- Brand action: darker accessible blue
- Semantic status colors adjusted for WCAG contrast

### 5.2 Color rules

- Neutral surfaces dominate.
- Cian is reserved for brand, focus, active state and primary action.
- Red is reserved for real danger or blocking errors.
- State is never communicated by color alone.
- Large glow fields, bright gradients and decorative halos are restrained.
- Glass effects may clarify overlays or navigation, but never reduce readability.

### 5.3 Typography

Target family:

```css
Inter, "Avenir Next", "SF Pro Text", "Segoe UI", system-ui, sans-serif
```

No font binary is added solely for this migration.

Semantic scale:

| Role | Target |
|---|---|
| Display | 32–40px desktop, reduced responsibly on mobile |
| Page title | 24–32px |
| Section title | 18–24px |
| Card/entity title | 16–18px |
| Body | 15–16px |
| Label | 14px |
| Metadata | 13–14px |
| Caption | 12–13px only when contrast and context permit |
| Numeric/KPI | tabular figures, strong weight, responsive size |
| Code/identifier | compact mono or tabular style where useful |

Rules:

- do not reduce mobile text to fit excessive content;
- headings are short;
- metadata remains readable;
- amounts use tabular figures where available;
- labels remain visible and do not rely on placeholder text.

### 5.4 Spacing

Canonical scale:

- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48
- 64px

Use tighter spacing for related operational rows and larger gaps between distinct intents.

Avoid double padding caused by wrapper-inside-wrapper composition.

### 5.5 Radius

| Surface | Range |
|---|---|
| Small control | 10–14px |
| Input/button | 12–16px |
| Card | 16–20px |
| Panel/workspace | 18–24px |
| Overlay/bottom sheet | 20–28px |
| Pill/badge | full radius only when semantically a pill |

Not every component should be a capsule.

### 5.6 Elevation

Use tonal layering before shadow.

- Base: page background
- Level 1: content surface
- Level 2: raised/selected surface
- Level 3: menu, dialog, overlay

Heavy shadows, repeated inner glows and multiple glass layers are rejected.

### 5.7 Motion

Motion clarifies:

- entry;
- focus;
- step progression;
- state change;
- success;
- relationship between list and detail.

Global durations remain short, approximately 160–340ms.

Rules:

- CSS for simple microinteractions;
- GSAP only when it creates meaningful spatial clarity;
- no blocking animation;
- full `prefers-reduced-motion` support.

---

## 6. Responsive system

The design is validated at four reference widths. Breakpoints may differ technically, but behavior must match.

### 6.1 Mobile — 390px reference

- one column;
- fixed mobile dock;
- full-screen detail and create/edit flows;
- advanced filters in bottom sheet;
- horizontal scroll only for compact tabs/chips, never the page;
- sticky footer when the primary action must remain reachable;
- safe-area support;
- no table requiring horizontal scrolling;
- primary action may occupy full width;
- first meaningful field visible immediately;
- keyboard must not hide active fields or the only CTA.

### 6.2 Tablet — 768px reference

- treat as its own constraint;
- list and detail are not forced into compressed columns;
- important flows may remain full screen;
- navigation adapts without inherited desktop overflow;
- two columns only when both remain readable;
- touch behavior remains primary.

### 6.3 Compact desktop/tablet landscape — 1024px reference

- compact sidebar where appropriate;
- master-detail only with real space;
- no narrow side panels;
- controlled overlay width;
- support context may appear beside the decision layer.

### 6.4 Desktop — 1440px reference

- full global sidebar;
- controlled maximum content width;
- balanced master-detail layouts;
- independent scroll only when it improves usability;
- no meaningless stretched cards;
- support context must not compete with the primary decision.

---

## 7. App Shell contract

### 7.1 One shell

The authenticated CRM has one global shell.

Entering a client, property or job workspace must not introduce a second navigation system.

### 7.2 Desktop navigation

Grouped visible modules:

- General: Inicio
- Comercial: Leads
- Base: Clientes, Propiedades
- Operaciones: Presupuestos, Servicios
- Finanzas: Facturas, Cobros, Gastos
- Cierre: Cierre fiscal

Alerts remain available globally.

### 7.3 Mobile dock

Primary dock:

- Inicio
- Clientes
- Servicios
- Facturas
- Más

“Más” exposes:

- Alertas
- Leads
- Propiedades
- Presupuestos
- Cobros
- Gastos
- Cierre fiscal
- account/theme controls when appropriate

### 7.4 Shell requirements

- correct active state;
- `aria-current`;
- visible focus;
- at least 44px touch target;
- safe-area clearance;
- predictable back behavior;
- one logout surface per viewport;
- theme state persists;
- public routes do not render the shell.

---

## 8. Shared frontend patterns

### 8.1 Page header

A page header may include:

- eyebrow;
- title;
- one-line purpose;
- current state;
- one primary action;
- one quiet secondary action.

Do not repeat the same metric in the header and multiple KPI cards.

### 8.2 Executive header

Used when a module needs a decision-oriented summary.

It includes only signals that change the next action.

### 8.3 Search and filters

- Search is dominant.
- Quick filters are compact.
- Advanced filters open on demand.
- Active filters remain visible as removable chips or a context bar.
- Mobile filters open in an accessible sheet.
- Filter loading is localized and does not erase the whole page.

### 8.4 Lists

Operational lists are compact and scannable.

Priority order:

1. entity identity;
2. state;
3. meaningful amount/date;
4. next action signal;
5. secondary metadata.

No decorative image may dominate a list card.

### 8.5 Master-detail

Use at 1024/desktop only when both panels remain useful.

Mobile and most 768px layouts use list → full-screen detail.

### 8.6 Workspaces

Workspace order:

1. identity and back context;
2. current state;
3. next recommended action;
4. compact snapshot;
5. tabs;
6. active tab content.

### 8.7 Actions

- one primary action;
- secondary actions visually quieter;
- overflow actions inside “Más acciones”;
- destructive actions separated and confirmed when risk exists;
- labels describe the consequence.

### 8.8 Overlays and flows

- mobile/tablet: full-screen for important creation/editing;
- desktop: wide controlled overlay;
- inherited context remains visible;
- dirty-state guard is mandatory;
- closing returns to the exact origin.

### 8.9 Skeletons

Skeletons must resemble the final structure without showing fake values.

Provide variants for:

- header;
- KPI;
- list;
- detail;
- workspace;
- filters;
- related entities;
- timeline;
- document;
- period selector.

### 8.10 Empty and error states

Empty:

- explain what is missing;
- show one useful next action;
- distinguish “no data” from “no filter results”.

Error:

- explain impact;
- preserve user input;
- provide a recovery action;
- never show success simultaneously.

---

## 9. Domain terminology

Visible language is Spanish.

Canonical labels:

- Cliente
- Propiedad
- Presupuesto
- Servicio
- Factura
- Cobro
- Gastos
- Centro de alertas
- Cierre fiscal
- Precio sin IVA
- Base imponible
- IVA
- Total legal
- Pendiente de cobro
- Parcialmente pagada
- Pagada
- Justificante
- Posible duplicado
- Requiere revisión
- Preparado para cierre
- Preparado para gestoría

### Cobros vs pagos

Customer income is always visible as:

- Cobro
- Cobros
- Registrar cobro
- Historial de cobros
- Cobro parcial
- Cobro total

“Pago” is reserved for outflow or expense-payment context.

Internal `payments` identifiers, types, APIs and data structures remain unchanged unless a separate migration is explicitly authorized.

---

## 10. Module contracts

## 10.1 Splash and authentication

### Purpose

Communicate secure initialization and allow safe authentication.

### Rules

- preserve current Supabase bootstrap;
- recoverable auth errors must remain recoverable;
- no fake progress percentage;
- login remains minimal;
- theme and build information do not obscure the primary action;
- public standalone routes bypass authenticated bootstrap as currently designed.

---

## 10.2 Home / Cockpit Diario

### Purpose

Show what matters today.

### Decision layer

- primary operational priority;
- meaningful alerts;
- immediate next action.

### Support layer

- useful facturation, collection and expense signals;
- today/upcoming service context;
- fiscal-closing status when meaningful.

### Prohibited

- decorative KPI overload;
- duplicate alert feeds;
- unrelated statistics;
- fake trend charts.

---

## 10.3 Leads

### Purpose

Capture and convert commercial opportunities safely.

### Required

- search;
- status/origin filters;
- compact list;
- creation;
- duplicate review;
- explicit conversion to client;
- creation/modification time where available.

### Prohibited

- automatic quote, property or service creation;
- automatic messaging.

---

## 10.4 Clients

### Directory

- active clients;
- pending-balance signal;
- compact search/filter;
- duplicate review;
- new client flow.

### Workspace tabs

1. Resumen
2. Propiedades
3. Servicios
4. Presupuestos
5. Facturas
6. Cobros
7. Actividad / Notas

### Workspace priority

1. fiscal completeness;
2. first property if missing;
3. collection if balance is pending;
4. overdue recurring invoice plan;
5. next service preparation;
6. new service.

### Prohibited

- property-investment management;
- employee/team management.

---

## 10.5 Properties

A property is a service location and operational context.

### Workspace tabs

1. Resumen
2. Servicios
3. Presupuestos
4. Facturas
5. Cobros
6. Actividad / Notas

### Primary content

- client;
- address;
- type;
- operational notes;
- next service;
- relevant quote/invoice;
- billed, collected and pending amounts;
- related activity.

### Prohibited

- market value;
- profitability;
- investment;
- asset management;
- luxury-property sales presentation.

---

## 10.6 Quotes

### States

- Borrador
- Enviado
- Aceptado
- Rechazado
- Vencido
- Cancelado

### State actions

- Borrador → Marcar como enviado
- Enviado → Marcar como aceptado
- Aceptado without service → Crear servicio
- Aceptado with service → Abrir servicio
- With invoice → Abrir factura

### Economic rule

Commercial total is shown without VAT.

Required copy:

- “Precios sin IVA”
- “Importe sujeto a revisión tras comprobar las condiciones reales del servicio”

VAT may be internal/informative but is not added to the dominant commercial quote total.

A quote becoming accepted never creates a service automatically.

---

## 10.7 Services / Jobs

### States

- Programado
- En curso
- Completado
- Cancelado

### Operational signals

- Hoy
- Atrasado
- Listo para facturar
- Facturado
- Pendiente de cobro
- Cerrado y cobrado

### Workspace tabs

1. Resumen
2. Operativa
3. Facturación
4. Actividad / Notas

### Dynamic primary action

- Programado → Comenzar servicio or context-safe edit
- En curso → Completar servicio
- Completado without invoice → Crear factura
- Facturado with balance → Registrar cobro
- Pagado → Abrir factura or return to context

### Prohibited

- employee assignment unless already real and separately authorized;
- attendance;
- hours;
- payroll;
- inventory;
- functional recurring services.

---

## 10.8 Invoices

### Documentary state

- Borrador
- Emitida
- Cancelada
- Correctiva when applicable

### Financial state

- Pendiente
- Parcialmente pagada
- Pagada

These dimensions are always visually separate.

### Required financial reading

- Base imponible
- IVA
- Total legal
- Cobrado
- Pendiente

### Dynamic primary action

- Borrador → Emitir factura
- Emitida with balance → Registrar cobro
- Parcialmente pagada → Registrar saldo restante
- Pagada → Abrir documento
- Numbering anomaly → Revisar numeración

### Document rule

The legal document contains legal invoice data, not the live financial collection state.

Document access must not be blocked by whether a collection action is available.

---

## 10.9 Collections

Collections are an auxiliary audit and traceability module. The normal collection path starts from an invoice.

### Required

- invoice;
- client;
- property when available;
- amount;
- date;
- method;
- remaining before;
- remaining after;
- resulting financial state;
- duplicate signal.

### Rules

- no collection without a valid invoice;
- collection cannot exceed remaining balance;
- partial collections are valid;
- collection cannot edit invoice lines, base, VAT or legal total.

---

## 10.10 Alerts

### Buckets

1. Críticas
2. Requieren acción
3. Seguimiento
4. Revisadas

### Required alert model

- clear title;
- one-line explanation;
- severity;
- source module;
- related entity;
- age;
- consequence;
- one recommended primary action;
- reviewed/postponed/resolved state.

Only real alert rules are allowed.

Resolving the underlying cause must update the alert and Home summary.

---

## 10.11 Expenses

### Documentary state

- Con justificante
- Sin justificante
- Pendiente
- No disponible
- Ilegible
- Sustituido

### Review state

- Sin revisar
- En revisión
- Revisado
- Requiere corrección
- Excluido
- Preparado para cierre

### Rules

- base + VAT must equal total;
- operational relationships are optional;
- duplicate review is manual;
- “Preparado para cierre” means internally reviewed for inclusion, not legally deductible;
- document management must preserve the previous file until replacement succeeds;
- no automatic OCR or fiscal judgment.

All “Aura Maritime CRM”, port, fleet and maritime-operations copy is rejected.

---

## 10.12 Fiscal Closing

### Period modes

- current/previous month;
- current/previous quarter;
- Q1–Q4;
- current/previous year;
- custom range.

They use one engine, not separate visual modules.

### Required distinctions

- factured vs collected;
- pending balance;
- registered vs prepared expenses;
- excluded vs pending expenses;
- output VAT vs registered input VAT;
- preliminary economic result.

### Status

- Sin preparar
- En revisión
- Bloqueado
- Preparado para gestoría
- Exportado
- Reabierto
- Desactualizado

### Language

Use:

- “Estimación preliminar”
- “Datos sujetos a validación”
- “Preparado para gestoría”
- “Diferencia preliminar de IVA”

Never use:

- “IVA definitivo a pagar”
- “Declaración presentada”
- “Aprobado por Hacienda”
- “Fiscalmente garantizado”

Missing data such as payroll or hours must be disclosed rather than invented.

---

## 10.13 Recurring invoice plans

Recurring invoice plans remain available from client context.

They may include:

- client;
- optional property;
- optional source quote;
- cadence;
- next issue date;
- template lines;
- VAT;
- status;
- duplicate review.

They are not recurring services.

---

## 10.14 Public quote request

The public request is a manual-review intake.

It may collect:

1. contact;
2. service;
3. property;
4. schedule;
5. details;
6. review;
7. success.

It does not automatically:

- create a final quote;
- send email;
- send WhatsApp;
- schedule a service.

---

## 10.15 Public manual quiz

The quiz remains an isolated public experience:

- intro;
- questions;
- private result;
- admin-only history where already supported.

It must not import the authenticated CRM shell.

---

## 11. Context inheritance

### Client → New property

- client fixed;
- client name visible;
- return to client workspace.

### Client → New service

- client fixed;
- property selected or suggested;
- missing property may open a nested property flow.

### Property → New service

- client fixed;
- property fixed.

### Client/property → New quote

- origin context visible;
- property fixed when opened from a property;
- nested property creation returns to the exact step.

### Accepted quote → New service

- quote;
- client;
- property;
- lines;
- relevant notes;
- commercial total.

### Completed service → New invoice

- job;
- quote where related;
- client;
- property;
- lines;
- base.

### Invoice → Register collection

- invoice fixed;
- client;
- property;
- total;
- collected;
- remaining.

### Client → Recurring invoice plan

- client fixed;
- property optional;
- quote optional.

Context must never be silently lost or requested again without a real reason.

---

## 12. StepFlow contract

Important creation and review flows use StepFlow.

Every flow provides:

- entry context;
- one purpose per step;
- progress indicator;
- back action;
- primary action;
- inline validation;
- review;
- saving state;
- success;
- recovery;
- dirty-state protection.

### Canonical current flow families

- property creation;
- quote creation;
- job creation;
- invoice creation;
- collection registration;
- expense creation;
- recurring invoice plan;
- public intake.

The current code’s exact step count and persistence contract remain authoritative. Stitch step counts are references, not forced migrations.

---

## 13. Economic rules

### Quotes

- dominant commercial total excludes VAT;
- required “Precios sin IVA” note;
- visible review-condition note.

### Invoices

- base;
- VAT;
- legal total;
- documentary and financial state separated.

### Collections

- cannot exceed remaining;
- partial and final collections;
- balance and history update together.

### Expenses

- deterministic base/VAT/total validation;
- review readiness is not a legal conclusion.

### Fiscal closing

- factured and collected are not interchangeable;
- VAT difference is preliminary;
- economic result is preliminary;
- absent data is disclosed.

Validated shared example:

| Concept | Amount |
|---|---:|
| Quote commercial total | 330,00 € |
| Invoice base | 330,00 € |
| VAT 21% | 69,30 € |
| Invoice legal total | 399,30 € |
| First collection | 200,00 € |
| Remaining | 199,30 € |
| Final collection | 199,30 € |
| Final remaining | 0,00 € |

---

## 14. Duplicates

Duplicate review exists across relevant domains.

Allowed:

- compare;
- open existing;
- return to review;
- continue when explicitly permitted;
- mark reviewed/ignored according to current engine.

Prohibited:

- automatic merge;
- automatic deletion;
- silent replacement;
- irreversible resolution without confirmation.

---

## 15. Unsaved changes and destructive actions

Dirty flows must protect the user.

Confirm before:

- discarding changes;
- deleting;
- archiving;
- cancelling an invoice;
- excluding an expense;
- reopening fiscal closing;
- deleting a document;
- applying a risky bulk action;
- continuing despite a strong duplicate.

Avoid confirmation fatigue for reversible low-risk actions.

---

## 16. Accessibility

Global minimum:

- WCAG AA;
- visible focus;
- logical keyboard order;
- accessible icon-button names;
- labels independent from placeholders;
- semantic landmarks;
- controlled dialog/sheet focus;
- focus restoration;
- Escape support when safe;
- minimum 44px interactive target;
- errors associated with fields or blocks;
- state and severity not based only on color;
- reduced motion;
- charts with textual alternatives;
- accessible tab and stepper semantics.

---

## 17. Loading, errors and recovery

### Loading

- localized when possible;
- no fake numbers;
- skeleton structure matches final layout;
- filters remain understandable during refresh.

### Save error

- keep all input;
- remain in the flow;
- explain what failed;
- allow retry;
- never create the entity visually.

### Relation error

- preserve inherited context;
- allow localized retry;
- do not close the parent flow.

### Document error

- preserve the existing valid document until replacement succeeds;
- show supported recovery.

### Stale alert or closing data

- explain that data changed;
- refresh the same entity;
- do not show obsolete success.

---

## 18. Components and reuse policy

The current repository already has shared components and a design-system area. Implementers must audit before creating.

Canonical pattern families include:

- AppShell
- AppNav / mobile dock
- page/executive headers
- KPI cards
- status/severity badges
- search and filter controls
- context filter bars
- compact entity lists
- master-detail
- workspace header/tabs
- detail and related-entity blocks
- action groups
- bottom sheets
- overlays
- StepFlow and sticky footer
- confirmation dialog
- empty/error/skeleton/toast
- timeline
- period selector
- duplicate notice/review

Names may differ in code. Behavior and reuse matter more than renaming.

A new component is justified only when:

1. no valid equivalent exists;
2. it represents a repeated semantic pattern;
3. it has at least two realistic uses or a strong domain boundary;
4. it reduces inconsistency;
5. it has accessible states.

---

## 19. QA contract

Every visual sprint must run:

- relevant focused tests;
- `npm run lint`;
- `npm run build`;
- full tests when risk or scope requires;
- visible running-app QA for visual claims.

Required visual widths:

- 390;
- 768;
- 1024;
- desktop.

Required checks:

- no horizontal overflow;
- dark/light;
- focus;
- reduced motion;
- primary action hierarchy;
- loading, empty, error and success;
- dirty-state guard;
- return context;
- document behavior;
- real amounts and states.

No test may be weakened merely to permit a redesign.

---

## 20. Protected implementation boundary

Frontend work under this blueprint must not modify without a separate explicit gate:

- Supabase schema;
- SQL or migrations;
- RLS or RPCs;
- auth contracts;
- secrets;
- production data;
- financial calculations;
- fiscal numbering;
- portal security boundaries;
- public route isolation;
- persistence semantics.

Visual redesign must preserve props, callbacks, IDs, state transitions and observable consequences.

---

## 21. Definition of done

A frontend slice is complete only when:

- it follows this blueprint;
- it is implemented against the real module;
- accepted Stitch intent is visible;
- rejected Stitch domain concepts are absent;
- one primary action is clear;
- mobile and tablet behavior are proven;
- dark/light and accessibility pass;
- state truth is preserved;
- business and navigation contracts are unchanged unless explicitly authorized;
- tests, lint and build pass;
- documentation is honest;
- commit and push are completed.

This blueprint must be updated when the implemented frontend intentionally changes. Mockups alone do not update the canonical contract.
