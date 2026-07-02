import { useEffect, useMemo, useState } from 'react'
import { BUILD_INFO } from './buildInfo'
import {
  buildModuleHealthSummaries,
  runDataHealthProbes,
  shouldShowDataHealthDebug,
  type DataHealthProbeResult,
} from './dataHealth'

interface DataHealthDebugPanelProps {
  domainErrors: Partial<Record<string, string | null>>
}

export function DataHealthDebugPanel({ domainErrors }: DataHealthDebugPanelProps) {
  const [results, setResults] = useState<DataHealthProbeResult[]>([])
  const [isLoading, setIsLoading] = useState(() => shouldShowDataHealthDebug())
  const [probeError, setProbeError] = useState<string | null>(null)

  const isVisible = shouldShowDataHealthDebug()
  const moduleSummaries = useMemo(() => buildModuleHealthSummaries(domainErrors), [domainErrors])

  useEffect(() => {
    if (!isVisible) return

    let isMounted = true

    void runDataHealthProbes()
      .then((nextResults) => {
        if (!isMounted) return
        setResults(nextResults)
      })
      .catch((error) => {
        if (!isMounted) return
        setProbeError(error instanceof Error ? error.message : 'No se pudieron ejecutar los probes de salud.')
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isVisible])

  if (!isVisible) return null

  const failingProbeCount = results.filter((result) => !result.ok).length

  return (
    <section className="data-section cc-state-card" aria-label="Salud de datos">
      <div className="section-header page-header-actions">
        <div>
          <h2>Sistema · Salud de datos</h2>
          <p>Auditoría rápida app ↔ Supabase con errores de carga, probes REST y build activo.</p>
        </div>
      </div>

      <div className="cc-kpi-grid cc-kpi-grid--compact">
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Build</span>
          <strong className="cc-kpi-value">{BUILD_INFO.commit}</strong>
          <p className="cc-kpi-footnote">{BUILD_INFO.version}</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Módulos con error</span>
          <strong className="cc-kpi-value">{moduleSummaries.filter((module) => module.status === 'error').length}</strong>
          <p className="cc-kpi-footnote">Errores visibles desde `useAppData`.</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Probes REST fallidos</span>
          <strong className="cc-kpi-value">{failingProbeCount}</strong>
          <p className="cc-kpi-footnote">{isLoading ? 'Ejecutando probes…' : 'Sobre selects reales de la app.'}</p>
        </article>
      </div>

      {probeError ? (
        <div className="cc-alert cc-alert--error">
          <strong>No se pudieron ejecutar los probes</strong>
          <p>{probeError}</p>
        </div>
      ) : null}

      <div className="cc-detail-panel__summary">
        {moduleSummaries.map((module) => (
          <div key={module.view} className="cc-detail-panel__summary-card">
            <span>{module.label}</span>
            <strong>{module.status === 'ok' ? 'OK' : 'Error'}</strong>
            <small>
              {module.failingDomains.length > 0
                ? `Dominios: ${module.failingDomains.join(', ')}`
                : 'Sin errores cargados en esta sesión.'}
            </small>
          </div>
        ))}
      </div>

      <div className="lead-form" style={{ marginTop: '1rem' }}>
        {results.map((result) => (
          <div key={result.key} className={`cc-alert ${result.ok ? 'cc-alert--info' : 'cc-alert--warning'}`}>
            <strong>{result.table} · {result.selectMode === 'app' ? 'select app' : 'select mínimo'}</strong>
            <p>
              {result.ok
                ? `OK (${result.statusCode ?? 'sin status'})`
                : `${result.issueType} · HTTP ${result.statusCode ?? 'n/a'}${result.missingColumn ? ` · ${result.missingColumn}` : ''}`}
            </p>
            {!result.ok ? (
              <small>{result.detail}</small>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
