# Design System Integration — Dashboard Analytics V1

## Authority

Visual implementation must obey:

1. explicit approved sprint scope;
2. `AGENTS.md` and security/business contracts;
3. current business/data behavior;
4. `docs/stitch/DESIGN_SYSTEM_CONSTITUTION.md`;
5. approved/extracted Stitch values in `docs/stitch/DESIGN.md`;
6. existing V3 design primitives.

No generic SaaS template outranks Costa Clean's own visual system.

## Current design foundation

The repository already has:

- semantic CSS variables;
- `src/design-system/components`;
- `DSCard`;
- `DSButton`;
- `DSSkeleton`;
- loading/empty/error states;
- V3 primitives;
- dark/light theme;
- motion tokens;
- GSAP integration;
- reduced-motion hook;
- mobile density and 44px interaction rules.

The analytics dashboard must extend these primitives rather than introduce a new component universe.

## shadcn decision

shadcn/ui and Tailwind are not installed.

Decision: **do not add shadcn as a second runtime design system**.

“shadcn Charts” may be used as a pattern/reference for how Recharts can be wrapped, but the runtime component skin, tokens, states and controls must be Costa Clean-native.

## Recharts integration

If approved in the implementation sprint:

- Recharts provides rendering mechanics only.
- Costa Clean owns card shell, typography, spacing, colors, tooltip styling, legends and states.
- No chart may use hard-coded library default colors if semantic tokens exist.
- Create one thin chart wrapper layer rather than scattering Recharts imports across Home.

## Motion decision

Motion for React is not recommended as an initial dependency.

Reason:

- GSAP is already installed;
- the repository has a governed `src/design-system/motion/` layer;
- `useReducedMotion` already exists;
- repository rules prohibit direct business-component GSAP imports and require shared motion primitives.

Analytics should first use:

- CSS transitions where enough;
- existing GSAP motion presets through the design-system layer;
- restrained chart-library animation.

A later implementation ADR may approve Motion only if it solves a concrete gap without creating parallel motion governance.

## GSAP usage

Allowed future use:

- subtle KPI/value transition;
- filter state/layout transition;
- section reveal if it improves orientation;
- small list reordering transition.

Not allowed:

- spectacle chart entrances;
- scroll-triggered financial storytelling;
- number counters that obscure actual values;
- motion that delays comprehension.

## TanStack Table decision

Deferred/conditional.

For a compact recent-activity block, existing V3 list primitives are preferred.

Introduce TanStack Table only if the final scope requires multiple of:

- complex column sorting;
- server/client filtering;
- pagination;
- column visibility;
- selection;
- persistent state.

Do not add a dependency just to render five recent rows.

## Tremor role

Tremor is reference-only:

- dashboard composition;
- spacing ideas;
- KPI information patterns;
- ranking/chart layout examples.

No Tremor runtime components are planned.

## Visual style

Target qualities:

- professional;
- calm;
- high information clarity;
- strong numeric hierarchy;
- semantic status use;
- restrained depth;
- low visual noise.

Avoid:

- glassmorphism;
- excessive gradients;
- huge card walls;
- one color per data category;
- nested card-on-card layouts;
- trading aesthetics.

## Token rules

New analytics components should use existing semantic tokens for:

- surface/background;
- foreground/muted text;
- brand/primary;
- success;
- warning;
- danger;
- borders;
- radius;
- spacing;
- motion duration/easing.

If a chart needs a new reusable semantic series token, add it through the governed token process only after visual reference approval.

## Dark mode

Charts must inherit theme-aware tokens.

Required future QA:

- axes/labels readable;
- grid lines subtle;
- tooltip surface and text pass contrast;
- series remain distinguishable;
- no hard-coded light backgrounds;
- focus rings visible.

## Stitch status

`docs/stitch/DESIGN.md` currently marks HOME references as pending.

Therefore:

- this planning package defines information architecture and behavior;
- it does not certify pixel-perfect final visuals;
- exact geometry/token additions remain `WAITING_FOR_STITCH` unless the human explicitly approves an alternate visual reference in the implementation gate.

## Design acceptance principle

“Looks professional” is not an acceptance criterion.

Visual acceptance will be based on:

- hierarchy order;
- max visible blocks;
- no overflow/clipping;
- token-only values;
- target-size compliance;
- readability;
- state completeness;
- responsive matrix;
- approved visual reference fidelity.
