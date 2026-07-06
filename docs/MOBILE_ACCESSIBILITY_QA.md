# Mobile Accessibility QA

## Resumen

Sprint 13 ejecuta una pasada segura de accesibilidad, mobile QA y responsive polish sin tocar logica de negocio, persistencia, rutas, `?view=` ni modulos criticos.

El trabajo se centra en primitives compartidas y StepFlow oficial para corregir deuda transversal con el menor radio de impacto posible.

## Superficies auditadas

### Auditadas en navegador local

- `src/features/auth/AuthPage.tsx`
- `src/pages/PublicQuoteRequestPage.tsx`
- `src/features/publicIntake/PublicQuoteRequestForm.tsx`
- `src/components/FullscreenStepFlow.tsx`
- `src/components/ActionFlowOverlay.tsx`
- `src/pages/DevStepFlowPreviewPage.tsx`

### Auditadas por codigo y estructura

- `src/app/AppShell.tsx`
- `src/app/AppNav.tsx`
- `src/app/useShellNavigation.ts`
- `src/pages/HomePage.tsx`
- `src/pages/AlertsCenterPage.tsx`
- `src/pages/LeadsPage.tsx`
- `src/pages/ClientsPage.tsx`
- `src/pages/PropertiesPage.tsx`
- `src/pages/QuotesPage.tsx`
- `src/pages/InvoicesPage.tsx`
- `src/pages/JobsPage.tsx`
- `src/pages/PaymentsPage.tsx`
- `src/pages/ExpensesPage.tsx`
- `src/pages/FiscalClosingPage.tsx`
- `src/design-system/components/DSListControlBar.tsx`
- `src/design-system/components/design-system.css`
- estados globales DS ya consolidados en `src/design-system/components/*` y `src/shared/toasts/*`

## Problemas detectados

1. `FullscreenStepFlow` no anunciaba el paso actual de forma explicita para lector de pantalla al cambiar de paso.
2. Los botones de progreso movil de `FullscreenStepFlow` quedaban en `42px` de alto, por debajo del minimo tactil recomendado.
3. El dismiss mobile de `ActionFlowOverlay` se reducia a `38px` de alto en viewport estrecho.
4. `DSButton` no tenia una regla comun de `:focus-visible`, lo que dejaba foco inconsistente entre primitives nuevas y controles legacy.
5. `DSFilterChip` y el clear action de filtros quedaban por debajo del minimo tactil razonable.
6. El resumen desplegable de apoyo en `FullscreenStepFlow` no tenia estilo de foco visible dedicado.

## Cambios aplicados

### Accesibilidad

- `FullscreenStepFlow` ahora expone:
  - `aria-labelledby` y `aria-describedby` en la superficie principal.
  - `aria-label` explicito en botones de progreso desktop y mobile.
  - `role="status"` + `aria-live="polite"` en el bloque de paso actual.
  - `aria-label` contextual en el aside de apoyo del flow.
- Se anade foco visible comun a:
  - `DSButton`
  - `FullscreenStepFlow` progress steps
  - `FullscreenStepFlow` mobile progress steps
  - `FullscreenStepFlow` mobile summary toggle

### Mobile / responsive

- `FullscreenStepFlow` mobile progress steps suben a minimo `44px`.
- `ActionFlowOverlay` mantiene `44px` de alto minimo tambien en mobile para el boton de cierre.
- `DSFilterChip` y la accion de limpiar filtros suben a minimo `44px`.

## Criterios verificados

- Botones principales con texto visible en las superficies auditadas.
- Inputs del login e intake con label visible.
- `StepFlow` mas comprensible para lector de pantalla.
- Foco visible reforzado en primitives compartidas y controles clave del flow.
- Objetivos tactiles minimos corregidos en chips y acciones clave del flow.
- Sin cambio del mecanismo `?view=`.
- Sin cambios en datos, calculos, submit handlers ni contratos.

## Limitaciones del entorno

- La auditoria visual interactiva completa del shell autenticado no se pudo ejecutar end-to-end sin iniciar sesion real, y este sprint no permite tocar auth ni preparar accesos especiales.
- Se pudo validar en navegador:
  - login
  - intake publico
  - preview dev del StepFlow
- El resto de superficies se revisaron por codigo, semantica, clases responsive y componentes reutilizados.
- No hubo validacion con lector de pantalla real ni suite automatizada de accesibilidad; la verificacion fue manual por DOM, CSS y navegador local.

## Deuda pendiente

- Persisten superficies autenticadas grandes donde parte del foco visible depende de clases legacy fuera del design system.
- `AppShell`, dashboards y workspaces de dominio siguen necesitando una pasada visual autenticada real con datos cargados.
- Document previews y listas densas no se remaquetan en este sprint; solo se corrige la base compartida para no empeorar accesibilidad.

## Recomendaciones futuras

1. Ejecutar una pasada autenticada real sobre shell, dashboard, alertas y workspaces con sesion de QA.
2. Extender las reglas de `focus-visible` a controles legacy que aun no consumen primitives DS.
3. Añadir una checklist operativa de teclado para overlays, listas con filtros y document previews.
4. Mantener `44px` como minimo tactil por defecto en nuevas acciones compactas del sistema.
