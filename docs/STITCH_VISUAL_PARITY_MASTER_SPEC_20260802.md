# Costa Clean — Stitch Visual Parity Master Specification

**Status:** `CANONICAL PROTOTYPE VISUAL CONTRACT`  
**Created:** 2026-08-02  
**Branch:** `prototype/stitch-full-visual-parity`  
**Base:** `agent/stitch-fe-02-token-theme-fundamentals`

## 1. Purpose

This document defines how the original Google Stitch exports must be translated into the real Costa Clean CRM frontend.

The objective is literal visual parity at product level, not a token-only refresh. The implementation must reproduce the Stitch composition, density, hierarchy, responsive behavior, assets, profile imagery, list patterns, workspaces, master-detail modules and guided flows while preserving all existing application behavior.

## 2. Source material

The reviewed handoff contains:

- 6 ZIP exports;
- 58 `code.html` screens;
- 59 `screen.png` captures;
- 7 `DESIGN.md` variants;
- 1 technical handoff;
- two unusable screenshots with valid HTML: `inicio_cockpit/screen.png` and `m_dulo_de_facturas_escritorio/screen.png`.

The exported HTML is visual evidence only. It must not replace React components, routing, data contracts, Supabase integration or business logic.

## 3. Canonical visual references

### Global

- `cargando_costa_clean`
- `iniciar_sesi_n`
- corrected `directorio_de_clientes`
- normalized Maritime Professional design rules

### Workspaces

- corrected client workspace desktop, tablet and mobile variants;
- corrected property workspace desktop, tablet and mobile variants;
- loading, incomplete-profile and unsaved-change states.

### Guided creation

- new property;
- new quote;
- new service;
- new invoice;
- register collection;
- invoice automation;
- duplicate warning;
- success and recovery states.

### Operational modules

- services;
- quotes;
- invoices;
- collections;
- alerts;
- expenses;
- fiscal closing.

Reject only invented domain concepts such as Aura Maritime, port operations, fleets, logistics, luxury-property investment or unsupported automation. Preserve useful layout and replace invented content with real Costa Clean entities.

## 4. Required visual outcome

The prototype must visibly differ from the current interface.

It must implement:

- narrow desktop navigation rail;
- thin top bar;
- compact mobile header;
- fixed mobile bottom dock;
- first useful content above the fold;
- compact KPI cards;
- dense lists;
- clear master-detail layouts;
- flattened workspaces;
- fewer nested cards;
- one dominant action per screen;
- cyan active and primary states;
- restrained borders and elevation;
- real avatar and asset fallbacks;
- coherent dark and light themes.

It must not keep the current oversized navigation card, repeated section labels, large empty header zones or card-inside-card composition.

## 5. Typography

Primary family:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

| Role | Desktop | Mobile | Weight |
|---|---:|---:|---:|
| Page title | 32px | 26–28px | 600–700 |
| Section title | 24px | 20–22px | 600 |
| Card title | 18–20px | 17–18px | 600 |
| Body | 15–16px | 15–16px | 400 |
| Compact body | 13–14px | 13–14px | 400–500 |
| Label | 12–13px | 12–13px | 500–600 |
| Micro label | 10–11px | 10–11px | 600–700 |
| KPI | 32–36px | 28–32px | 700 |
| Main amount | 28–36px | 26–32px | 700 |

Uppercase is limited to short metadata labels.

## 6. Core dimensions

### Page and grid

- base spacing: 4px;
- mobile page margin: 16px;
- tablet margin: 20–24px;
- desktop margin: 24–32px;
- desktop grid: 12 columns, 24px gutters;
- tablet grid: 8 columns, 16px gutters;
- mobile grid: 4 columns;
- maximum content width: 1440px.

### Shell

- desktop rail: 64–80px;
- desktop top bar: 64px;
- workspace top bar: 64–72px;
- mobile top bar: 56–64px;
- mobile bottom dock: 68–76px plus safe-area inset;
- icon button: 40–44px;
- minimum mobile touch target: 44px.

### Modules

- master-detail list column: 360–400px;
- search input: 44–48px desktop, 48–52px mobile;
- main button: 44–48px desktop, 50–56px mobile;
- compact row: 56–68px;
- mobile entity card: 72–88px;
- KPI card: 112–144px wide and 92–120px high.

## 7. Radius and elevation

