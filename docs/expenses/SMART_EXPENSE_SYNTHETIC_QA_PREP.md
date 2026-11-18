# Smart Expense synthetic QA preparation

Status: local preparation only. No OpenAI call, Edge Function deployment, remote Supabase operation, or expense creation was performed.

## Local inputs and fixtures

- Two PDFs were found in Downloads; both are PDF files, so they do not provide the requested image-format case. They are not copied into this repository or sent to any service. The acceptance cases below remain entirely synthetic, as required.
- `src/features/expenses/fixtures/smart-expense-synthetic-invoice.pdf` and `.png` are fully fictitious test documents. Each is conspicuously marked as synthetic and not valid for accounting; the tax identifiers are explicitly labelled fictitious and invalid.
- Both fixtures include supplier, fictitious tax ID, invoice number, date, concept, taxable base, 21% VAT and a mathematically consistent total. The PDF text is selectable; the PNG was inspected visually and carries the same synthetic field text in a text metadata chunk for deterministic fixture checks.

## Safe schema diagnostics

`diagnoseExtractionProposal` returns only allowlisted failure codes and never includes submitted values, OCR text, provider messages or document content:

- `INVALID_OBJECT`
- `MISSING_KEYS`
- `UNSUPPORTED_SCHEMA_VERSION`
- `INVALID_DOCUMENT_TYPE`
- `INVALID_FIELD_CONTRACT`

It is diagnostic only. `validateExtractionProposal`, normalization, amount reconciliation and the explicit human-confirmation boundary remain authoritative. Mismatched fiscal totals stay blocked.

## Product flow boundaries

- Smart Capture now uses the ordinary fixture-capable extraction client, then shows editable supplier, tax ID, invoice, date, amounts, VAT lines and expense fields before the explicit save action. Human edits are tagged as reviewer-sourced and pass through the same strict fiscal normalizer; invalid tax IDs can be cleared, while mismatched totals remain blocked. Replacing a document validates the new file before cancelling the prior capture, and the review fields are reset between documents.
- A successful confirmation stays marked as saved even if refreshing the expense list fails; the UI reports the refresh issue separately.
- The selected document is previewed in the capture review: PDF in an embedded browser frame and images inline. The separate stored-receipt view in `ExpenseSupportFieldset` still opens in another browser tab; that UX item remains pending and does not explain extraction/schema failures.
- The ordinary extraction client is intentionally fail-closed when the runtime is unavailable. These local fixture tests do not prove that a remote extraction Edge Function is deployed or that either downloaded invoice can be processed by it.

## Next controlled step

The local fixtures and schema checks are ready for deterministic tests. The QA-only Edge fixture handler is guarded by the exact QA project URL and explicit `N52_SERVER_FIXTURE_MODE=qa-fixture`; it returns deterministic proposals only for the two synthetic fixture filenames and never calls an extraction provider or reads document bytes. It is not deployed or invoked remotely here. A real OCR/extraction result for the Downloads documents remains untested. Do not use the OpenAI client for this preparation.

The review and PDF preview are validated by local code and tests only; authenticated browser QA, persisted receipt display, and the actual QA deployment remain pending. No expense was created and no remote data changed.

## Local verification result

- PDF fixture: `READY`; PNG fixture: `READY`; safe schema diagnostics: `READY`.
- Focused extraction, fiscal-review, document and orchestration checks: `29/29 PASS` after replacement-flow fixes.
- Full local suite: `1,252 PASS`, `4 SKIP`; lint and build: `PASS`.
- The Edge entrypoint passed TypeScript syntax transpilation and ESLint. Deno is unavailable locally, so Deno-specific type checking and runtime execution remain unverified.
- Controlled QA execution is prepared for these exact synthetic fixtures but still requires an explicitly authorized Edge deployment/invocation. No OpenAI request is made by this fixture path.
