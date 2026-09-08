import { useMemo, useRef, useState } from 'react'
import type { ExpenseModuleFilter } from '../../app/moduleFilters'
import { formatCurrency } from '../../app/displayFormat'
import { buildExpenseFiscalSummary } from '../../features/expenses/fiscalIntelligenceSummary'
import type { ExpenseListItem } from '../../features/expenses/types'
import { V3EmptyState, V3EntityList, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3PrimaryAction, V3Search, V3Select } from '../components/V3Primitives'
import { V3ExpenseRow } from './V3ExpenseRow'
import { V3ExpenseWorkspace } from './V3ExpenseWorkspace'

interface V3ExpensesPageProps {
  expenses: ExpenseListItem[]
  allExpenses: ExpenseListItem[]
  error: string | null
  initialExpenseId?: string | null
  activeFilter?: ExpenseModuleFilter | null
  activeFilterLabel?: string | null
  onCreateExpense: () => void
  onRefresh: () => Promise<void>
  onEditExpense: (expense: ExpenseListItem) => void
  onCreateSimilarExpense: (expense: ExpenseListItem) => void
  onOpenExpenseDeepLink: (expenseId: string) => void
  onBackToExpenseList: () => void
}

export function V3ExpensesPage(props: V3ExpensesPageProps) {
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(props.initialExpenseId ?? null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'oldest' | 'amount'>('recent')
  const listScrollYRef = useRef(0)
  const selectedExpense = props.expenses.find((expense) => expense.id === selectedExpenseId) ?? null
  const fiscalSummary = buildExpenseFiscalSummary(props.allExpenses)
  const totalThisMonth = props.allExpenses.filter((expense) => expense.expense_date.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum, expense) => sum + Number(expense.total ?? 0), 0)
  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return props.expenses.filter((expense) => !query || [expense.display_code, expense.supplier_name, expense.description, expense.category, expense.reference_number].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)).sort((left, right) => sort === 'amount' ? Number(right.total) - Number(left.total) : sort === 'oldest' ? left.expense_date.localeCompare(right.expense_date) : right.expense_date.localeCompare(left.expense_date))
  }, [props.expenses, search, sort])

  if (selectedExpense) return <V3ExpenseWorkspace key={selectedExpense.id} expense={selectedExpense} onBack={() => { setSelectedExpenseId(null); props.onBackToExpenseList(); window.requestAnimationFrame(() => window.scrollTo({ top: listScrollYRef.current, behavior: 'auto' })) }} onRefresh={props.onRefresh} onEdit={() => props.onEditExpense(selectedExpense)} onCreateSimilar={() => props.onCreateSimilarExpense(selectedExpense)} />

  return <V3Page className="v3-expenses-page"><V3PageTitle eyebrow="Soporte y revisión" title="Gastos" description={`${props.activeFilterLabel ? `${props.activeFilterLabel} · ` : ''}Importes, soporte documental y revisión interna en una sola lectura.`} action={<V3PrimaryAction onClick={props.onCreateExpense}>+ Nuevo gasto</V3PrimaryAction>} /><V3KpiGroup><V3Kpi label="Gasto este mes" value={formatCurrency(totalThisMonth)} hint="Suma real por fecha de gasto" /><V3Kpi label="Por revisar" value={String(fiscalSummary.needsReviewCount)} hint="Estado interno de revisión fiscal" /></V3KpiGroup><div className="v3-module-controls"><V3Search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Proveedor, referencia, concepto o categoría" /><V3Select aria-label="Ordenar gastos" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="amount">Mayor importe</option></V3Select></div>{props.error ? <div className="v3-state v3-state--error" role="alert"><strong>Error cargando gastos</strong><p>{props.error}</p></div> : null}{!props.error && visibleExpenses.length === 0 ? <V3EmptyState title="Sin gastos visibles" description="Ajusta la búsqueda o el filtro para continuar." /> : null}<V3EntityList label="Gastos">{visibleExpenses.map((expense) => <V3ExpenseRow key={expense.id} expense={expense} onOpen={() => { listScrollYRef.current = window.scrollY; setSelectedExpenseId(expense.id); props.onOpenExpenseDeepLink(expense.id); window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' })) }} />)}</V3EntityList></V3Page>
}
