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
