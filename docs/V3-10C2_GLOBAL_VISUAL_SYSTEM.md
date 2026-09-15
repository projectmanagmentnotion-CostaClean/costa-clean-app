# V3-10C2 — Global Visual System Refinement

Status: `CLOSED / CERTIFIED`

Starting HEAD: `23614bca14f187d0c677c51e320d34b7826f5d08`
Branch: `codex/app-v3-mobile-first-redesign`

This slice is a shared visual-foundation correction. It does not redesign
individual modules, change routes, alter business logic, write QA/business data,
touch Supabase, deploy production or add GSAP motion.

## Baseline findings

The pre-change authenticated visual runner completed `1,584/1,584` checks. The
private baseline was captured at `qa-screenshots/private/2026-09-15T18-33-50`.

The system had useful existing primitives, but the audit classified these global
issues:

| Finding | Classification | Evidence | Decision |
| --- | --- | --- | --- |
| Teal accent served as brand, action and selected-state color | GLOBAL_TOKEN | `src/v3/design/tokens.css` | Separate brand primitives from semantic roles; use official blue for primary action and accessible derivative for text |
| Typography exposed only generic xs/sm/md/lg/xl roles | GLOBAL_TOKEN | `src/v3/design/tokens.css`, `src/v3/design/v3.css` | Add compact display/page/workspace/section/body/label/caption roles |
| Page/group rhythm mixed raw levels and module-specific gaps | GLOBAL_TOKEN | shared page, section and shell rules | Add component/group/section rhythm and page-gutter roles |
| Borders and filled surfaces repeated across section/KPI layers | GLOBAL_PRIMITIVE | shared section, KPI, sheet and row rules | Flatten ordinary sections; retain borders only for semantic list/control separation |
| Sheet/navigation elevation was inconsistent | SHELL / GLOBAL_PRIMITIVE | shared sheet, rail and selection rules | Add restrained hover/sheet/dialog/navigation elevation roles |
| Shared radius and icon geometry had one-off values | GLOBAL_PRIMITIVE | shared controls, media and navigation rules | Add control/surface/sheet/icon/handle tokens |
| Module-specific information architecture and business states | MODULE_SPECIFIC | V3 module components | Deferred to later slices; no module redesign in C2 |

## Design decisions

### Brand and color

Canonical primitives remain `#00AEF0`, `#000000` and `#FFFFFF`; accessible UI blue
is `#006B8F`. They are declared independently from semantic tokens. The official
blue is used for primary branded actions, selection and identity accents. Status
colors remain independent success, warning and danger roles.

The former teal values were classified as follows:

- `#0d9488` / `#0f766e` action and selection roles: `MIGRATE_TO_BRAND` and
  `MIGRATE_TO_ACCESSIBLE_BRAND` through semantic aliases.
- success, warning and danger roles: `KEEP_AS_SEMANTIC`; their meaning and
  contrast remain independent of the brand.
- official logo artwork: unchanged and still resolved through
  `src/v3/brand/brandAssets.ts`.

Measured foreground/background contrast after the change:

- brand blue on black: `8.31:1`
- accessible blue on white: `6.00:1`
- primary text on page background: `15.88:1`
- secondary text on page background: `5.96:1`
- muted text on page background: `4.19:1`

### Typography and rhythm

The compact semantic scale now includes display value, page title, workspace title,
section title, body, body-small, label, caption and button roles. Shared page,
group and section spacing use semantic tokens; mobile, tablet and desktop gutters
are explicit. Operational headings remain restrained and no marketing hero scale
was introduced.

### Containers, borders and elevation

Ordinary KPI and detail blocks no longer receive a border by default. Operational
rows retain subtle separators. Sheets use a shared elevated surface and shadow;
the navigation rail and bottom navigation use quieter surfaces and subtle borders.
The change intentionally avoids adding nested cards or new wrapper markup.

### Controls and accessibility

