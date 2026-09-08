# Costa Clean App V3 — Roadmap

## V3-0E — Editorial SaaS Simplified clean final Stitch export

Current state: the existing Stitch project `6884707630640107069` contains the 13-screen Editorial SaaS Simplified final set. Obsolete frames were removed from the active canvas and excluded from the clean ZIP. No implementation, route, auth, Supabase or financial logic was changed in this work block. Human final approval remains pending.

- [x] Preserve only functional learnings from the rejected set.
- [x] Select Editorial SaaS Simplified as the sole V3 visual direction.
- [x] Complete and verify the 13-screen final Stitch inventory.
- [x] Remove/archive obsolete frames from the active Stitch canvas.
- [x] Export and inventory the clean ZIP with zero obsolete screens.
- [x] Document `V3_USEFUL_STITCH_FEATURE_BACKLOG` and classify proposals A/B/C/D.
- [x] Run regression gates required for this docs/export-only block.
- [ ] Human final approval of the direction.
- [ ] Complete screen-by-screen visual PASS at 390x844, 768x1024 and 1440x900.

## V3-1 — Mobile shell prototype (after V3-0C approval)

- Implement only an isolated visual sandbox or feature-flagged shell.
- Prove 390x844 and 768x1024 first; then validate 1440x900.
- Do not migrate production modules yet.
- Protect routes, auth, Supabase and financial contracts.

## V3-2 — Core entity workspaces

- Invoice, quote, client, lead and service list/workspace patterns.
- Keep real data adapters and business logic unchanged.
- Add visual QA and interaction evidence before expanding.

## V3-3 — Financial and secondary surfaces

- Apply the approved patterns to payments, expenses, alerts, closings and configuration.
- Preserve selection, downloads, exports, lifecycle and duplicate flows.

## Exit rule

Do not start V3-1 until V3-0C is human-approved and the complete requested Stitch review has a visual PASS or an explicit documented exception at the required anchors.
