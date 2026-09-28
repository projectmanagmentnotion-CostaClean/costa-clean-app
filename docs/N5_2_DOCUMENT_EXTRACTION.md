# N5.2 — Smart document extraction foundation

## Goal and scope

N5.2 prepares a local-first, supplier-aware extraction proposal for documents captured by N5.1. The proposal is evidence, not accounting data. A human must review and confirm it before any future expense creation.

Included: versioned proposal types, field provenance, safe structural validation, decimal money strings, multi-VAT lines, auditable attempt identity, a deterministic fixture provider, the review-first UI state, and a local migration draft. The product runtime reaches extraction through `expenseExtractionClient`; the fixture is available only behind an explicit local/test flag and the default path fails closed with `EXTRACTION_RUNTIME_NOT_CONFIGURED`. A future server extraction boundary is prepared but not deployed. Excluded: QA migration apply, Edge Function deploy, external provider calls, provider secrets, OCR, AI, expense creation, supplier creation or matching, deep accounting validation, and Production.

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

`ExpenseExtractionClient` is the product boundary. The only implementation in this workstream is `fixture`, version `n5.2-fixture-v1`, and it is loaded only when an explicit local/test flag is enabled. It is deterministic, clearly labelled as not OCR, and only accepts filenames explicitly prefixed `fixture-`. The ordinary product runtime fails closed with a safe unavailable result. Provider errors, timeouts and invalid responses never expose stack traces.

No provider account, paid API, Edge Function or secret is configured. A future real adapter must run behind a trusted server boundary, verify the authenticated owner/session, read the private Storage object server-side, validate the response, and persist only safe structured output.

## Supplier-forward compatibility

The proposal preserves `rawName`, legal/commercial candidates, raw and normalized tax-id candidates, address, postal code, city, country, phone, email and website as optional extracted fields. This prepares N5.4 to match against a supplier master without pretending that extraction has established supplier identity. N5.4 owns canonical supplier records, aliases, matching and merge decisions.

## Human confirmation and UI

The N5.1 review shell now exposes `Extraer datos`, an explicit analysing state, grouped proposal sections for supplier, invoice and amounts/VAT, and a visible “detected, not confirmed” distinction. Low or missing values remain review signals. `Continuar manualmente` remains available on the initial screen and extraction failure. There is no confirmation action or financial write in N5.2.

## Security and privacy

The local migration draft creates `expense_capture_extractions` with a composite document/session foreign key, owner/session references, RLS and FORCE RLS. Authenticated users receive read access only through an owner-scoped and active-internal-staff policy; direct authenticated writes are not granted. Service-role grants exist only for server-side infrastructure in the unapplied draft and are never referenced by frontend code. No public or anonymous access is introduced.

Amounts are rendered with the detected currency code. Null or unknown currency never assumes EUR or invents a symbol. Confidence and missing-field messages are derived from the proposal; null confidence is shown as unavailable and low-confidence fields remain visually identifiable.

Raw text is nullable and not populated by the fixture provider. If a future provider needs to persist raw text, it must remain private, owner-scoped, excluded from telemetry and protected from provider stack traces or secret dumping.

## Retry and idempotency

Attempt identity combines document, SHA-256, schema version, provider and attempt number. The generated idempotency key is deterministic for that identity. Accidental duplicate requests can be rejected by the durable unique key; an intentional retry increments the attempt and preserves the earlier record.

## Known limitations and handoff

- Fixture output is not OCR and must never be presented as Production extraction.
- No real provider is integrated and no provider recommendation is selected for runtime use.
- N5.3 must own deep validation, reconciliation and normalization policy.
- N5.4 must own supplier master, matching, aliases, analytics and merge decisions.
- No migration has been applied to QA and no Edge Function has been deployed.

Before any remote action, require the exact authorization gate:

`AUTORIZO_APLICAR_N52_QA_Y_DESPLEGAR_RUNTIME_EXTRACCION`
