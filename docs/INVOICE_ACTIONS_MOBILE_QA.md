# Invoice Actions Mobile QA

## Scope

This document was created on `2026-07-08` because the repo did not previously contain `docs/INVOICE_ACTIONS_MOBILE_QA.md`.

It records only verified or honestly blocked evidence for invoice mobile behavior. It does not backfill unaudited historical QA.

## Test Debt Closed - Invoice Fiscal Debug Visibility

- Broken test: `src/pages/InvoicesPage.test.ts`
- Broken expectation: fiscal/debug/numbering surface was still expected in normal invoice rendering
- Approved product behavior: the normal invoice workspace hides fiscal/debug control; explicit `?debugInvoiceFiscal=1` reveals the technical debug block and numbering control
- Change applied:
  - added a helper to render with controlled query params
  - normal view now asserts `Debug fiscal`, `Control de numeracion`, and `Revisar secuencia` are absent
  - debug view now asserts the compact JSON payload and numbering control are present
  - regularization hint coverage remains, but only under explicit fiscal debug
- Verification:
  - `npm run test -- src/pages/InvoicesPage.test.ts` passed on `2026-07-08`

## Authenticated QA Recovery Attempt

- Requested viewports:
  - `390x844`
  - `768x1024`
- Requested invoice surfaces:
  - invoice module
  - invoice detail
- Real browser status:
  - the embedded authenticated tab can still be resolved at `http://127.0.0.1:4173/?view=invoices`
  - title resolution still works on the live tab
- Blocking behavior:
  - a broader authenticated audit timed out at `120000 ms`
  - a focused invoice-page audit timed out at `60000 ms`
  - screenshot capture failed with `Timed out running CDP command "Page.captureScreenshot" for tab 1`
- Fallback audit:
  - repo search confirmed there is no committed `storageState` or authenticated Playwright session artifact available for a supported local fallback
- Current QA conclusion:
  - code and tests confirm invoice fiscal control is hidden in normal mode and available only via explicit debug
  - a fresh end-to-end authenticated visual confirmation of mobile/iPad invoice surfaces is still pending due embedded-browser instability
