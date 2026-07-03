# App Shell Navigation

## Objetivo de este documento

Dejar documentado como navega hoy la app interna, que vistas estan realmente vivas y que decisiones de Sprint 4 se aplicaron sin cambiar rutas, auth, Supabase ni el mecanismo `?view=`.

## Como funciona la navegacion actual

- Las rutas publicas standalone se resuelven antes de auth y antes del shell desde `src/App.tsx`.
- La app autenticada no usa paths internos por modulo.
- La navegacion interna del shell depende de `?view=` y se centraliza en `src/app/useShellNavigation.ts`.
- `readViewFromLocation()` lee la vista desde la URL actual.
- `writeViewToLocation()` persiste la vista en el query param.
- `navigateToView()` y `navigateBack()` aplican guardas de cambios pendientes antes de cambiar la vista.
- `src/app/navigation.ts` define el set oficial de vistas soportadas.
- `src/app/AppShell.tsx` decide que pantalla renderizar para cada vista viva.
- `src/app/AppNav.tsx` define la navegacion realmente visible para desktop y movil.

## Vistas vivas detectadas

| Vista | Navegacion visible | Render actual | Observacion |
| --- | --- | --- | --- |
| `dashboard` | Si | `HomePage` | Vista inicial del shell |
| `alerts` | Solo acceso secundario | `AlertsCenterPage` | Accesible por campana y sheet movil |
| `fiscal_closing` | Si | `FiscalClosingPage` | Entrada principal del area de cierre |
| `quarterly_closing` | No como item propio | `FiscalClosingPage` | Alias vivo del cierre |
| `annual_closing` | No como item propio | `FiscalClosingPage` | Alias vivo del cierre |
| `leads` | Si | `LeadsPage` | Modulo comercial |
| `clients` | Si | `ClientsPage` | Base de clientes |
| `properties` | Si | `PropertiesPage` | Base de inmuebles |
| `quotes` | Si | `QuotesPage` | Presupuestos |
| `jobs` | Si | `JobsPage` | Servicios |
| `invoices` | Si | `InvoicesPage` | Zona critica, no tocada en Sprint 4 |
| `payments` | Si | `PaymentsPage` | Cobros |
| `expenses` | Si | `ExpensesPage` | Gastos |

## Vistas declaradas pero no vivas

Detectadas en tipos/configuracion, no en la navegacion viva del shell actual:

| Modulo o vista | Fuente | Estado |
| --- | --- | --- |
| `kpis` | `src/app/modules.ts`, `src/types/app.ts` | Declarado, no visible |
| `settings` | `src/app/modules.ts`, `src/types/app.ts` | Declarado, no visible |

## Drift y alias relevantes

- `fiscal_closing` es la entrada viva de navegacion.
- `annual_closing` y `quarterly_closing` siguen soportadas por el router interno y renderizan la misma superficie `FiscalClosingPage`.
- Antes de Sprint 4, esos aliases podian dejar la navegacion sin estado activo claro en el shell.
- Sprint 4 corrige solo esa capa visual: si la vista actual es `annual_closing` o `quarterly_closing`, el shell marca activo el item de cierre fiscal.

## Navegacion realmente visible al usuario

### Desktop

- Cabecera superior con marca, sync, toggle de tema, alertas y accion de volver.
- Rail horizontal por secciones:
  - `General`: Inicio
  - `Comercial`: Leads
  - `Base`: Clientes, Inmuebles
  - `Operaciones`: Presupuestos, Servicios
  - `Finanzas`: Facturas, Cobros, Gastos
  - `Cierre`: Cierre fiscal

### Movil

- Header compacto sticky con titulo de vista, seccion, sync, toggle y alertas.
- Bottom dock con accesos prioritarios:
  - `Inicio`
  - `Clientes`
  - `Servicios`
  - `Facturas`
  - `Mas`
- Sheet secundario agrupado por secciones para el resto de modulos y acceso a `Alertas`.

## Decisiones tomadas en Sprint 4

- Se mantiene intacto el mecanismo `?view=`.
- No se cambian rutas publicas.
- No se toca auth.
- No se toca Supabase.
- No se toca `AppShell` a nivel de orquestacion funcional.
- No se activan `kpis` ni `settings`.
- No se migran modulos a StepFlow.
- Se ordena la jerarquia visual del shell agrupando la navegacion por secciones en desktop y en el sheet movil.
- Se unifica la etiqueta principal de `dashboard` como `Inicio` en la navegacion.
- Se corrige el estado activo visual para aliases de cierre fiscal.

## Riesgos vigentes

- `src/app/AppShell.tsx` sigue concentrando demasiada orquestacion cross-module.
- `?view=` sigue siendo un router interno funcional, pero menos expresivo que rutas dedicadas.
- El drift entre modulos declarados y modulos vivos sigue presente y solo queda documentado.
- `alerts` sigue siendo una vista viva con acceso secundario, no un modulo principal de rail.
- Facturas sigue siendo zona critica y queda fuera del alcance de este sprint.

## Que no se toco

- Rutas publicas y su aislamiento previo a auth.
- Auth y bootstrap de sesion.
- Supabase, write paths o capas de datos.
- Facturas, numeracion de facturas, `financialWriteApi` y `appDataApi`.
- Logica funcional de navegacion o render de vistas.
- Activacion de modulos no vivos.
- Backups `.bak-*`.

## Proximo paso recomendado

Sprint 5 deberia trabajar Dashboard con criterio decision-first, ya apoyado en un shell mas legible y con jerarquia de navegacion documentada.
