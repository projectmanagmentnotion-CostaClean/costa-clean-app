import type { ClosingIntelligenceResponse } from '../closingIntelligence/types'

interface ClosingAiSummarySectionProps {
  title: string
  description: string
  periodLabel: string
  periodValueLabel: string
  closingStatusLabel: string
  isGenerating: boolean
  result: ClosingIntelligenceResponse | null
  error: string | null
  onGenerate: () => void
  formatDateTime: (value: string | null | undefined) => string
}

function renderSummaryList(items: string[], emptyLabel: string, keyPrefix: string) {
  if (items.length === 0) {
    return <p className="cc-dashboard-panel__text">{emptyLabel}</p>
  }

  return items.map((item, index) => (
    <p key={`${keyPrefix}-${index}`} className="cc-dashboard-panel__text">{index + 1}. {item}</p>
  ))
}

function getConfidenceLabel(value: 'high' | 'medium' | 'low') {
  if (value === 'high') return 'Alta'
  if (value === 'medium') return 'Media'
  return 'Baja'
}

export function ClosingAiSummarySection({
  title,
  description,
  periodLabel,
  periodValueLabel,
  closingStatusLabel,
  isGenerating,
  result,
  error,
  onGenerate,
  formatDateTime,
}: ClosingAiSummarySectionProps) {
  return (
    <section className="cc-dashboard-block">
      <div className="cc-dashboard-block__header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button type="button" className="primary-button" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? 'Generando resumen...' : result ? 'Regenerar resumen' : 'Generar resumen'}
        </button>
      </div>

      <div className="cc-alert cc-alert--warning">
        <strong>Interpretacion asistiva</strong>
        <p>La IA solo redacta y prioriza. No recalcula IVA, importes ni conclusiones fiscales definitivas.</p>
      </div>

      {error ? (
        <div className="cc-alert cc-alert--error">
          <strong>No se pudo generar el resumen inteligente</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="cc-quarterly-pack-grid">
            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Generado</span>
              <strong className="cc-dashboard-panel__value">{formatDateTime(result.generated_at)}</strong>
              <p className="cc-dashboard-panel__text">Modelo utilizado: {result.model}</p>
            </article>
            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">{periodLabel}</span>
              <strong className="cc-dashboard-panel__value">{periodValueLabel}</strong>
              <p className="cc-dashboard-panel__text">Estado del cierre: {closingStatusLabel}</p>
            </article>
            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Confianza declarada</span>
              <strong className="cc-dashboard-panel__value">{getConfidenceLabel(result.summary.confidenceLevel)}</strong>
              <p className="cc-dashboard-panel__text">La IA debe respetar el nivel de confianza del resumen determinista.</p>
            </article>
          </div>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Resumen ejecutivo</h2>
              </div>
            </div>
            <article className="cc-quarterly-persistence__card">
              <p className="cc-dashboard-panel__text">{result.summary.executiveSummary}</p>
              {renderSummaryList(result.summary.confidenceNotes, 'Sin notas adicionales de confianza.', 'confidence')}
            </article>
          </section>

          <section className="cc-quarterly-pack-grid">
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Riesgos clave</span>
              {renderSummaryList(result.summary.keyRisks, 'Sin riesgos destacados por la IA.', 'risk')}
            </article>
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Datos faltantes</span>
              {renderSummaryList(result.summary.missingDataNotes, 'Sin datos faltantes adicionales destacados.', 'missing')}
            </article>
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Notas para gestoria</span>
              {renderSummaryList(result.summary.accountantNotes, 'Sin notas sugeridas adicionales.', 'accounting')}
            </article>
          </section>

          <section className="cc-quarterly-pack-grid">
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Recomendaciones</span>
              {renderSummaryList(result.summary.recommendedActions, 'Sin recomendaciones adicionales.', 'recommendation')}
            </article>
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Siguientes pasos</span>
              {renderSummaryList(result.summary.nextSteps, 'Sin siguientes pasos adicionales.', 'next')}
              <p className="cc-dashboard-panel__text">{result.summary.assistantNotice}</p>
            </article>
          </section>
        </>
      ) : null}
    </section>
  )
}
