# Costa Clean App V3 — Roadmap

## V3-0C — Editorial SaaS Simplified final visual gate

Current state: the Editorial SaaS Simplified prompt was submitted to the existing Stitch project `6884707630640107069`. Stitch generated simplified Home and Facturas list, but not the complete requested set; the gate is partial and human final approval is pending. No implementation, route, auth, Supabase or financial logic was changed in this work block.

- [x] Preserve only functional learnings from the rejected set.
- [x] Select Editorial SaaS Simplified as the sole V3-0C visual direction under review.
- [x] Submit the simplified mobile-first prompt in the existing Stitch canvas.
- [x] Record partial Stitch evidence, contract review and no-action decisions.
- [x] Define the candidate palette, typography, KPI hierarchy and navigation alternatives.
- [x] Run regression gates required for a docs-only block.
- [ ] Complete Stitch generation of all requested screens.
- [ ] Remove remaining invented copy/actions from the final Stitch evidence.
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
