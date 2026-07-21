# Full App Audit — 2026-07-21

## Objetivo y alcance

Auditoría integral de Costa Clean sobre el HEAD inicial `dbd63b2bff6cbeb2037c180172c549c5c903793c`, orientada a detectar problemas reales de producción y corregir únicamente los que admiten un cambio local, mínimo y seguro.

La evidencia combina:

- inventario de 417 archivos bajo `src/`
- revisión de arquitectura, rutas, módulos, design system, auth y clientes API/Supabase
- búsquedas estáticas de TypeScript débil, catches vacíos, supresiones, TODO, fetch y focos de accesibilidad
- `npm run lint`, `npm run build` y `npm run test`
- QA visual autenticada contra el build actual aislado en sandbox
- agente end-user en modo `dry-run`, sin submits

No se tocaron producción, schema, migraciones, auth productivo, facturas, cobros, numeración, `financialWriteApi` ni datos reales.

## Identidad del entorno auditado

La primera URL local detectada, `127.0.0.1:4173`, servía otro producto y quedó descartada inmediatamente. No se usó ningún resultado obtenido contra esa URL. Costa Clean se compiló en modo QA, se sirvió en `127.0.0.1:4174` y se verificó por el título `CostaClean CRM` antes de continuar.

Este incidente originó una corrección del harness: ya no acepta cualquier Vite local como Costa Clean y valida la identidad del producto también después de abrir una sesión CDP.

## Arquitectura detectada

| Capa | Implementación real | Observación |
| --- | --- | --- |
| Entry y auth | `src/App.tsx`, `src/features/auth/AuthPage.tsx`, `src/lib/supabase.ts` | Bootstrap explícito, rutas públicas aisladas y errores recuperables diferenciados. |
| Shell | `src/app/AppShell.tsx`, `src/app/AppNav.tsx`, `src/app/AppShellViewRenderer.tsx` | Orquesta vistas por `?view=`, prefills y navegación responsive. Zona de alto radio de impacto. |
| Rutas internas | `src/app/navigation.ts`, `src/app/useShellNavigation.ts`, `src/app/publicStandaloneRoutes.ts` | No existe `src/routes/`; la navegación viva se concentra en `src/app/`. |
| Páginas | `src/pages/` | Once páginas lazy en `AppShellPages`; cierre trimestral/anual se mantiene como superficie legacy o alias. |
| Dominios | `src/features/` | Clientes, propiedades, leads, presupuestos, servicios, facturas, gastos, cobros, cierres, alertas y formularios públicos. |
| API/read layer | `src/app/appDataApi.ts`, `src/lib/supabaseRest.ts`, APIs por feature | Fallbacks de compatibilidad y propagación explícita de errores REST. |
| Writes | APIs por dominio y `src/features/financial/financialWriteApi.ts` | Zona protegida. No se ejecutó ni modificó ningún write financiero. |
| Design system | `src/design-system/`, `src/components/`, `src/features/shell/` | Primitives, StepFlow, overlays, filtros, estados y motion compartidos. |
| QA | `scripts/qa/` | Harness CDP autenticado, visual multi-viewport, dry-run y guardrails de sandbox. |
| Backend auxiliar | `api/` | Endpoints serverless para intake, borradores e inteligencia; revisión estática, sin invocaciones productivas. |

No existen `src/modules/`, `src/routes/` ni `src/styles/`; no es un defecto por sí mismo porque las responsabilidades equivalentes están cubiertas por `src/app/`, `src/pages/`, `src/features/` y hojas co-localizadas.

## Inventario de módulos y cobertura

