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

## CP-3C.3R6 — Portal Entry Waterfall Investigation

Date: **2026-09-14**
Status: `PARTIAL_AUTH_AND_PERFORMANCE`

### Baseline waterfall

- Lighthouse baseline LCP: `2554.5803`, `2704.3279`, `2704.1377 ms`;
  median `2704.1377 ms`.
- LCP element remained `.portal-auth__intro`.
- Current request sequence was verified: main entry
  `index-Lv8rbS0l.js` (`3,034 bytes` transfer) completed around `34.9 ms`,
  then `bootstrapPortal-Cl6pUHt1.js` began around `43.5 ms` and transferred
  `32,374 bytes`. Portal entry discovery is therefore sequential after main
  module execution.
- The eight initial script requests transferred `168,952 bytes` in the
  production-like QA run. This includes the Portal dependency chunks and does
  not include CRM page chunks.

### Static-entry A/B

- Temporary static Portal import removed the sequential Portal entry request.
- Static A/B LCP: `2576.5833`, `2577.7615`, `2578.1675 ms`; median
  `2577.7615 ms`, an improvement of `126.3762 ms` versus baseline, but still
  `77.7615 ms` above the `2500 ms` target.
- Static entry produced a `559.81 KB` main JavaScript chunk and transferred
  `165,790 bytes` across its initial scripts, versus the isolated dynamic
  entry's `3.03 KB` main request. It would pull Portal code into CRM startup.
- Decision: waterfall hypothesis is **partially confirmed as a contributor**,
  but static import is rejected because it misses the LCP budget and violates
  the stronger Portal/CRM startup isolation boundary.

### Final architecture and final evidence

- Dynamic Portal import restored; CRM import remains dynamic. No CRM source or
  behavior was changed and no hashed entry was hardcoded into HTML.
- Final dynamic-entry Lighthouse LCP: `2703.842`, `2704.5891`, `2554.016 ms`;
  median `2703.842 ms`. CLS `0`; TBT `4`, `6`, `2 ms`; Accessibility `1.00`;
  Best Practices `1.00`.
- Final architecture keeps the existing separated bundles. No further
  speculative performance source change is authorized in this block.
- CRM startup smoke: source boundary remains isolated; no CRM route or UI was
  modified. Production requests/writes remain `0`.

### Regression and gate

- Axe: PASS, 0 violations; preview network: PASS, 0 action requests.
- Responsive/reflow evidence remains PASS at `390x844`, `768x1024`,
  `1440x900` and `320px`.
- Full tests: 106 files, 643 passed, 4 skipped; lint PASS; QA build PASS;
  diff check PASS.
- Authenticated matrix remains `BLOCKED_EXTERNAL_PRIVATE_INPUT`; private
  credential handoff remains active and fixtures remain protected.

Gate decision: `CP-3C.3 = PARTIAL_AUTH_AND_PERFORMANCE`. CP-4.1 was not
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

## CP-3C.3R4 Final Two-Blocker Closeout

Date: **2026-09-10**
Status: `PARTIAL — authenticated matrix blocked; LCP remains above budget`

### Portal/CRM boundary

- `src/main.tsx` dynamically imports `./portal/bootstrapPortal` for `/portal`
  and `./bootstrapCrm` for CRM. Portal/CRM bootstrap isolation: `PASS`.
- No CRM source, route, Supabase schema, production environment or tenancy
  behavior was changed.

### Lighthouse baseline and motion A/B

- Same QA preview build, route `/portal/login`, CDP port `9229`, and Lighthouse
  methodology were used for all measurements.
- Current-motion baseline LCP: `2704.6758`, `2704.1654`, `2704.4182 ms`;
  median `2704.4182 ms`.
- Motion-off experiment using the existing preview-only
  `portalReducedMotion=1` switch: `2703.6125`, `2703.9493`, `2703.7562 ms`;
  median `2703.7562 ms`.
- The difference is `0.6620 ms`; motion is not the LCP cause. The experiment
  was not committed as a production behavior change.

### LCP diagnosis and decision

- LCP element remains `.portal-auth__intro`.
- The prior concrete resource issue was the 564,779-byte 5952x4380 logo PNG;
  the existing SVG plus preload remains the bounded fix.
- Lighthouse breakdown shows fast document response and no CSS waste; the
  remaining delay is after the initial document/resource phase while the
  portal bootstrap and React render the auth surface. No further speculative
  rewrite is justified by this A/B.
- Final post-fix LCP: `2704.4811`, `2703.9592`, `2705.1286 ms`; median
  `2704.4811 ms`. CLS `0`; TBT `16`, `5`, `15.21785 ms`; Accessibility `1.00`;
  Best Practices `1.00`.
- LCP budget: `FAIL` (`204.4811 ms` above `2500 ms`).

### Private authentication gate

- Historical private ledgers were inventoried by filenames and metadata only;
  contents were not printed. The QA identity creation/reset scripts were
  inspected without executing remote mutations.
- Safe QA admin channel: `NOT_AVAILABLE`.
- Direct Auth SQL: `NO`.
- Credential file: absent; ignored: `YES`; secrets printed: `NO`.
- Required aliases `ADMIN_A`, `MEMBER_A_V2`, `ADMIN_B_V2`, `SUSPENDED` and
  `REVOKED`: `BLOCKED_EXTERNAL_PRIVATE_INPUT`.
