import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../../app/displayFormat'
import { listJobProfitability } from './jobProfitabilityApi'
import type { JobProfitability } from './jobProfitability'

type Period = 'month' | 'previous' | '90d'
function iso(date: Date) { return date.toISOString().slice(0, 10) }
function range(period: Period) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), period === 'previous' ? 1 : period === '90d' ? today.getDate() - 89 : 1)
  const end = period === 'previous' ? new Date(today.getFullYear(), today.getMonth(), 0) : period === 'month' ? new Date(today.getFullYear(), today.getMonth() + 1, 0) : today
  return { from: iso(start), through: iso(end) }
}

export function ServicesProfitabilitySummary() {
  const [period, setPeriod] = useState<Period>('month')
  const [rows, setRows] = useState<JobProfitability[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const dates = useMemo(() => range(period), [period])
  const refresh = useCallback(async () => { setLoading(true); try { setRows(await listJobProfitability(dates.from, dates.through)); setError(null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el resumen de rentabilidad.') } finally { setLoading(false) } }, [dates.from, dates.through])
  useEffect(() => { void refresh() }, [refresh])
  const summary = useMemo(() => ({ revenue: rows.reduce((sum, row) => sum + row.actual_invoiced_base, 0), labor: rows.reduce((sum, row) => sum + row.actual_labor_cost, 0), margin: rows.reduce((sum, row) => sum + row.actual_direct_contribution, 0), missingHours: rows.filter((row) => row.completeness_status === 'PARTIAL_NO_TIME').length, missingInvoice: rows.filter((row) => row.completeness_status === 'PARTIAL_NO_INVOICE').length }), [rows])
  const marginPercent = summary.revenue > 0 ? summary.margin / summary.revenue * 100 : null
  const group = (key: 'client_name' | 'property_name') => [...rows.reduce((map, row) => { const name = row[key] || 'Sin identificar'; map.set(name, (map.get(name) ?? 0) + row.actual_direct_contribution); return map }, new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 3)
  return <section className="data-section" data-qa="services-profitability-summary"><div className="section-header"><div><h2>Rentabilidad de servicios</h2><p>Margen directo antes de gastos generales y otros costes no asignados.</p></div><label>Periodo<select value={period} onChange={(event) => setPeriod(event.target.value as Period)}><option value="month">Mes actual</option><option value="previous">Mes anterior</option><option value="90d">Últimos 90 días</option></select></label></div>{loading ? <p>Cargando resumen...</p> : error ? <p role="alert" className="form-error">{error}</p> : <><div className="cc-client-workspace__ledger-grid"><div className="detail-row"><span className="detail-label">Facturación base</span><strong>{formatCurrency(summary.revenue)}</strong></div><div className="detail-row"><span className="detail-label">Coste de personal</span><strong>{formatCurrency(summary.labor)}</strong></div><div className="detail-row"><span className="detail-label">Margen directo</span><strong>{formatCurrency(summary.margin)}</strong></div><div className="detail-row"><span className="detail-label">Margen %</span><strong>{marginPercent == null ? '—' : `${marginPercent.toFixed(2)} %`}</strong></div></div><p>{rows.length} servicio(s) · {summary.missingHours} sin horas · {summary.missingInvoice} sin factura emitida.</p><div className="cc-client-workspace__focus-list"><article className="cc-client-workspace__focus-card"><span>Clientes con mayor contribución</span>{group('client_name').map(([name, value]) => <strong key={name}>{name}: {formatCurrency(value)}</strong>)}</article><article className="cc-client-workspace__focus-card"><span>Propiedades con mayor contribución</span>{group('property_name').map(([name, value]) => <strong key={name}>{name}: {formatCurrency(value)}</strong>)}</article></div></>}</section>
}
