import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../../app/displayFormat'
import type { ExpenseListItem } from '../expenses/types'
import { getExpenseCategoryLabel } from '../expenses/types'
import { isExpenseOperationallyAllocatable, type JobExpenseAllocation, remainingAllocatableBase, totalOtherDirectCost } from './expenseAllocation'
import { listJobExpenseAllocations, removeJobExpenseAllocation, saveJobExpenseAllocation } from './expenseAllocationApi'

export function JobExpenseAllocationPanel({ jobId, expenses, onChanged }: { jobId: string; expenses: ExpenseListItem[]; onChanged: () => void }) {
  const [allocations, setAllocations] = useState<JobExpenseAllocation[]>([])
  const [expenseId, setExpenseId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const refresh = useCallback(async () => { try { setAllocations(await listJobExpenseAllocations(jobId)); setError(null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar otros costes directos.') } }, [jobId])
  useEffect(() => { void refresh() }, [refresh])
  const eligibleExpenses = useMemo(() => expenses.filter((expense) => isExpenseOperationallyAllocatable(expense.category) && !expense.deleted_at && !expense.archived_at && !expense.cancelled_at), [expenses])
  const selected = eligibleExpenses.find((expense) => expense.id === expenseId)
  const allocatedForSelected = allocations.filter((allocation) => allocation.expense_id === expenseId).reduce((sum, allocation) => sum + Number(allocation.allocated_base_amount || 0), 0)
  const remaining = selected ? remainingAllocatableBase(Number(selected.subtotal), allocatedForSelected) : 0
  async function save() { const numericAmount = Number(amount); if (!selected || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > remaining) { setError('Selecciona un gasto elegible y un importe dentro del subtotal restante.'); return }; setSaving(true); try { await saveJobExpenseAllocation({ expense_id: selected.id, job_id: jobId, allocated_base_amount: numericAmount, notes: notes.trim() || null, idempotency_key: `N8-${jobId}-${selected.id}` }); setAmount(''); setNotes(''); await refresh(); onChanged(); setError(null) } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'No se pudo asignar el gasto.') } finally { setSaving(false) } }
  async function remove(id: string) { setSaving(true); try { await removeJobExpenseAllocation(id); await refresh(); onChanged() } catch (removeError) { setError(removeError instanceof Error ? removeError.message : 'No se pudo quitar la asignación.') } finally { setSaving(false) } }
  return <section className="data-section" data-qa="job-expense-allocations"><div className="section-header"><div><h2>Otros costes directos</h2><p>Asignaciones operativas sobre subtotal, sin cambiar el gasto original. Total asignado: {formatCurrency(totalOtherDirectCost(allocations))}</p></div></div><div className="lead-form cc-form-shell__grid"><label>Gasto elegible<select value={expenseId} onChange={(event) => setExpenseId(event.target.value)}><option value="">Selecciona gasto</option>{eligibleExpenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.display_code ?? expense.id} · {getExpenseCategoryLabel(expense.category)} · {formatCurrency(expense.subtotal)}</option>)}</select></label><label>Importe base<input type="number" min="0.01" max={remaining || undefined} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Nota opcional<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label><p>Subtotal restante: {formatCurrency(remaining)}</p><button type="button" className="primary-button" onClick={() => void save()} disabled={saving}>Asignar gasto</button></div>{allocations.map((allocation) => <article key={allocation.id} className="cc-list-section__header"><div><strong>{allocation.supplier_name ?? allocation.expense_id}</strong><p>{allocation.category ? getExpenseCategoryLabel(allocation.category) : allocation.expense_category_snapshot} · {allocation.allocation_status === 'invalid_source' ? 'Fuente no válida' : 'Fuente válida'}</p></div><div><strong>{formatCurrency(allocation.allocated_base_amount)}</strong><button type="button" className="secondary-button" onClick={() => void remove(allocation.id)} disabled={saving}>Quitar</button></div></article>)}{allocations.length === 0 ? <p>No hay gastos directos asignados a este servicio.</p> : null}{error ? <p role="alert" className="form-error">{error}</p> : null}</section>
}
