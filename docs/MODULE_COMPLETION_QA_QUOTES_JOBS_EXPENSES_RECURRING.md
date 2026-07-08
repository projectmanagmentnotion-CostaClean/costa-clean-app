# Module Completion QA - Quotes, Jobs, Expenses, Payments and Recurring

## Baseline inicial

- Commit de partida: `5c14bd8573283b528747aeb219379957ad4ddb6c`
- `npm run lint`: OK
- `npm run build`: OK
- `npm run test`: OK
- `npm run qa:visual:auth`: baseline no totalmente verde
  - resultado real encontrado al arrancar este sprint: `239/240`
  - fallo exacto: `mobile / home / headerVisible`

## Viewports usados

- `390x844`
- `768x1024`
- `1366x900`

## Vistas revisadas

- `home`
- `clients`
- `properties`
- `quotes`
- `jobs`
- `invoices`
- `expenses`
- `payments`
- `fiscal_closing`
- `invoices-debug`

## StepFlows revisados

- `quotes-create`
- `jobs-create`
- `expenses-create`
- `payments-create`

## Recurrentes

- No existe una vista standalone real en `?view=` para recurrentes.
- El dominio recurrente sigue embebido en workspace de cliente y flows internos.
- En este sprint no se inventa ruta nueva ni se fuerza un escenario de harness artificial.
- Se documenta como `no aplicable` para barrido standalone del harness.

## Problemas reales encontrados

1. El harness autenticado seguia fallando en `mobile / home / headerVisible` porque auditaba antes de que saliera del loading real del dashboard.
2. `QuotesPage` mostraba ruido con valor `0` en mobile:
   - `Potencial bloqueado 0,00 €`
   - checklist items a `0`
   - KPI secundarios a `0`
3. `JobsPage` mostraba ruido con valor `0` en mobile:
   - `0 servicio(s) hoy`
   - KPIs/checklist sin valor operativo inmediato
4. `desktop / quotes-create` dejaba el primer campo real por debajo del primer viewport por una cabecera de StepFlow demasiado alta para un flujo de `7` pasos.

## Correcciones aplicadas por modulo

### Presupuestos

- Se ocultan metricas, KPIs y checklist items con valor `0`.
- El hero conserva solo la decision comercial viva.
- `Nuevo presupuesto` se valida en `390x844`, `768x1024` y `1366x900`.

### Servicios / Jobs

- Se ocultan KPIs y checklist items con valor `0`.
- Se mantiene la agenda/cola solo cuando tiene carga operativa positiva.
- `Registrar servicio` se valida en `390x844`, `768x1024` y `1366x900`.

### Gastos

- Sin cambio de logica de negocio en este sprint.
- Se confirma con QA autenticada que:
  - no hay overflow horizontal
  - `Nuevo gasto` abre visible
  - el flow entra sin submit final

### Cobros / Pagos

- Sin cambio de logica de negocio en este sprint.
- Se confirma con QA autenticada que:
  - no hay overflow horizontal
  - `Registrar cobro` abre visible
  - el flow entra sin submit final

## Correcciones compartidas

- `ActionFlowOverlay` expone marcadores estables `data-qa` para QA.
- `FullscreenStepFlow` expone marcador estable `data-qa`.
- `FullscreenStepFlow` gana una variante densa para flows largos con contexto lateral.
  - objetivo: evitar formularios enterrados en desktop sin tocar logica del flujo

## Checks añadidos al harness

- Nuevas vistas auditadas:
  - `quotes`
  - `jobs`
- Nuevos escenarios de create-flow:
  - `quotes-create`
  - `jobs-create`
  - `expenses-create`
  - `payments-create`
- Nueva espera explicita para que `home` no se audite mientras sigue en loading real.
- Nuevos checks de overlay/StepFlow:
  - overlay visible
  - titulo del flow visible
  - primer campo visible
  - sin overflow horizontal
  - StepFlow presente

## Acciones no ejecutadas para no mutar datos

- no se hizo submit final en ningun create/edit flow
- no se convirtio presupuesto a factura
- no se emitio recurrente
- no se registraron cobros reales
- no se guardaron gastos reales

## Resultado final

- `npm run lint`: OK
- `npm run build`: OK
- `npm run test`: OK
- `npm run qa:visual:auth`: `360/360`

## Deuda pendiente

- recurrentes sigue sin ruta standalone auditada por harness porque el producto no la expone
- `quotes`, `jobs`, `expenses` y `payments` aun pueden adelgazar copy secundaria en un sprint posterior, pero ya cumplen el gate operativo de esta pasada

## Confirmacion de alcance protegido

- no se tocaron Supabase, SQL, RPC, migrations, auth productivo, rutas, `?view=`, `financialWriteApi`, numeracion, fiscalidad global, persistencia ni contratos
