import { useCallback, useEffect, useState } from 'react'
import { formatCurrency } from '../../app/displayFormat'
import { getJobProfitability } from './jobProfitabilityApi'
import type { JobProfitability } from './jobProfitability'

function amount(value: number) { return formatCurrency(Number.isFinite(value) ? value : 0) }

export function JobProfitabilityPanel({ jobId }: { jobId: string }) {
  const [data, setData] = useState<JobProfitability | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    setLoading(true)
    try { setData(await getJobProfitability(jobId)); setError(null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la rentabilidad operativa.') } finally { setLoading(false) }
  }, [jobId])
  useEffect(() => { void refresh() }, [refresh])
  if (loading) return <section className="data-section"><h2>Rentabilidad</h2><p>Cargando cálculo operativo...</p></section>
  if (error) return <section className="data-section"><h2>Rentabilidad</h2><p role="alert" className="form-error">{error}</p></section>
  if (!data) return null
  const incomplete = data.completeness_status !== 'COMPLETE'
  return <section className="data-section" data-qa="job-profitability"><div className="section-header"><div><h2>Rentabilidad operativa</h2><p>Margen directo antes de gastos generales y otros costes no asignados.</p></div>{data.actual_direct_contribution < 0 ? <span className="lead-badge">Margen directo negativo</span> : null}</div><div className="cc-client-workspace__ledger-grid"><div className="detail-row"><span className="detail-label">Facturación base</span><strong>{amount(data.actual_invoiced_base)}</strong></div><div className="detail-row"><span className="detail-label">Coste de personal</span><strong>{amount(data.actual_labor_cost)}</strong></div><div className="detail-row"><span className="detail-label">Margen directo</span><strong>{incomplete ? 'Pendiente de completar' : amount(data.actual_direct_contribution)}</strong></div><div className="detail-row"><span className="detail-label">Margen %</span><strong>{incomplete || data.direct_margin_percent == null ? '—' : `${data.direct_margin_percent.toFixed(2)} %`}</strong></div><div className="detail-row"><span className="detail-label">Horas previstas / registradas</span><strong>{(data.planned_minutes / 60).toFixed(2)} h / {(data.actual_minutes / 60).toFixed(2)} h</strong></div></div><div className="cc-client-workspace__focus-list"><article className="cc-client-workspace__focus-card"><span>Previsto</span><strong>{amount(data.planned_direct_contribution)}</strong><small>Ingresos {amount(data.planned_revenue_base)} · Personal {amount(data.planned_labor_cost)}</small></article><article className="cc-client-workspace__focus-card"><span>Real</span><strong>{incomplete ? 'Datos incompletos' : amount(data.actual_direct_contribution)}</strong><small>Ingresos {amount(data.actual_invoiced_base)} · Personal {amount(data.actual_labor_cost)}</small></article></div>{incomplete ? <p role="status">{data.completeness_status === 'PARTIAL_NO_TIME' ? 'Faltan horas registradas.' : data.completeness_status === 'PARTIAL_NO_INVOICE' ? 'Servicio aún sin factura emitida.' : 'Rentabilidad pendiente de datos operativos.'}</p> : null}<details><summary>Cobros (separados del margen)</summary><p>Factura total con IVA: {amount(data.invoice_total_with_vat)} · Cobrado: {amount(data.collected_amount)} · Pendiente: {amount(data.outstanding_amount)}</p></details></section>
}
