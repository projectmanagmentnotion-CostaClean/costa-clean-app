# INVOICE NUMBERING REGULARIZATION 0054 QA

## Contexto

- DB correcta antes de la prueba:
  - `INV-0045 / 2026-045`
  - `INV-0046 / 2026-046`
  - `INV-0047 / 2026-047`
  - `INV-0048 / 2026-048`
  - huecos `0`
  - siguiente `INV-0049 / 2026-049`
- Produccion:
  - `build 782c7e5`
- Nueva incidencia:
  - StepFlow esperaba `2026-049`
  - Supabase persistio `2026-054`
  - factura creada: `INV-0054 / 2026-054`

## Evidencia

- La factura `0054` conserva en `pricing_metadata`:
  - `source_flow = invoice_stepflow`
  - `write_api_version = save_invoice_with_lines_v2`
  - `expected_invoice_number = 2026-049`
  - `expected_display_code = INV-0049`
  - `client_fiscal_snapshot` completo

## Diagnostico

- El frontend actual de repo no envia `invoice_number/display_code` en el create normal.
- El mismatch se detecto bien en cliente, pero demasiado tarde: la fila ya estaba insertada.
- La causa bloqueante es DB-side:
  - numeracion efectiva no autoritativa en Supabase
  - write layer real aun desalineada del endurecimiento completo de repo

## SQL preparada

- Blindaje:
  - `sql/20260702_enforce_authoritative_invoice_numbering.sql`
- Regularizacion:
  - `sql/20260702_regularize_unsent_invoice_0054_to_0049.sql`

## Resultado esperado

1. `INV-0049 / 2026-049` existe y viene de `INV-0054 / 2026-054`.
2. `INV-0054 / 2026-054` ya no existe como activo.
3. `huecos = 0`.
4. `next_invoice_number = 2026-050`.
5. `next_display_code = INV-0050`.
6. Emision final real desde StepFlow:
   - sale `INV-0050 / 2026-050`
   - no reaparece `0054` ni un salto superior
