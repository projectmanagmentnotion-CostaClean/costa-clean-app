# Costa Clean App V3 — V3-1 Implementation Contract

Status: `CERTIFIED — V3-2B AUTHENTICATED VISUAL QA`.

Base commit: `09d923622bc2053f2fce46abacc666d9f934e60c`

## Scope

V3-1R replaces the earlier CSS adaptation with an independent V3 presentation
tree. The repository remains the functional source of truth. Existing `AppView`,
query parameters, Supabase reads/writes, invoice numbering, PDF generation and
payment settlement contracts remain authoritative.

QA activation is explicit with `?v3=1`. Without that query parameter the V2
shell remains available during migration. The flag is presentation-only and is
never used as business state or persisted in local storage.

## Real actions kept

- Invoice PDF download uses the existing `downloadInvoicePdf` / PDF output path.
- Invoice settlement uses `canSettleInvoiceByTransfer`, the settlement guard,
  `settleInvoiceByTransfer` and payment refresh. The UI never writes
  `status = 'paid'` directly.
- Invoice list filtering continues to use `ListToolbar` and
  `ModuleFilterState`; V3 adds presentation around the existing state only.
- Entity navigation continues to use the existing `AppView` and workspace
  contracts.

## Dedicated V3 tree

- `src/v3/shell/V3ShellChrome.tsx` owns the V3 top bar, bottom navigation and
  More sheet.
- `src/v3/invoices/V3InvoicesPage.tsx` owns the V3 invoice list, row and
  full-screen workspace.
- V3 invoice markup does not render `hero-card`, `cc-master-layout`,
  `OperationalListItem`, `cc-record-card` or `cc-list-toolbar`.
- Legacy `InvoicesPage` remains the V2 branch only; it is an orchestration
  boundary and retains the real callbacks/APIs.
- `src/v3/clients/` owns the V3 client list, client workspace and contact action
  presentation. It does not import legacy list/workspace visual components.
- `src/v3/quotes/` owns the V3 quote list, filters, rows and full-screen quote
  workspace. Quote lines are loaded from the existing `quote_lines` contract;
  no visual quote fixture is used as source of truth.
- Client relations are derived from existing IDs. Financial totals use current
  invoice/payment data; no LTV, margin, delivery or tracking state is invented.

## V3-2A useful actions

- WhatsApp uses a normalized `wa.me` URL with optional contextual text.
- Call uses a validated `tel:` URL.
- Email uses a validated `mailto:` URL.
- New invoice and new quote use the existing create flows and client prefills.
- No action claims sent, delivered, read, verified, GPS, tracking or telemetry.

## V3-2B document and conversion actions

- Quote PDF download uses the existing quote renderer.
- Share builds a local `File` from that PDF and uses `navigator.share`/
  `navigator.canShare` when available; the fallback downloads locally. No
  external upload, delivery tracking or read state is invented.
- Quote-to-invoice uses `accept_quote_workflow` with the real quote id, lines,
  VAT and duplicate protection. The resulting invoice keeps the `quote_id`
  relation and refreshes the invoice workspace data.
- Quote deep links use `quote=<id>` and browser history; back returns to the
  quote list and clears the module deep-link state.

## Design Guardian checks

`scripts/quality/v3DesignGuardian.test.mjs` verifies the dedicated V3 tree has no
forbidden legacy visual names or hardcoded component colors. Token values live in
`src/v3/design/tokens.css`; geometry, touch targets, safe areas and motion rules
live in the V3 stylesheet.

## Hidden-until-real policy

V3-1 does not expose Parte de Trabajo PDF or Lead
“Marcar revisado”. These remain backlog items until their real contracts and
tests exist. No fake delivery, read, verification, GPS, telemetry, eIDAS or
IBAN state is rendered.

## Deep-link and back contract

The V3 invoice surface accepts the existing `view` and invoice filter context,
plus `invoice=<id>` for a direct invoice workspace entry. Navigation changes are
written to browser history; back restores the previous app view and retains
existing list preferences. The invoice filter remains a real module filter, not
opaque local-only routing state.

## QA contract

- Primary: `390x844` and `430x932`.
- Regression: `768x1024` and desktop no-regression.
- Targets: at least 44px, preferably 48px.
- `prefers-reduced-motion`, safe-area insets, focus visibility and bottom-sheet
  Escape/dismiss/scroll-lock behavior are mandatory.
- No production deploy, migration, production write or main-branch change.

Final authenticated visual certification is recorded in
`docs/V3_DESIGN_GUARDIAN.md`. V3-2C remains a separate future sprint and is not
started by this change.
