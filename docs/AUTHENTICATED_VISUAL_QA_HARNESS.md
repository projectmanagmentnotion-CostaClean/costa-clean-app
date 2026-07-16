# Authenticated Visual QA Harness

## Problema que resuelve

La QA visual autenticada no puede depender solo del navegador embebido de Codex mientras siga fallando con timeouts al navegar o capturar.

Este harness crea una ruta local, estable y reutilizable para auditar la app autenticada sin tocar auth productivo, rutas, `?view=`, Supabase ni write paths.

## Estrategia elegida

- `playwright` no existe como dependencia directa ni instalada en `node_modules`, asi que este sprint no fuerza una dependencia nueva contra la regla del repo.
- En su lugar, el harness usa un perfil QA local aislado de Edge/Chrome mas Chrome DevTools Protocol.
- La sesion autenticada se conserva en un perfil local ignorado por git.
- El archivo `.auth/costa-clean-storage-state.json` solo guarda metadata segura del harness, no cookies ni tokens.

## Por que no usar el navegador embebido como unica fuente

- ya fallo con barridos de `120000 ms`
- ya fallo con intentos focalizados de `60000 ms`
- ya fallo con `Page.captureScreenshot`
- no es una base suficientemente estable para cerrar sprints visuales autenticados por si sola

## Scripts creados

- `npm run qa:auth:setup`
- `npm run qa:visual:auth`

Archivos:

- [scripts/qa/setup-auth-state.mjs](C:/Users/USUARIO/costa-clean-app/scripts/qa/setup-auth-state.mjs)
- [scripts/qa/run-authenticated-visual-qa.mjs](C:/Users/USUARIO/costa-clean-app/scripts/qa/run-authenticated-visual-qa.mjs)
- [scripts/qa/auth/cdpHarness.mjs](C:/Users/USUARIO/costa-clean-app/scripts/qa/auth/cdpHarness.mjs)
- [scripts/qa/auth/README.md](C:/Users/USUARIO/costa-clean-app/scripts/qa/auth/README.md)

## Como generar sesion

1. Ejecutar `npm run qa:auth:setup`
2. El script detecta la app local en `http://127.0.0.1:4173/` o fallback `http://127.0.0.1:5173/`
3. Abre Edge/Chrome con un perfil QA local aislado
4. El usuario inicia sesion manualmente
5. El script detecta shell autenticado y guarda metadata en `.auth/costa-clean-storage-state.json`

## Como ejecutar QA

1. Ejecutar `npm run qa:visual:auth`
2. El script reutiliza el perfil QA ignorado
3. Recorre vistas autenticadas con `?view=...`
4. Ejecuta checks estructurales
5. Guarda screenshots y reportes locales ignorados

## Rutas ignoradas por git

- `.auth/`
- `playwright/.auth/`
- `test-results/auth/`
- `qa-screenshots/private/`
- `qa-reports/private/`

## Viewports incluidos

- `390x844`
- `768x1024`
- `1366x900`

## Vistas revisadas por el script

- `?view=home`
- `?view=clients`
- `?view=properties`
- `?view=invoices`
- `?view=expenses`
- `?view=payments`
- `?view=fiscal_closing`
- `?view=invoices&debugInvoiceFiscal=1`

## Checks incluidos

Global:

- no login screen
- no scroll horizontal
- app shell visible
- header visible
- bottom nav visible en mobile
- no error boundary visible

Especificos:

- `home`: heuristica para no reintroducir agenda grande
- `invoices`: control fiscal/numeracion oculto en vista normal
- `invoices-debug`: control fiscal/numeracion visible en modo debug
- `fiscal_closing`: primer importe visible arriba en el viewport

## Interpretacion de resultados

- El reporte JSON/Markdown local resume checks por viewport y vista.
- Un check fallido significa que la pantalla merece revision manual o ajuste de heuristica.
- Un reporte verde no sustituye criterio UX; solo formaliza QA autenticada repetible.

## Limitaciones

- depende de Edge/Chrome local con soporte CDP
- requiere login manual inicial
- el archivo `.auth/costa-clean-storage-state.json` no es `storageState` de Playwright; es metadata segura para reutilizar un perfil QA local
- si la app local no esta levantada en `4173` o `5173`, el harness falla de forma explicita

## Politica de seguridad

- no commitear tokens, cookies ni perfiles autenticados
- no commitear screenshots privados con datos reales
- no imprimir secretos en terminal
- no usar el harness para bypass de auth ni puertas traseras

