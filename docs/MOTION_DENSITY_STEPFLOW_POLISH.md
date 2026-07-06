# Motion Density StepFlow Polish

## Objetivo

Compactar StepFlow, overlays y barras de accion compartidas para reducir scroll, microcopy y ruido visual, usando GSAP solo en transiciones de superficie utiles.

## Superficies ajustadas

- `src/components/FullscreenStepFlow.tsx`
- `src/components/fullscreen-step-flow.css`
- `src/components/ActionFlowOverlay.tsx`
- `src/components/action-flow-overlay.css`
- `src/components/ConfirmDialog.tsx`
- `src/features/shared/fullscreen-create-flow.css`
- `src/design-system/layout/DSBottomActionBar.tsx`
- `src/design-system/layout/ds-layout.css`
- `src/design-system/components/DSListControlBar.tsx`

## Flujos con copy y densidad ajustada

- `src/features/publicIntake/PublicQuoteRequestForm.tsx`
- `src/features/quotes/QuoteCreateFlow.tsx`
- `src/features/quotes/QuoteEditFlow.tsx`
- `src/features/jobs/JobCreateFlow.tsx`
- `src/features/properties/PropertyCreateFlow.tsx`
- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/invoices/InvoiceEditFlow.tsx`
- `src/features/clients/ClientCreateForm.tsx`

## Cambios reales

- Header de StepFlow mas corto y menos dominante.
- Meta de progreso, pills y cards laterales con menos padding.
- Footer sticky mas compacto y con acciones mas cercanas a la consecuencia.
- `ActionFlowOverlay` y `ConfirmDialog` con entrada GSAP corta y cleanup automatico.
- `FullscreenStepFlow` con transicion GSAP de paso, sin animar campos individualmente.
- Copy de apoyo resumida en flows largos para evitar lectura repetitiva.
- `DSListControlBar` y `DSBottomActionBar` con menos texto decorativo.

## Reglas de motion aplicadas

- Solo `fadeIn`, `sheetEnter`, `modalEnter` y `stepTransition`.
- Nada de parallax, pinning, scrub, scroll hijacking ni animacion de importes.
- `prefers-reduced-motion` resuelve al estado final sin transicion.
- La animacion no bloquea foco, click ni warnings.

## Lo que no se toco

- Supabase, SQL, RPC, migrations y auth.
- Rutas publicas y mecanismo `?view=`.
- `appDataApi`, `financialWriteApi`, numeracion, fiscalidad, totales y persistencia.
- Reglas de negocio de presupuestos, facturas, clientes, servicios o intake.

## Limitaciones pendientes

- Algunos formularios siguen teniendo validacion y copy inline dentro del propio archivo.
- Facturas sigue necesitando desacople futuro del workspace si se quiere reducir mas densidad sin riesgo.
- `ConfirmDialog` comparte estilos legacy en CSS de shell; la compactacion visual futura debe coordinar esa capa.
