# N5.2 — Smart document extraction foundation

## Goal and scope

N5.2 prepares a local-first, supplier-aware extraction proposal for documents captured by N5.1. The proposal is evidence, not accounting data. A human must review and confirm it before any future expense creation.

Included: versioned proposal types, field provenance, safe structural validation, decimal money strings, multi-VAT lines, auditable attempt identity, a deterministic fixture provider, the review-first UI state, the QA foundation migration, and a QA-only trusted Edge Function runtime. The product runtime reaches extraction through `expenseExtractionClient`; it has no provider or fixture injection surface and fails closed with `EXTRACTION_RUNTIME_NOT_CONFIGURED` until browser-to-server wiring is explicitly approved. Deterministic fixture wiring lives in `expenseExtractionFixtureClient` and is reserved for local tests/certification. Excluded: external provider calls, provider secrets, OCR, AI, expense creation, supplier creation or matching, deep accounting validation, and Production.

## Invariant

`DOCUMENT → EXTRACTION PROPOSAL → NORMALIZATION → SUPPLIER MATCHING → DUPLICATE CHECK → HUMAN REVIEW → CONFIRM → EXPENSE`

The N5.2 implementation stops at extraction proposal and human review. Uploading or extracting never creates an expense, invoice, payment, supplier, ledger movement or financial transaction.

## State and schema

Extraction attempts use explicit states: `PENDING`, `PROCESSING`, `SUCCEEDED`, and `FAILED`. Each attempt keeps its own attempt number, provider metadata, proposal, safe error fields and timestamps. Retries do not overwrite previous evidence.

The proposal has `schemaVersion = 1` and includes:

- document type: invoice, receipt, credit note, other or unknown;
- supplier raw document fields and future-compatible candidates, with no `supplier_id`;
- invoice number, issue date, due date and currency;
- decimal-string amounts for net, tax, gross, discount and withholding;
- zero or more VAT lines;
- field-level raw value, confidence, source and optional page/text/bounding-box evidence. Structural validation requires all field keys and finite, non-negative evidence geometry.

Persisted accounting calculations must use exact decimal or minor-unit representations. The contract does not infer EUR when currency is missing or ambiguous and does not reconcile totals; deep validation belongs to N5.3.

## Provider abstraction

`ExpenseExtractionClient` is the product boundary. The local-only implementation is `fixture`, version `n5.2-fixture-v1`, and it is exposed only through the explicit fixture client. It is deterministic, clearly labelled as not OCR, and only accepts filenames explicitly prefixed `fixture-`. The ordinary product runtime fails closed with a safe unavailable result. Provider errors, timeouts and invalid responses never expose stack traces.

No external provider account, paid API or provider secret is configured. The QA runtime is a JWT-protected Edge Function pinned to QA project `kpvvydthlxupjjqqdpxy` and an explicit server-side `qa-fixture` mode. It accepts only `captureDocumentId` plus `mode`, derives the document/session/owner, requires active internal staff, reads the private Storage object server-side, persists only safe structured output, and never creates financial records. The deterministic `fixture` provider is limited to filenames prefixed `fixture-`; a future real adapter must remain behind the same trusted server boundary.

## Supplier-forward compatibility

The proposal preserves `rawName`, legal/commercial candidates, raw and normalized tax-id candidates, address, postal code, city, country, phone, email and website as optional extracted fields. This prepares N5.4 to match against a supplier master without pretending that extraction has established supplier identity. N5.4 owns canonical supplier records, aliases, matching and merge decisions.

## Human confirmation and UI

The N5.1 review shell now exposes `Extraer datos`, an explicit analysing state, grouped proposal sections for supplier, invoice and amounts/VAT, and a visible “detected, not confirmed” distinction. Low or missing values remain review signals. `Continuar manualmente` remains available on the initial screen and extraction failure. There is no confirmation action or financial write in N5.2.

## Security and privacy

The QA migration creates `expense_capture_extractions` with composite document/session and session/owner foreign keys, coherent state checks, RLS and FORCE RLS. Authenticated users receive read access only through an owner-scoped and active-internal-staff policy; direct authenticated writes are not granted. Service-role grants exist only for server-side infrastructure and are never referenced by frontend code. No public or anonymous access is introduced.

Amounts are rendered with the detected currency code. Null or unknown currency never assumes EUR or invents a symbol. Confidence and missing-field messages are derived from the proposal; null confidence is shown as unavailable and low-confidence fields remain visually identifiable.

Raw text is nullable and not populated by the fixture provider. If a future provider needs to persist raw text, it must remain private, owner-scoped, excluded from telemetry and protected from provider stack traces or secret dumping.

## Retry and idempotency

Attempt identity combines document, SHA-256, schema version, provider and attempt number. The generated idempotency key is deterministic for that identity. Accidental duplicate requests can be rejected by the durable unique key; an intentional retry increments the attempt and preserves the earlier record.

## Known limitations and handoff

- Fixture output is not OCR and must never be presented as Production extraction.
- No real provider is integrated and no provider recommendation is selected for runtime use.
- QA runtime R2.1 hardening accepts only `{ captureDocumentId, mode }`, derives owner/session/path/hash/provider inputs server-side, requires active internal staff, reads the private Storage object before persistence, and uses an atomic lifecycle claim. Normal `extract` is idempotent; only `retry` from `FAILED` creates attempt N+1. Reused successful attempts return no fresh provider metadata because no provider was dispatched for that request. Fixture execution requires both the exact QA project pin and the server-only Edge secret `N52_SERVER_FIXTURE_MODE=qa-fixture`; missing or incorrect configuration fails closed.
- N5.3 must own deep validation, reconciliation and normalization policy.
- N5.4 must own supplier master, matching, aliases, analytics and merge decisions.
- QA migration `20260928173312_n52_document_extraction_foundation` is applied to Supabase project `kpvvydthlxupjjqqdpxy` with RLS and FORCE RLS enabled. Edge Function `expense-document-extraction` is ACTIVE there with `verify_jwt=true`. Production remains untouched, and the browser product boundary remains fail-closed until a separate client wiring decision.
- R2.1 adds service-side owner/staff parity and atomic claim RPCs so normal `extract` reuses PENDING/PROCESSING/SUCCEEDED attempts, only explicit `retry` creates N+1 from FAILED, and concurrent callers cannot dispatch twice. The R2.1 contract-parity correction adds no database migration; the server fixture now omits `evidence` for missing fields and validates the complete schemaVersion 1 shape before persistence.

Before any remote action, require the exact authorization gate:

`AUTORIZO_APLICAR_N52_QA_Y_DESPLEGAR_RUNTIME_EXTRACCION`
