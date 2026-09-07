# Stitch Visual QA

**Status:** `WAITING_FOR_STITCH`  
**Rule:** no screen receives `PASS` while important visual differences remain.

This is the required comparison record for each completed screen. It must be
filled against the exact Stitch revision listed in `docs/stitch/DESIGN.md`.

## Required viewports

- `390x844` mobile
- `768x1024` tablet interpolation, unless a tablet Stitch reference exists
- `1440x900` desktop

## Per-screen record

```text
ROUTE:
STITCH REFERENCE:
VIEWPORT:
LAYOUT:
TYPOGRAPHY:
SPACING:
COLORS:
IMAGES:
CONTROLS:
NAVIGATION:
RESPONSIVE:
MOTION:
ACCESSIBILITY:
DIFFERENCES:
VERDICT: WAITING_FOR_STITCH | PASS | FAIL
EVIDENCE:
```

`PASS` requires functional behavior to remain compatible with the existing
route, state, auth and backend contracts, plus no material layout,
typography, spacing, imagery, responsive or motion discrepancy. Test both
normal motion and `prefers-reduced-motion: reduce`.

## FE-03 shell evidence attempt — 2026-09-07

Environment: local QA preview at `http://127.0.0.1:4174/`, with the normal
authenticated Chrome session. The served QA build targets
`kpvvydthlxupjjqqdpxy.supabase.co`; no production target was used.

- `390x844`: `BLOCKED` — exact viewport and `scrollWidth` measurement were not
  available through the current normal-Chrome control surface.
- `768x1024`: `BLOCKED` — exact viewport and `scrollWidth` measurement were not
  available through the current normal-Chrome control surface.
- `1024x768`: `BLOCKED` — exact viewport and `scrollWidth` measurement were not
  available through the current normal-Chrome control surface.
- `1440x900`: `PARTIAL` — authenticated shell inspected in Chrome; grouped
  navigation, active state, account, alerts, theme, contextual back and one
  visible logout control were present, but exact viewport dimensions and
  `scrollWidth` were not captured.
- Dark/light: `NOT CERTIFIED` for the exact required viewports.
- Mobile dock and `Mas` sheet: verified by code and focused tests, not granted
  visual PASS without exact running-app evidence.

The existing authenticated visual harness was attempted twice and could not
connect to its CDP endpoint. No prior screenshots were reused as current
proof. FE-03 remains `DONE_WITH_DOCUMENTED_DEBT`; FE-04 must not start until
the four exact viewport measurements and dark/light evidence are captured.