- icon tile: 10–12px;
- input and button: 12–14px;
- list row: 14–16px;
- standard panel: 16–18px;
- featured panel: 20–24px;
- modal or bottom sheet: 24–32px;
- pill only for compact states, filters and segmented controls.

Use tonal layering before shadow. Avoid glow and large black shadows on every surface.

## 8. Color direction

### Dark

- canvas: `#06101D` or normalized `#0F1418`;
- lowest surface: `#0A0F12`;
- low surface: `#171C20`;
- panel: `#1B2024`;
- elevated: `#252B2E`;
- highest: `#303539`;
- main text: `#DEE3E8`;
- secondary text: `#BDC8D1`;
- border: blue-gray at controlled opacity;
- primary: `#38BDF8`;
- secondary: `#22D3EE`;
- success: `#34D399`;
- warning: `#FACC15`;
- danger: `#FB7185`.

### Light

- canvas: approximately `#F4F9FC`;
- surface: `#FFFFFF`;
- raised surface: `#F8FCFF`;
- main text: `#10243A`;
- muted text: `#52677A`;
- border: blue-gray at 14–20% opacity.

## 9. Profile and asset system

### Account avatar

- 32–36px desktop;
- 36–40px mobile;
- circular crop;
- one-pixel border;
- authenticated `avatar_url` when available;
- local neutral fallback;
- initials as final fallback.

### Client avatar

- 48px in lists;
- 64–80px in workspaces;
- company clients use a business/building tile;
- never fabricate client photographs.

### Staff avatar

- 24–32px;
- authorized image or initials;
- optional overlap of 6–8px in groups.

### Local asset structure

```text
public/ui-assets/
  avatars/
    admin-default.svg
    client-default-person.svg
    staff-default.svg
  properties/
    property-default.svg
  empty-states/
    clients-empty.svg
```

Remote Stitch image URLs must not be placed directly in JSX.

## 10. Screen rules

### Splash and login

- centered Costa Clean mark;
- no oversized shell card;
- login card width 420–440px;
- 24px radius;
- 32–40px padding;
- 56px inputs and primary action;
- coherent light and dark variants.

### Desktop shell

- narrow rail;
- cyan active tile;
- 64px top bar;
- search, alerts, theme and avatar on one line;
- content begins immediately below the bar;
- no repeated General/Base/Operations labels inside each nav item.

### Mobile shell

- 56–64px top bar;
- visible avatar and alerts;
- bottom dock with Inicio, Clientes, Servicios, Facturas and Más;
- safe-area support;
- no overlap with content.

### Lists

- search first;
- primary CTA near the title or search;
- 2–4 compact KPIs;
- dense rows containing identity, code/location, status and chevron;
- desktop list/table and mobile compact cards.

### Workspaces

- compact identity block;
- status;
- KPI strip;
- one next-action panel;
- tabs near content;
- activity below;
- imagery only when it communicates property context.

### Master-detail

Services, Quotes, Invoices and Collections use:

- compact left rail;
- search/list column;
- active row with cyan edge;
- detail workspace;
- entity header and status;
- tabs;
- primary action at top right;
- summary or document panel when relevant.

### StepFlows

- mobile full-height guided flow;
- desktop modal or split panel;
- visible progress;
- first real field above the fold;
- sticky footer actions;
- 50–56px mobile primary action;
- no new business steps.

## 11. State coverage

Implement and verify:

- loading skeleton;
- empty state;
- error and recovery;
- duplicate warning;
- unsaved changes;
- incomplete profile;
- success confirmation;
- disabled, hover, pressed and focus-visible;
- mobile, tablet and desktop;
- dark and light.

## 12. Functional invariance

Visual migration may change wrappers, CSS, presentational JSX and component boundaries.

It must not change:

- data sources;
- queries or mutations;
- Supabase, RLS, RPC or SQL;
- authentication or sessions;
- routes or `AppView` values;
- public props and callbacks;
- validation;
- business state machines;
- invoice numbering;
- taxes, totals or rounding;
- fiscal calculations;
- document meaning;
- duplicate detection;
- unsaved-change guards;
- operational consequences.

**Invariant:** same inputs + same data + same actions = same functional results.

## 13. Acceptance

The prototype is accepted only when:

- the difference from the current interface is immediately obvious;
- the shell resembles Stitch;
- the first useful content is above the fold;
- client and property workspaces resemble corrected exports;
- operational modules use master-detail structure;
- avatars and local assets are visible and correctly sized;
- typography is Inter-based;
- dark/light remain coherent;
- no functional contract changes are present.