- Human handoff: [`CP3C3_PRIVATE_CREDENTIAL_HANDOFF.md`](./CP3C3_PRIVATE_CREDENTIAL_HANDOFF.md).

### Regression evidence

- Axe: PASS, 0 violations across 14 scenarios at `390x844` and `1440x900`.
- Preview network: PASS, 0 action requests and 0 production requests.
- Responsive: `390x844 PASS`, `768x1024 PASS`, `1440x900 PASS`, `320px reflow PASS`.
- Console/network preview: 0 unexpected errors; QA-only preview traffic;
  production host requests `0`; service-role browser `NO`.
- Full tests with `--testTimeout=20000`: 106 files, 643 passed, 4 skipped.
- Lint: PASS. QA build: PASS. Diff check: PASS.

Gate decision: `CP-3C.3 = PARTIAL` under CASE D. Both blockers remain
independent and explicit: `AUTHENTICATED_MATRIX_BLOCKED_EXTERNAL_PRIVATE_INPUT`
and `LCP_ABOVE_2500MS_AFTER_BOUNDED_REMEDIATION`. Fixtures remain protected;
cleanup is not authorized. CP-4.1 was not started.

## CP-3C.3R5 — Public Auth First-Paint Performance Remediation

Date: **2026-09-14**
Status: `PARTIAL_AUTH_AND_PERFORMANCE`

### Early-auth A/B

- Baseline on the established Lighthouse method: `2704.6758`, `2704.1654`,
  `2704.4182 ms`; median `2704.4182 ms`.
- Temporary early public-auth experiment on `/portal/login`: the same
  `PortalAuthScreen` rendered while state was `booting` for only `login` and
  `recover`; lifecycle execution and protected routing were unchanged.
- Early-auth results: `2707.1318`, `2704.0634`, `2704.1199 ms`; median
  `2704.1199 ms`.
- Difference versus baseline: `0.2983 ms`; hypothesis rejected. The experiment
  was completely reverted and is not part of the runtime.

### Temporary QA instrumentation

- Development-only marks measured document load at `73.4 ms`, Portal dynamic
  import at `129.0 ms`, Portal bootstrap at `5.8 ms`, and first auth commit at
  approximately `246.3 ms` in a Playwright Chromium run at `390x844`.
- The evidence does not show session resolution delaying the first auth commit;
  no lifecycle, tenant read or protected data was exposed before authorization.
- The remaining Lighthouse LCP gap is not attributable to the tested
  early-auth hypothesis. Instrumentation was removed before closeout; no
  telemetry was left in production code.

### Final state

- The bounded SVG/preload logo fix remains the only accepted performance change.
- Final prior post-fix Lighthouse set remains `2704.4811`, `2703.9592`,
  `2705.1286 ms`; median `2704.4811 ms`; CLS `0`; Accessibility `1.00`;
  Best Practices `1.00`.
- LCP budget remains `FAIL` by `204.4811 ms`; no speculative rewrite was made.
- Focused boundary test: `7 passed`; full suite: `643 passed`, `4 skipped`;
  lint and QA build: PASS.
- The final R5 rerun used the Vite development server with
  `QA_APP_URL=http://127.0.0.1:4177`, which is required for the synthetic
  `portalPreview` adapter; it produced the same 14-scenario Axe PASS and
  preview-network PASS. The production-like preview on `4174` intentionally
  disables synthetic preview and was not counted as matrix evidence.
- Authenticated visual matrix remains `BLOCKED_EXTERNAL_PRIVATE_INPUT`; the
  private credential handoff is unchanged. CP3C fixtures remain protected.

Gate decision: `CP-3C.3 = PARTIAL_AUTH_AND_PERFORMANCE`. CP-4.1 was not
started.

## CP-3C.3R7 — Owner Performance Debt Acceptance

Date: **2026-09-14**
Status: `PARTIAL_AUTH_PRIVATE_INPUT_ONLY`

- Owner decision: accept the measured dynamic-entry LCP of approximately
  `2703.8 ms` median as explicit P2 performance debt for CP-3 QA.
- Performance debt: `P2_ACCEPTED_OWNER`; blocking: `NO`; follow-up is
  post-CP-3 performance optimization and real-deployment RUM.
- The `2500 ms` budget remains `MISSED_BUT_OWNER_ACCEPTED_AS_P2`; it is not a
  PASS. The isolated dynamic Portal/CRM architecture is preserved.
- The remaining CP-3 blocker is the authenticated visual matrix. The real
  `.auth/cp3c3/credentials.json` is absent, ignored, and was not invented or
  reconstructed from historical ledgers. No direct Auth SQL, service-role
  browser code, production credentials or fixture cleanup was used.
- Safe QA admin channel: `NOT_AVAILABLE`; authenticated matrix:
  `BLOCKED_EXTERNAL_PRIVATE_INPUT`.
- Human input is documented in
  [`CP3C3_PRIVATE_CREDENTIAL_HANDOFF.md`](./CP3C3_PRIVATE_CREDENTIAL_HANDOFF.md).
  The placeholders-only committed template is
  [`CP3C3_CREDENTIALS_TEMPLATE.example.json`](./CP3C3_CREDENTIALS_TEMPLATE.example.json).

CP-3C.3 remains `PARTIAL_AUTH_PRIVATE_INPUT_ONLY`; fixtures stay protected.
CP-4.1 was not started.
