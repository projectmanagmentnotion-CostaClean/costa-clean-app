# Design System

## Objetivo

Este sprint crea una base de design system reusable y compatible sobre componentes ya vivos del repo. No migra modulos productivos completos ni cambia logica funcional.

## Estructura creada

- `src/design-system/index.ts`
- `src/design-system/tokens/`
  - `design-system-tokens.css`
  - `tokens.ts`
  - `index.ts`
- `src/design-system/components/`
  - `design-system.css`
  - `DSButton.tsx`
  - `DSCard.tsx`
  - `DSInput.tsx`
  - `DSTextarea.tsx`
  - `DSSelect.tsx`
  - `DSBadge.tsx`
  - `DSTag.tsx`
  - `DSPageHeader.tsx`
  - `DSSectionHeader.tsx`
  - `DSEmptyState.tsx`
  - `DSErrorState.tsx`
  - `DSLoadingState.tsx`
  - `DSSkeleton.tsx`
  - `DSConfirmDialog.tsx`
  - `index.ts`
- `src/design-system/layout/`
  - `DSBottomActionBar.tsx`
  - `ds-layout.css`

## Tokens disponibles

La capa nueva no inventa otro universo visual. Referencia el sistema actual de variables ya presente en `src/index.css`.

### Spacing

- `dsSpacing`
- CSS vars `--ds-space-1` a `--ds-space-9`

### Radius

- `dsRadius`
- CSS vars `--ds-radius-xs` a `--ds-radius-pill`

### Typography

- `dsTypography`
- `--ds-font-display`
- `--ds-font-size-caption`
- `--ds-font-size-body`
- `--ds-font-size-title`
- `--ds-font-size-hero`

### Shadows

- `dsShadows`
- `--ds-shadow-sm`
- `--ds-shadow-md`
- `--ds-shadow-lg`
- `--ds-shadow-shell`

### Motion

- `dsMotion`
- `--ds-motion-fast`
- `--ds-motion-base`
- `--ds-motion-slow`
- `--ds-motion-spring`

### Semantic colors

- `dsColors`
- Todas las referencias apuntan a variables existentes como `--cc-color-brand`, `--cc-color-surface`, `--cc-color-danger`, etc.

## Componentes disponibles

- `DSButton`
- `DSCard`
- `DSInput`
- `DSTextarea`
- `DSSelect`
- `DSBadge`
- `DSTag`
- `DSListControlBar`
- `DSSearchInput`
- `DSFilterChip`
- `DSSortMenu`
- `DSActiveFilters`
- `DSPageHeader`
- `DSSectionHeader`
- `DSEmptyState`
- `DSErrorState`
- `DSLoadingState`
- `DSSkeleton`
- `DSBottomActionBar`
- `DSConfirmDialog`

## Equivalencias con componentes actuales

### Wrappers directos

- `DSPageHeader` -> `ExecutiveHeader`
- `DSBadge` -> `SeverityBadge`
- `DSLoadingState` -> `DeferredContentFallback`
- `DSConfirmDialog` -> `ConfirmDialog`
- `DSSearchInput` -> `SearchBar`
- `DSListControlBar` -> `ListToolbar`

### Compatibilidad basada en clases existentes

- `DSButton` reutiliza `primary-button` y `secondary-button`
- `DSEmptyState` reutiliza `empty-state`
- `DSErrorState` reutiliza `cc-alert cc-alert--error`

### Piezas nuevas ligeras

- `DSCard`
- `DSInput`
- `DSTextarea`
- `DSSelect`
- `DSTag`
- `DSSectionHeader`
- `DSSkeleton`
- `DSBottomActionBar`
- `DSFilterChip`
- `DSSortMenu`
- `DSActiveFilters`

Estas piezas nuevas no cambian imports existentes ni fuerzan migracion masiva.

## Patron de listas consolidado

Sprint 9A suma una base oficial para listas operativas:

- `DSListControlBar`
- `DSSearchInput`
- `DSFilterChip`
- `DSSortMenu`
- `DSActiveFilters`

Regla:

- una lista = una sola barra de control
- la barra debe concentrar busqueda, filtros, orden y reset
- `ListToolbar` sigue vivo como wrapper compatible para modulos ya integrados

Superficies ya alineadas:

- `ClientsList`
- `PropertiesList`
- `LeadsPage`
- `QuotesList` via wrapper
- `InvoicesList` via wrapper seguro

## Reglas de uso

1. Preferir wrappers si ya existe un equivalente maduro.
2. No duplicar componentes de dominio como `VisualKpiCard`, `ActionChecklist` o `FullscreenStepFlow`.
3. Usar tokens `ds*` o `--ds-*` en nuevas piezas de UI antes de crear nuevos valores hardcoded.
4. Mantener `Facturas`, `financialWriteApi`, `auth`, `Supabase`, rutas y shell critico fuera de cualquier migracion visual directa en esta fase.
5. Introducir nuevos componentes de design system solo para primitives o layout helpers, no para encapsular reglas de negocio.

## Reglas de estados y feedback

- `DSEmptyState`: usarlo cuando falten datos, resultados o contexto; debe explicar que falta y cual es la siguiente accion recomendada.
- `DSErrorState`: usarlo para errores visibles al usuario con copy humana; evitar mensajes tecnicos crudos salvo que sean la unica pista util.
- `DSLoadingState`: usarlo en cargas estructurales o previews diferidos; preferir contexto claro frente a spinners sin texto.
- `DSConfirmDialog`: wrapper preferido para acciones destructivas, irreversibles o de salida documental; no anadir confirmaciones innecesarias a acciones ligeras.
- `FeedbackDialog` existente sigue siendo valido para exito/error puntual cuando la accion ya vive en ese patron, pero nuevas superficies deben priorizar primitives DS o toasts del sistema ya existente.
- Warnings fiscales, mismatch y riesgos criticos no deben suavizarse: la consistencia de feedback no puede ocultar severidad real.

## Que NO se migro todavia

- `Dashboard`
- `Intake publico`
- `Presupuestos`
- `Facturas`
- `Clientes`
- `Servicios`
- `Finanzas`
- `AppShell`
- imports existentes del repo

Tampoco se tocaron:

- `Supabase`
- `auth`
- rutas
- `financialWriteApi`
- numeracion de facturas
- `appDataApi`

## Hallazgos reales relacionados con la fundacion

- El repo ya tenia una base fuerte de variables y clases reutilizables en `src/index.css`, `src/App.css`, `src/components/visual-ux-system.css` y `src/features/shell/*.css`.
- Existe duplicacion historica de bloques `:root` y redefiniciones visuales dentro de `src/index.css`. No se corrige en este sprint, pero debe tratarse como higiene futura.
- `ExecutiveHeader`, `SeverityBadge`, `ConfirmDialog` y `DeferredContentFallback` ya eran buenos candidatos a wrapper en lugar de reemplazo.

## Proximos pasos recomendados

1. Usar esta capa en Sprint 3 para helpers de StepFlow y estados comunes.
2. Aplicar primero a superficies pequenas o nuevas, no a modulos criticos.
3. En Sprint 4+, estudiar limpieza de duplicacion de tokens en `src/index.css` sin mezclarlo con cambios funcionales.
4. En Sprint 5+, migrar headers, states y form primitives por modulo de forma incremental.
5. Reusar el patron de listas en servicios, cobros, gastos y modulos auxiliares antes de crear toolbars ad hoc nuevas.