| Módulo | Archivos principales | Flujo principal | Evidencia de este sprint | Riesgo |
| --- | --- | --- | --- | --- |
| Inicio | `HomePage.tsx`, `features/dashboard/*` | Leer prioridad y abrir acción | QA viva mobile/tablet/desktop | medio |
| Alertas | `AlertsCenterPage.tsx`, `features/alerts/*`, `features/automation/*` | Revisar y navegar a incidencia | código; no forma parte del set visual por defecto | medio |
| Leads | `LeadsPage.tsx`, `features/leads/*`, `features/leadDrafts/*` | Buscar, revisar y convertir | código; no forma parte del set visual por defecto | alto por captación |
| Clientes | `ClientsPage.tsx`, `features/clients/*` | listar, abrir workspace, alta/cancelación | QA viva y dry-run | alto por datos y relaciones |
| Propiedades | `PropertiesPage.tsx`, `features/properties/*` | listar, abrir workspace, alta/cancelación | QA viva y dry-run | alto por relación cliente-servicio |
| Presupuestos | `QuotesPage.tsx`, `features/quotes/*` | alta guiada y lectura documental | QA viva y dry-run | alto por conversión y handoff |
| Servicios | `JobsPage.tsx`, `features/jobs/*` | agenda, alta, contexto y base de cobro | QA viva y dry-run | alto por write path y líneas |
| Facturas | `InvoicesPage.tsx`, `features/invoices/*` | lectura y apertura segura del flujo | QA viva y dry-run sin submit | crítico |
| Cobros | `PaymentsPage.tsx`, `features/payments/*` | lectura y apertura segura del flujo | QA viva y dry-run sin submit | crítico |
| Gastos | `ExpensesPage.tsx`, `features/expenses/*` | alta guiada y lectura fiscal | QA viva y dry-run sin submit | alto |
| Cierre fiscal | `FiscalClosingPage.tsx`, `features/closing/*` | lectura de importe/periodo y exportación | QA viva y dry-run de lectura | crítico |
| Auth/Login | `App.tsx`, `AuthPage.tsx`, `lib/supabase.ts` | bootstrap, login, sesión, logout | detección de shell + código; no se alteró auth | crítico |
| Navegación | `AppNav.tsx`, `navigation.ts`, `useShellNavigation.ts` | cambio de vista y retorno contextual | QA viva multi-viewport | alto por alcance transversal |
| Formularios/StepFlow | `FullscreenStepFlow.tsx`, flows por feature | entrada, validación, revisión, cancelación | QA viva y dry-run | alto según dominio |
| Listas/filtros | `DSListControlBar.tsx`, `ListToolbar.tsx`, listas por feature | búsqueda, filtro, orden, selección | QA viva en módulos principales | medio |
| Estados globales | `DSPageLoading`, `DSEmptyState`, `DSErrorState`, toasts | loading, empty, error, feedback | QA viva + código | medio |
| Configuración/KPIs | `app/modules.ts` | definición declarativa | no existe vista viva en `AppView` | bajo/deuda |
| Intake y quiz públicos | páginas y features públicas | captación sin shell | revisión de código; no submit | alto por conversión |

## Zonas críticas

- Supabase, RLS, RPC y contratos de datos.
- Auth y almacenamiento de sesión.
- Facturación, numeración, emisión, fiscalidad y cobros.
- `financialWriteApi` y cualquier submit final.
- Reasignación de propiedades y edición de servicios.
- Shell central y navegación por su radio de impacto.

## Zonas seguras para corrección

- estado inicial de StepFlows sin cambiar validación ni persistencia
- guardrails del harness QA
- tests puros y selectores estables
- copy y jerarquía local cuando existe evidencia visual
- documentación, inventario y clasificación de riesgos

## Auditoría UX/UI y responsive

La pasada visual cubrió 42 combinaciones de vista/flujo en `390x844`, `768x1024` y `1366x900`. Después de la corrección, los 360 checks pasan. Se verificaron overflow horizontal, cabeceras, navegación inferior, primer campo de flows principales, estados operativos y geometría de overlays.

Hallazgo real: el servicio abierto desde una propiedad llegaba al paso `Contexto` aunque cliente y propiedad ya estaban bloqueados. En tablet el primer control editable quedaba fuera del viewport. El flujo ahora comienza en `Agenda` cuando ambos valores vienen fijados; alta general y alta desde cliente conservan `Contexto`.

No se observaron otros fallos visuales en el set autenticado. Alertas, Leads, auth interactivo y rutas públicas no están cubiertos por ese set y no se declaran visualmente cerrados.

## Auditoría funcional

El agente end-user cubrió 33 combinaciones de 11 flows y tres viewports:

