# Costa Clean Stitch Design Extraction

**Status:** `WAITING_FOR_STITCH`  
**Authority:** approved Google Stitch reference for the exact screen being
implemented. This file is an extraction record, not a design proposal.

## Operating rule

Do not fill this file from taste, the current frontend, stock media or a
generic design system. Create one completed section per supplied Stitch screen
after inspecting both its visual reference and its exported structure. If the
reference is missing, keep the section pending and do not implement final UI.

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

## Extraction schema

For each screen, record exact observed values or `not provided`; never infer a
value and present it as Stitch-approved:

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
- `exceptions`: only critical accessibility, security, technical or functional
  conflicts, with evidence and the least-divergent resolution.

## Derivation sequence

`STITCH reference -> visual extraction -> this DESIGN.md -> tokens -> components -> pages`

The existing application and Supabase contracts define behavior and data, not
the visual values in this file. Missing visual evidence remains
`WAITING_FOR_STITCH`.
