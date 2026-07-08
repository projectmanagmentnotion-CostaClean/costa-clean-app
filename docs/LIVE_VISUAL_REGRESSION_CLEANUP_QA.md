# Live Visual Regression Cleanup QA

| Captura / pantalla | Problema real | Componente probable | Correccion aplicada | Verificacion viva | Pendiente |
| --- | --- | --- | --- | --- | --- |
| Home / KPIs moviles | KPI con `0` seguia ocupando altura y CTA en primer viewport | `src/pages/HomePage.tsx`, `src/features/dashboard/components/HomeFiscalKpiGrid.tsx` | Filtrado condicional de KPIs con valor `0`; seccion no renderiza vacia; metrica `Abierto` se oculta si es `0` | Confirmado en `390x844`: desaparecen `Facturado 0`, `Cobrado 0` y `Revision fiscal 0` cuando no aportan | Revisar tablet `768x1024` al cerrar bloque |
| Home / Alertas | Las alertas deben existir solo si tienen count positivo y accion real | `src/pages/HomePage.tsx`, `src/features/dashboard/components/HomeAlertSummaryStrip.tsx` | Filtro por `alert.count > 0`; la seccion no se renderiza si queda vacia | Parcial: la sesion viva no tenia strip visible tras estados locales, pero el filtrado queda aplicado | Reconfirmar con datos vivos que produzcan alertas Home |
| Home / Agenda | La card Agenda grande no debe volver | `src/pages/HomePage.tsx` | Sigue fuera del flujo normal; no se reintrodujo ningun bloque agenda con `0` | Confirmado en app viva: no aparece card de agenda | Ninguno |
| Clientes / resumen | `Planes recurrentes vencidos = 0` y `Saldo abierto visible 0,00 €` seguian ocupando superficie | `src/pages/ClientsPage.tsx` | Grid de KPIs filtrado; cards y metrica header con `0` no renderizan | Confirmado en `390x844`: desaparecen la card `0` y la metrica vacia | Compactar mas el banner de duplicados en sprint aparte |
| Propiedades / resumen | Regla global de no renderizar resumenes `0` faltaba en directorio | `src/pages/PropertiesPage.tsx` | Grid de KPIs filtrado por valor > 0 | Confirmado con vista viva: no se muestran KPIs secundarios vacios | Revalidar con dataset que produzca `0` reales en propiedades |
| Pagos / resumen | Si cobros o contadores estan a `0`, no deben crear cards ni metrica vacia | `src/pages/PaymentsPage.tsx` | Metricas y grid ocultos si valen `0` | Verificado por codigo y estructura viva; dataset actual tenia valores positivos | Reconfirmar con un estado sin cobros |
| Facturas / resumen | `Borradores por emitir = 0` y filas checklist `0` seguian ocupando espacio | `src/pages/InvoicesPage.tsx` | KPIs y checklist filtrados por valor positivo; solo quedan items accionables | Confirmado en `390x844`: desaparece la card de borradores `0` | Revisar tablet y desktop antes de siguiente sprint |
| Gastos / revision | Filas checklist y KPIs de revision/riesgo con `0` no deben ocupar superficie | `src/pages/ExpensesPage.tsx` | Checklist y KPIs filtrados; cobertura solo aparece si hay gastos visibles | Verificado por codigo; dataset actual mantiene valores positivos y sigue visible solo lo accionable | Banner de duplicados sigue siendo grande, fuera de esta regla concreta |
| Listas vacias | `0 visibles de 0` seguia apareciendo como bloque operativo en directorios vacios | `src/design-system/components/DSListControlBar.tsx` | La toolbar no se renderiza cuando `totalCount === 0` | Confirmado en Clientes vacio: desaparece la lectura `0 visibles de 0` | Si se quiere busqueda en vistas vacias, definir excepcion explicita |
| Docs de sprint citadas | `docs/ALERTS_ACTIONS_QA.md`, `docs/HOME_KPI_ACTIONS_QA.md`, `docs/INVOICE_ACTIONS_MOBILE_QA.md` no existen en repo | `docs/` | Se documenta la ausencia para no asumir QA previa inexistente | Confirmado por filesystem local | Crear o consolidar esos docs si se quieren como requisito real |

## Test Debt Closed - Invoice Fiscal Debug Visibility

- `src/pages/InvoicesPage.test.ts` esperaba un panel fiscal operativo que ya no forma parte de la vista normal aprobada.
- El producto correcto mantiene ese bloque oculto fuera de `?debugInvoiceFiscal=1`.
- La cobertura se reescribio para validar ocultacion en vista normal y visibilidad solo bajo debug explicito.
- Resultado verificado: `npm run test -- src/pages/InvoicesPage.test.ts` en verde el `2026-07-08`.

## Authenticated QA Recovery Attempt

- Se reintento la QA autenticada real desde el navegador embebido sobre la pestaña viva del app local.
- La reconexion al tab activo siguio funcionando y resolvio `http://127.0.0.1:4173/?view=invoices`.
- La recuperacion no fue completa:
  - el barrido autenticado multi-pantalla agoto `120000 ms`
  - el intento focalizado por pagina agoto `60000 ms`
  - la captura viva fallo con `Timed out running CDP command "Page.captureScreenshot" for tab 1`
- Se verifico ademas que el repo no contiene `storageState` autenticado reutilizable para fallback local.
- Estado final: recuperacion parcial del canal de inspeccion, pero QA visual autenticada completa aun pendiente.

## Harness Follow-up

- Desde `2026-07-08` existe un harness local autenticado reutilizable documentado en `docs/AUTHENTICATED_VISUAL_QA_HARNESS.md`.
- Su objetivo es dejar de depender del navegador embebido como unica fuente de QA viva.
- La primera pasada real del harness ya recorrio mobile, tablet y desktop con un solo fallo residual en `tablet / fiscal_closing`.

## Module Completion Follow-up

- El harness ya no se limita a finanzas base: incorpora `quotes`, `jobs` y escenarios reales de apertura de flows.
- El baseline real de este sprint detecto un rojo en `mobile/home/headerVisible`; no se maquillo, se corrigio esperando al estado cargado antes de auditar.
