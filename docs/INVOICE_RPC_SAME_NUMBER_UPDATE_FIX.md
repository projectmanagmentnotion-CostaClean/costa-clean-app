# Invoice RPC Same-Number Update Fix

## Objetivo

Corregir el falso hueco de numeracion fiscal que aparece cuando una factura ya emitida se actualiza manteniendo el mismo `invoice_number` y el mismo `display_code`.

## Causa exacta

La funcion SQL afectada es:

- `public.save_invoice_with_lines(jsonb, jsonb)`

La rama actual hace esto:

1. detecta que el `status` consume numeracion fiscal
2. ejecuta `public.assert_invoice_numbering_regular(extract(year from v_issue_date)::integer, v_invoice_id)`
3. excluye la propia factura `v_invoice_id` de la secuencia

En una actualizacion interna de una emitida ya existente, esa exclusion saca de la secuencia precisamente el numero que pertenece a la factura editada. El resultado es un hueco artificial:

- `2026-045` parece faltar
- pero la fila real `2026-045 / INV-0045` sigue existiendo

## Por que no afecta a altas nuevas

La migracion no relaja el alta de facturas nuevas.

Para una factura nueva:

- no existe una fila previa con ese `id`
- no existe numeracion persistida que deba mantenerse
- el chequeo sigue excluyendo `v_invoice_id`
- la validacion de huecos reales sigue intacta

Tambien sigue siendo estricta cuando una factura existente todavia no consumia numeracion fiscal y pasa a consumirla por primera vez.

## Criterio de seguridad

La ruta especial solo aplica cuando:

1. ya existe una factura persistida con ese `id`
2. la factura persistida ya consume numeracion fiscal
3. tiene `invoice_number` y `display_code` no vacios
4. el ejercicio fiscal sigue siendo el mismo
5. la numeracion persistida actual es valida para ese ejercicio

En ese caso, la comprobacion de continuidad se ejecuta **incluyendo** la propia factura actual para evitar el falso hueco por autoexclusion.

## Migracion creada

- [20260707_fix_same_number_invoice_update_gap.sql](C:/Users/USUARIO/costa-clean-app/supabase/migrations/20260707_fix_same_number_invoice_update_gap.sql)

## Lo que no toca

- no cambia `invoice_number`
- no cambia `display_code`
- no renumera ninguna factura
- no crea facturas nuevas
- no crea rectificativas
- no toca otra factura
- no cambia secuencias ni contadores
- no relaja la validacion de huecos reales para nuevas emisiones
- no cambia contratos TypeScript ni `financialWriteApi`

## Aplicacion

En este entorno la migracion no pudo aplicarse automaticamente porque:

- no hay CLI `supabase` instalada
- no existe `SUPABASE_SERVICE_ROLE_KEY` disponible en el repo local

Aplicacion manual exacta recomendada:

1. abrir el proyecto Supabase real asociado a la app
2. abrir SQL Editor
3. ejecutar el contenido de:
   - `supabase/migrations/20260707_fix_same_number_invoice_update_gap.sql`
4. confirmar que la funcion `public.save_invoice_with_lines(jsonb, jsonb)` queda reemplazada
5. reejecutar:
   - `node scripts/ops/correct-invoice-2026-045.mjs`
   - `node scripts/ops/correct-invoice-2026-045.mjs --apply`

## Estado actual

- migracion creada: si
- migracion aplicada desde este turno: no
- factura `2026-045` completamente corregida: no

La factura sigue parcial hasta que la RPC remota incorpore esta migracion o exista una via autorizada de servidor para sincronizar la cabecera.
