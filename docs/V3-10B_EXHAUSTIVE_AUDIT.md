# V3-10B — Exhaustive Whole-App Quality Audit

Status: `OPEN — bounded evidence reconciliation complete; independent quality gate CONTINUE`

This gate is diagnosis only. No product fix, Supabase write, QA write,
production write or deployment was performed.

## Scope and evidence boundary

- Starting HEAD: `eb0910dfedd2c71aa3127d0fcf6b9b76c79ee0dc`
- Branch: `codex/app-v3-mobile-first-redesign`
- Local app inspected at `http://127.0.0.1:4177/?v3=1`
- Authenticated execution completed with the existing ignored local QA profile after
  manual QA authentication; credentials were not requested, read, copied or manipulated.
- The unauthenticated local harness inspected 14 V3 view candidates across eight viewports:
  `320x568`, `390x844`, `430x932`, `768x1024`, `1024x1366`, `1280x800`, `1440x900`,
  `1920x1080` — 112 navigations total.
- Runtime evidence is private and ignored at
  `qa-reports/private/v3-10b/v3-10b-local-audit.json`.
- Authenticated runtime evidence is private and ignored at
  `qa-reports/private/v3-10b/v3-10b-auth-audit.json`.
- Determinism evidence is private and ignored at
  `qa-reports/private/v3-10b/v3-10b-repeat.json` and its per-run logs.
- Independently reviewable sanitized evidence is committed at
  `docs/evidence/v3-10b/`, with manifest, HTTP, search, Escape and determinism
  summaries. The private paths above are provenance only.

## Specialist review passes

The V3-10A specialist architecture was used as ordered review lanes:

1. design-quality-orchestrator
2. bug-root-cause-investigator
3. state-edge-case-auditor
4. ux-flow-architect
5. visual-design-director
6. design-system-guardian
7. brand-asset-guardian
8. property-media-curator
9. frontend-ux-accessibility
10. responsive-layout-inspector
11. interaction-motion-director
12. visual-regression-auditor
13. qa-e2e-specialist
14. performance-gsap-motion
15. business-rules-test-engineer
16. security-privacy-auditor
17. pr-quality-gate

All lanes were constrained to repository inspection and local read-only evidence.
The PR-quality checklist was applied to scope, severity, unsupported claims,
false positives, production safety and the correction roadmap. The prior read-only
continuation review returned `CONTINUE` (quality score 68). V3-10B.2 reconciled the
four requested evidence gaps without product changes. The fresh independent review
also returned `CONTINUE`: the isolated reviewer could not independently verify
private command-run results and stopped on `deployment-not-automatic`.

## Coverage

### Surfaces in inventory

Auth/login, shell/navigation, Home, Clients, Leads, Properties, Quotes,
Services/Jobs, Invoices, Payments, Expenses, Alerts, Closings, Recurring Plans,
Selection, Search, sheets/dialogs, document/media UI: 18 surface groups.

### State matrix

Loading, empty, one item, many items, populated, error, retry, search match,
search miss, long content, missing optional data, status variants, disabled,
saving, success, cancel, dirty, duplicate, permission, deep link, hard reload,
back and selection/sheet states were reviewed as a 22-state audit matrix.

Runtime states actually observed: unauthenticated login, HTTP navigation,
manifest/favicon presence, authenticated shell, populated/empty read-only surfaces,
workspace relations, deep-link/back navigation, More dialog, keyboard/Escape handling,
reduced-motion state and property media. Write-required states remain N/A because this
gate is audit-only and performed no QA writes.

### Visual evidence

The local harness captured safe unauthenticated login baselines and authenticated
read-only surface evidence for the required mobile/tablet/desktop anchors. No customer
names, financial records, tokens, cookies or session files were captured or committed.
The authenticated harness covered 12 surfaces × 8 viewports (96 surface navigations),
plus initial/final shell and search-roundtrip navigations: 120 document navigations in
total. Two consecutive audit runs were compared using sanitized aggregate counters.

