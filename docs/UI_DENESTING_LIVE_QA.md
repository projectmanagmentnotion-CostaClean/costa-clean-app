# UI De-nesting Live QA

## Regla central

Una superficie = una capa visual.

No se permiten cards dentro de cards, paneles dentro de paneles ni wrappers que resten ancho util sin cambiar la decision del usuario.

## Viewports usados en validacion real

- `390x844` en la app viva autenticada, vista `?view=invoices`

## Pantallas revisadas con app viva

- Facturas, portada del modulo
- Facturas, tramo de KPIs y control superior
- Facturas, lista operativa
- Facturas, detalle de factura

## Problemas reales detectados

- `Control fiscal` seguia visible en la app normal y generaba ruido operativo.
- El detalle de factura seguia teniendo demasiada encapsulacion visual.
- Las acciones secundarias seguian ocupando demasiado espacio visible.
- Filtros y tarjetas de lista conservaban demasiada altura para mobile.

## Correcciones aplicadas

- `Control fiscal` deja de renderizarse en la app normal y solo queda disponible bajo debug explicito.
- `InvoiceDetailCard` pierde subsecciones `data-section` internas y usa una sola superficie principal.
- Las filas internas del detalle pasan a fondo transparente con separadores ligeros.
- Las acciones multiples se compactan a una sola accion visible y resto en `Mas`.
- `DSListControlBar`, chips de filtro y tarjetas operativas reducen padding, altura y peso visual.

## Botones corregidos

- Accion primaria conservada
- Secundarias empujadas a `Mas`
- Altura compacta y alineacion horizontal cuando el ancho lo permite

## Filtros corregidos

- Menor padding
- Botones de resumen mas compactos
- Chips mas discretos
- La barra visual pesa menos que el contenido

## Superficies desencapsuladas

- `InvoicesPage`
- `InvoiceDetailCard`
- `ActionGroup`
- `DSListControlBar` via estilos compartidos
- `OperationalListItem` via estilos compartidos

## Control fiscal/debug

- El control fiscal de facturas queda oculto en uso normal.
- Solo aparece cuando el modo debug fiscal esta activo.
- La logica fiscal no se elimina; solo se saca del flujo operativo diario.

## Antes / despues textual

### Facturas

- Antes: bloque fiscal visible, lista pesada, detalle con subsecciones enmarcadas varias veces.
- Despues: sin bloque fiscal normal, lista mas compacta, detalle con una sola superficie y secciones internas planas.

### Acciones

- Antes: varias acciones visibles compitiendo por ancho.
- Despues: una accion visible y resto bajo `Mas`.

## Deuda pendiente

- Repetir QA viva completa en `375x812`, `768x1024` y desktop basico.
- Extender el mismo aplanado a clientes, propiedades, cobros, gastos, presupuestos y cierre fiscal.
- Revisar que algunos headers de detalle aun pueden adelgazar una capa mas.

## Actualizacion cross-module 2026-07-07

- Se ejecuta una pasada viva adicional sobre `dashboard`, `clients`, `properties`, `payments` y `fiscal_closing`.
- `PaymentCreateFlow` deja visible el primer campo en `390x844` y `768x1024`.
- `PaymentDetailCard` y `PropertyDetailCard` quedan en lectura mas plana para mobile/iPad.
- Se detecta un overflow real en iPad dentro del shell superior y se corrige en `cc-shell-nav`.
- Resultado final de la pasada: sin scroll horizontal en `390x844` ni `768x1024` en los modulos auditados.

## Confirmacion de alcance protegido

No se tocaron Supabase, SQL, RPC, migrations, auth, rutas, `?view=`, `appDataApi`, `financialWriteApi`, numeracion, fiscalidad, calculos, persistencia ni contratos.

## Harness Follow-up

- La repeticion futura de esta QA ya no debe depender solo del navegador embebido.
- El harness autenticado local documentado en `docs/AUTHENTICATED_VISUAL_QA_HARNESS.md` pasa a ser la via de respaldo para `390x844` y `768x1024`.

## Actualizacion module completion 2026-07-08

- La pasada se extiende a `quotes` y `jobs`.
- La regla de desencapsulacion ahora se hace explicita tambien en create flows largos: si el header del StepFlow entierra el primer campo, el flow falla aunque no haya overflow.
