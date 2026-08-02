# Stitch Source Audit and Screen Map — 2026-08-02

**Branch:** `prototype/stitch-full-visual-parity`  
**Source-set contract:** `4 ZIP / 58 code.html / 59 screen.png / 5 DESIGN.md`  
**Status:** canonical local audit, private Stitch sources not committed

## 1. Inventory summary

The definitive Stitch handoff is split across four ZIP packages:

| Package | code.html | screen.png | DESIGN.md | Notes |
|---|---:|---:|---:|---|
| `stitch_costa_clean_crm_system.zip` | 13 | 13 | 2 | Main package includes two valid Maritime Professional design specs. |
| `stitch_costa_clean_crm_system (1).zip` | 14 | 14 | 1 | Client directory + workspace + property workspace corrections. |
| `stitch_costa_clean_crm_system (2).zip` | 14 | 14 | 1 | StepFlows, invoices, payments and property creation variants. |
| `stitch_costa_clean_crm_system (3).zip` | 17 | 18 | 1 | Dashboard, login, client/property workspaces and alert/fiscal states. |

Totals verified in the generated private report:

- `expected_zip_count = 4`
- `actual_zip_count = 4`
- `actual_counts.code_html = 58`
- `actual_counts.screen_png = 59`
- `actual_counts.design_md = 5`
- `content_inventory_complete = true`
- SHA-256 duplicates: none

Private reference used locally:

- `.project-agent/private/stitch-source/stitch-source-report.json`
- `.project-agent/private/stitch-source/stitch-inventory.csv`

## 2. Canonical screen map

The table below maps the 58 `code.html` exports to the real Costa Clean surfaces. Rows are grouped when a screen family appears in more than one package or when the design family is clearly the same operational surface.

