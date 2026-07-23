# CP-2A Storage review

The migration defines `invoice-documents` as private, PDF-only and limited to 20 MiB. Browser roles have no list/read/write object policy. `invoice_document_records` maps a canonical invoice/client to an opaque object key and revocation state.

Download flow: authenticated request → explicit membership/client check → invoice/document ownership RPC → exact server-returned key validation → one signed URL with 60-second expiry. The browser cannot supply an arbitrary path; the Edge handler does not log the key or signed URL. Membership suspension/revocation or document revocation blocks the next authorization request.

CP-2A uploaded no object. Its disposable proof created only a local dummy non-fiscal PDF and deleted it. Storage configuration is embedded in the immutable migration; therefore its authoritative SQL hash equals the migration hash. `supabase/config.toml` also documents the four local Edge entries and contains no secret values.
