# Invoice Document Security

Date: 2026-07-23
Scope: design only; no PDFs published and no storage changed

## Current state

The CRM renders `InvoiceDocumentA4` in the browser and opens a print window. “Guardar PDF” invokes the browser print dialog; the repository does not currently generate or store canonical invoice PDFs.

The only defined storage bucket in source is private `expense-receipts`, whose authenticated policies are workspace-wide and are not suitable for customer invoice delivery.

## Target model

Create a separate private bucket `client-invoice-documents` in CP-2. Never make it public and never reuse expense storage.

Object key:

```text
<random-uuid>/<random-uuid>.pdf
```

The key contains no client name, tax ID, invoice number, sequential identifier or address.

Target document registry:

| Field | Purpose |
| --- | --- |
| `id` | opaque document UUID |
| `invoice_id` | canonical invoice FK, unique for active version |
| `object_key` | opaque private key, server-only |
| `sha256` | integrity/evidence |
| `byte_size`, `mime_type` | validation |
| `renderer_version`, `template_version` | reproducibility |
| `invoice_snapshot_hash` | binds document to immutable invoice snapshot |
| `status` | `ready`, `superseded`, `quarantined` |
| `created_at`, `created_by` | evidence |

Portal users never SELECT this registry.

## Generation

- Generate only from a persisted, issued invoice snapshot.
- Do not overwrite an issued PDF in place. A legitimate corrected/rectifying workflow creates a new evidence version.
- Validate content type `application/pdf`, PDF magic bytes, maximum size and renderer output.
- Scan or quarantine externally supplied documents; initial invoice PDFs should be server-rendered, not customer uploads.
- The portal does not issue, renumber, correct, settle or cancel invoices.

## Download authorization

`portal-download-invoice` receives an opaque invoice/document ID and:

1. validates method, origin, JWT and request size;
2. resolves `auth.uid()`;
3. checks verified email and active membership;
4. queries invoice with `invoice.client_id = membership.client_id`;
5. checks document `ready` and allowed invoice status;
6. applies per-user/IP rate limit;
7. creates a signed GET for the opaque key with 60-second expiry;
8. records an audit event;
9. returns `Cache-Control: no-store, private`, safe filename and no internal path metadata.

All ownership failures return the same `404` body and timing envelope. There is no endpoint that signs an arbitrary storage path.

If signed URLs expose an unacceptable provider path, use an authenticated Edge streaming proxy instead. This is a CP-2 performance/cost decision, not permission to create a public URL.

## Storage policies

- `public = false`.
- zero anon SELECT/INSERT/UPDATE/DELETE;
- zero broad authenticated object policies;
- browser does not call Storage list APIs;
- trusted Edge signs exact objects after database authorization;
- service-role secret is Edge-only;
- object versioning/lifecycle is defined before production.

## Browser protections

- Do not place analytics, chat, maps or marketing pixels on invoice routes.
- `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, CSP `frame-ancestors 'none'`.
- Avoid browser previews that persist document bytes in IndexedDB/localStorage.
- Revoke object URLs after use.
- Filename may contain a sanitized invoice reference only in `Content-Disposition`; the storage key remains opaque.

## Audit event

Record: event ID, timestamp, user ID, membership ID, client ID, invoice ID, document ID, result, request correlation ID, AAL and coarse risk result. Do not record signed URL, object key, invoice contents, tax ID, address, raw IP or user agent.

## Tests

- Client A can list/download its issued invoice.
- Client A receives indistinguishable not-found for Client B and random IDs.
- Pending/revoked/anonymous users receive no document.
- Expired signed URL fails.
- Signature cannot be changed to another object.
- Bucket listing and direct object GET without signature fail.
- Cache/referrer headers are correct.
- Logs contain none of token, URL query, object key, address, tax ID or PDF body.
- Download does not change invoice, payment, fiscal snapshot or sequence.

## Retention and closure

Account closure revokes delivery but does not delete legally required invoice evidence. Retention follows the accounting/legal matrix and litigation holds. Superseded documents remain restricted evidence until their retention expires.
