# Invoice Numbering Sequence Audit QA

## Fecha

- 2026-07-02

## Problema reportado

- El usuario indico que la ultima factura correcta era `2026-042`.
- En la app aparecian facturas reales:
  - `INV-0048 - 2026-048`
  - `INV-0049 - 2026-049`
- Habia que comprobar si el salto era real, si `43-47` existian de alguna forma y como impedir que vuelva a pasar.

## Auditoria real de DB

Lectura ejecutada desde este entorno contra Supabase con el mismo acceso publico que usa la app.

Resumen confirmado:

- Total de facturas con `invoice_number` en 2026 auditadas: `44`
- Rango fiscal detectado: `2026-001` a `2026-049`
- Huecos reales detectados:
  - `2026-043`
  - `2026-044`
  - `2026-045`
  - `2026-046`
  - `2026-047`
- Duplicados detectados:
  - `invoice_number`: ninguno
  - `display_code`: ninguno
- Borradores con numero reservado:
  - ninguno

## Facturas 43-47

- No existen filas para `2026-043` a `2026-047`.
- No aparecieron tampoco como:
  - `deleted_at`
  - `archived_at`
  - `cancelled_at`
- Con el acceso disponible no hay evidencia de que esos numeros sigan ocupados por registros visibles.

## Estado de 48 y 49

- `2026-048 / INV-0048`
  - estado: `paid`
  - fecha emision: `2026-06-08`
  - `deleted_at`: `null`
  - `archived_at`: `null`
  - `cancelled_at`: `null`
- `2026-049 / INV-0049`
  - estado: `issued`
  - fecha emision: `2026-06-30`
  - `deleted_at`: `null`
  - `archived_at`: `null`
  - `cancelled_at`: `null`

Conclusion:

- `48` y `49` existen como facturas reales.
- No se renumero nada automaticamente en este sprint.
- La siguiente numeracion segura, si no se decide una regularizacion fiscal manual, es `2026-050 / INV-0050`.

## Campos reales usados por la app

- Numero fiscal visible:
  - `invoice_number`
- Codigo interno visible:
  - `display_code`
- La UI presenta ambos en el label:
  - `INV-0048 - 2026-048 - ...`

## Campos pedidos en el sprint que no existen en este schema

Con la auditoria real de la tabla accesible desde la app:

- `number`: no existe
- `document_number`: no existe
- `series`: no existe

En esta instalacion el schema real visible para numeracion se apoya en:

- `display_code`
- `invoice_number`
- `status`
- `issue_date`
- `created_at`
- `archived_at`
- `deleted_at`
- `cancelled_at`

## Causa real del salto

Lo que si queda demostrado:

1. El frontend actual no calcula la numeracion.
2. La RPC `save_invoice_with_lines` del repo tampoco la calcula.
3. La numeracion dependia de logica de DB no explicitada en el repo activo.
4. Ya existia antecedente de deriva manual en:
   - `sql/20260430_fix_invoice_numbering_gap.sql`
5. El hueco actual `43-47` es real en datos visibles y `48/49` no son borradores ocultos.

Lo que no se puede demostrar con el acceso disponible:

- el evento historico exacto que empujo la secuencia hasta `48`

Diagnostico defendible:

- la fuente de verdad estaba fuera del write layer versionado del repo
- la secuencia avanzo en DB sin una auditoria visible en UI
- la app no tenia guardas para detectar el salto antes de seguir emitiendo

## Regla fiscal adoptada en repo

1. Las facturas `issued`, `paid` y `cancelled` consumen y conservan numero fiscal.
2. Los borradores no deben consumir `invoice_number` ni `display_code`.
3. La siguiente numeracion se sugiere desde el maximo numero fiscal real existente del ejercicio.
4. No se reutilizan numeros ausentes automaticamente.
5. Si hay huecos, se muestran como warning y control administrativo.

## Fix de generacion futura

Se anadio migracion nueva:

- `sql/20260702_stabilize_invoice_numbering_sequence.sql`

Hace esto:

- centraliza la regla de numeracion en DB
- anade trigger `trg_sync_invoice_numbering`
- anula reserva de numero en inserts `draft`
- asigna `invoice_number` y `display_code` solo cuando la factura pasa a `issued`, `paid` o `cancelled`
- usa bloqueo transaccional por ejercicio para evitar carreras simples
- anade indices unicos parciales para:
  - `invoice_number`
  - `display_code`

## Guardas anadidas en app

- Helper unico:
  - `src/features/invoices/invoiceNumbering.ts`
- Tests:
  - `src/features/invoices/invoiceNumbering.test.ts`
- UI de control:
  - `src/features/invoices/InvoiceNumberingControlCard.tsx`
  - integrada en `src/pages/InvoicesPage.tsx`
