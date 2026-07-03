# List Filter Sort Implementation

## Decision tecnica

Sprint 9A no crea un segundo sistema paralelo.

Se toma como base el patron real ya existente en:

- `src/components/ListToolbar.tsx`
- `src/components/SearchBar.tsx`

Y se reorganiza sobre design system con componentes dedicados:

- `src/design-system/components/DSListControlBar.tsx`
- `src/design-system/components/DSSearchInput.tsx`
- `src/design-system/components/DSFilterChip.tsx`
- `src/design-system/components/DSSortMenu.tsx`
- `src/design-system/components/DSActiveFilters.tsx`

`ListToolbar` se mantiene como wrapper compatible para no romper imports vivos en presupuestos y facturas.

## Tipos compartidos

- `src/features/lists/types.ts`
  - `ListSortOption`
  - `ListFilterOption`
  - `ListControlFilter`
  - `ListControlState`

## Utilidades compartidas

- `src/features/lists/utils.ts`
  - `normalizeSearchText`
  - `applyTextSearch`
  - `applySortOption`
  - `recentFirstSort`

## Superficies adaptadas

### Clientes

- archivo: `src/features/clients/ClientsList.tsx`
- vista base:
  - busqueda
  - orden por recientes o nombre
  - filtro `Vista`: activos / inactivos / archivados / todos

### Propiedades

- archivo: `src/features/properties/PropertiesList.tsx`
- vista base:
  - busqueda
  - orden por nombre / cliente / ciudad
  - filtro `Vista`
  - filtro `Tipo` construido desde los tipos reales detectados en la lista cargada

### Leads

- archivos:
  - `src/pages/LeadsPage.tsx`
  - `src/features/leads/LeadsList.tsx`
- cambio estructural:
  - la pagina concentra la barra de control comun
  - la lista queda solo para rendering de resultados
- filtros:
  - estado
  - vista activa / archivada / todas

### Presupuestos

- archivo: `src/features/quotes/QuotesList.tsx`
- no se cambia su logica de filtrado/orden
- hereda la nueva capa visual a traves de `ListToolbar`

### Facturas

- archivo: `src/features/invoices/InvoicesList.tsx`
- no se cambia su logica de filtrado/orden
- hereda la nueva capa visual a traves de `ListToolbar`
- decision segura: mejora visual indirecta, sin reabrir logica critica del workspace

## Compatibilidad preservada

- no cambia `storageKey` de preferencias
- no cambian callbacks de seleccion
- no cambian contratos de datos
- no se anaden dependencias
- no se tocan `Supabase`, `financialWriteApi`, `appDataApi`, rutas ni `?view=`

## Limites actuales

- no todas las listas del repo estan migradas todavia
- `LeadsPage` sigue siendo un workspace grande aunque ya comparte patron de control
- algunos modulos no exponen una fecha fiable de recencia en su contrato de lista
- `InvoicesList` mejora solo por wrapper seguro; no se fuerza migracion mas profunda

## Siguiente paso recomendado

1. Reusar este patron en `Jobs`, `Payments`, `Expenses` y superficies auxiliares.
2. Mantener cualquier filtro nuevo como estado local hasta que exista un caso real para backend filtering.
3. Evitar volver a crear paneles de filtros ad hoc fuera de `DSListControlBar` o `ListToolbar`.
