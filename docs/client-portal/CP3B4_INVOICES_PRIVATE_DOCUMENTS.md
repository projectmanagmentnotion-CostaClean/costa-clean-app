# CP-3B.4 Invoices and Private Documents

Date: 2026-09-09

## Status

`PARTIAL — implementation complete; browser download certification pending`

The narrow portal contract and download integration are implemented. QA contains
one synthetic invoice/document fixture. Browser-only download, expiry and
negative authorization evidence still require authenticated manual execution.

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

The portal adapter maps the customer-safe financial fields plus
`documentAvailable` and `documentId`. The frontend invokes the existing
`portal-invoice-download` Edge Function and never exposes the storage object key.

The existing `portal-invoice-download` Edge Function is present in source and
uses `portal_get_invoice_download_authorization_trusted`, the private
`invoice-documents` bucket, an exact opaque object key, and a 60-second signed
URL. The browser is not given service-role credentials.

## QA Evidence

QA evidence on 2026-09-09:

- CP-3.4 synthetic invoice: `INV-QA-CP3B4-20260909-001`
- generated invoice number: `2026-001`
- generated display code: `INV-0001`
- invoice document id: `f1feb5e2-faf7-4039-9c40-8db248964993`
- private object: `f93c6df4-13b7-4795-8e9e-a8c0fc2af8b5/9b0a2a8d-cf2b-45e2-b27b-8b7876f3a5ad.pdf`
- object size: `27126` bytes; MIME: `application/pdf`
- invoice document status: `ready`
- bucket public flag: `false`

The invoice list can be validated as a real read surface, but no authorized
document exists for a fresh signed-URL download, expiry, or cross-tenant
document denial test.

## Remaining Evidence

The source migration is `20260909130000_portal_invoice_document_availability`.
It changes only the `portal_list_invoices` function and adds the safe metadata
fields `documentAvailable` and `documentId`. The existing private bucket and
trusted download function remain unchanged.

The following are implemented but `NOT_EXECUTED` in authenticated browser
evidence: own download, signed URL expiry/refresh, unsigned storage denial,
unknown/foreign/mismatched document denial, 390x844 download UX, and browser
Console/Network capture.

## Next Action

Run the authenticated QA browser certification against this single fixture.
Do not start CP-3B.5.
