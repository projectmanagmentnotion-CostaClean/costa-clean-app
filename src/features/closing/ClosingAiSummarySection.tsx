import { CollapsibleDetailSection } from '../../components/CollapsibleDetailSection'
import { InsightPanel } from '../../components/InsightPanel'
import { SeverityBadge } from '../../components/SeverityBadge'
import { VisualKpiCard } from '../../components/VisualKpiCard'
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

function getConfidenceTone(value: 'high' | 'medium' | 'low') {
  if (value === 'high') return 'success'
  if (value === 'medium') return 'warning'
  return 'critical'
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
        <button type="button" className="secondary-button" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? 'Generando resumen...' : result ? 'Regenerar resumen' : 'Generar resumen'}
        </button>
      </div>

      <div className="cc-alert cc-alert--warning">
        <strong>Ayuda interna de preparacion</strong>
        <p>La IA interpreta y prioriza. No recalcula IVA, importes ni conclusiones fiscales definitivas y requiere validacion profesional.</p>
      </div>

      {error ? (
        <div className="cc-alert cc-alert--error">
          <strong>No se pudo generar el resumen inteligente</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {result ? (
        <div className="cc-fiscal-closing-ai-grid">
          <div className="cc-fiscal-closing-ai-meta">
            <VisualKpiCard
              label="Generado"
              value={formatDateTime(result.generated_at)}
              hint={`Modelo ${result.model}`}
              tone="info"
              priority="compact"
            />
            <VisualKpiCard
              label={periodLabel}
              value={periodValueLabel}
              hint={`Estado del cierre: ${closingStatusLabel}`}
              tone="neutral"
              priority="compact"
            />
            <VisualKpiCard
              label="Confianza declarada"
              value={getConfidenceLabel(result.summary.confidenceLevel)}
              hint="Debe respetar la confianza del resumen determinista."
              tone={getConfidenceTone(result.summary.confidenceLevel)}
              priority="compact"
              badgeLabel="Asistiva"
            />
          </div>

          <InsightPanel
            title="Resumen ejecutivo asistivo"
            tone={getConfidenceTone(result.summary.confidenceLevel)}
            insight={result.summary.executiveSummary}
            implication={result.summary.confidenceNotes[0] ?? 'La IA solo resume el estado del cierre a partir del bloque determinista.'}
            action={result.summary.assistantNotice}
          />

          <div className="cc-fiscal-closing-ai-columns">
            <CollapsibleDetailSection
              title="Riesgos y datos insuficientes"
              count={result.summary.keyRisks.length + result.summary.missingDataNotes.length}
              tone={result.summary.keyRisks.length > 0 ? 'warning' : 'info'}
            >
              <div className="cc-quarterly-checklist">
                <div className="cc-action-group" style={{ alignItems: 'center' }}>
                  <strong>Riesgos clave</strong>
                  <SeverityBadge label={`${result.summary.keyRisks.length}`} tone={result.summary.keyRisks.length > 0 ? 'warning' : 'success'} />
                </div>
                {renderSummaryList(result.summary.keyRisks, 'Sin riesgos destacados por la IA.', 'risk')}
                <div className="cc-action-group" style={{ alignItems: 'center', marginTop: '0.5rem' }}>
                  <strong>Datos insuficientes</strong>
                  <SeverityBadge label={`${result.summary.missingDataNotes.length}`} tone={result.summary.missingDataNotes.length > 0 ? 'warning' : 'success'} />
                </div>
                {renderSummaryList(result.summary.missingDataNotes, 'Sin datos faltantes adicionales destacados.', 'missing')}
              </div>
            </CollapsibleDetailSection>

            <CollapsibleDetailSection
              title="Recomendaciones y siguientes pasos"
              count={result.summary.recommendedActions.length + result.summary.nextSteps.length}
              tone="info"
            >
              <div className="cc-quarterly-checklist">
                <div className="cc-action-group" style={{ alignItems: 'center' }}>
                  <strong>Recomendaciones</strong>
                  <SeverityBadge label={`${result.summary.recommendedActions.length}`} tone="info" />
                </div>
                {renderSummaryList(result.summary.recommendedActions, 'Sin recomendaciones adicionales.', 'recommendation')}
                <div className="cc-action-group" style={{ alignItems: 'center', marginTop: '0.5rem' }}>
                  <strong>Siguientes pasos</strong>
                  <SeverityBadge label={`${result.summary.nextSteps.length}`} tone="info" />
                </div>
                {renderSummaryList(result.summary.nextSteps, 'Sin siguientes pasos adicionales.', 'next')}
              </div>
            </CollapsibleDetailSection>
          </div>

          <CollapsibleDetailSection title="Notas para gestoria y confianza" count={result.summary.accountantNotes.length + result.summary.confidenceNotes.length} tone="neutral">
            <div className="cc-quarterly-checklist">
              <div className="cc-action-group" style={{ alignItems: 'center' }}>
                <strong>Notas para gestoria</strong>
                <SeverityBadge label={`${result.summary.accountantNotes.length}`} tone="neutral" />
              </div>
              {renderSummaryList(result.summary.accountantNotes, 'Sin notas sugeridas adicionales.', 'accounting')}
              <div className="cc-action-group" style={{ alignItems: 'center', marginTop: '0.5rem' }}>
                <strong>Notas de confianza</strong>
                <SeverityBadge label={`${result.summary.confidenceNotes.length}`} tone={getConfidenceTone(result.summary.confidenceLevel)} />
              </div>
              {renderSummaryList(result.summary.confidenceNotes, 'Sin notas adicionales de confianza.', 'confidence')}
            </div>
          </CollapsibleDetailSection>
        </div>
      ) : null}
    </section>
  )
}
