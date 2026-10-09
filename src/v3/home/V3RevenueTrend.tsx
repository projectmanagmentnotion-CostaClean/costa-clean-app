import { useState } from 'react'
import type { DashboardTrendPoint } from './executiveDashboardModel'

type SeriesKey = 'invoiced' | 'collected' | 'expenses'
const seriesMeta: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: 'invoiced', label: 'Facturado', color: 'var(--v3-chart-invoiced)' },
  { key: 'collected', label: 'Cobrado', color: 'var(--v3-chart-collected)' },
  { key: 'expenses', label: 'Gastos', color: 'var(--v3-chart-expenses)' },
]

function currency(value: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value) }
function pathFor(points: DashboardTrendPoint[], key: SeriesKey, xFor: (index: number) => number, yFor: (value: number) => number) { return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point[key])}`).join(' ') }
function areaFor(points: DashboardTrendPoint[], key: SeriesKey, xFor: (index: number) => number, yFor: (value: number) => number) { return points.length ? `${pathFor(points, key, xFor, yFor)} L ${xFor(points.length - 1)} 176 L ${xFor(0)} 176 Z` : '' }

export function V3RevenueTrend({ points: trend }: { points: DashboardTrendPoint[] }) {
  const [activePoint, setActivePoint] = useState<{ index: number; key: SeriesKey } | null>(null)
  const max = Math.max(...trend.flatMap((point) => [point.invoiced, point.collected, point.expenses]), 1)
  const summary = trend.map((point) => `${point.label}: facturado ${currency(point.invoiced)}, cobrado ${currency(point.collected)}, gastos ${currency(point.expenses)}`).join('; ')
  const xFor = (index: number) => trend.length <= 1 ? 256 : 28 + (index * 464) / (trend.length - 1)
  const yFor = (value: number) => 176 - (value / max) * 138
  const active = activePoint ? trend[activePoint.index] : null
  return <div className="v3-dashboard-trend">
    <div className="v3-dashboard-trend__plot" role="img" aria-labelledby="v3-dashboard-trend-title v3-dashboard-trend-description">
      <svg className="v3-dashboard-trend__chart" viewBox="0 0 520 220" preserveAspectRatio="none">
        <defs><linearGradient id="v3-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--v3-chart-invoiced)" stopOpacity=".28" /><stop offset="1" stopColor="var(--v3-chart-invoiced)" stopOpacity=".02" /></linearGradient></defs>
        <title id="v3-dashboard-trend-title">Tendencia de facturación, cobros y gastos</title><desc id="v3-dashboard-trend-description">{summary || 'Sin datos históricos suficientes.'}</desc>
        {[38, 107, 176].map((y) => <line key={y} x1="28" y1={y} x2="492" y2={y} stroke="var(--v3-chart-grid)" strokeDasharray="3 5" />)}
        {trend.length ? <path d={areaFor(trend, 'invoiced', xFor, yFor)} fill="url(#v3-trend-fill)" /> : null}
        {seriesMeta.map((series) => <path key={series.key} d={pathFor(trend, series.key, xFor, yFor)} fill="none" stroke={series.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
        {trend.map((point, index) => <g key={point.key}><text x={xFor(index)} y="205" textAnchor="middle" fill="var(--v3-chart-label)">{point.label}</text>{seriesMeta.map((series) => <circle key={series.key} cx={xFor(index)} cy={yFor(point[series.key])} r={activePoint?.index === index && activePoint.key === series.key ? 5 : 3} fill={series.color} stroke="var(--v3-color-surface)" strokeWidth="2" tabIndex={0} role="img" aria-label={`${series.label}, ${point.label}: ${currency(point[series.key])}`} onMouseEnter={() => setActivePoint({ index, key: series.key })} onFocus={() => setActivePoint({ index, key: series.key })} onMouseLeave={() => setActivePoint(null)} onBlur={() => setActivePoint(null)} />)}</g>)}
      </svg>
      {active ? <div className="v3-dashboard-trend__tooltip" role="status"><strong>{active.label}</strong><span>{seriesMeta.find((series) => series.key === activePoint?.key)?.label}: {currency(active[activePoint?.key ?? 'invoiced'])}</span></div> : null}
    </div>
    <div className="v3-dashboard-trend__legend">{seriesMeta.map((series) => <span key={series.key}><i style={{ background: series.color }} />{series.label}</span>)}</div>
  </div>
}
