# Smart Expense synthetic QA preparation

Status: local preparation only. No OpenAI call, Edge Function deployment, remote Supabase operation, or expense creation was performed.

## Local inputs and fixtures

- The two invoice PDFs found in the user's Downloads were inspected locally for PDF parsing and selectable text only. Their contents were not copied into this repository, printed to the chat, or sent to a service. The available local scan did not establish the requested 21% VAT line for both files, so they are not used as the synthetic acceptance fixtures.
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

- The current expense create StepFlow has a pre-save review for manually entered values. The Smart Capture proposal is not wired into that UI yet, so this does not prove a user can inspect extracted values before saving through the extraction flow.
- `ExpenseSupportFieldset` opens a pending or stored receipt in a separate browser tab. An embedded PDF content preview within the form remains pending; it is a separate UX gap and does not explain schema or extraction errors.
- The ordinary extraction client is intentionally fail-closed when the runtime is unavailable. These local fixture tests do not prove that a remote extraction Edge Function is deployed or that either downloaded invoice can be processed by it.

## Next controlled step

The local fixtures and schema checks are ready for deterministic tests. A real QA extraction remains untested until the owner separately authorizes the exact QA invocation and confirms the extraction runtime is available. Do not use the OpenAI client for this test.
