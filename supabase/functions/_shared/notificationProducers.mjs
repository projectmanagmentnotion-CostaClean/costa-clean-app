const RULES = Object.freeze({
  overdueInvoice: {
    alertKey: 'unpaid-invoices-older-threshold',
    ruleId: 'unpaid_invoices_older_threshold',
    category: 'collections',
    sourceTable: 'invoices',
    destinationPath: '/?view=invoices&filter=overdue',
    title: 'Revisar cobros pendientes',
    body: 'Hay una factura pendiente fuera de plazo interno.',
  },
  expenseMissingSupport: {
    alertKey: 'expenses-missing-support',
    ruleId: 'expenses_missing_support',
    category: 'administration',
    sourceTable: 'expenses',
    destinationPath: '/?view=expenses&filter=missing_support',
    title: 'Completar soportes documentales',
    body: 'Hay un gasto sin soporte documental suficiente.',
  },
  completedJobWithoutInvoice: {
    alertKey: 'completed-jobs-without-invoice-older-threshold',
    ruleId: 'completed_jobs_without_invoice_older_threshold',
    category: 'operations',
    sourceTable: 'jobs',
    destinationPath: '/?view=jobs&filter=completed_without_invoice',
    title: 'Facturar servicios completados',
    body: 'Hay un servicio completado pendiente de facturación.',
  },
  acceptedQuotePendingAction: {
    alertKey: 'accepted-quotes-without-job-older-threshold',
    ruleId: 'accepted_quotes_without_job_older_threshold',
    category: 'operations',
    sourceTable: 'quotes',
    destinationPath: '/?view=quotes&filter=accepted_pending_action',
    title: 'Activar presupuestos aceptados',
    body: 'Hay un presupuesto aceptado pendiente de activar.',
  },
})

export const PRODUCER_RULES = RULES

function hasId(value) {
  return typeof value === 'string' && value.length > 0
}

function decisionKey(rule, sourceId) {
  return `${rule.ruleId}:${sourceId}`
}

export function buildProducerConditions({ invoices = [], payments = [], expenses = [], jobs = [], quotes = [], now = new Date(), thresholds = {} }) {
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  const olderThan = (value, days) => {
    if (!value || !Number.isFinite(days)) return false
    const date = new Date(`${value}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return false
    const cutoff = new Date(today)
    cutoff.setUTCDate(cutoff.getUTCDate() - days)
    return date < cutoff
  }
  const paidByInvoice = new Map()
  for (const payment of payments) {
    if (!hasId(payment.invoice_id) || payment.archived_at || payment.deleted_at || payment.cancelled_at) continue
    paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount ?? 0))
  }
  const conditions = []
  for (const invoice of invoices) {
    const outstanding = Number(invoice.total ?? 0) - (paidByInvoice.get(invoice.id) ?? 0)
    if (hasId(invoice.id) && invoice.status !== 'cancelled' && !invoice.archived_at && !invoice.deleted_at && !invoice.cancelled_at && outstanding > 0 && olderThan(invoice.issue_date, thresholds.unpaidInvoicesOlderThanDays)) {
      conditions.push({ rule: RULES.overdueInvoice, sourceId: invoice.id })
    }
  }
  for (const expense of expenses) {
    const missing = expense.document_support_status === 'missing' || (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid')
    if (hasId(expense.id) && !expense.archived_at && !expense.deleted_at && !expense.cancelled_at && missing) conditions.push({ rule: RULES.expenseMissingSupport, sourceId: expense.id })
  }
  for (const job of jobs) {
    if (hasId(job.id) && !job.archived_at && !job.deleted_at && !job.cancelled_at && job.status === 'completed' && !job.invoice_id && olderThan(job.scheduled_date, thresholds.completedJobsWithoutInvoiceOlderThanDays)) {
      conditions.push({ rule: RULES.completedJobWithoutInvoice, sourceId: job.id })
    }
  }
  for (const quote of quotes) {
    if (hasId(quote.id) && !quote.archived_at && !quote.deleted_at && !quote.cancelled_at && quote.status === 'accepted' && !quote.job_id && olderThan(quote.created_at?.slice(0, 10), thresholds.acceptedQuotesWithoutJobOlderThanDays)) {
      conditions.push({ rule: RULES.acceptedQuotePendingAction, sourceId: quote.id })
    }
  }
  return conditions
}

export function buildReminder(condition, userId) {
  if (!condition?.rule || !hasId(condition.sourceId) || !hasId(userId)) return null
  const fingerprint = decisionKey(condition.rule, condition.sourceId)
  return {
    user_id: userId,
    category: condition.rule.category,
    title: condition.rule.title,
    body: condition.rule.body,
    destination_path: condition.rule.destinationPath,
    dedupe_key: `v1:${fingerprint}`,
    source_table: condition.rule.sourceTable,
    source_id: condition.sourceId,
    payload: { rule_id: condition.rule.ruleId },
    status: 'ready',
  }
}

export function decisionSuppresses(decision, condition, userId) {
  if (!decision || !condition || decision.status !== 'dismissed' && decision.status !== 'resolved') return false
  if (decision.alert_key !== condition.rule.alertKey || decision.fingerprint !== decisionKey(condition.rule, condition.sourceId)) return false
  return decision.scope === 'global' || (decision.scope === 'user' && decision.user_id === userId)
}

export async function produceReminders({ conditions, users, decisions = [], existingDedupeKeys = new Set(), insertReminder }) {
  const result = { matched: conditions.length, eligibleUsers: users.length, inserted: 0, deduplicated: 0, suppressed: 0 }
  for (const userId of users) {
    for (const condition of conditions) {
      if (decisions.some((decision) => decisionSuppresses(decision, condition, userId))) { result.suppressed += 1; continue }
      const reminder = buildReminder(condition, userId)
      if (!reminder) continue
      if (existingDedupeKeys.has(`${userId}:${reminder.dedupe_key}`)) { result.deduplicated += 1; continue }
      try {
        await insertReminder(reminder)
        existingDedupeKeys.add(`${userId}:${reminder.dedupe_key}`)
        result.inserted += 1
      } catch (error) {
        if (error?.code === '23505') result.deduplicated += 1
        else throw error
      }
    }
  }
  return result
}

export function isAuthorizedProducerToken({ token, secret, serviceRoleKey }) {
  return Boolean(token) && ((Boolean(secret) && token === secret) || (Boolean(serviceRoleKey) && token === serviceRoleKey))
}
