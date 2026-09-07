# Costa Clean — UX Operativo + Mobile V2 Regression Matrix

## A1/A2 scope

| Surface | Direct action | Source of truth | Required result |
| --- | --- | --- | --- |
| Invoice list | Descargar | `downloadInvoicePdf` / existing invoice PDF renderer | PDF download with historical filename; no detail navigation |
| Quote list | Descargar | `downloadQuotePdf` / existing quote PDF renderer | PDF download with historical filename; no detail navigation |
| Invoice bulk | Descargar | existing ZIP builder | unchanged |
| Quote bulk | Descargar | existing ZIP builder | unchanged |

## A3 scope

| Surface | Eligibility | Action | Persistence |
| --- | --- | --- | --- |
| Invoice list | issued, pending or partially paid, non-cancelled/non-archived/non-deleted, outstanding > tolerance | `Marcar pagada` | real payment through `settle_invoice_by_transfer`; list refresh; reload remains paid |
| Paid/zero balance | ineligible | no settlement action | no write |
| Cancelled/archived/deleted | ineligible | no settlement action | no write |

The individual action is guarded per invoice id against double click. Bulk settlement continues to use the same eligibility function and its existing confirmation flow.

## Automated checks

- invoice PDF output remains a real `application/pdf` blob;
- invoice download uses the existing delivery contract and filename;
- quote filename remains filesystem-safe and domain-labelled;
- quote download uses the existing delivery contract;
- TypeScript, lint and production build pass.

## Viewport checks

| Viewport | Invoice list | Quote list | Horizontal overflow | CTA visibility |
| --- | --- | --- | --- | --- |
| 390x844 | PASS | PASS | PASS | PASS |
| 430x932 | PASS | PASS | PASS | PASS |
| 768x1024 | PASS | PASS | PASS | PASS |
| 1440x900 | PASS | PASS | PASS | PASS |

Authenticated QA evidence (2026-09-07) ran from the isolated UX V2 origin `http://127.0.0.1:4175` against the QA Supabase project only. The official authenticated harness passed 357/360 checks; the three known `quotes-create` StepFlow checks are unrelated to A1/A2/A3 and were unchanged. Required A1/A2 surfaces were additionally checked at 1440x900 and 430x932: download actions were visible/usable, with zero horizontal overflow. The 390x844 and 768x1024 cells passed in the same authenticated run.

## A3 real QA evidence

- Fixture: isolated `QA_UXV2_A3_<RUN_ID>_` invoice, total `121.00 €`, pre-existing transfer payment `40.00 €`, outstanding `81.00 €`.
- UI path: one click on `Marcar pagada` from the invoice list; no manual settlement RPC was used to simulate the result.
- Backend after click: exactly one new `transfer_auto` payment for `81.00 €`; paid total `121.00 €`; outstanding `0.00 €`; financial status `paid`.
- UI and reload: busy state disabled the button during the request; after refresh the invoice remained paid and the settlement action was absent for that invoice.
- Cleanup: PASS. The authorized QA cleanup RPC reported `cleaned: true`; the synthetic invoice, payments and client were verified absent.

## Protected regression areas

Notifications, auth, Supabase/RLS, invoice numbering, payment creation, quote lifecycle, recurrence, alert fingerprints, navigation guards and existing bulk exports are out of scope and must remain behaviorally unchanged.