| Package(s) | Stitch screen family | File types | Apparent viewport | Costa Clean module | Real React component | Canonical / duplicate | State | Reason | Implementation block | Risks / debt |
|---|---|---|---|---|---|---|---|---|---|---|
| `(3)` | `inicio_cockpit` | `code.html`, `screen.png` | Desktop cockpit | Home / Dashboard | `src/pages/HomePage.tsx` | Canonical | USE | Original dashboard reference for the cockpit layout. | Block 4 | Screenshot is known to be visually noisy/corrupt; HTML remains valid. |
| `(3)` | `iniciar_sesi_n` | `code.html`, `screen.png` | Login | Auth | `src/features/auth/AuthPage.tsx` | Canonical | USE | Valid login layout and brand composition. | Block 4 | Keep auth contract untouched. |
| `(3)` | `cargando_costa_clean` | `code.html`, `screen.png` | Splash/loading | Auth / boot | `src/features/auth/*` | Canonical | USE | Loading state used as boot/splash reference. | Block 4 | Visual only. |
| `(1)` + `(3)` | `directorio_de_clientes` | `code.html`, `screen.png` | Desktop list | Clients | `src/pages/ClientsPage.tsx` + `src/features/clients/ClientsList.tsx` | Canonical + duplicate | COMBINE | Same surface appears in two packages; use the sharper directory composition. | Block 5 | Duplicate variant retained only as evidence. |
| `(3)` | `workspace_cliente_escritorio` | `code.html`, `screen.png` | Desktop workspace | Client Workspace | `src/features/clients/ClientWorkspace.tsx` | Canonical | USE | Base workspace composition and density reference. | Block 5 | Preserve tabs and guarded actions. |
| `(1)` + `(3)` | `workspace_cliente_marta_l_pez_escritorio_corregido` | `code.html`, `screen.png` | Desktop workspace | Client Workspace | `src/features/clients/ClientWorkspace.tsx` | Canonical + duplicate | COMBINE | Corrected desktop variant to be reconciled with the real workspace. | Block 5 | Use corrected spacing/identity. |
| `(3)` | `workspace_cliente_marta_l_pez_m_vil_corregido` | `code.html`, `screen.png` | Mobile workspace | Client Workspace | `src/features/clients/ClientWorkspace.tsx` | Canonical | USE | Corrected mobile variant. | Block 5 | Guard safe-area and tabs. |
| `(3)` | `workspace_cliente_marta_l_pez` | `code.html`, `screen.png` | Mobile workspace | Client Workspace | `src/features/clients/ClientWorkspace.tsx` | Older variant | DISCARD | Superseded by the corrected mobile export. | Block 5 | Keep only as historical evidence. |
| `(3)` | `workspace_cliente_tablet_1024px` | `code.html`, `screen.png` | Tablet workspace | Client Workspace | `src/features/clients/ClientWorkspace.tsx` | Canonical | USE | Tablet density and tabs reference. | Block 5 | Verify no overflow at `768x1024`. |
| `(3)` | `workspace_cliente_ficha_incompleta` | `code.html`, `screen.png` | Incomplete profile | Client Workspace | `src/features/clients/ClientWorkspace.tsx` | Canonical | USE | Required incomplete-profile state. | Block 5 | Guard changes without writing data. |
| `(1)` + `(3)` | `workspace_propiedad_calella_centro_escritorio_corregido` | `code.html`, `screen.png` | Desktop workspace | Property Workspace | `src/features/properties/PropertyWorkspace.tsx` | Canonical + duplicate | COMBINE | Corrected property workspace desktop reference. | Block 5 | Keep property relations intact. |
| `(1)` + `(3)` | `workspace_propiedad_calella_centro_m_vil_corregido` | `code.html`, `screen.png` | Mobile workspace | Property Workspace | `src/features/properties/PropertyWorkspace.tsx` | Canonical + duplicate | COMBINE | Corrected property mobile reference. | Block 5 | Safe-area and tab overflow risk. |
| `(3)` | `workspace_propiedad_calella_centro` | `code.html`, `screen.png` | Mobile workspace | Property Workspace | `src/features/properties/PropertyWorkspace.tsx` | Older variant | DISCARD | Superseded by corrected export. | Block 5 | Historical evidence only. |
| `(3)` | `workspace_propiedad_escritorio` | `code.html`, `screen.png` | Desktop workspace | Property Workspace | `src/features/properties/PropertyWorkspace.tsx` | Canonical | USE | Property detail density reference. | Block 5 | Preserve property callbacks. |
| `(3)` | `workspace_propiedad_tablet_768px` | `code.html`, `screen.png` | Tablet workspace | Property Workspace | `src/features/properties/PropertyWorkspace.tsx` | Canonical | USE | Tablet-specific property reference. | Block 5 | No horizontal overflow. |
| `(3)` | `workspace_propiedad_cargando_skeleton` | `code.html`, `screen.png` | Loading state | Property Workspace | `src/features/properties/PropertyWorkspace.tsx` | Canonical | USE | Loading skeleton for property workspace. | Block 5 | Visual only. |
| `(2)` | `automatizar_factura_m_vil_390px` | `code.html`, `screen.png` | Mobile StepFlow | Invoices / automation | `src/features/recurringInvoices/RecurringInvoicePlanFlow.tsx` | Canonical | USE | Automation StepFlow reference. | Block 6 | No new dependency. |
| `(2)` | `automatizar_factura_multi_propiedad_m_vil` | `code.html`, `screen.png` | Mobile StepFlow | Invoices / automation | `src/features/recurringInvoices/RecurringInvoicePlanFlow.tsx` | Canonical | USE | Multi-property automation flow. | Block 6 | Keep billing consequences unchanged. |
| `(2)` | `nuevo_servicio_m_vil_390px` | `code.html`, `screen.png` | Mobile StepFlow | Services | `src/features/jobs/JobCreateFlow.tsx` | Canonical + duplicate | COMBINE | Appears in two packages; same guided creation flow. | Block 6 | First actionable field must stay above the fold. |
| `(1)` + `(2)` | `nuevo_servicio_cliente_sin_propiedad_m_vil` | `code.html`, `screen.png` | Mobile StepFlow | Services | `src/features/jobs/JobCreateFlow.tsx` | Canonical | USE | No-property service creation state. | Block 6 | Preserve validation and guard rails. |
| `(2)` | `nueva_factura_m_vil_390px` | `code.html`, `screen.png` | Mobile StepFlow | Invoices | `src/features/invoices/InvoiceCreateFlow.tsx` | Canonical | USE | Mobile invoice creation. | Block 6 | Preserve totals and numbering. |
| `(2)` | `nueva_factura_escritorio_1440px` | `code.html`, `screen.png` | Desktop StepFlow | Invoices | `src/features/invoices/InvoiceCreateFlow.tsx` | Canonical | USE | Desktop invoice creation. | Block 6 | Same write semantics. |
| `(2)` | `nuevo_presupuesto_m_vil_390px` | `code.html`, `screen.png` | Mobile StepFlow | Quotes | `src/features/quotes/QuoteCreateFlow.tsx` | Canonical | USE | Mobile quote creation. | Block 6 | Preserve quote line semantics. |
| `(2)` | `nuevo_presupuesto_tablet_1024px` | `code.html`, `screen.png` | Tablet StepFlow | Quotes | `src/features/quotes/QuoteCreateFlow.tsx` | Canonical | USE | Tablet quote creation. | Block 6 | No overflow. |
| `(1)` | `lista_de_presupuestos_m_vil` | `code.html`, `screen.png` | Mobile list | Quotes | `src/pages/QuotesPage.tsx` | Canonical | USE | Mobile quote list composition. | Block 7 | Dense list, no card inflation. |
| `(1)` | `m_dulo_de_presupuestos_escritorio` | `code.html`, `screen.png` | Desktop module | Quotes | `src/pages/QuotesPage.tsx` | Canonical | USE | Desktop quotes module reference. | Block 7 | Keep master-detail invariants. |
| `(1)` | `m_dulo_de_presupuestos_escritorio_1440px` | `code.html`, `screen.png` | Desktop module | Quotes | `src/pages/QuotesPage.tsx` | Canonical | USE | Large desktop quotes reference. | Block 7 | No layout inflation. |
| `(1)` | `m_dulo_de_facturas_escritorio` | `code.html`, `screen.png` | Desktop module | Invoices | `src/pages/InvoicesPage.tsx` | Canonical | USE | Desktop invoice module reference. | Block 7 | Screenshot known to be visually corrupt; HTML valid. |
| `(1)` | `m_dulo_de_facturas_escritorio_1440px` | `code.html`, `screen.png` | Desktop module | Invoices | `src/pages/InvoicesPage.tsx` | Canonical | USE | Large desktop invoice reference. | Block 7 | Keep document legibility. |
| `(1)` | `m_dulo_de_cobros_escritorio` | `code.html`, `screen.png` | Desktop module | Payments | `src/pages/PaymentsPage.tsx` | Canonical | USE | Desktop payments module. | Block 7 | Preserve collection workflow. |
| `(1)` | `m_dulo_de_cobros_escritorio_1440px` | `code.html`, `screen.png` | Desktop module | Payments | `src/pages/PaymentsPage.tsx` | Canonical | USE | Large desktop payments module. | Block 7 | No behavioral change. |
| `(1)` | `registrar_cobro_escritorio_1440px` | `code.html`, `screen.png` | Desktop StepFlow | Payments | `src/features/payments/PaymentCreateFlow.tsx` | Canonical | USE | Collection registration flow. | Block 6 | Preserve financial consequence. |
| `(2)` | `xito_registrar_cobro_m_vil` | `code.html`, `screen.png` | Mobile StepFlow | Payments | `src/features/payments/PaymentCreateFlow.tsx` | Canonical | USE | Success state after payment registration. | Block 6 | Do not invent writes. |
| `(1)` | `nuevo_gasto_importes_escritorio` | `code.html`, `screen.png` | Desktop StepFlow | Expenses | `src/features/expenses/ExpenseCreateFlow.tsx` | Canonical | USE | Expense import/amount entry. | Block 8 | Preserve totals and tax logic. |
| `(1)` | `m_dulo_de_gastos_lista_m_vil` | `code.html`, `screen.png` | Mobile list | Expenses | `src/pages/ExpensesPage.tsx` | Canonical | USE | Expenses list density reference. | Block 8 | Keep compact list treatment. |
| `(1)` | `m_dulo_de_gastos_escritorio_1440px` | `code.html`, `screen.png` | Desktop module | Expenses | `src/pages/ExpensesPage.tsx` | Canonical | USE | Desktop expense module reference. | Block 8 | Keep support docs visible. |
| `(1)` | `detalle_de_gasto_m_vil_390px` | `code.html`, `screen.png` | Mobile detail | Expenses | `src/features/expenses/ExpenseDetailCard.tsx` | Canonical | USE | Expense detail screen. | Block 8 | Real data only. |
| `(1)` | `filtros_avanzados_gastos_m_vil` | `code.html`, `screen.png` | Mobile filters | Expenses | `src/pages/ExpensesPage.tsx` | Canonical | USE | Advanced filter sheet. | Block 8 | Keep inside sheet/popover. |
| `(1)` | `revisi_n_de_duplicado_gastos` | `code.html`, `screen.png` | Review state | Expenses | `src/features/duplicates/DuplicateReviewOverlay.tsx` | Canonical | USE | Duplicate review for expense domain. | Block 8 | No destructive merge. |
| `(1)` | `cierre_fiscal_escritorio_1440px` | `code.html`, `screen.png` | Desktop closing | Fiscal closing | `src/pages/FiscalClosingPage.tsx` | Canonical | USE | Fiscal closing executive view. | Block 8 | Keep calculations untouched. |
| `(1)` | `cierre_fiscal_m_vil_390px` | `code.html`, `screen.png` | Mobile closing | Fiscal closing | `src/pages/FiscalClosingPage.tsx` | Canonical | USE | Mobile fiscal closing view. | Block 8 | Safe-area and readability. |
| `(1)` | `centro_de_alertas_escritorio_1440px` | `code.html`, `screen.png` | Desktop alerts | Alerts center | `src/pages/AlertsCenterPage.tsx` | Canonical | USE | Alerts center desktop surface. | Block 8 | Keep read/dismiss actions. |
| `(1)` | `centro_de_alertas_m_vil_390px` | `code.html`, `screen.png` | Mobile alerts | Alerts center | `src/pages/AlertsCenterPage.tsx` | Canonical | USE | Alerts center mobile surface. | Block 8 | No overflow. |
| `(1)` | `detalle_de_alerta_m_vil_390px` | `code.html`, `screen.png` | Mobile alert detail | Alerts | `src/pages/AlertsCenterPage.tsx` | Canonical | USE | Alert detail state. | Block 8 | Preserve action routing. |
| `(1)` | `posponer_alerta_m_vil_390px` | `code.html`, `screen.png` | Mobile alert action | Alerts | `src/pages/AlertsCenterPage.tsx` | Canonical | USE | Snooze / postpone state. | Block 8 | No time-based drift in data. |
| `(1)` | `skeleton_de_carga_centro_de_alertas_m_vil` | `code.html`, `screen.png` | Loading state | Alerts center | `src/pages/AlertsCenterPage.tsx` | Canonical | USE | Loading skeleton for alerts. | Block 8 | Visual only. |
| `(1)` | `bottom_sheet_m_s_acciones_cliente` | `code.html`, `screen.png` | Bottom sheet | Clients / shell | `src/app/AppNav.tsx` + sheet styles | Canonical | USE | Mobile “Más” sheet and account/logout affordance. | Block 3 | Keep navigation outcomes unchanged. |
| `(3)` | `cambios_sin_guardar_m_vil` | `code.html`, `screen.png` | Mobile guard | Shell / guards | `src/app/AppShell.tsx` + confirm dialog | Canonical | USE | Unsaved-changes guard state. | Block 3 / 5 | No data writes. |
| `(2)` | `duplicado_detectado_escritorio` | `code.html`, `screen.png` | Desktop duplicate state | Duplicate review | `src/features/duplicates/DuplicateReviewOverlay.tsx` | Canonical | USE | Duplicate detection UI. | Block 5 / 8 | Preserve duplicate logic. |
| `(3)` | `costa_clean_logo.png` | `screen.png` | Asset only | Branding / assets | `public/branding/Costa_Clean-LOGO.png` | Asset | USE | Local logo asset evidence. | Block 2 / 3 | Not a screen. |
| `(3)` | `handoff_t_cnico_costa_clean_crm.md` | `handoff` | Technical handoff | Documentation | `docs/STITCH_VISUAL_PARITY_MASTER_SPEC_20260802.md` | Reference | USE | Non-visual technical handoff. | Block 1 | Documentation only. |
| `(1)` | `maritime_professional_1/DESIGN.md` | `DESIGN.md` | Design spec | Visual rules | `docs/STITCH_SOURCE_SET_CORRECTION_20260802.md` | Canonical | USE | First valid Maritime Professional design spec. | Block 1 | Local private source only. |
| `(1)` | `maritime_professional_2/DESIGN.md` | `DESIGN.md` | Design spec | Visual rules | `docs/STITCH_SOURCE_SET_CORRECTION_20260802.md` | Canonical | USE | Second valid Maritime Professional design spec. | Block 1 | Local private source only. |
| `(2)` | `maritime_professional/DESIGN.md` | `DESIGN.md` | Design spec | Visual rules | `docs/STITCH_SOURCE_SET_CORRECTION_20260802.md` | Canonical | USE | Third design spec variant. | Block 1 | Local private source only. |

