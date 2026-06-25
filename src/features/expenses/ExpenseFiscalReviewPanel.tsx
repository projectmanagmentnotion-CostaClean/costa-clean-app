import { useState } from 'react'
import {
  analyzeExpenseFiscalIntelligence,
  saveExpenseFiscalIntelligenceResult,
} from './fiscalIntelligenceApi'
import {
  getExpenseAiFiscalClassificationLabel,
  getExpenseDocumentSupportStatusLabel,
  getExpenseFiscalReviewStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  type ExpenseListItem,
} from './types'

interface ExpenseFiscalReviewPanelProps {
  expense: ExpenseListItem
  onExpenseUpdated: () => Promise<void>
}

function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value ?? 0))
}

function formatDateEs(value: string | null | undefined): string {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatPercentage(value: number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(0)}%`
}

function formatConfidence(value: number | null | undefined): string {
  return `${Math.round(Number(value ?? 0) * 100)}%`
}

export function ExpenseFiscalReviewPanel({
  expense,
  onExpenseUpdated,
}: ExpenseFiscalReviewPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fiscalAssistiveNotice, setFiscalAssistiveNotice] = useState<string | null>(null)

  async function handleAnalyze() {
    setSaveError(null)
    setSuccessMessage(null)
    setIsAnalyzing(true)

    try {
      const response = await analyzeExpenseFiscalIntelligence(expense)
      await saveExpenseFiscalIntelligenceResult(expense.id, response)
      setFiscalAssistiveNotice(response.result.assistive_notice)
      await onExpenseUpdated()
      setSuccessMessage('Estimacion fiscal actualizada correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido generando la estimacion fiscal.'
      setSaveError(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <section className="data-section cc-expense-surface cc-expense-surface--fiscal">
      <div className="section-header page-header-actions">
        <div>
          <h2>Revision fiscal</h2>
          <p>Separa estado manual, lectura asistida y riesgo sin competir con la edicion principal.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => void handleAnalyze()}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? 'Analizando...' : expense.ai_fiscal_classification ? 'Actualizar estimacion' : 'Analizar fiscalmente'}
        </button>
      </div>

      <div className="cc-expense-surface__grid">
        <article className="cc-expense-surface__card">
          <span className="cc-expense-surface__label">Revision manual</span>
          <strong>{getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}</strong>
          <small>Estado vigente para seguimiento y cierre.</small>
        </article>

        <article className="cc-expense-surface__card">
          <span className="cc-expense-surface__label">Riesgo fiscal</span>
          <strong>{getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level)}</strong>
          <small>Prioridad operativa antes de cierre o deduccion.</small>
        </article>

        <article className="cc-expense-surface__card">
          <span className="cc-expense-surface__label">Deducible</span>
          <strong>{expense.is_deductible ? 'Si' : 'No'}</strong>
          <small>Marcado manual actual del gasto.</small>
        </article>

        <article className="cc-expense-surface__card">
          <span className="cc-expense-surface__label">Soporte actual</span>
          <strong>{getExpenseDocumentSupportStatusLabel(expense.document_support_status)}</strong>
          <small>Impacta la lectura fiscal y la deducibilidad del IVA.</small>
        </article>
      </div>

      {saveError ? (
        <div className="cc-alert cc-alert--error">
          <strong>No se pudo completar la operacion</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {successMessage ? (
        <div className="cc-alert cc-alert--success">
          <strong>Operacion correcta</strong>
          <p>{successMessage}</p>
        </div>
      ) : null}

      {expense.ai_fiscal_classification ? (
        <>
          <section className="cc-expense-surface__section">
            <div className="cc-expense-surface__section-head">
              <h3>Lectura asistida</h3>
              <p>La capa de IA se consulta aqui, no dentro del flujo de edicion.</p>
            </div>

            <div className="cc-expense-surface__grid">
              <article className="cc-expense-surface__card">
                <span className="cc-expense-surface__label">Clasificacion</span>
                <strong>{getExpenseAiFiscalClassificationLabel(expense.ai_fiscal_classification)}</strong>
                <small>Resultado sugerido desde los datos estructurados.</small>
              </article>

              <article className="cc-expense-surface__card">
                <span className="cc-expense-surface__label">Confianza</span>
                <strong>{formatConfidence(expense.ai_fiscal_confidence)}</strong>
                <small>Indicador de seguridad de la estimacion.</small>
              </article>

              <article className="cc-expense-surface__card">
                <span className="cc-expense-surface__label">Base deducible estimada</span>
                <strong>{formatCurrency(expense.ai_estimated_deductible_base)}</strong>
                <small>Estimacion prudente, no definitiva.</small>
              </article>

              <article className="cc-expense-surface__card">
                <span className="cc-expense-surface__label">IVA deducible estimado</span>
                <strong>{formatCurrency(expense.ai_estimated_deductible_vat)}</strong>
                <small>Depende del soporte y la clasificacion.</small>
              </article>

              <article className="cc-expense-surface__card">
                <span className="cc-expense-surface__label">Deducibilidad estimada</span>
                <strong>{formatPercentage(expense.ai_deductibility_percentage)}</strong>
                <small>Porcentaje sugerido para el gasto.</small>
              </article>

              <article className="cc-expense-surface__card">
                <span className="cc-expense-surface__label">IVA deducible estimado %</span>
                <strong>{formatPercentage(expense.ai_vat_deductibility_percentage)}</strong>
                <small>Porcentaje sugerido sobre el IVA soportado.</small>
              </article>

              <article className="cc-expense-surface__card">
                <span className="cc-expense-surface__label">Riesgo sugerido</span>
                <strong>{getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level)}</strong>
                <small>Se muestra aparte para no ensuciar la ficha base.</small>
              </article>

              <article className="cc-expense-surface__card">
                <span className="cc-expense-surface__label">Analizado</span>
                <strong>{expense.ai_fiscal_analyzed_at ? formatDateEs(expense.ai_fiscal_analyzed_at.slice(0, 10)) : 'Sin fecha'}</strong>
                <small>Ultima ejecucion registrada.</small>
              </article>
            </div>
          </section>

          <section className="cc-expense-surface__section">
            <div className="cc-expense-surface__section-head">
              <h3>Motivo sugerido</h3>
              <p>Razonamiento explicado fuera del card principal.</p>
            </div>

            <article className="cc-expense-surface__note-card">
              <p>{expense.ai_fiscal_reasoning ?? 'Sin razonamiento registrado.'}</p>
            </article>

            {expense.ai_fiscal_flags?.length ? (
              <div className="cc-expense-surface__flags" aria-label="Banderas fiscales sugeridas">
                {expense.ai_fiscal_flags.map((flag) => (
                  <span key={flag} className="cc-expense-chip cc-expense-chip--risk">
                    {flag.replaceAll('_', ' ')}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="cc-alert cc-alert--warning">
              <strong>Estimacion asistida</strong>
              <p>
                {fiscalAssistiveNotice ??
                  'Estimacion orientativa basada en datos estructurados del gasto. No sustituye la revision de una gestoria ni constituye asesoramiento fiscal.'}
              </p>
            </div>
          </section>
        </>
      ) : (
        <div className="empty-state">
          <strong>Sin estimacion fiscal asistida</strong>
          <p>Usa Analizar fiscalmente para generar una lectura prudente sin mezclarla con la edicion del gasto.</p>
        </div>
      )}
    </section>
  )
}
