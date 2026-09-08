# Costa Clean App V3 — Roadmap

## V3-0E — Editorial SaaS Simplified clean final Stitch export

Current state: the existing Stitch project `6884707630640107069` contains the 13-screen Editorial SaaS Simplified final set. Obsolete frames were removed from the active canvas and excluded from the clean ZIP. V3-0E is human-approved; no production implementation was made in that gate.

- [x] Preserve only functional learnings from the rejected set.
- [x] Select Editorial SaaS Simplified as the sole V3 visual direction.
- [x] Complete and verify the 13-screen final Stitch inventory.
- [x] Remove/archive obsolete frames from the active Stitch canvas.
- [x] Export and inventory the clean ZIP with zero obsolete screens.
- [x] Document `V3_USEFUL_STITCH_FEATURE_BACKLOG` and classify proposals A/B/C/D.
- [x] Run regression gates required for this docs/export-only block.
- [x] Human final approval of the direction.
- [x] Complete screen-by-screen Stitch visual PASS at the approved anchors.

## V3-1R — Full structural redesign + invoice vertical slice — CLOSED

- [x] Add reversible V3 tokens, primitives and reduced-motion/safe-area rules.
- [x] Replace the V2 shell branch with a dedicated V3 shell chrome.
- [x] Replace the V2 invoice list/workspace tree with dedicated V3 components.
- [x] Add Design Guardian structural/token checks.
- [x] Preserve real PDF, settlement, lifecycle and deep-link contracts.
- [x] Complete authenticated visual QA at 390x844 and 430x932.
- [x] Complete 768x1024 regression and desktop no-regression.
- [x] Close V3-1R with QA evidence and final commit/push.

## V3-2A — Clients + real contact actions — CLOSED

- [x] Add dedicated `src/v3/clients/` list and full-screen client workspace.
- [x] Render only real client, property, service, quote, invoice, payment and recurring-plan relations.
- [x] Add guarded WhatsApp, `tel:` and `mailto:` actions with valid-number/email checks.
- [x] Connect contextual invoice and quote creation to existing financial/commercial flows with client prefills.
- [x] Preserve `?v3=1&view=clients&client=<id>` and list/back restoration.
- [x] Add dedicated-tree, deep-link, contact URL and workspace tests.
- [x] Complete authenticated QA at 390x844, 430x932 and 768x1024.
- [x] Close with lint, build, full tests, commit and push.

## V3-2 — Core entity workspaces

- Invoice, quote, client, lead and service list/workspace patterns.
- Keep real data adapters and business logic unchanged.
- Add visual QA and interaction evidence before expanding.

## V3-3 — Financial and secondary surfaces

- Apply the approved patterns to payments, expenses, alerts, closings and configuration.
- Preserve selection, downloads, exports, lifecycle and duplicate flows.

## Exit rule

V3-1R and V3-2A are closed with authenticated QA evidence and no financial,
route, auth or deep-link regression. V3-2B remains a separate future sprint and
is not started by this change.
