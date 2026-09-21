# Costa Clean — UX Refinement R1 visual foundation

Status: certified locally; no Production deployment performed.

## Scope

R1 is limited to the approved global foundation:

- UX-01 global surface depth and semantic color hierarchy;
- UX-03 mobile header contract;
- UX-08 safe-area and top-spacing governance;
- UX-09 canonical status geometry.

Dashboard, virtualization, StepFlows, and invoice/quote preview changes remain deferred.

## Before state

The V3 shell already had governed tokens and a single status primitive, but its canvas and surfaces were nearly indistinguishable, KPI content had no shared surface treatment, and the top bar rendered a second Costa Clean mark beside the brand block. Safe-area values existed but were duplicated between the top bar and content padding, making the shell geometry harder to reason about.

## Implemented foundation

### Semantic surfaces

`src/v3/design/tokens.css` now exposes the semantic roles `canvas`, `primary-surface`, `secondary-surface`, `elevated-surface`, `information`, `financial`, `attention`, and `interactive-accent`. Existing V3 surface names remain compatibility aliases so module contracts do not change.

`v3.css` applies a restrained shared card language to V3 sections, detail sections, summaries, and KPIs. The hierarchy uses surface contrast, one-pixel governed borders, radius tokens, and no decorative shadow inflation.

### Header and safe area

`V3ShellChrome` keeps one visible canonical brand mark in the top bar and removes the duplicate right-side mark. The current context remains available beside the brand, while module navigation and back behavior are unchanged. The top bar owns the safe top inset; content no longer adds that inset a second time. The iPad rail also respects the safe top and bottom insets.

### Status system

`V3EntityStatus` remains the only status primitive and `V3Status` remains its compatibility alias. Its governed height, padding, pill geometry, and line-height are unchanged semantically and now remain visually stable beside headings.

## Static governance

Focused V3 governance and shell tests passed: **13/13**.

The governance suite now asserts the semantic surface roles and prevents reintroduction of the removed top-bar duplicate mark.

## Visual certification

Required contract matrix: `320x568`, `390x844`, `430x932`, `768x1024`, `820x1180`, `834x1194`, `1024x1366`, `1280x800`, `1440x900`, `1920x1080`.

The first runner failure was isolated to stale Edge processes using the ignored `qa-browser-profile`: Edge was present and executable, but the runner waited on a different stale CDP port. No permission error, port collision on the verified port, or product startup error was found. Recovery reused only the disposable QA profile, started the local preview on `http://127.0.0.1:4178/?v3=1`, and connected to the profile's active CDP port. The normal Edge profile was not touched.

The authenticated visual runner then completed every configured surface and flow as `ok` at the native matrix viewports (`1280x800`, `1366x768`, `1440x900`, `1536x864`, `1728x1117`, `1920x1080`, `2560x1440`, `1024x1366`, `834x1194`, `768x1024`, `430x932`, `390x844`). The runner was minimally extended with `ipad-820` (`820x1180`) and `mobile-320` (`320x568`); both targeted runs also completed every surface and flow as `ok`. Total evidence: **14 viewports, 182 surface/flow cases, 0 failures**.

The independent read-only audit at `390x844` confirmed: authenticated shell, 15 document navigations with HTTP 200, 0 production Supabase requests, 0 non-QA Supabase requests, 0 QA business mutations, 0 failed requests, 0 console errors, 0 page errors, 0 overflow viewports, successful search roundtrip, and successful open/close/focus restoration for Más. Touch measurements were at least 44px high.

Fresh screenshot review covered Home at `320x568`, `390x844`, and `820x1180`, plus the full screenshot set from the authenticated matrix. The review found the app materially less flat, semantic surface contrast without excessive shadows, one visible Costa Clean mark in the mobile header, readable page context, stable status geometry, no overlap, no horizontal overflow, and no new P0/P1/P2/P3 findings.

## Quality gates

- Focused tests: PASS — 13/13.
- Build: PASS.
- Full test suite: PASS — 168 files, 888 passed, 4 skipped.
- Agents: PASS — 294/294.
- Lint: PASS.
- Build: PASS.
- Diff check: PASS before documentation-only update; rerun required after this update.
- Production deployment: NO.
- Production mutations: 0.
- Supabase production mutations: 0.
- Business logic changes: 0.

## Deferred roadmap

R2–R6 remain explicitly deferred in `docs/V3_UX_REFINEMENT_ROADMAP.md`.
