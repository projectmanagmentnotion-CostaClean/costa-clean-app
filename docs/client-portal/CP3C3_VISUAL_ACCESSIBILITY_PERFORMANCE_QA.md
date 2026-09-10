# CP-3C.3 Visual, Accessibility, Responsive And Performance QA

Date: 2026-09-10
Target: local QA build and synthetic Portal preview only  
Certified source: `636523f` plus the bounded `Más` focus fix in this block  
Status: `PARTIAL — P1 fixed; final native-tool and authenticated-state evidence remains`

## Boundary

- Portal only. No CRM UI, CRM contracts or production environment were changed.
- No Supabase migration, policy, Edge Function, Auth or Storage change was made.
- Preview data is synthetic and is not a customer record.
- CP-4 remains not started.

## Device Matrix

| Device | Viewport | Overflow | Responsive result | Evidence |
|---|---:|---|---|---|
| iPhone | 390x844 | `scrollWidth = 390` | PASS for audited states | Playwright QA preview |
| iPad | 768x1024 | `scrollWidth = 768` | PASS for audited states | Playwright QA preview |
| Desktop | 1440x900 | `scrollWidth = 1440` | PASS for audited states | Playwright QA preview |

The exact authenticated browser session was not resized by the available CUA
surface in this block. The exact 390x844 visual contract therefore remains
backed by the existing approved evidence plus the automated synthetic preview
check, not by a new authenticated screenshot in this block.

## Audited States

| State family | Result | Notes |
|---|---|---|
| Login / Google CTA / password fields | PASS | Accessible names, labels, errors and 44px controls present |
| Inicio / Cuenta / Inmuebles / property detail | PASS | Synthetic preview loaded without console errors or horizontal overflow |
| Servicios / solicitudes / Facturas | PASS | Synthetic preview loaded without console errors or horizontal overflow |
| Más bottom sheet | PASS after fix | Focus enters, Tab cycles, Escape closes, focus returns |
| WhatsApp | PASS | `wa.me/34698911517`, visible and named on authenticated surfaces |
| Onboarding, invitation, member, legal, error variants | NOT_REEXECUTED_IN_THIS_BLOCK | Existing CP-3B/CP-3C evidence remains authoritative; full matrix is deferred |

## Visual Fidelity

The approved iPhone composition, six-control navigation and Coastal Luminous
direction were not redesigned. The only visual-adjacent change is semantic
focus behavior for the existing `Más` control. No material Stitch difference
was introduced.

## Accessibility

| Check | Result |
|---|---|
| Visible interactive targets | PASS; no audited visible target below 44px |
| Form labels and field errors | PASS by existing portal guardrails and accessibility tree |
| Landmarks / headings / accessible names | PASS for audited login and active portal states |
| Reduced motion | PASS; `prefers-reduced-motion: reduce` active and transition reduced |
| Más focus management | PASS after bounded fix |
| Automated axe scan | NOT_AVAILABLE; axe is not installed in the repository |
| Native screen reader | NOT_AVAILABLE |
| 200% browser zoom | NOT_EXECUTED; available browser harness has no zoom control |

The accessibility tree was inspected with Playwright. No NVDA, VoiceOver or
JAWS result is claimed.

## Performance

Measurement mode: production-like QA build served by `vite preview` on localhost.

| Route family | DOM ready | Load event | CLS | Errors |
|---|---:|---:|---:|---|
| Login, Inicio, Inmuebles, Facturas, Cuenta | 9–26ms | 16–38ms | 0 | 0 |

LCP and reliable lab INP were not exposed by the available run; therefore no
invented values are reported. `INP LAB = NOT DIRECTLY AVAILABLE`.
Lighthouse was not available in the environment. Standard QA lab targets remain
the reference thresholds: LCP <= 2.5s, CLS <= 0.10 and INP <= 200ms.

## Defects And Fixes

| Severity | Defect | Resolution |
|---|---|---|
| P1 | `Más` left focus on its trigger, did not close with Escape and had no focus cycle/return | Fixed in `PortalWorkspaceView.tsx`; regression guard added |
| P0 | None found | None |
| P2 | None newly found | None |

## Quality Results

- Portal-focused tests: `76/76 PASS`.
- Full default suite: `643 PASS`, `4 skipped`, no timeout in the isolated final
  run. A concurrent earlier run exposed the known slow `cp3b2a*` checks; the
  established higher-timeout diagnostic passed `643/643`.
