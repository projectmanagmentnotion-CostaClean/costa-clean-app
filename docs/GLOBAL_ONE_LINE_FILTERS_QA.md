# Global One-Line Filters QA

## Problema observado

- varias listas seguian mostrando filtros como paneles largos con grupos completos de chips.
- gastos era el caso mas evidente: categoria, soporte, revision, riesgo, enfoque fiscal y clasificacion quedaban visibles a la vez.
- facturas, trabajos y otras listas heredaban una barra correcta en logica, pero todavia demasiado abierta en presentacion.

## Regla global final

- una sola superficie de control por lista.
- busqueda siempre primero.
- 3-5 chips rapidos visibles como maximo.
- orden resumido en un solo control compacto.
- filtros avanzados ocultos en popover o sheet compacto.
- limpiar vista solo cuando existan filtros activos.

## Componentes cambiados

- `src/design-system/components/DSListControlBar.tsx`
- `src/design-system/components/DSActiveFilters.tsx`
- `src/design-system/components/DSCompactFilterGroup.tsx`
- `src/design-system/components/DSFilterSummaryButton.tsx`
- `src/design-system/components/design-system.css`
- `src/features/shell/shell-dashboard.css`

## Listas auditadas

- `LeadsPage`
- `ClientsList`
- `PropertiesList`
- `QuotesList`
- `InvoicesList`
- `JobsList`
- `PaymentsList`
- `ExpensesList`

## Modulos actualizados

- clientes
- propiedades
- leads
- presupuestos
- facturas
- servicios
- cobros
- gastos

## Comportamiento desktop

- la primera linea queda en `buscar + chips rapidos + orden + filtros + limpiar`.
- el resto de filtros vive en una capa flotante compacta anclada a la barra.
- los filtros activos se resumen debajo con tags compactas y contador de overflow.

## Comportamiento movil

- la busqueda sigue primero.
- los chips y botones compactos se reordenan en wrap limpio.
- el panel avanzado deja de empujar el listado y pasa a sheet fijo inferior.

## Excepciones

- `AnnualClosingPage` y `QuarterlyClosingPage` siguen usando filtros propios fuera de `ListToolbar`. No se tocaron en este sprint porque no forman parte de la capa comun de listas ni del objetivo principal de una sola linea.

## Que no se toco

- logica de filtrado
- datos
- contratos de preferencias
- `storageKey`
- rutas
- `?view=`
- Supabase
- `appDataApi`
- `financialWriteApi`

## Riesgos pendientes

- la priorizacion de chips rapidos se basa en el primer grupo de filtros configurado por cada modulo. Si un modulo necesita accesos rapidos distintos, debe declararlos de forma explicita en una fase posterior.
- las pantallas de cierre fiscal mantienen controles propios y merecen una migracion separada si se quiere homogeneidad total.

## Recomendacion

- mantener `ListToolbar` o `DSListControlBar` como unica puerta de entrada para nuevos filtros de listas.
- no volver a desplegar grupos completos de chips dentro del flujo vertical principal.
