# Release Candidate Visual QA

Fecha: 2026-06-30

## Estado general

- QA responsive ejecutado en navegador real sobre las superficies accesibles en local.
- Hallazgo visual real corregido: scroll vertical residual en login desktop bajo.
- Los modulos internos no pudieron auditarse visualmente en navegador porque el navegador embebido no disponia de sesion autenticada y la app abre `AuthPage`.

## Breakpoints revisados

- Movil: `390x844`
- Movil: `430x932`
- Tablet: `768x1024`
- Desktop: `1366x768`
- Desktop: `1440x900`

## Modulos revisados

Revisados visualmente en navegador:

- Login (`AuthPage`)
- `dev/step-flow-preview` como superficie real reutilizable del sistema visual y overlays guiados

Revisados por codigo, pero no navegables en esta fase por falta de sesion:

- Home
- Alertas
- Cierre fiscal
- Facturas
- Cobros
- Presupuestos
- Servicios
- Gastos
- Clientes
- Propiedades

## Hallazgos por modulo

### Login

- Sin scroll horizontal en los breakpoints revisados.
- Inputs y CTA con tamano correcto en movil.
- A `1366x768` existia scroll vertical residual por exceso de altura de la tarjeta.

### Step flow preview

- Sin scroll horizontal en `390x844`, `430x932`, `768x1024`, `1366x768` y `1440x900`.
- El overlay mantiene CTA visibles y progreso legible.
- La ruta sirve para validar el sistema visual comun, pero no sustituye QA visual de los modulos internos autenticados.

### Modulos internos

- Bloqueados en navegador por falta de sesion autenticada real en el entorno embebido.
- No se fuerza cobertura falsa sobre Home, Alertas, Cierre fiscal, Facturas, Cobros, Presupuestos, Servicios, Gastos, Clientes ni Propiedades.

## Correcciones aplicadas

- `src/features/auth/auth.css`
  - Ajuste responsive especifico para desktop de poca altura (`min-width: 901px` y `max-height: 820px`).
  - Reduccion menor de padding, gaps, logo y altura de campos para eliminar el scroll residual en login sin tocar logica ni layout movil.

## Limitaciones del QA

- El navegador embebido abre la app en login y no tenia sesion heredada para entrar a las vistas internas.
- No se introdujeron credenciales ni se forzo un bypass artificial.
- El QA visual en navegador cubre acceso, sistema visual compartido y comportamiento responsive basico, pero no una navegacion autenticada completa.

## Validaciones ejecutadas

- `npm run lint`
- `npm run build`
- `npm run test`

## Recomendacion final

- `listo con observaciones`

Observacion principal:

- Antes de una release externa o cierre visual definitivo de modulos internos, conviene repetir una pasada browser-authenticated sobre Home, Alertas, Cierre fiscal, Facturas, Cobros, Presupuestos, Servicios, Gastos, Clientes y Propiedades.
