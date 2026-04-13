# CostaClean CRM Operational Validation Checklist

Use this checklist with current real data before relying more heavily on daily operations. Do not delete or reset production records during validation.

## Financial Writes

- Quote create: create a draft quote with one or more lines, confirm totals and IVA, then verify it appears in the list and document view.
- Quote edit: edit client/property/notes/lines on an existing quote, save, refresh the app, and confirm the persisted values and totals.
- Quote status: move a quote through normal status buttons, including the rejected confirmation, and confirm no RLS error appears.
- Invoice create: create an invoice from an existing job, verify copied service/quote line data, totals, and document view.
- Invoice edit: edit issue date/status/notes/lines on an existing invoice, save, refresh, and confirm persisted totals.
- Invoice status: use status buttons, including the paid confirmation, and confirm no RLS error appears.
- Payment create: create a payment against an invoice and verify the invoice status refreshes when paid in full.
- Payment edit: edit payment date/amount/method/notes and confirm the linked invoice refreshes.
- Payment move: move a payment from one invoice to another and verify both the old and new invoice payment statuses are recalculated.

## Fiscal Expense Flow

- Expense fiscal analysis: run `Analizar fiscalmente` on an expense with structured data and confirm the result persists after refresh.
- Fiscal KPIs: compare estimated deductible IVA/base, review count, medium/high risk count, and missing valid VAT invoice count against the expense list.
- Expense filters: validate requires review, medium/high risk, zero estimated IVA, missing valid VAT invoice, and classification filters.
- Quarterly closing: open the current quarter and confirm fiscal review/risk/missing-support drilldowns match the same AI-aware expense filters.
- Annual closing: open the current year and confirm yearly drilldowns align with quarterly fiscal signals.

## Recovery Checks

- Repeat quote, invoice, payment, and fiscal analysis actions after a browser refresh to confirm stale selections recover cleanly.
- Validate errors are shown in-panel and the app remains editable after a failed save or failed fiscal analysis request.