## Runtime audit results

| Check | Result |
|---|---:|
| Local unauthenticated navigations | 112/112 HTTP 200 |
| Authenticated read-only surface navigations | 96/96 navigation completions |
| Authenticated main-document navigations | 120/120 HTTP 200 |
| Client-side navigation without document response | 0 |
| Authenticated viewports | 8/8 |
| Console-error pages | 0 |
| Page-error pages | 0 |
| Failed-request pages | 0 |
| Horizontal-overflow pages | 0 |
| Production requests | 0 |
| Supabase mutations | 0 |
| Authenticated QA writes | 0 |
| Visible/accessibility UUIDs | 0 / 0 |
| Unicode-as-icon / legacy markers | 0 / 0 |
| Property media broken images | 0 |
| Authenticated read-only navigation harness | PASS |
| Harness surface count/readiness gate | 96/96 PASS |
| Harness safety/error/HTTP gate | PASS |
| Search-miss assertions | 40 PASS, 0 FAIL, 48 N/A across 8 viewports |
| Search → workspace → Back roundtrip | 8/8 PASS |
| Escape open assertion | 8/8 PASS |
| Escape close assertion | 8/8 PASS |
| Focus restoration | N/A in 8/8; no restoration contract claimed |
| Release determinism | 3/3 PASS |
| Audit repeatability | 2/2 PASS; summaries identical |

The historical release matrix had one serial `768x1024` wait failure. Three
consecutive equivalent full serial runs then passed all five tests, including
`768x1024`; `V3Q-P3-002` is therefore resolved by evidence without claiming a root
cause fix. Two consecutive authenticated audit runs also produced identical sanitized
summaries.

Search-miss coverage is now explicit. Clients, Leads, Properties, Invoices and
Expenses passed the full assertion (`40` passes across 8 viewports). The assertion
requires the deterministic no-match token, zero visible rows, a valid explicit or
accessible zero-state, and restoration of the original list. Quotes, Jobs, Payments,
Alerts, Closings and Recurring were N/A because the required search/record state was
unavailable. No product fix is made in this audit gate.

## Master findings

Machine-readable source: `config/v3-10b-findings.json`.

### V3Q-P2-001 — canonical logo hidden on V3 auth

- Severity: P2
- Confidence: CONFIRMED
- Surface: V3 login, `390x844` observed
- Category: brand / visual / hierarchy
- Evidence: `src/v3/design/v3.css:117` hides `.v3-auth-page .auth-brand__logo`; the
  component renders the canonical registry asset at `src/features/auth/AuthPage.tsx:61-65`.
- Impact: the first operational entry point shows only text branding and does not
  expose the canonical logo asset.
- Fix: later approved visual slice only; decide between showing the canonical mark
  with responsive sizing or explicitly approving text-only treatment.
- Status: OPEN; not fixed in V3-10B.

### V3Q-P2-002 — shared V3 actions below touch-target contract

- Severity: P2
- Confidence: CONFIRMED
- Surface: contact actions and shell ghost action
- Category: accessibility / responsive / touch targets
- Evidence: `src/v3/design/v3.css:600` and `:608` set `min-height: 40px`; repository
  contract requires at least `44x44 CSS px` for interactive targets. The authenticated
  harness measured `.v3-contact-action` at 40px in all eight viewports; the ghost action
  was not rendered in the sampled data states.
- Impact: contact actions are undersized on touch devices; ghost-action geometry remains
  N/A for the sampled states.
- Fix: later correction slice must raise the shared token or document a verified exception,
  then rerun geometry and keyboard checks.
- Status: OPEN; not fixed in V3-10B.

### V3Q-P3-001 — native blocking alerts in document fallback paths

- Severity: P3
- Confidence: SUPPORTED
- Surface: document print/popup and clipboard fallback
- Category: UX / accessibility / error recovery
- Evidence: `window.alert` at `src/features/documents/utils.ts:54-56`,
  `src/features/invoices/openInvoicePrintWindow.tsx:77` and
  `src/features/quotes/openQuotePrintWindow.tsx:92`.
