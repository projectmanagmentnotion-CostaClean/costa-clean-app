# Expenses Visual QA

Fecha: 2026-06-30

## Auditoria real

- Campos reales de soporte: `receipt_file_path`, `receipt_file_url`, `attachment_count`, `document_support_status`.
- Flags y estados fiscales reales:
  - `fiscal_review_status`
  - `fiscal_risk_level`
  - `ai_fiscal_classification`
  - `ai_estimated_deductible_base`
  - `ai_estimated_deductible_vat`
- El resumen de primer nivel puede apoyarse en `buildExpenseFiscalSummary`.
- CTAs reales confirmados:
  - nuevo gasto
  - abrir gasto
  - editar
  - revisar soporte
  - analizar fiscalmente

## Cambios aplicados

- Cabecera ejecutiva nueva centrada en cobertura documental y revision.
- KPI superior limitado a 4: gasto total, cobertura documental, gastos por revisar, riesgo medio/alto.
- `ProgressMetric` para cobertura documental.
- `ActionChecklist` para soporte, revision, riesgo y analisis asistivo.

## Limites respetados

- No se afirmo deducibilidad definitiva.
- No se afirmo IVA definitivo.
- La IA sigue siendo asistiva; la UI habla de revision interna y soporte pendiente.
