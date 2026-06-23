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
        <strong>Texto asistivo generado por IA</strong>
        <p>No modifica calculos ni sustituye la revision fiscal o contable. Solo interpreta los datos ya validados por la app.</p>
      </div>

      {error ? (
        <div className="cc-alert cc-alert--error">
          <strong>No se pudo generar el resumen inteligente</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="cc-quarterly-pack-header">
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
          </div>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Resumen ejecutivo</h2>
              </div>
            </div>
            <article className="cc-quarterly-persistence__card">
              <p className="cc-dashboard-panel__text">{result.summary.executive_summary}</p>
            </article>
          </section>

          <section className="cc-quarterly-pack-grid">
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Riesgos e incidencias clave</span>
              {renderSummaryList(result.summary.key_risks, 'Sin riesgos destacados por la IA.', 'risk')}
            </article>
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Alertas documentales</span>
              {renderSummaryList(result.summary.documentation_warnings, 'Sin alertas documentales adicionales.', 'doc')}
            </article>
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Notas sugeridas para gestoria</span>
              {renderSummaryList(result.summary.suggested_manager_notes, 'Sin notas sugeridas adicionales.', 'note')}
            </article>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Siguientes acciones sugeridas</h2>
              </div>
            </div>
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              {renderSummaryList(result.summary.suggested_next_actions, 'Sin acciones sugeridas adicionales.', 'action')}
              <p className="cc-dashboard-panel__text">{result.summary.assistive_notice}</p>
            </article>
          </section>
        </>
      ) : null}
    </section>
  )
}