- Warning previo en creacion/emision:
  - `src/features/invoices/InvoiceCreateFlow.tsx`
  - `src/features/invoices/InvoiceEditFlow.tsx`
- Toasts mejorados:
  - borrador: no consume numero fiscal
  - emitida: muestra `invoice_number` real guardado

## UI de control

Nueva seccion visible en Facturas:

- `Control de numeracion`

Muestra:

- ultimo numero emitido
- proximo numero sugerido
- codigo interno sugerido
- huecos detectados
- duplicados detectados
- borradores con numero reservado

## SQL de auditoria preparado

Consulta base:

```sql
select
  id,
  display_code,
  invoice_number,
  status,
  issue_date,
  created_at,
  archived_at,
  deleted_at,
  cancelled_at,
  client_id,
  job_id,
  quote_id,
  total,
  pricing_metadata
from public.invoices
order by created_at asc;
```

## Accion recomendada para el caso actual

- No renumerar `2026-048` ni `2026-049` automaticamente.
- Tratar `2026-050` como siguiente numeracion segura por defecto.
- Solo abrir una regularizacion manual de `43-47` si el usuario confirma que fiscalmente corresponde documentar/anular/rehacer ese tramo.

## Decision posterior del usuario

- El usuario confirmo despues que `INV-0048 / 2026-048` y `INV-0049 / 2026-049` no fueron enviadas al cliente.
- Con esa confirmacion ya no se trata como incidencia cerrada en `050` por defecto.
- La regularizacion propuesta pasa a ser:
  - `048 -> 043`
  - `049 -> 044`
- Ver patch preparado:
  - `sql/20260702_regularize_unsent_invoice_numbers_0048_0049.sql`
- Ver QA especifica:
  - `docs/INVOICE_NUMBERING_REGULARIZATION_0048_0049_QA.md`

## Lo que requiere confirmacion del usuario

- Si `2026-048` y `2026-049` fueron emitidas/entregadas al cliente sin posibilidad de renumeracion.
- Si quiere mantener el salto y seguir en `050`, o abrir una regularizacion fiscal manual externa para `043-047`.

## Pendiente real fuera de repo

- Aplicar en Supabase la migracion:
  - `sql/20260702_stabilize_invoice_numbering_sequence.sql`

## Escenario critico posterior

- En el siguiente sprint aparecio un caso nuevo:
  - `INV-0050 / 2026-050` existe
  - `INV-0045` a `INV-0049` faltan
- A partir de este punto la app ya no debe sugerir `2026-051` como siguiente numero mientras haya huecos.
- Regla nueva en repo:
  - si `audit.gaps.length > 0`, el siguiente numero seguro pasa a ser el primer hueco
  - la emision no borrador queda bloqueada hasta regularizar
  - `Revisar secuencia` debe avisar del salto y enfocar la incidencia real

## Regularizacion preparada para 0050

- SQL preparada:
  - `sql/20260702_fix_invoice_fiscal_metadata_and_numbering_0050.sql`
- QA especifica:
  - `docs/INVOICE_NUMBERING_REGULARIZATION_0050_QA.md`
- Verificar en la DB real que los defaults/triggers antiguos no contradicen esta version.
- Emitir una factura nueva y confirmar:
  - borrador sin numero
  - emitida con `2026-050 / INV-0050`

## Cierre final post-0053

- Estado actual verificado por lectura REST:
  - `2026-045` a `2026-048` existen
  - no hay huecos entre el minimo y el maximo fiscal emitido de 2026
  - siguiente numero calculado: `2026-049 / INV-0049`
- Estado actual verificado en repo:
  - `invoiceNumbering.ts` ya sugiere el primer hueco si existe
  - los flujos reales de emision escriben `expected_invoice_number` y `expected_display_code`
  - `financialWriteApi.ts` ahora bloquea si la DB devuelve numeracion distinta a la esperada
- Riesgo residual:
  - falta la prueba manual de emision controlada para confirmar `0049` desde UI autenticada

## Incidencia 0054

- Caso real observado:
  - secuencia visual correcta en UI
  - mismatch detectado al guardar
  - persistencia final incorrecta `INV-0054 / 2026-054`
- Blindaje nuevo en repo:
  - `financialWriteApi.ts` elimina `invoice_number` y `display_code` del payload normal antes del RPC
  - si Supabase devuelve numeracion distinta, el error incluye la factura creada para facilitar regularizacion
  - `sql/20260702_enforce_authoritative_invoice_numbering.sql` obliga a que la DB asigne el siguiente hueco real en inserts que consumen numeracion
- Regularizacion preparada:
  - `sql/20260702_regularize_unsent_invoice_0054_to_0049.sql`
- Cierre pendiente:
  - aplicar SQL en Supabase
  - confirmar `INV-0049 / 2026-049`
  - emitir prueba real y confirmar `INV-0050 / 2026-050`
