# N5 Smart Expense Capture Roadmap

## Baseline and isolation

- Product baseline: `2d81aff8893fbc89ab041c38e9e657e632aec38a`
- Workstream branch: `codex/post-v3-n5-smart-expense-capture-v2`
- Phase: N5.1 foundation only.
- Production, N5.2+, OCR/AI extraction and automatic expense creation are out of scope.
- QA Supabase is the only database target for this phase; Production remains untouched.

## N5.1 contract

Smart Capture prepares a private document and its metadata for later review. It does not infer supplier, date, invoice number, base, VAT, total, payment method, category or notes. Those fields remain pending manual review. The existing manual expense flow remains available as the fallback and is the only path that can create an expense.

Accepted types are PDF, JPEG, PNG and WEBP. The deterministic limit is 10 MiB. Empty files, unsupported MIME types, oversized files and unsafe filenames are rejected before upload. The client calculates SHA-256 and uses `captures/<session-id>/<sha256>` as the object path; user filenames never become object identity.

The QA contract uses the private `expense-receipts` bucket, authenticated internal-staff RLS and owner-scoped capture sessions. RPCs create a session, attach metadata after the storage upload, and cancel/clean a session. No public URL or service-role credential is used.

## State model

`IDLE → SELECTING → VALIDATING → UPLOADING → UPLOADED → READY_FOR_REVIEW`.

Validation, upload, storage rejection, RPC failure or network failure ends in `ERROR`, where `Continuar manualmente` is available. Duplicate retries use the same SHA-based object identity and the server-side session idempotency key. No capture state is an expense-created state.

## Future phases

- N5.2 may add reviewed structured fields only under a new explicit instruction.
- OCR/AI, automatic line extraction, fiscal classification and automatic expense creation require a separate contract, review and QA gate.