## 3. Duplicate families to combine, not preserve separately

These are the only duplicated screen families across packages:

| Screen family | Packages | Decision | Reason |
|---|---|---|---|
| `directorio_de_clientes` | `(1)`, `(3)` | `COMBINE` | Same client directory surface; use the denser, more corrected composition. |
| `nuevo_servicio_m_vil_390px` | `(1)`, `(2)` | `COMBINE` | Same mobile StepFlow family; preserve the stronger guided flow evidence. |
| `workspace_cliente_marta_l_pez_escritorio_corregido` | `(1)`, `(3)` | `COMBINE` | Corrected workspace evidence should be treated as a single canonical family. |
| `workspace_propiedad_calella_centro_escritorio_corregido` | `(1)`, `(3)` | `COMBINE` | Same corrected property workspace family. |
| `workspace_propiedad_calella_centro_m_vil_corregido` | `(1)`, `(3)` | `COMBINE` | Same corrected mobile property workspace family. |

## 4. What this audit preserves

- The HTML exports are used only as visual evidence.
- No exported HTML is copied into `src/`.
- The real React surfaces stay mapped to the existing app contract:
  - `HomePage`
  - `ClientsPage`
  - `ClientWorkspace`
  - `PropertyWorkspace`
  - shell navigation and `AppView`
- The motion audit remains advisory only; no layout now depends on GSAP.
- The private extraction and report stay ignored by Git.

