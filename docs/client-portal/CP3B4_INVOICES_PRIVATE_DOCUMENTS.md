# CP-3B.4 Invoices and Private Documents

Date: 2026-09-09

## Status

`FIXTURE_BLOCKED`

This block is not implemented or certified. No runtime, CRM, schema, or
production changes were made.

## Contract Audit

QA target: `kpvvydthlxupjjqqdpxy`

The existing `portal_list_invoices(p_client_id, p_limit)` RPC returns these
customer-safe fields:

- invoice id
- invoice number
- issue date
- status
- subtotal
- tax amount
- total
- paid amount
- outstanding amount

The current portal adapter maps only id, invoice number, issue date, and status
into `PortalInvoiceSummary`. It has no document availability metadata, invoice
detail adapter, or frontend download adapter.

The existing `portal-invoice-download` Edge Function is present in source and
uses `portal_get_invoice_download_authorization_trusted`, the private
`invoice-documents` bucket, an exact opaque object key, and a 60-second signed
URL. The browser is not given service-role credentials.

## QA Evidence

Read-only QA counts on 2026-09-09:

- canonical invoice rows: `7`
- invoice document registry rows: `0`
- `invoice-documents` storage objects: `0`
- bucket public flag: `false`

The invoice list can be validated as a real read surface, but no authorized
document exists for a fresh signed-URL download, expiry, or cross-tenant
document denial test.

## Blocker

`QA_FIXTURE_REQUIRED`

The minimum missing fixture is one clearly synthetic QA invoice linked to an
existing QA portal client plus one PDF-only `invoice_document_records` row and
matching private `invoice-documents` object. The fixture must be created only
through the separately authorized QA fixture process and must have an exact
cleanup identity. No production data may be used.

Until that fixture exists, these remain `NOT_EXECUTED`:

- secure download through the Edge Function
- signed URL lifetime and expiry
- direct unsigned storage denial
- own/foreign/mismatched/unknown document denial
- 390x844 download UX certification
- browser Console and Network evidence for the download flow

## Next Action

Authorize and run the minimal QA fixture process, then implement the narrow
frontend adapter and invoice states without changing the approved portal shell.
Do not start CP-3B.5.
