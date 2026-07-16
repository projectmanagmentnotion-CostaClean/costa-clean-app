# QA Baseline Recovery 2026-07-16

## Contexto

- Baseline previo estable: `360/360`.
- Estado reportado al abrir este sprint: `338/360`.
- Commit de partida verificado: `275be80`.
- `main` y `origin/main` estaban alineados antes de editar.

## Hallazgo inicial real

- El reporte adjunto del sprint describia `22` fallos.
- Al reejecutar localmente `npm run qa:visual:auth` antes de corregir nada, el canal ya habia degradado a `322/360`, con `38` checks fallidos.
- Conclusión: no habia una regresion funcional unica del fix de propiedades; habia inestabilidad acumulada en el harness y en la estabilizacion de varios create flows.

## Clasificacion de causas

### Grupo A. Timing del harness

- La mayoria de vistas fallidas del rerun local mostraban `Header: n/a` o texto de carga como `Cargando clientes`, `Cargando facturas`, `Preparando tu centro de control` y `Sincronizando la vista operativa...`.
- Causa: el harness auditaba antes de que el shell autenticado hubiese sustituido sus estados de carga por la vista final.
- Afectaba a `home`, `clients`, `properties`, `quotes`, `jobs`, `invoices`, `expenses`, `payments` e `invoices-debug` en distintos viewports.

### Grupo B. Selector / readiness del harness

- `invoices-debug` podia auditarse antes de que aparecieran `Debug fiscal` y `Control de numeracion`.
- `payments` podia caer en una pagina interna del navegador (`HTTP ERROR 404`) aunque la ruta real de la app seguia viva y pasaba en el siguiente viewport.
- Los create flows podian abrirse, pero el harness evaluaba el formulario antes de que el primer control estuviera realmente visible.

### Grupo C. UI real y acotada

- `expenses-create` en `tablet` y `desktop` dejaba demasiada altura ocupada por contexto redundante en el paso inicial.
- Causa: el paso 1 de alta de gastos apilaba resumen de progreso y contexto antes del primer input.
- Tipo: fallo real de presentacion, no de persistencia.

## Correcciones aplicadas

### Harness

- `scripts/qa/auth/cdpHarness.mjs`
- Se anadieron marcadores estables de loading del shell para no auditar vistas a medio bootstrap.
- `waitForViewReady` ahora exige shell autenticado estable y reglas especificas para `home` e `invoices-debug`.
- `navigateAndWait` reintenta una vez si el navegador aterriza en su pagina interna de error.
- `collectActionFlowAudit` ya no usa un `sleep` fijo:
  - falla explicitamente si el boton no existe
  - espera panel, StepFlow, titulo correcto y primer campo realmente visible
  - evita falsos negativos por montaje parcial del flow

### UI acotada

- `src/features/expenses/ExpenseCreateFlow.tsx`
- `src/components/FullscreenStepFlow.tsx`
- `src/features/stepflow/types.ts`
- El paso inicial de `Nuevo gasto` oculta contexto redundante de cabecera y lateral hasta que deja de aportar valor real.
- El flow fuerza visibilidad del primer campo dentro del contenedor desplazable del StepFlow.
- `FullscreenStepFlow` admite ocultar resumen de paso y metrica superior cuando un flow necesita una entrada mas inmediata al formulario.

## Relacion con el fix de propiedades

- Se audito el posible impacto indirecto sobre `InvoiceCreateFlow`, `FullscreenStepFlow`, markers del overlay y condiciones de espera del harness.
- Resultado: los fallos no venian del sync local de propiedades ni del duplicate guard por cliente.
- El fix funcional previo queda intacto:
  - la propiedad creada se inyecta localmente
  - queda seleccionada
  - el duplicate guard sigue acotado al cliente correcto

## Validacion segura del subflujo de propiedad

- Se abrio `Nueva factura` en navegador autenticado sin submit final.
- Se verifico apertura de overlay, presencia de StepFlow y retorno seguro por cancelacion.
- No se creo propiedad real.
- No se creo factura real.
- No se ejecuto submit final en factura ni en propiedad.

## Resultado final

- `npm run lint` OK
- `npm run build` OK
- `npm run test` OK
- `npm run qa:visual:auth` OK
- Resultado final: `360/360`

## Alcance protegido

- No se revirtio el fix funcional de propiedades.
- No se toco Supabase schema.
- No se toco SQL.
- No se toco RPC.
- No se tocaron migrations.
- No se toco auth productivo.
- No se cambiaron rutas ni `?view=`.
- No se toco `financialWriteApi`.
- No se tocaron `invoice_number`, `display_code`, numeracion, fiscalidad global ni calculos de factura.
- No se toco persistencia critica ni contratos de datos.

## Deuda residual

- El sprint adjunto citaba `22` fallos en `338/360`, pero ese detalle exacto ya no estaba preservado en `qa-reports/private/authenticated-visual-qa-latest.*` cuando se rehizo la reproduccion local; el rerun inmediato ya mostraba `38` checks rotos por la misma inestabilidad del harness.
- La deuda real restante ya no es de cobertura ausente, sino mantener el harness alineado con estados de carga reales y flows embebidos que montan contenido por fases.
