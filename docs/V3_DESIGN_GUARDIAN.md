# V3 Design Guardian — V3-2B

Status: `CERTIFIED — V3-2B`

## Review boundary

The guardian reviews the V3 shell, invoice, quote and client
list/workspace against the
approved Stitch Editorial Simplified reference. It is a reviewer, not a source
of screen-specific invention. New V3 screens must reuse the existing tokens,
buttons, inputs, status, sections, rows, workspace, navigation and sheet
contracts before any extension is considered.

## Evidence

- QA target: Supabase QA project `kpvvydthlxupjjqqdpxy`.
- Browser context: independent `costaclean-v3`.
- Reference: approved Stitch project `6884707630640107069`.
- Private screenshots: `.auth/costaclean-v3/` (ignored; not committed).
- Viewports reviewed: `390x844`, `430x932`, `768x1024`.

## Gate scores

| Gate | Score | Result |
| --- | ---: | --- |
| Layout | 94 | PASS |
| Typography | 92 | PASS |
| Spacing | 92 | PASS |
| Controls | 94 | PASS |
| Lists | 93 | PASS |
| Workspace | 94 | PASS |
| Navigation | 94 | PASS |
| Overall | 93 | PASS |

Validated details: flat invoice rows, editorial KPI hierarchy, shared button
geometry, status placement, section dividers, bottom navigation, More sheet,
filter sheet, safe-area padding and no horizontal overflow.

## Static guardian

- Hardcoded V3 colors outside `src/v3/design/tokens.css`: `0`.
- Forbidden legacy visual classes in the dedicated V3 tree: `0`.
- Legacy visual dependency in the rendered V3 invoice tree: `0`.
- `prefers-reduced-motion`: covered by the V3 stylesheet.

## Real flow evidence

- Auth session and reload: PASS.
- PDF download from invoice list: PASS; real PDF generated.
- Settlement: PASS; one real payment recorded and outstanding became `0,00 €`.
- Paid workspace and reload persistence: PASS.
- Deep link with `v3=1&view=invoices&invoice=...`: PASS.
- Back restoration of filter/search/scroll context: PASS.
- QA fixture cleanup: PASS; residue verified `0`.

Production was not accessed or modified.

## V3-2A client evidence

- Client list and workspace: PASS at `390x844`, `430x932`, `768x1024`.
- Real QA rows and relations: PASS; invoice balance and historical totals came
  from existing invoice/payment data.
- WhatsApp, call and email: PASS with valid contact data; invalid contact data
  is guarded and hidden.
- Invoice prefill: PASS; existing financial create flow selected the client.
- Quote prefill: PASS; existing commercial quick flow opened with client
  context.
- Client deep link/back: PASS; `client=<id>` opened the workspace and back
  restored the client list.
- Legacy visual dependency in `src/v3/clients`: `0`.
- Hardcoded V3 colors outside tokens: `0`.

## V3-2B quote evidence

- Quote list and workspace: PASS at `390x844`, `430x932`, `768x1024`.
- Real quote lines and relations: PASS; client, property, job and invoice
  references are rendered only when present in the existing data contracts.
- Quote PDF download: PASS; existing renderer produced the real PDF.
- Share capability and fallback: PASS; unit coverage verifies the native PDF
  `File` payload and local download fallback without external upload.
- Quote-to-invoice conversion: PASS; existing workflow preserved `quote_id`,
  lines, VAT/total, duplicate protection and invoice navigation.
- Quote deep link/back restoration: PASS.
- Legacy visual dependency in `src/v3/quotes`: `0`.
- Hardcoded V3 colors outside tokens: `0`.
- QA fixture cleanup: PASS; quote, quote lines, invoice and invoice lines
  residue verified `0`.
