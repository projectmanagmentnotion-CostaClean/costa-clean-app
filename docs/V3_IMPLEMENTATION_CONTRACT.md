# Costa Clean App V3 — V3-1 Implementation Contract

Status: `ACTIVE — V3-1R STRUCTURAL REDESIGN`.

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

## Design Guardian checks

`scripts/quality/v3DesignGuardian.test.mjs` verifies the dedicated V3 tree has no
forbidden legacy visual names or hardcoded component colors. Token values live in
`src/v3/design/tokens.css`; geometry, touch targets, safe areas and motion rules
live in the V3 stylesheet.

## Hidden-until-real policy

V3-1 does not expose Share, WhatsApp, call/email, Parte de Trabajo PDF or Lead
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