## Primera ejecucion real

- Fecha: `2026-07-08`
- Browser: `edge`
- App URL: `http://127.0.0.1:4173/`
- Viewports ejecutados:
  - `390x844`
  - `768x1024`
  - `1366x900`
- Vistas ejecutadas:
  - `home`
  - `clients`
  - `properties`
  - `invoices`
  - `expenses`
  - `payments`
  - `fiscal_closing`
  - `invoices-debug`
- Resultado:
  - `240` checks totales
  - `239` checks en verde
  - `1` check fallido: `tablet / fiscal_closing / fiscalRealAmountVisible`
- Artefactos locales generados:
  - `qa-reports/private/authenticated-visual-qa-latest.md`
  - `qa-reports/private/authenticated-visual-qa-latest.json`
  - `qa-screenshots/private/2026-07-08T11-38-11/`

Interpretacion del fallo:

- el harness detecto que en `768x1024` el primer importe de `fiscal_closing` no quedo suficientemente arriba segun la heuristica actual del script
- no se interpreta como rotura general del harness; se registra como finding real para revisarlo en sprint visual posterior o ajustar la heuristica con mas evidencia

## Fiscal Closing Tablet QA Fix

- Fallo detectado inicialmente:
  - `tablet / fiscal_closing / fiscalRealAmountVisible`
- Causa exacta:
  - el importe real fiscal ya era visible en tablet dentro del `ExecutiveHeader`
  - el harness estaba leyendo el primer texto con `€` del viewport mediante heuristica generica, no el bloque fiscal real
- Cambio aplicado:
  - `ExecutiveHeader` admite `data-qa` estable para el bloque de metrica
  - `FiscalClosingPage` marca el total real con `data-qa="fiscal-real-amount"`
  - el harness valida ese nodo exacto en lugar del primer importe arbitrario
- Tipo de problema:
  - selector del harness, no calculo fiscal ni visibilidad rota del dato
- Resultado final:
  - `npm run qa:visual:auth` = `240/240`
- Confirmacion:
  - no se tocaron importes ni calculos fiscales

## Module Completion QA

- El harness ya cubre tambien:
  - `quotes`
  - `jobs`
  - create flows de `quotes`, `jobs`, `expenses` y `payments`
- Los create flows se validan sin submit final y con checks de:
  - overlay visible
  - titulo visible
  - primer campo visible
  - sin overflow horizontal
  - StepFlow presente
- La pasada `2026-07-08` deja el resultado final en `360/360`.
- `recurring` queda fuera del barrido standalone porque no existe ruta real `?view=` para ese dominio.

## Actualizacion 2026-07-16

- La pasada del `2026-07-16` se ejecuto con la app local viva en `http://127.0.0.1:4173/`; el bloqueo anterior por `ERR_CONNECTION_REFUSED` queda resuelto como problema de entorno, no de harness.
- El resultado ya no es un fallo total del canal: aparecen findings reales de vistas concretas. Por tanto, cualquier sprint que cite esta pasada debe distinguir esos findings del alcance del cambio revisado.

## Baseline Recovery 2026-07-16

- El canal partio de un estado reportado de `338/360` y, al reejecutarse localmente antes de corregir nada, llego a `322/360` por la misma inestabilidad del harness.
- El recovery se cerro en `360/360` sin eliminar checks y sin tocar auth, rutas, `?view=` ni write paths.
- Hardening aplicado en `cdpHarness.mjs`:
  - espera explicita del shell autenticado estable mediante marcadores reales de loading
  - validacion especifica de `home` e `invoices-debug`
  - reintento defensivo cuando el navegador cae en su propia pagina interna de error
  - apertura de create flows sin `sleep` fijo, esperando panel, StepFlow, titulo y primer campo realmente visible
- Ajuste visual minimo asociado:
  - `ExpenseCreateFlow` compacta el paso inicial para que el primer campo quede inmediatamente accesible
  - `FullscreenStepFlow` permite ocultar resumen/metrica redundante cuando una entrada al formulario lo requiere
- Causas agrupadas del sprint:
  - timing del harness
  - selector/readiness del harness
  - un unico finding visual real en `expenses-create`
- Cierre detallado: [QA_BASELINE_RECOVERY_20260716.md](C:/Users/USUARIO/costa-clean-app/docs/QA_BASELINE_RECOVERY_20260716.md)