Primary, secondary and ghost actions retain the C1 `44px` minimum contract.
Inputs, filters, navigation and sheet actions continue to use the preferred `48px`
control height. Existing focus rings, Escape behavior, reduced-motion behavior,
accessible names and selected states are preserved.

## Before / after visual evidence

Private ignored captures:

- BEFORE: `qa-screenshots/private/2026-09-15T18-33-50`
- AFTER: `qa-screenshots/private/2026-09-15T19-19-20`
- C1 login baseline used as the pre-C2 login reference:
  `qa-reports/private/v3-10c1/after`

The requested anchors are present for the core authenticated surfaces at
`390x844` (`mobile-390`), `768x1024` (`ipad-768`) and `1440x900`
(`desktop-1440`). The authenticated runner covered Home, Clients, Properties,
Quotes, Jobs/Services, Invoices, Expenses, Payments and Closings plus create-flow
states. Alerts, More, selection and deep-link/workspace behavior remain covered by
the V3-10B read-only runtime harness; no customer screenshot was committed.

## Scorecard

Scores are an evidence-backed visual review of the private before/after captures,
not a pixel-diff claim:

| Category | Before | After | Evidence |
| --- | ---: | ---: | --- |
| Hierarchy | 3 | 4 | page title, section title and KPI roles are separated |
| Spacing / air | 3 | 4 | shared page/group/section rhythm and flatter KPI blocks |
| Separation | 3 | 4 | lower border chrome, clearer surface contrast |
| Structure | 3 | 4 | consistent page frame, sheet and rail surfaces |
| Contrast | 3 | 4 | brand/action and text contrast measured above |
| Scanability | 3 | 4 | quieter metadata and stronger section labels |
| Density | 3 | 4 | more usable air without adding module wrappers |
| CTA clarity | 3 | 4 | one brand-primary action with quieter secondary actions |
| Typography | 3 | 4 | compact semantic scale replaces generic-only roles |
| Consistency | 3 | 4 | shared geometry, surfaces, controls and spacing |
| Brand integration | 2 | 4 | official blue is controlled and logo registry is preserved |
| Overall polish | 3 | 4 | visible in Home and Clients before/after review |

## Runtime and quality evidence

The post-change authenticated visual runner completed `1,584/1,584` checks with
zero failed checks. It used the existing QA auth profile and generated only
private ignored screenshots. The inherited V3-10C1 exact eight-viewport
read-only runtime evidence remains valid because this slice changes only shared
CSS/tokens, tests and documentation; the post-change visual runner covers the
same authenticated surfaces across mobile, tablet and desktop widths. No
Supabase schema, policy, bucket, seed or business data was changed.

The full 8-view read-only V3 runtime matrix must remain the final gate. Required
runtime invariants are: zero production requests, zero QA mutations, zero
horizontal overflow, zero broken images, zero visible/accessibility UUIDs, zero
Unicode-as-icon matches, zero legacy runtime markers, zero console/page errors and
zero critical failed requests.

## Test coverage

Added focused non-pixel contracts in
`src/v3/design/v3GlobalVisualSystem.test.ts` for:

- brand primitives versus semantic roles;
- typography, spacing, elevation and radius token presence;
- the C1 44px interaction contract;
- absence of raw color literals in shared V3 CSS.

The existing C1, brand, icon, shell and runtime coverage remains unchanged.

## Remaining module-specific debt

- Individual module composition, dense row information architecture and copy are
  intentionally not redesigned in C2.
- Module-specific raw values outside the shared V3 CSS require separate audit and
  evidence; no blind V2 migration is allowed.
- Alerts/closings/selection visual refinements remain future bounded slices.
- Motion proposals may be reviewed, but GSAP implementation is explicitly deferred
  to V3-10C7 after geometry stabilizes.
- V3-10C3 through V3-10C8 remain not completed.

## Gate boundary

The independent `pr-quality-gate` verified the diff, private before/after
evidence, inherited exact eight-viewport runtime invariants, accessibility,
brand decisions, business-logic freeze and final quality commands. Production
deployment remains `NOT EXECUTED`.