- Impact: feedback is blocking and inconsistent with the app's inline status model.
- Fix: evaluate in a later document-output UX slice with focus and announcement tests.
- Status: OPEN; not fixed in V3-10B.

### V3Q-P3-002 — historical serial release harness flake at 768x1024

- Severity: P3
- Confidence: SUPPORTED
- Surface: V3-8 read-only release matrix
- Category: runtime / state / test reliability
- Evidence: the historical failure is retained; three consecutive equivalent full
  serial runs passed all five tests, including `768x1024`. No harness fix or root cause
  claim was introduced.
- Impact: historical false-negative risk is documented, but not reproduced in the
  controlled 3-run sequence.
- Status: `RESOLVED_BY_EVIDENCE`; historical finding retained.

## Independent quality gate

The former `V3-10B-BLOCKER-001` was an authentication infrastructure blocker. Manual
QA authentication resolved it without credential handling. The authenticated
read-only matrix now runs against QA with zero production requests, zero non-QA
Supabase requests, zero QA mutations, zero console/page errors and zero failed
requests. HTTP status, search assertions, Escape closure and deterministic runs are
now recorded. The bounded runtime evidence is reconciled, but the fresh independent
review is not a PASS: it could not independently verify private command-run results
and stopped on `deployment-not-automatic`. No product fix is authorized in this slice.

## Discarded false positives

- The teal V3 accent is explicitly documented as a semantic product token; it is not
  automatically a brand defect.
- Inline styles in generated work-report output are document-local styling and are
  not by themselves a V3 runtime token violation.
- Unreferenced legacy branding variants remain intentionally retained for auditability
  after V3-10A.1 and are not runtime dependencies.
- No local runtime errors, failed assets, production calls, Supabase mutations or
  horizontal overflow were observed in either local matrix.

## Correction roadmap — not implemented

1. V3-10C0: none; no P0 found.
2. V3-10C1: address shared touch targets and stabilize read-only release QA.
3. V3-10C2: canonical auth brand treatment and document feedback consistency.
4. V3-10C3: Home + CRM authenticated states.
5. V3-10C4: Finance authenticated states.
6. V3-10C5: Operations authenticated states.
7. V3-10C6: responsive/tablet/desktop normalization.
8. V3-10C7: motion and microinteraction corrections after lifecycle evidence.
9. V3-10C8: final visual regression, E2E and independent certification.

## Validation

- Project-agent validator: `294/294 PASS`.
- Unit/integration suite: `137` files passed; `708` tests passed; `4` known skips.
- Lint: `PASS`.
- Build: `PASS`.
- `git diff --check`: `PASS`.
- Release determinism: `3/3 PASS` with `--workers=1 --timeout=120000`.
- Authenticated audit repeatability: `2/2 PASS`; sanitized summaries identical
  (`40` search-miss PASS, `0` FAIL, `48` N/A on both runs).
- Harness failure-injection check: `V3_10B_FORCE_FAIL=1` returned exit `2`, and the
  repeat runner returned non-zero; a clean audit now requires auth, surface count,
  readiness, HTTP, safety, error, overflow, search and Escape gates simultaneously.
- Independent continuation review: `CONTINUE`; latest evidence is
  `.project-agent/private/2026-09-15T16-09-03-697Z/iteration-1-review.json`.

## Safety and closure

- Production writes: 0
- QA writes: 0
- Supabase changes: 0
- Production deployment: `NOT_APPLICABLE — AUDIT ONLY / DEPLOYMENT PROHIBITED`
- Product TSX/CSS fixes: 0
- V3-10C: NOT STARTED

V3-10B is not closed. The truthful verdict is:

`V3-10B OPEN — bounded evidence reconciliation PASS; independent quality gate CONTINUE (private command evidence not independently verifiable; deployment-not-automatic).`
