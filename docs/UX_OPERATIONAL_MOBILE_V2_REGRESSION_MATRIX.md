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
| 390x844 | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 430x932 | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 768x1024 | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1440x900 | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

The isolated origin `http://127.0.0.1:4175` was started from the UX V2 worktree and rendered the controlled `Error de arranque` state because the worktree has no Supabase environment variables. No authenticated QA session or fixture write was attempted. The viewport cells remain blocked until the QA-only environment is supplied; desktop success cannot compensate for a mobile partial/failure.

## Protected regression areas

Notifications, auth, Supabase/RLS, invoice numbering, payment creation, quote lifecycle, recurrence, alert fingerprints, navigation guards and existing bulk exports are out of scope and must remain behaviorally unchanged.
