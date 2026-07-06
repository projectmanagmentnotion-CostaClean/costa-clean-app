# List Filter Sort UX System

## Objetivo

Definir un patron unico para listas operativas de la app: una sola superficie compacta para busqueda, filtros rapidos, orden y lectura de resultados.

Sprint 9A no cambia contratos de datos ni logica de negocio. Solo consolida la capa visual y de organizacion local de listas.

## Principio rector

- Una lista = una barra de control.
- Una barra = busqueda + filtros rapidos + orden.
- Un usuario debe entender en un vistazo:
  - cuantos resultados esta viendo
  - que filtros estan activos
  - cual es el orden actual
  - como volver a la vista base

## Patron obligatorio

Cada lista operativa debe tener:

1. Resumen superior
   - `X visibles de Y`
   - copy corto que explique si la lista esta afinada o en vista base

2. Busqueda principal
   - siempre visible
   - placeholder con los campos reales que acepta
   - no esconder la busqueda tras modal o panel lateral

3. Ajustes compactos
   - orden resumido en un solo control compacto
   - 3-5 chips rapidos visibles como maximo
   - filtros avanzados dentro de popover o sheet
   - sin convertir la pantalla en una parrilla pesada de controles

4. Filtros activos visibles
   - tags o chips legibles
   - boton claro de `Limpiar vista`

## Jerarquia UX esperada

- Busqueda primero.
- Filtros y orden en segundo plano hasta que hagan falta.
- El listado sigue siendo el protagonista; los controles no deben competir con el contenido.

## Reglas de orden por defecto

- Preferir `recientes` o `mas recientes primero` cuando el contrato del modulo exponga una señal fiable de recencia:
  - `created_at`
  - `issue_date`
  - `display_code` cuando el modulo ya lo use como proxy operativo estable

- Si el modulo no expone recencia fiable en el contrato de lista, documentar la excepcion y usar un orden semantico estable:
  - `name`
  - `client`
  - `city`

### Excepciones reales del repo en Sprint 9A

- `PropertiesList` usa `Nombre` como vista base porque el contrato auditado no expone `created_at`.
- `QuotesList` conserva su base previa de codigo / estado comercial.
- `InvoicesList` conserva su base previa por `issue_date`.

## Reglas de filtros

- Los filtros rapidos deben ser de lectura humana:
  - `Activos`
  - `Archivados`
  - `Todos`
  - estados de dominio cuando sean seguros y ya existan

- No conectar filtros locales a backend en esta fase.
- No crear taxonomias nuevas de negocio solo para la UI.
- No mezclar filtros visuales con acciones destructivas o de persistencia.

## Reglas de copy

- Corto, operativo y concreto.
- Sin tecnicismos de implementacion.
- `Ajustar lista` como label del panel secundario.
- `Limpiar vista` como reset global.

## Comportamiento mobile-first

- Busqueda siempre accesible en el primer scroll.
- Chips horizontales o wrap limpio.
- Evitar dobles bandas de filtros.
- El panel avanzado debe abrirse como sheet compacto, no como bloque largo debajo de la barra.
- No saturar el header con iconos o multiples botones de orden.

## Comportamiento desktop

- Una sola barra clara.
- El panel de ajustes debe sentirse como capa flotante corta, no como panel vertical largo.
- Los filtros activos deben quedar visibles entre la busqueda y el panel colapsable.

## Componentes base oficiales

- `DSListControlBar`
- `DSSearchInput`
- `DSFilterChip`
- `DSSortMenu`
- `DSActiveFilters`
- `DSFilterSummaryButton`
- `DSCompactFilterGroup`
- compat wrapper: `ListToolbar`

## Utilidades compartidas

- `normalizeSearchText`
- `applyTextSearch`
- `applySortOption`
- `recentFirstSort`

## Modulos cubiertos en Sprint 9A

- `ClientsList`
- `PropertiesList`
- `LeadsPage` + `LeadsList`
- `QuotesList` por herencia segura del wrapper
- `InvoicesList` por herencia segura del wrapper

## Que no entra en este sistema

- filtros backend
- query params nuevos
- cambios de rutas
- cambios de `?view=`
- cambios de persistencia
- acciones bulk criticas
- logica fiscal
- numeracion
- Supabase / SQL / RPC

## Definition of Done del patron

- La lista compila sin tocar contratos funcionales.
- Existe una sola superficie visible para buscar, filtrar y ordenar.
- Los filtros activos se leen sin abrir paneles.
- El reset devuelve a la vista base del modulo.
- La vista base esta documentada.
- Mobile y desktop no ganan ruido nuevo.
