# Stitch Visual Parity Scaffold

This folder contains the visual-only scaffold for the Stitch parity prototype.

## Files

- `stitchAssets.ts`: local asset paths, visual measurements and pure avatar helpers.
- `stitchVisualParity.css`: scoped shell, list, KPI, avatar, master-detail and responsive primitives.

## Activation rule

The stylesheet is intentionally scoped under `.cc-stitch-prototype`.

It must not be imported globally and activated across the whole app in one uncontrolled change. Codex must integrate it block by block and place the class only on the prototype root after inspecting the existing shell and cascade.

## Functional boundary

These files may support presentation only. They must not define or change:

- data loading;
- queries or mutations;
- authentication;
- routes or `AppView`;
- persistence;
- business validation;
- financial or fiscal calculations;
- document state;
- operational consequences.

## Avatar rules

1. Use an authorized real avatar URL when available.
2. Fall back to the local SVG defined in `stitchAssets.ts`.
3. Use initials as a final fallback when the image cannot load.
4. Company clients use a business/building visual, not a fabricated portrait.
5. Never commit private profile photographs or Stitch-hosted remote URLs.

## Integration order

1. Shell and navigation.
2. Splash, login and Home.
3. Clients, Properties and Workspaces.
4. Guided creation flows.
5. Operational master-detail modules.
6. Alerts, Expenses and Fiscal Closing.
7. Responsive/accessibility QA.

Read the canonical specification and implementation plan before using these primitives.
