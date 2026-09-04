# Costa Clean Stitch Design Extraction

**Status:** `WAITING_FOR_STITCH`  
**Authority:** approved Google Stitch reference for the exact screen being implemented  
**Governance:** `docs/stitch/DESIGN_SYSTEM_CONSTITUTION.md`

This file is the canonical extraction record for Stitch-approved visual values. It is not a design proposal. The constitution defines the strict component/system rules; this file fills those rules with observed values from approved Stitch references.

## Operating rule

Do not fill this file from taste, the current frontend, stock media or a generic design system. Create one completed section per supplied Stitch screen after inspecting both its visual reference and its exported structure. If the reference is missing, keep the section pending and do not implement final UI.

All reusable values extracted here become shared design tokens when justified by repeated Stitch evidence. Once approved and reused, they are locked under the change-control rules in `DESIGN_SYSTEM_CONSTITUTION.md`.

## Mobile-first extraction rule

For every screen with a mobile reference:

1. extract the mobile composition independently;
2. implement and validate `390x844` first;
3. verify fail-safe behavior at `320px` where applicable;
4. interpolate/implement tablet and validate `768x1024`;
5. implement desktop from its reference and validate `1440x900`.

Desktop approval never overrides an unresolved mobile discrepancy.

## Screen registry

| Screen | Stitch desktop | Stitch mobile | Tablet source | Status | Route/contract owner |
|---|---|---|---|---|---|
| HOME | pending | pending | interpolate only | WAITING_FOR_STITCH | public-web decision pending |
| SERVICE LANDING TEMPLATE | pending | pending | interpolate only | WAITING_FOR_STITCH | public-web decision pending |
| QUOTE REQUEST / initial | pending | pending | interpolate only | WAITING_FOR_STITCH | existing lead contract |
| QUOTE REQUEST / intermediate | pending | pending | interpolate only | WAITING_FOR_STITCH | existing StepFlow contract |
| QUOTE REQUEST / confirmation | pending | pending | interpolate only | WAITING_FOR_STITCH | existing lead contract |
| PORTAL LOGIN | pending | pending | interpolate only | WAITING_FOR_STITCH | `src/portal/auth` |
| PORTAL HOME | pending | pending | interpolate only | WAITING_FOR_STITCH | `src/portal` |
| PORTAL LIST/DETAIL | pending | pending | interpolate only | WAITING_FOR_STITCH | portal contracts |
| INVOICES / list | pending | pending | interpolate only | WAITING_FOR_STITCH | portal invoice contract |
| INVOICES / detail | pending | pending | interpolate only | WAITING_FOR_STITCH | private document contract |

## Global token registry

Do not assign numeric/aesthetic values until Stitch evidence exists.

| Token family | Status | Source |
|---|---|---|
| colors | WAITING_FOR_STITCH | pending approved screen(s) |
| typography | WAITING_FOR_STITCH | pending approved screen(s) |
| spacing | WAITING_FOR_STITCH | pending approved screen(s) |
| grid / containers | WAITING_FOR_STITCH | pending approved screen(s) |
| radii | WAITING_FOR_STITCH | pending approved screen(s) |
| borders | WAITING_FOR_STITCH | pending approved screen(s) |
| shadows / elevation | WAITING_FOR_STITCH | pending approved screen(s) |
| button geometry / states | WAITING_FOR_STITCH | pending approved screen(s) |
| form-control geometry / states | WAITING_FOR_STITCH | pending approved screen(s) |
| icons | WAITING_FOR_STITCH | pending approved screen(s) |
| media ratios / crops | WAITING_FOR_STITCH | pending approved screen(s) |
| navigation geometry | WAITING_FOR_STITCH | pending approved screen(s) |
| motion / easing / duration | WAITING_FOR_STITCH | pending approved screen(s) |
| layering / overlays | WAITING_FOR_STITCH | pending approved screen(s) |

## Extraction schema

For each screen, record exact observed values or `not provided`; never infer a value and present it as Stitch-approved:

- `reference`: filename, URL or supplied asset identifier and revision;
- `viewport`: reference viewport and capture scale;
- `page_max_width`, `container_width`, `grid`, `columns`, `gutters`;
- `section_spacing`, `component_spacing`, `alignment`, `whitespace`;
- `typography`: family, size, weight, line height, letter spacing;
- `color`, `border`, `radius`, `shadow`, `opacity`;
- `icon_dimensions`, `button_dimensions`, `form_control_dimensions`;
- `image_source`, `aspect_ratio`, `crop`, `object_position`;
- `navigation_geometry`, CTA placement and responsive reordering;
- `motion`: only transitions/reveals visibly justified by Stitch;
- `accessibility`: contrast, focus, labels, target size and reduced motion;
- `functional mapping`: existing route, state machine and backend contract;
- `exceptions`: only critical accessibility, security, technical or functional conflicts, with evidence and the least-divergent resolution.

## Component extraction registry

Populate each family only when Stitch supplies enough evidence. Every implemented family must comply with the constitution.

- Buttons: primary, secondary, tertiary/ghost, destructive, icon.
- Hero: marketing hero anatomy, media, CTA hierarchy and mobile order.
- Cards: informational, interactive, entity/list, metric, selected option, status.
- Typography: display, headings, body, labels, captions, button labels, data.
- Forms: inputs, textarea, select, checkbox, radio, switch, validation, StepFlow.
- Navigation: public header, mobile menu, portal shell, contextual nav, footer.
- Lists/tables: row density, mobile transformation, actions, filters.
- Status: badges, chips, semantic states.
- Disclosure: tabs, segmented controls, accordions.
- Overlays: modal, dialog, sheet, popover, menu.
- Feedback: alerts, banners, toasts, inline messages.
- System states: loading, skeleton, empty, error, forbidden.
- Media: iconography, imagery, photography, video, decorative assets.
- Legal/consent: cookie, privacy and consent controls.
- Marketing CTA: WhatsApp, call, quote/contact controls.

## Derivation sequence

`STITCH reference -> visual extraction -> this DESIGN.md -> approved tokens -> shared components -> pages -> visual QA`

The existing application and Supabase contracts define behavior and data, not the visual values in this file. Missing visual evidence remains `WAITING_FOR_STITCH`.
