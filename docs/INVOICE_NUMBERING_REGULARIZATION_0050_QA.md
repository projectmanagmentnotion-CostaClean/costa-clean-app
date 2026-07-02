# Invoice Numbering Regularization 0050 QA

## Fecha

- 2026-07-02

## Escenario auditado

- Estado reportado para la secuencia:
  - `INV-0043 / 2026-043`: existe
  - `INV-0044 / 2026-044`: existe
  - `INV-0045 / 2026-045`: no existe
  - `INV-0046 / 2026-046`: no existe
  - `INV-0047 / 2026-047`: no existe
  - `INV-0048 / 2026-048`: no existe
  - `INV-0049 / 2026-049`: no existe
  - `INV-0050 / 2026-050`: existe

## Riesgo fiscal

- Mientras exista el hueco `2026-045` a `2026-049`, la app no debe:
  - sugerir `2026-051`
  - emitir nuevas facturas no borrador
- La siguiente numeracion segura debe volver al primer hueco:
  - `INV-0045 / 2026-045`

## SQL preparada

- Archivo:
  - `sql/20260702_fix_invoice_fiscal_metadata_and_numbering_0050.sql`

## Qué hace

1. normaliza `pricing_metadata` a objeto JSONB
2. rellena snapshots fiscales faltantes desde `clients.full_name`, `tax_id`, `billing_address`, `email`
3. intenta regularizar:
   - `INV-0050 / 2026-050`
   - hacia `INV-0045 / 2026-045`

## Guardas antes de renumerar

- bloquea si `0045` ya existe
- bloquea si `0050` no existe
- bloquea si `0050` esta archivada, eliminada o cancelada
- bloquea si `0050` parece enviada o exportada

## Trazabilidad que deja

- `renumbered_from_display_code`
- `renumbered_from_invoice_number`
- `renumbered_at`
- `renumbered_reason`

## Resultado esperado tras aplicar SQL

- `INV-0045 / 2026-045` existe
- `INV-0050 / 2026-050` deja de existir como numero activo
- no quedan huecos entre `2026-043` y `2026-045`
- la siguiente emision segura pasa a:
  - `INV-0046 / 2026-046`

## Estado real desde este entorno

- La SQL queda preparada en repo.
- No fue aplicada desde este entorno.
- La verificacion final requiere:
  - aplicar la SQL en Supabase
  - refrescar Facturas
  - pulsar `Revisar secuencia`
  - confirmar que ya no aparecen huecos
