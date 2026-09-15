# V3-10C1 — Core Certified Findings Correction

Status: `CLOSED / CERTIFIED`

Starting HEAD: `3d7d6364da8af9cc1d549e0b5aa97e4fb4a54393`
Branch: `codex/app-v3-mobile-first-redesign`

This slice corrected only the three open V3-10B product findings. It did not start
V3-10C2, add GSAP, change Supabase, write business data, deploy production or alter
protected invoice, quote, payment, expense, service, alert or closing contracts.

## Findings and root causes

### V3Q-P2-001 — canonical login logo

`AuthPage` already rendered `brandAssets.logoPrimary`; the V3-only stylesheet rule
hid `.auth-brand__logo`. The correction removes only that hide behavior and gives the
existing canonical asset a restrained proportional size (`112px` at the primary
mobile viewport, capped at `144px` with a `120px` height cap). The form remains the
primary decision surface and the asset remains `/branding/logo-primary.png` from the
authoritative registry.

Independent login replay: visible at `390x844`, `768x1024` and `1440x900`, with
natural image width present and accessible alt text `CostaClean`.

### V3Q-P2-002 — shared 44px touch target

The root cause was duplicated `40px` minimum geometry in the shared V3 contact and
ghost-action rules. Both now use the existing `--v3-touch-min` token (`44px`). No
component-by-component patch or density redesign was introduced.

The full authenticated 8-viewport replay measured `352` rendered contact actions at
`44px`. Ghost actions were not rendered in the QA data state and therefore remain
honestly N/A at runtime; their shared rule is tokenized to the same 44px contract.

### V3Q-P3-001 — blocking document alerts

The root cause was direct `window.alert` ownership in the clipboard fallback and
popup-blocked print helpers. The existing `ToastProvider` is now the feedback path:
clipboard success/failure receives the caller's toast API, and quote popup failure
returns a boolean so the V3 document screen can show actionable, dismissible guidance.
The invoice legacy helper also fails without a native alert; the existing V3 invoice
output path already reports errors inline.

Focused tests cover clipboard success/failure and popup-blocked output. Static source
audit: `window.alert` in `src` = `0` (test helper functions named `alert` are not
runtime alerts).

## Visual evidence

Private ignored captures were generated for login and contact actions at:

- `390x844`
- `768x1024`
- `1440x900`

They live under `qa-reports/private/v3-10c1/` and contain QA data; no screenshots
are committed. The initial login capture was taken against a stale preview before
the first rebuild and is blank, so it is not treated as visual evidence. The
post-rebuild login capture, the valid contact before/after captures, and the
authenticated geometry/runtime report are the authoritative C1 evidence.

## Runtime evidence

The authenticated read-only V3-10B harness was rerun after rebuilding the local app:

- 8/8 authenticated viewports
- 96/96 surface navigations
- 120/120 main documents HTTP 200
- 40 search-miss PASS, 48 N/A, 0 FAIL
- 8/8 search roundtrips
- 8/8 Escape open and close assertions
- 0 production requests
- 0 QA mutations
- 0 console errors, page errors or failed requests
- 0 horizontal overflow, UUID leaks, Unicode-as-icon matches or legacy markers
- 0 broken images
- contact geometry 44px in every rendered measurement

The focused runtime report is private at
`qa-reports/private/v3-10c1/core-corrections-runtime.json`.

## Accessibility and protected contracts

- Canonical logo remains an image with accessible alt text and preserved aspect ratio.
- Contact and ghost actions retain the shared focus treatment and meet the 44px target
  where rendered.
- Toast feedback uses the existing `role="status"`/`role="alert"` live-region
  implementation, remains dismissible and preserves retry guidance.
- `window.alert` is not used by the covered V3 document paths.
- No protected business contract files were changed.
- QA writes, business-data writes and production deployment were `0`.

## Validation and independent review

The required project-agent contracts were read in the requested order. The local
independent review checks the diff, focused tests, static alert audit, canonical asset
registry, runtime geometry, authenticated read-only matrix and protected-file scope.
The `pr-quality-gate` review is required to PASS before closure.

## Remaining risks

- V3Q-P3-002 remains historical `RESOLVED_BY_EVIDENCE`; no product fix is claimed.
- Ghost action runtime geometry remains N/A when no ghost action is rendered by the
  available QA records.
- Broader token, container, typography and teal/brand-system refinement belongs to
  V3-10C2 and has not started.

## Scope boundary

`V3-10C2` has not started. This document closes only V3-10C1 core corrections.
