import { useCallback, useEffect, useState } from 'react'
import { formatCurrency } from '../../app/displayFormat'
import { getExpenseAllocationSummary } from '../jobs/expenseAllocationApi'

export function ExpenseAllocationSummaryPanel({ expenseId }: { expenseId: string }) {
  const [summary, setSummary] = useState<{ expense_subtotal: number; allocated_base: number; remaining_base: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => { try { setSummary(await getExpenseAllocationSummary(expenseId)); setError(null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el resumen de asignaciones.') } }, [expenseId])
  useEffect(() => { const timer = window.setTimeout(() => { void refresh() }, 0); return () => window.clearTimeout(timer) }, [refresh])
  return <section className="data-section" data-qa="expense-allocation-summary"><div className="section-header"><div><h2>Asignación a servicios</h2><p>Lectura operativa sobre subtotal; no modifica los datos fiscales del gasto.</p></div></div>{error ? <p role="alert" className="form-error">{error}</p> : summary ? <div className="cc-client-workspace__ledger-grid"><div className="detail-row"><span className="detail-label">Subtotal</span><strong>{formatCurrency(summary.expense_subtotal)}</strong></div><div className="detail-row"><span className="detail-label">Asignado</span><strong>{formatCurrency(summary.allocated_base)}</strong></div><div className="detail-row"><span className="detail-label">Disponible</span><strong>{formatCurrency(summary.remaining_base)}</strong></div></div> : <p>Cargando asignaciones...</p>}</section>
}
