# V3 — Post-C5 Global Recertification

Status: `CLOSED / CERTIFIED`

Candidate under test: `b6950a65f2f3d1794d98fb15969bc8924f9dea2a`

Branch: `codex/app-v3-mobile-first-redesign`

QA target: `http://127.0.0.1:4178/?v3=1`

QA namespace/profile: `costaclean-v3` / `.auth/costaclean-v3/qa-browser-profile`

## Verdict

The current V3 branch was replayed as one coherent release candidate after
C1–C5. The authenticated QA shell persisted, the required eight-viewport
matrix passed, the global invariant scan passed, protected contract drift was
zero, and no production or QA business mutation occurred.

`POST-C5 GLOBAL RECERTIFICATION CLOSED / CERTIFIED`

`GLOBAL RELEASE CANDIDATE CERTIFIED`

Production release remains `NOT STARTED` and requires separate human
authorization. No C6 was created.

## Runtime evidence

The existing authenticated visual harness produced `1,584 / 1,584` checks
across its complete surface/flow matrix. It includes the eight required
viewports and the additional certified desktop/tablet presets. The exact
`320x568` supplement produced `144 / 144` checks.

| Viewport | Result |
| --- | --- |
| 320x568 | PASS |
| 390x844 | PASS |
| 430x932 | PASS |
| 768x1024 | PASS |
| 1024x1366 | PASS |
| 1280x800 | PASS |
| 1440x900 | PASS |
| 1920x1080 | PASS |

The global invariant scan covered 80 combinations: ten available V3
surfaces across the eight exact viewports. All 80 passed.

Surfaces covered:

- Home
- Clients and client workspace evidence
- Properties and property workspace evidence
- Invoices and invoice workspace evidence
- Quotes
- Payments
- Expenses
- Services / Jobs
- Alerts
- Closings

Recurring Plans are embedded in Client Workspace. The authenticated QA client
showed the recurring-plan section and a truthful empty state (`0` populated
plans); therefore a populated recurring workspace was recorded as `N/A`, not
assumed PASS. Existing C4/C5 certification records retain the same rule for
quote/payment/service/work-report/expense-attachment states when no QA record
was available.

Read-only interaction evidence included:

- authenticated shell restoration after reload
- invoice deep-link hydration
- invoice workspace open and Back restoration
- invoice search no-result state and clear restoration
- settlement confirmation wording opened and cancelled without confirmation
- More actions sheet, Escape and focus restoration
- Alerts surface, More navigation and Escape
- Client → Property navigation and Back
- accessible labels, headings and relationship summaries

No credentials, cookies, tokens, headers or private screenshots were committed.

Private evidence remains under ignored paths:

- `qa-reports/private/authenticated-visual-qa-latest.json`
- `qa-reports/private/post-c5-320.json`
- `qa-reports/private/post-c5-global-runtime-scan.json`

## Global invariants

| Invariant | Result |
| --- | --- |
| Horizontal overflow | 0 |
| Raw UUID visible or accessible | 0 |
| Unicode-as-icon | 0 |
| Legacy/V2 presentation markers | 0 |
| Broken assets | 0 |
| Console errors | 0 |
| Page errors | 0 |
| Failed critical requests | 0 |
| Overlapping controls | 0 in covered runtime checks |
| Clipped primary values | 0 in covered runtime checks |
| Production requests | 0 |
| Production mutations | 0 |
| QA business mutations | 0 |

The runtime scan also found no undersized interactive controls in the covered
surfaces. The existing V3 44px contract remained intact.

## Protected contract freeze

Protected contract drift against the documented production source baseline
`50bf05a8d11aff8b7b44cc3d79644532803988be` was `0` for the audited contract
files and symbols:

- `canSettleInvoiceByTransfer`, `settleInvoiceByTransfer`,
  `settle_invoice_by_transfer`
- `acceptQuoteWorkflow`, `accept_quote_workflow`
- `PaymentCreateFlow` and `transfer_auto` semantics
- expense persistence, private storage, signed URLs and the 10MB limit
- service/job persistence and service-to-invoice duplicate protection
- alert state machine
- `buildClosingSummary`, deterministic totals and assistive-only AI
- `saveRecurringInvoicePlan`, `generateInvoiceFromRecurringPlan`,
  `buildRecurringPlanPersistenceInput`, schedule helpers and duplicate guards

No alternate write path was introduced. No Supabase schema, policy, RPC,
storage or auth configuration changed. No Vercel or production deployment was
performed.

## Validation

| Gate | Result |
| --- | --- |
| `npm test` standard 5-second timeout | 2 pre-existing CP3B2A V6R1E timeout failures; no assertion failures |
| Full suite with approved 15-second test timeout | `867 passed · 4 skipped` |
| `npm run qa:agents` | `294/294 PASS` |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| Secret/privacy scan | PASS; no sensitive values committed |

The two standard-timeout failures are infrastructure timing only: the exact
same tests pass with the approved 15-second timeout, and the complete suite
returns the known `867 passed · 4 skipped` baseline. Assertions were not
weakened and tests were not skipped.

## Independent review

A fresh detached independent review inspected the current docs-only candidate,
the aggregate runtime evidence, protected contracts, truthful N/A states and
phase boundaries.

- Verdict: `PASS` (`complete` structured result)
- Quality score: `96/100`
- P0/P1/P2/P3: `0/0/0/0`
- Structured artifact: `.project-agent/private/post-c5-global-recertification-review.json`

## Publication boundary

This document and the roadmap update are the only committed changes from this
recertification gate. Product files changed: `0`.

Production release is deliberately separate, remains not started, and may not
be inferred from this certification. Do not invent or start V3-10C6.