- `npm run lint`: PASS.
- `npm run build -- --mode qa`: PASS.
- `git diff --check`: PASS.
- Production requests/writes/deploys/auth mutations: `0`.

## Fixture And External Debts

CP3C-created QA fixtures were not cleaned because CP-3C.3 did not fully close;
the exact cleanup authorization remains available for a future completed gate.
The private ledgers remain ignored and untracked.

- Google source/UI: implemented.
- Google provider QA/runtime: `PRIVATE_CONFIG_PENDING` / `NOT_EXECUTED`.
- Invitation email delivery: `DEFERRED_CP4_3`.

## Gate Decision

`CP-3C.3 = PARTIAL`. The bounded P1 was fixed and the audited responsive portal
surface is clean, but native-reader/zoom/Lighthouse evidence and the complete
authenticated state matrix were not available in this run. Do not promote this
to `DONE` or start CP-4.1 automatically.

Next action: run the remaining authenticated visible state matrix with a tool
that supports exact viewport control, native accessibility tooling, browser
zoom and Lighthouse, then rerun the same checks before cleanup and closeout.

## CP-3C.3R Final Remediation / Closeout

Date: **2026-09-10**
Status: `PARTIAL — automated accessibility remediation passed; authenticated and native-tool gates remain open`

### Automated evidence

- `npm run qa:visual:a11y`: `PARTIAL`. Axe reported `0` violations after the
  bounded contrast and landmark remediation across 14 synthetic scenarios at
  `390x844` and `1440x900`.
- Horizontal overflow remained `false` in every scenario.
- The members preview emitted two `401` console errors at each viewport. This
  is recorded as an unauthenticated preview limitation/defect, not suppressed.
- `@axe-core/playwright` is dev/test-only; it is not imported by runtime code.

### Bounded remediation

- Darkened the existing small-text brand token from `#0088BD` to `#006F9B` and
  the approved success/WhatsApp text surfaces to meet WCAG AA contrast.
- Wrapped the persistent WhatsApp action in a labeled complementary landmark so
  it is represented correctly in the accessibility tree.
- No route, Supabase, CRM, production, auth contract or business logic changed.

### Evidence limitations that remain

- Reused local QA storage states redirected to `/portal/login`; no authenticated
  device matrix could be claimed from them.
- Exact native screen-reader output, browser 200% zoom and Lighthouse scores
  remain `NOT_AVAILABLE` / `NOT_EXECUTED`. Lighthouse startup was blocked by
  Windows `EPERM` while cleaning its temporary profile.
- The existing approved authenticated visual evidence remains authoritative for
  the previously certified portal states; new exact authenticated screenshots
  were not created in this block.

### Gate decision

`CP-3C.3 = PARTIAL`. The automated accessibility and reflow evidence is clean
after remediation, but authenticated state coverage, the members preview 401s,
native-reader/zoom evidence and Lighthouse remain unresolved. CP-4.1 is not
started and CP3C fixtures remain retained.

## CP-3C.3R2 Final Closeout

Date: **2026-09-10**
Status: `PARTIAL — preview defect fixed; authenticated matrix and LCP budget remain open`

### QA harness

- Authentication root cause: `LEGACY_MANUAL_PROFILE_HARNESS`.
- Deterministic UI-login runner added at
  `scripts/client-portal/cp3c3r2AuthenticatedVisualQa.mjs`; it uses isolated
  Playwright contexts and never injects service-role credentials or writes
  storage state.
- Runner result: `NOT_EXECUTED_PRIVATE_CREDENTIAL_INPUT_MISSING`. The required
  ignored `.auth/cp3c3/credentials.json` is absent; no credentials were
  inferred from browser profiles or printed.
- Portal Auth was not modified.

### Preview isolation

- `PortalAccountAdapter` now selects the existing production Edge actions only
  outside preview, and a deterministic synthetic adapter inside preview.
- Active-admin preview has a synthetic self, member and pending invitation;
  active-member preview exposes only member-safe state. Marketing preference
  changes remain local to the preview adapter.
- `npm run qa:preview:network`: PASS. Members and marketing emitted zero
  `portal-member-actions`/`portal-account-actions` requests and zero console
  errors, including the prior 401s.

