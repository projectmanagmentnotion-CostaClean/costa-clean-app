# Costa Clean App V3 — V3-1 Implementation Contract

Status: `ACTIVE — MOBILE FOUNDATION + INVOICE VERTICAL SLICE`.

Base commit: `09d923622bc2053f2fce46abacc666d9f934e60c`

## Scope

V3-1 adds a reversible V3 visual foundation and applies it to the mobile shell
and the invoice list/workspace. The repository remains the functional source of
truth. Existing `AppView`, query parameters, Supabase reads/writes, invoice
numbering, PDF generation and payment settlement contracts remain authoritative.

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
