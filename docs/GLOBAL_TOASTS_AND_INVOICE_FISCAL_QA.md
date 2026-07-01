# Global Toasts And Invoice Fiscal QA

## Fecha

- 2026-07-01

## Problemas reportados

- Los mensajes de exito, warning y error quedaban escondidos dentro del flujo o solo inline.
- No existia un sistema global de avisos visible por encima de overlays y modales.
- La factura podia heredar lineas correctamente, pero el bloque `CLIENTE` del documento no mostraba el NIF/CIF con etiqueta fiscal.
- El preview/PDF podia enseñar nombre y email, pero no dejaba claro si el dato venia del snapshot fiscal real.

## Causa real

### Toasts

- La app reutilizaba patrones locales:
  - `submitError`
  - `successMessage`
  - `cc-alert`
  - algunos `FeedbackDialog`
- No habia un bus global ni provider comun.
- El resultado era inconsistente:
  - algunos flows mostraban exito solo inline
  - otros solo error
  - algunos overlays tapaban el feedback

### NIF/CIF ausente

- La creacion de factura ya venia guardando `client_fiscal_snapshot` dentro de `pricing_metadata` en las rutas modernas.
- El problema principal no estaba en la escritura de las facturas nuevas, sino en el render del documento:
  - `src/features/invoices/InvoiceDocumentA4.tsx` mostraba `client_phone` y `client_email`
  - no leia el snapshot fiscal estructurado
  - por eso el bloque `CLIENTE` podia quedar con un numero suelto o sin `NIF/CIF:`

## Sistema global de toasts creado

Archivos nuevos:

- `src/shared/toasts/toastTypes.ts`
- `src/shared/toasts/toastState.ts`
- `src/shared/toasts/toastContext.ts`
- `src/shared/toasts/ToastProvider.tsx`
- `src/shared/toasts/useToast.ts`
- `src/shared/toasts/toast.css`
- `src/shared/toasts/toastState.test.ts`

API disponible:

- `toast.success(...)`
- `toast.warning(...)`
- `toast.error(...)`
- `toast.info(...)`
- `toast.loading(...)`
- `toast.update(id, ...)`
- `toast.dismiss(id)`

## Integracion global

- `src/App.tsx`
  - ahora monta `ToastProvider` en raiz
- Los avisos salen por portal a `document.body`
- Quedan por encima de la pantalla actual
- Mantienen `role="alert"` para error/warning y `role="status"` para success/info/loading`

## Flujos integrados en este sprint

- Servicios:
  - `src/features/jobs/JobDetailCard.tsx`
  - guardado
  - refresh warning
  - error de guardado
  - cambio de estado
- Facturas:
  - `src/features/invoices/InvoiceCreateFlow.tsx`
  - `src/features/invoices/InvoiceCreateForm.tsx`
  - `src/features/invoices/InvoiceDetailCard.tsx`
- Ficha fiscal inline:
  - `src/features/clients/ClientBillingDetailsInlineForm.tsx`

## Como se muestran success/warning/error/loading

- Al iniciar una accion importante:
  - toast `loading`
- Al terminar bien:
  - `success`
- Si el refresh queda pendiente:
  - `warning`
- Si falla:
  - `error`
- Los mensajes inline importantes se mantienen para contexto local.

## Fuente fiscal usada por factura

- Fuente prioritaria:
  - `pricing_metadata.client_fiscal_snapshot`
- Fallback visual secundario:
  - datos dinamicos del invoice cuando el snapshot no existe
- Helper central:
  - `src/features/clients/clientFiscalData.ts`
  - `getInvoiceFiscalDisplayData(invoice)`

## Cambios en snapshot fiscal

- Se mantiene el snapshot estructurado existente:
  - `client_id`
  - `fiscal_name`
  - `tax_id`
  - `billing_address`
  - `captured_at`
  - `source`
- No se inventa `tax_id`.
- No se hace backfill automatico a facturas antiguas en este sprint.

## Cambios en preview y PDF

- `src/features/invoices/InvoiceDocumentA4.tsx`
  - ahora lee snapshot fiscal
  - muestra `NIF/CIF: ...` solo si el dato es realmente `tax_id`
  - muestra direccion fiscal en lineas separadas
  - mantiene email del invoice
- Esto afecta:
  - preview embebido
  - pantalla documental
  - impresion/PDF

## Regla fiscal aplicada

- `InvoiceCreateFlow` ya bloqueaba la emision si faltaba ficha fiscal completa.
- `InvoiceCreateForm` ahora tambien bloquea la creacion cuando falta:
  - `tax_id`
  - `billing_address`
- En el form clasico se anadio acceso inline a completar la ficha fiscal del cliente sin perder el flujo.

## Tests

- `src/shared/toasts/toastState.test.ts`
  - crea registros
  - agrega success/error
  - actualiza loading -> success
  - cierra avisos
- `src/features/clients/clientFiscalData.test.ts`
  - prioriza snapshot fiscal sobre datos dinamicos
- `src/features/invoices/InvoiceDocumentA4.test.tsx`
  - renderiza `NIF/CIF:`
  - evita mostrar el `tax_id` como numero suelto

## Validacion automatizada

- `npm run lint`
- `npm run test`
- `npm run build`

## QA online recomendada

### Toasts

1. Editar `JOB-0052`.
2. Añadir linea.
3. Guardar.
4. Confirmar toast:
   - `Guardando servicio...`
   - `Servicio guardado`
5. Si el refresh tarda:
   - `Guardado con refresh pendiente`

### Factura

1. Crear factura desde `JOB-0052`.
2. Abrir preview.
3. Confirmar que salen las lineas reales.
4. Confirmar bloque `CLIENTE`:
   - nombre
   - `NIF/CIF: ...`
   - direccion fiscal
   - email si existe

### URL normal / debug

1. Abrir `https://app.costacleanbcn.com`
2. Confirmar que no aparece debug
3. Abrir `?debugBuild=1&debugJobLines=1`
4. Confirmar que debug si aparece

## Pendientes reales

- La infraestructura global ya existe, pero no se ha conectado todavia a todos los formularios de la app.
- Falta QA autenticada en navegador dentro de este turno.
- No se aplico backfill automatico a facturas historicas sin snapshot fiscal; eso requiere decision explicita aparte.
