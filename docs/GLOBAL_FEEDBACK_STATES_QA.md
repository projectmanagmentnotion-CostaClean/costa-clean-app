# Global Feedback States QA

## Estado anterior

- La app ya tenia confirmaciones en muchas acciones sensibles, pero los estados `empty`, `error` y `loading` seguian mezclando bloques ad hoc con primitives del design system.
- Las listas principales no estaban todas alineadas en copy ni en componentes de estado.
- Dashboard, alertas y previews documentales seguian resolviendo varios estados con `div.empty-state` o alerts crudos.

## Modulos auditados

- Dashboard
- Leads
- Clientes
- Propiedades
- Presupuestos
- Facturas
- Servicios
- Gastos
- Pagos
- Cierre fiscal
- Intake publico

## Patrones unificados

- `empty`: `DSEmptyState`
- `error`: `DSErrorState`
- `loading estructural`: `DSLoadingState`
- `confirmacion reutilizable`: `DSConfirmDialog`
- `header corto de seccion`: `DSSectionHeader`

## Acciones sensibles revisadas

- borrar / papelera: preservadas con confirmacion en facturas, servicios, presupuestos y soportes documentales
- archivar / restaurar: preservadas con confirmacion en clientes, facturas, servicios y presupuestos
- emitir / guardar documento: preservadas con confirmacion en documentos de factura y presupuesto
- cobrar: preservado el flujo y las confirmaciones existentes en facturas y pagos
- cambiar estado: preservadas las confirmaciones ya vivas en facturas, servicios y presupuestos
- aceptar presupuesto / convertir: preservadas las confirmaciones ya vivas en `QuoteDetailCard`
- reasignar propiedad: preservada la confirmacion existente en `PropertyDetailCard`
- acciones bulk: preservada la confirmacion existente en `InvoicesPage`

## Cambios aplicados

- `InvoicesList` y `QuotesList` pasan a usar `DSSectionHeader`, `DSEmptyState` y `DSErrorState`.
- `DashboardAgenda`, `DashboardOperationalFocus` y `DashboardIncidents` usan `DSEmptyState` para estados sin datos.
- `AlertsCenterPage` unifica estados vacios activos y revisados con `DSEmptyState`.
- `InvoiceDocumentPreview`, `QuoteDocumentPreview`, `InvoiceDocumentScreen` y `QuoteDocumentScreen` usan `DSLoadingState` y `DSErrorState`.
- `InvoiceDocumentScreen` y `QuoteDocumentScreen` pasan a usar `DSConfirmDialog` para la confirmacion de salida documental.

## Componentes usados

- `DSEmptyState`
- `DSErrorState`
- `DSLoadingState`
- `DSConfirmDialog`
- `DSSectionHeader`

## Que no se toco

- Supabase
- SQL
- RPC
- migrations
- auth
- rutas
- sistema `?view=`
- `appDataApi`
- `financialWriteApi`
- `invoice_number`
- `display_code`
- `save_invoice_with_lines`
- `save_invoice_with_lines_v2`
- numeracion
- fiscalidad
- calculos
- persistencia
- contratos de datos
- reglas de negocio

## Riesgos pendientes

- Muchas superficies de create/edit siguen mostrando errores inline propios y no todas han migrado aun al mismo tono de feedback.
- Existen vistas legacy de cierre (`AnnualClosingPage`, `QuarterlyClosingPage`) con patrones viejos que no deben tocarse en un sprint de consistencia ligera.
- La app conserva algunos mensajes tecnicos heredados en formularios profundos; requieren una pasada dedicada sin mezclar cambios funcionales.

## Recomendaciones futuras

- Priorizar una pasada especifica sobre formularios create/edit largos para humanizar mensajes de error sin tocar validaciones.
- Mantener `DSConfirmDialog` como wrapper preferido para nuevas confirmaciones.
- Reutilizar `DSLoadingState` en cualquier preview o bloque diferido nuevo antes de crear spinners o placeholders ad hoc.
