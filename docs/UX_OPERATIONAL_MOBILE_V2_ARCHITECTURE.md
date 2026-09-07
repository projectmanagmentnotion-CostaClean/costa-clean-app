# Costa Clean — UX Operativo + Mobile V2 Architecture

## Phase 0 audit

The authenticated app currently uses `AppShell`/`AppNav` for view routing and page-level list/detail workspaces for invoices and quotes. `InvoicesList` and `QuotesList` render the shared `OperationalListItem`, while `ListToolbar` and `BulkSelectionToolbar` provide the existing search, filtering and selection contracts.

Document output already has a single source of truth per domain:

- invoices: `buildInvoicePdfBlob`, `buildInvoicePdfFileName`, `downloadInvoicePdf`;
- quotes: `buildQuotePdfBlob`, `buildQuotePdfFileName`, `downloadQuotePdf`;
- bulk delivery: `downloadBlob` and the existing ZIP helpers.

The list rows currently open the document/detail surfaces but do not expose a direct single-record PDF download. Block A1/A2 will add only a page-owned callback for that action and will reuse the existing output functions. No renderer, route, persistence contract, or financial write path changes.

## Preserved contracts

- existing view routing, deep links, navigation guards and responsive shell;
- invoice numbering, invoice/payment relations and financial writes;
- quote lifecycle/status and quote-to-job relations;
- existing PDF renderers, filenames, bulk ZIP/CSV exports and document previews;
- `OperationalListItem` action semantics and shared design tokens.

## Improvement contract

Each invoice and quote row will expose a direct `Descargar` action. It generates the existing PDF and delivers it without selecting the row or opening the document preview. The action must keep the row scannable, remain keyboard accessible and preserve the compact mobile action pattern.

## Mobile architecture baseline

Mobile remains a dedicated follow-up block. The current phase does not redesign navigation or detail composition. For A1/A2, the row action must remain reachable at `390x844`, `430x932` and `768x1024`, with no horizontal overflow or fixed-control overlap. Future mobile work must define navigation, full-screen detail, filters as sheets, selection action bars, safe-area handling and keyboard behavior before implementation.

## Risks and non-goals

- No new selection engine or lead review workflow in this block.
- No schema, Supabase, auth, route or business-rule changes.
- PDF generation failure must surface through the existing page feedback/toast path and must not imply a successful download.
- The notification changes already present in the working tree are outside this block and must not be included in its commit.
