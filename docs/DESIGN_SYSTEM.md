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

### Density

- `dsDensity`
- `--ds-density-compact`
- `--ds-density-comfortable`
- `--ds-density-spacious`

### Motion / GSAP foundation

- `src/design-system/motion/gsap.ts`
- `src/design-system/motion/useReducedMotion.ts`
- `src/design-system/motion/useGsapEntrance.ts`
- `src/design-system/motion/motionPresets.ts`
- `src/design-system/motion/index.ts`

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
- `DSProFormField`
- `DSInlineSuggestionList`
- `DSSmartPostalCodeInput`
- `DSSmartLocationFields`
- `DSConceptAutocomplete`

## Motion system disponible

- `useReducedMotion`
- `useGsapEntrance`
- `motionPresets`
- `motionDurationFast`
- `motionDurationBase`
- `motionDurationSlow`
- `motionEaseStandard`
- `motionEaseExit`
- `motionEaseEmphasized`
- `ensureGsapRegistration`
- `registerGsapPlugins`

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
- `DSProFormField`
- `DSInlineSuggestionList`
- `DSSmartPostalCodeInput`
- `DSSmartLocationFields`
- `DSConceptAutocomplete`

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
6. `DSSmartPostalCodeInput` solo debe usarse donde `postal_code` y `city` ya existan como campos separados.
7. `DSSmartLocationFields` es el nombre recomendado para formularios nuevos o endurecidos; `DSSmartPostalCodeInput` sigue existiendo por compatibilidad.
8. `DSConceptAutocomplete` puede enriquecer formularios, pero nunca sustituir validaciones o reglas de estructura de dominio.

## Reglas de estados y feedback

- `DSEmptyState`: usarlo cuando falten datos, resultados o contexto; debe explicar que falta y cual es la siguiente accion recomendada.
- `DSErrorState`: usarlo para errores visibles al usuario con copy humana; evitar mensajes tecnicos crudos salvo que sean la unica pista util.
- `DSLoadingState`: usarlo en cargas estructurales o previews diferidos; preferir contexto claro frente a spinners sin texto.
- `DSConfirmDialog`: wrapper preferido para acciones destructivas, irreversibles o de salida documental; no anadir confirmaciones innecesarias a acciones ligeras.
- `FeedbackDialog` existente sigue siendo valido para exito/error puntual cuando la accion ya vive en ese patron, pero nuevas superficies deben priorizar primitives DS o toasts del sistema ya existente.
- Warnings fiscales, mismatch y riesgos criticos no deben suavizarse: la consistencia de feedback no puede ocultar severidad real.

## Reglas de accesibilidad y tactilidad

- `DSButton` debe mantener `focus-visible` explicito y altura minima de `44px`.
- `DSFilterChip` y acciones compactas equivalentes deben respetar `44px` de alto minimo salvo justificacion fuerte de desktop-only.
- Las superficies que extienden `FullscreenStepFlow` deben conservar foco visible en pasos, toggles de apoyo y acciones del footer.
- Cuando un control compactado pierda claridad de foco o baje de `44px`, debe tratarse como regresion del sistema, no como ajuste cosmetico local.

## Reglas de motion

- GSAP solo entra a la app a traves de `src/design-system/motion/`.
- Ningun componente de negocio debe importar `gsap` directamente en esta fase.
- Toda animacion debe respetar `prefers-reduced-motion`.
- No registrar `ScrollTrigger` globalmente sin sprint especifico.
- Las animaciones compartidas deben ser cortas, sobrias y no bloquear la interaccion.

## Reglas de densidad

- Compactar primero shells, headers, side summaries y footers antes de tocar formularios de negocio.
- Reducir microcopy repetida antes de ocultar datos utiles.
- Mantener targets tactiles de `44px` incluso cuando la UI se compacte.
- Un bloque compacto sigue necesitando una accion primaria clara.

## GSAP plugins approved usage

- El registro de plugins pasa por `src/design-system/motion/gsapPlugins.ts`.
- La disponibilidad real se consulta via `getGsapPluginAvailability()`.
- `DrawSVGPlugin` solo debe usarse con fallback.
- `SplitText` solo para titulares cortos.
- `Flip` solo para cards o listas pequenas.
- `Observer` y `Draggable` quedan preparados, pero restringidos a casos aislados y no criticos.
- `ScrollSmoother`, `InertiaPlugin`, `Physics2DPlugin`, `PhysicsPropsPlugin`, `PixiPlugin`, `EaselPlugin`, `GSDevTools`, `ScrambleTextPlugin` y `TextPlugin` quedan pospuestos o prohibidos por ahora.

## Patron de SVG charts animados

Para dashboards ligeros:

- usar SVG nativo
- encapsular la card en un wrapper como `HomeGsapChartCard`
- usar `drawSvgPath()` solo con fallback seguro
- usar `useGSAP` y `useGsapEntrance` a traves de la capa compartida
- limitar el chart a una lectura corta y accionable

Reglas:

- no usar charts decorativos sin decision asociada
- no animar importes como contadores
- no introducir librerias externas de charts
- no usar canvas si SVG resuelve el caso
- reduced motion debe renderizar el estado final

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
6. Adoptar motion primero en primitives compartidas y overlays antes de tocar superficies criticas de negocio.