### Final automated evidence

- `npm run qa:visual:a11y`: PASS, `0` violations across 14 scenarios and
  `390x844`/`1440x900`; overflow `false` everywhere.
- CDP zoom attempt: `Emulation.setPageScaleFactor(2)`. This is recorded as a
  CDP scale attempt, not native browser zoom certification.
- Reflow fallback at `320px`: PASS; html/body width `320`, no clipped controls.
- Native screen reader: `NOT_AVAILABLE_NONBLOCKING_TOOL_LIMIT`.
- Lighthouse via one pre-launched Chrome CDP workaround: Accessibility `1.00`,
  Best Practices `1.00`, CLS `0`, TBT `5ms`, LCP `5558.7ms`.
- LCP exceeds the QA target of `2500ms`; no performance pass is claimed.
- `npm run qa:performance:evidence`: PASS for no overflow and navigation timing;
  LCP was unavailable through the page observer in this harness and is not
  substituted for the Lighthouse LCP result.

### Gate decision

`CP-3C.3 = PARTIAL`. The preview 401 defect is fixed, Axe/keyboard/focus/
landmarks/reflow are clean, and production requests remain zero. The gate
cannot close because the required authenticated identity matrix was not run
without private credentials and the Lighthouse LCP budget is exceeded.
CP3C fixtures remain retained; no cleanup was attempted. CP-4.1 remains not
started.

## CP-3C.3R3 Final Authenticated Matrix + LCP Performance Remediation

Date: **2026-09-10**
Status: `PARTIAL — authenticated matrix blocked; LCP improved but remains above budget`

### Credential and authentication gate

- Required QA password rotation was not performed: no safe private admin
  channel or service-role credential was available in this workspace.
- `.auth/cp3c3/credentials.json` was not created or inferred. The deterministic
  authenticated runner returned `NOT_EXECUTED_PRIVATE_CREDENTIAL_INPUT_MISSING`.
- No Auth, database, Edge Function, Supabase or production mutation occurred.

### Preview, responsive and accessibility evidence

- `npm run qa:visual:a11y`: PASS; 14 synthetic scenarios at `390x844` and
  `1440x900`, 0 axe violations, 0 console errors and overflow `false`.
- `npm run qa:preview:network`: PASS; 0 portal action requests, 0 console
  errors and 0 production requests in preview.
- `npm run qa:performance:evidence`: PASS for 390px width, no horizontal
  overflow, CLS `0` and production requests `0`; its observer does not provide
  a substitutable LCP value.
- CDP scale and 320px reflow evidence remain non-native zoom substitutes as
  recorded in R2. Native screen-reader evidence remains unavailable.

### Lighthouse performance evidence

- Baseline, three runs: LCP `5559.475`, `5556.9722`, `5557.4032 ms`; median
  `5557.4032 ms`; CLS `0`.
- The LCP element is `.portal-auth__intro`. The concrete avoidable cost was
  `Costa_Clean-LOGO-AZUL.png` at 564,779 bytes and 5952x4380.
- Remediation uses the existing `logo-costa-clean.svg` plus an image preload;
  no visual design or route contract changed.
- Post-remediation, three runs: LCP `2704.4811`, `2703.9592`, `2705.1286 ms`;
  median `2704.4811 ms`; CLS `0`; TBT `16`, `5`, `15.21785 ms`;
  Accessibility `1.00`; Best Practices `1.00`; Performance `0.96`.
- LCP improved by `2852.9221 ms` (about 51.3%), but remains `204.4811 ms`
  above the `2500 ms` QA target. No LCP PASS is claimed.

### Regression and closeout decision

- `npm test`: default 5s timeout reproduced two historical slow-test timeouts;
  rerun with `--testTimeout=20000`: 106 files passed, 643 tests passed,
  4 skipped.
- `npm run lint`: PASS.
- `npm run build -- --mode qa`: PASS.
- CP3C fixtures remain retained because authenticated and performance gates are
  open. CP-4.1 and CP-3C.4 are not started.

Gate decision: `CP-3C.3 = PARTIAL` with
`AUTHENTICATED_MATRIX_BLOCKED_PRIVATE_CREDENTIAL_INPUT_MISSING` and
`LCP_ABOVE_2500MS_AFTER_BOUNDED_REMEDIATION`.
