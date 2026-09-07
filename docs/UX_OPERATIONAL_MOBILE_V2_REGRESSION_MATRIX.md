# Costa Clean — UX Operativo + Mobile V2 Regression Matrix

## A1/A2 scope

| Surface | Direct action | Source of truth | Required result |
| --- | --- | --- | --- |
| Invoice list | Descargar | `downloadInvoicePdf` / existing invoice PDF renderer | PDF download with historical filename; no detail navigation |
| Quote list | Descargar | `downloadQuotePdf` / existing quote PDF renderer | PDF download with historical filename; no detail navigation |
| Invoice bulk | Descargar | existing ZIP builder | unchanged |
| Quote bulk | Descargar | existing ZIP builder | unchanged |

## Automated checks

- invoice PDF output remains a real `application/pdf` blob;
- invoice download uses the existing delivery contract and filename;
- quote filename remains filesystem-safe and domain-labelled;
- quote download uses the existing delivery contract;
- TypeScript, lint and production build pass.

## Viewport checks

| Viewport | Invoice list | Quote list | Horizontal overflow | CTA visibility |
| --- | --- | --- | --- | --- |
| 390x844 | pending | pending | pending | pending |
| 430x932 | pending | pending | pending | pending |
| 768x1024 | pending | pending | pending | pending |
| 1440x900 | pending | pending | pending | pending |

The viewport cells are only closed after running the app and inspecting the real rendered surfaces. Desktop success cannot compensate for a mobile partial/failure.

## Protected regression areas

Notifications, auth, Supabase/RLS, invoice numbering, payment creation, quote lifecycle, recurrence, alert fingerprints, navigation guards and existing bulk exports are out of scope and must remain behaviorally unchanged.