- invoice-create
- client-create
- property-create
- quote-create
- expense-create
- payment-create
- job-create
- service-from-client
- service-from-property
- recurring-section
- fiscal-closing

Baseline: `587/588`; fallo único `service-from-property / tablet / firstFieldVisible`.

Post-fix: `588/588`, 3 acciones peligrosas omitidas por política, 0 entidades creadas y 0 cleanups necesarios. Login/logout manual, submits y writes no forman parte de esta evidencia.

## Auditoría técnica

- TypeScript usa `strict`, `noUnusedLocals` y `noUnusedParameters`.
- No se detectaron `catch` vacíos, `any`, `@ts-ignore`, `@ts-expect-error`, TODO o FIXME en `src/` con la búsqueda realizada.
- Lint, compilación y 175 tests pasaban en baseline.
- Las páginas principales usan lazy loading mediante `AppShellPages`.
- Build baseline: JS principal aproximado `372.66 kB` (`104.45 kB` gzip) y CSS principal `386.44 kB` (`58.97 kB` gzip).
- Existen assets PNG de marca entre aproximadamente `560 kB` y `868 kB`, además de `wave-bg.png` de aproximadamente `643 kB`.
- `shell-dashboard.css` supera `300 kB` en fuente y coexiste con capas de polish/estructura; requiere consolidación separada, no borrado oportunista.
- Hay componentes de dominio de más de 40–60 kB en facturas, servicios, clientes y cierres; su tamaño es deuda, no autorización para refactor masivo.
- El cliente central de Supabase mantiene sesión y errores de configuración explícitos. Los reads REST permiten access token y convierten respuestas no OK en errores estructurados.

## Hallazgos por severidad

### P0 — Crítico

Ninguno confirmado.

### P1 — Alto

1. **Target QA ambiguo — corregido.** El autodetector aceptaba cualquier respuesta de `4173/5173`; se reprodujo con otro producto local en `4173`. El harness ahora exige identidad Costa Clean antes de usar el target.
2. **Writes directos con bearer anónimo — documentado, no corregido.** `PropertyDetailCard` y `JobDetailCard` construyen PATCH/RPC directos con el anon key como bearer. Puede fallar bajo RLS autenticada o depender de policies demasiado amplias. Cambiarlo requiere sprint dedicado, sesión de usuario real, pruebas sandbox de escritura/cleanup y revisión de contratos.

### P2 — Medio

1. **Servicio contextual tablet sin campo accionable — corregido.** El StepFlow de propiedad omite el paso ya resuelto y abre en Agenda.
2. **Errores REST demasiado técnicos en edición — documentado.** Las mismas superficies directas presentan cuerpo/status REST al usuario. Debe resolverse junto al write-path para no ocultar evidencia durante una migración parcial.
3. **Assets de marca pesados — documentado.** Hay alternativas SVG en el repo, pero su equivalencia visual y contractual debe auditarse antes de sustituir PNG usados por documentos y shell.

### P3 — Polish

1. `kpis` y `settings` están declarados en `appModules` pero no son vistas vivas de `AppView`; no aparecen como rutas operativas.
2. El bundle global y las capas CSS admiten una pasada de presupuesto y consolidación, sin urgencia funcional demostrada.
3. Los archivos starter `vite.svg` y `react.svg` no tienen referencias detectadas y pueden retirarse en un sprint de higiene.

### P4 — Deuda

1. Duplicación histórica entre `JobCreateForm` y `JobCreateFlow`.
2. `AnnualClosingPage` y `QuarterlyClosingPage` son superficies grandes/legacy frente al cierre fiscal vivo.
3. Componentes y hojas de estilo muy grandes elevan el coste de revisión, pero su refactor debe ser modular y con QA viva.

## Resultado

El alcance seguro del sprint queda cerrado con dos correcciones verificadas. Los riesgos de write-path, assets y consolidación permanecen explícitos y no se maquillan como corregidos.

Evidencia de cambios y rollback: [FULL_APP_AUDIT_FIXES_20260721.md](FULL_APP_AUDIT_FIXES_20260721.md).
