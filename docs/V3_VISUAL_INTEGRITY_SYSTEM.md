# V3 Visual Integrity System

Status: governed contract, introduced 2026-09-19. Certification remains open until the required responsive run and repository quality gates are green.

## Purpose and authority

This document is the global visual contract for every authenticated V3 surface: Home, Clients, Properties, Leads, Invoices, Quotes, Payments, Expenses, Services, Alerts, Closings, Recurring Plans, Expense Vendors, and future modules.

Repository architecture, accessibility, business contracts, routing, authentication, and Supabase/security boundaries remain authoritative. Approved Stitch evidence governs genuinely new visual screens; Stitch does not override this shared governance. If required Stitch evidence is missing, the surface is `WAITING_FOR_STITCH` and must not be replaced with an invented generic layout.

## Global invariants

### Full-width shell

- `html[data-app-surface="v3"]`, `body`, and `#root` own the V3 canvas and use `width: 100%`.
- The V3 root has no legacy application `max-width` constraint.
- `.app-shell--v3 .v3-shell-frame` spans the viewport; navigation and content are layered inside it.
- `.v3-content` and `.v3-page` may constrain readable operational content, but never the application shell.
- Intentional content caps are `--v3-content-max`, `--v3-ipad-content-max`, and `--v3-desktop-content-max`. They are presentation caps, not shell-width limits.

### Spacing and rhythm

The canonical spacing scale is 4, 8, 12, 16, 20, 24, 32, 40, and 48 CSS pixels (`--v3-space-1` through `--v3-space-9`). New layout spacing must use these tokens or a documented semantic alias (`component`, `group`, `section`).

The 28px tablet gutter and 40px desktop gutter are intentional viewport gutters, exposed as `--v3-page-gutter-tablet` and `--v3-page-gutter-desktop`; they are not local component spacing. Text measure caps such as `12ch`, `16ch`, `58ch`, `60ch`, and `62ch` are readability exceptions.

### Buttons and interactive controls

All V3 buttons use the shared action contract in `V3Primitives.tsx` and the `.v3-action` CSS primitive. Allowed semantic variants are:

- `primary`: one clear consequential action per decision surface.
- `secondary`: an important alternative action.
- `ghost`: a low-emphasis action; compact height is allowed but the 44px minimum remains mandatory.

Primary/secondary controls use `--v3-control-height-primary` (48px). Compact/ghost controls use `--v3-control-height-compact` (44px). Padding, icon gap, focus ring, typography, and radius come from governed tokens. No new one-off button geometry is allowed. Every interactive target is at least 44x44 CSS pixels unless a documented native-semantic exception applies.

### Alignment and layout

- Page content is aligned through `.v3-page`, `.v3-content`, and shared shell primitives.
- Repeated entities use CSS grid/flex templates with `minmax(0, 1fr)` so long labels do not create horizontal overflow.
- Secondary actions wrap or collapse into the existing `Más` pattern; they must not create a second competing action row on mobile.
- No essential action depends on hover.

### Status/chip primitive

`V3EntityStatus` is the single status primitive; `V3Status` is its compatibility alias. The only allowed tones are `neutral`, `success`, `warning`, and `danger`, backed by `.v3-status` and its tone modifiers. Status geometry is governed by `--v3-status-height`, `--v3-status-padding-block`, and `--v3-status-padding-inline`. Modules must not create private status/chip components or ad-hoc status colors.

### Typography

Use the limited semantic scale in `tokens.css`: display, KPI, page title, workspace title, section title, body, body-small, label, caption, and button. New arbitrary font sizes are prohibited unless an accessibility exception is documented. Body text uses the shared V3 font stack and the shared line-height roles.

### Contrast and section hierarchy

Every operational surface must distinguish page canvas, primary surface, subtle surface, border, and elevated/overlay states through semantic tokens. A section may not become a nested card solely for decoration. Secondary context is quieter than the primary operational action. Card-inside-card composition is prohibited on mobile and iPad unless it represents a separate user decision.

### Responsive grid and form geometry

- Mobile is the primary contract. Create/edit flows expose the first actionable field immediately.
- Tablet/iPad is an adapted layout, not a shrunken desktop layout.
- Forms use shared V3 fields, labels, errors, and control geometry; no generic white-form replacement is permitted.
- Grids collapse at the existing V3 breakpoints and must preserve readable order, focus order, and 44px targets.

### Sheets, dialogs, and workspaces

Use the shared bottom-sheet/workspace primitives and governed radius, shadow, safe-area, and z-index tokens. Fixed controls must respect safe areas and cannot cover a form, legal control, or primary action. Escape closes an open overlay and focus returns to its trigger.

### Motion and safety

V3 motion is restrained and functional. `prefers-reduced-motion: reduce` disables transitions and animations for the V3 shell. New motion must not be required to understand or complete an action.

## Required responsive certification matrix

Every visual integrity release must inspect all applicable V3 surfaces at these exact viewports:

| ID | Size |
| --- | --- |
| `320x568` | 320 × 568 |
| `390x844` | 390 × 844 |
| `430x932` | 430 × 932 |
| `768x1024` | 768 × 1024 |
| `820x1180` | 820 × 1180 |
| `834x1194` | 834 × 1194 |
| `1024x1366` | 1024 × 1366 |
| `1280x800` | 1280 × 800 |
| `1440x900` | 1440 × 900 |
| `1920x1080` | 1920 × 1080 |

The run must check shell width, horizontal overflow, visual hierarchy, touch geometry, overlay safety, focus behavior, and reduced-motion behavior. A desktop pass never compensates for a mobile partial or failure.

## Automated governance checks

`src/v3/design/v3VisualIntegrityGovernance.test.ts` protects the contract where static checks are reliable. It verifies the versioned rules, canonical scale, shell width rules, action variants, status primitive, reduced motion, governed status/action geometry, and the ten certification viewports. Runtime QA remains necessary for pixel/layout behavior.

## Certification record

| Gate | Current state |
| --- | --- |
| VISUAL INTEGRITY | OPEN — contract and static checks added; runtime certification required |
| FULL-WIDTH | IMPLEMENTED — shell/root rules present; runtime certification required |
| SPACING CONSISTENCY | IMPLEMENTED — canonical scale and documented exceptions |
| BUTTON CONSISTENCY | IMPLEMENTED — shared action primitive and governed variants |
| ALIGNMENT | OPEN — runtime matrix required |
| STATUS CONSISTENCY | IMPLEMENTED — one shared primitive |
| TYPOGRAPHY | IMPLEMENTED — semantic token scale |
| SECTION CONTRAST | OPEN — runtime visual review required |
| GRID CONSISTENCY | OPEN — runtime visual review required |
| RESPONSIVE CONSISTENCY | OPEN — ten viewport matrix required |

Any material failure keeps recovery open. This contract does not authorize Production changes, Supabase writes, auth changes, route changes, or new Expenses/Vendors screens without approved Stitch evidence.
