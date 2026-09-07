# Costa Clean App V3 — Roadmap

## V3-0B — Rediseño visual completo + Stitch

Current state: three new V3-0B Stitch directions are generated and documented; old Directions A/B/C are rejected. Human visual approval is pending. No implementation, route, auth, Supabase or financial logic was changed in this work block.

- [x] Preserve only functional learnings from the rejected set.
- [x] Generate Finance Minimal, Friendly Business and Editorial SaaS in Stitch.
- [x] Prompt the complete 12-screen mobile-first set for each direction.
- [x] Record canvas evidence, links, project IDs, recommendation and trade-offs.
- [x] Define the candidate palette, typography, KPI hierarchy and navigation alternatives.
- [x] Run regression gates required for a docs-only block.
- [x] Commit and push the documentation block.
- [ ] Human approval of one direction.
- [ ] Complete screen-by-screen visual PASS at 390x844, 768x1024 and 1440x900.

## V3-1 — Mobile shell prototype (after V3-0B approval)

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

Do not start V3-1 until one V3-0B direction is human-approved and the complete 12-screen Stitch review has a visual PASS or an explicit documented exception at the required anchors.
