import { describe, expect, it } from 'vitest'
import { buildProducerConditions, buildReminder, isAuthorizedProducerToken, produceReminders } from '../../supabase/functions/_shared/notificationProducers.mjs'

const now = new Date('2026-09-10T12:00:00Z')
const thresholds = { unpaidInvoicesOlderThanDays: 7, completedJobsWithoutInvoiceOlderThanDays: 2, acceptedQuotesWithoutJobOlderThanDays: 3 }

describe('notification producers', () => {
  it('returns no conditions for normal or resolved business state', () => {
    expect(buildProducerConditions({ now, thresholds, invoices: [{ id: 'paid', issue_date: '2026-08-01', status: 'paid', total: 10 }], payments: [{ invoice_id: 'paid', amount: 10 }], expenses: [{ id: 'supported', document_support_status: 'invoice_valid', receipt_file_path: 'x' }], jobs: [{ id: 'invoiced', status: 'completed', invoice_id: 'i', scheduled_date: '2026-08-01' }], quotes: [{ id: 'active', status: 'accepted', job_id: 'j', created_at: '2026-08-01' }] })).toEqual([])
  })

  it('builds all four condition families with safe destinations and no PII', () => {
    const conditions = buildProducerConditions({ now, thresholds, invoices: [{ id: 'inv-1', issue_date: '2026-08-01', status: 'issued', total: 10 }], payments: [], expenses: [{ id: 'exp-1', document_support_status: 'missing', receipt_file_path: null }], jobs: [{ id: 'job-1', status: 'completed', invoice_id: null, scheduled_date: '2026-08-01' }], quotes: [{ id: 'quote-1', status: 'accepted', job_id: null, created_at: '2026-08-01T00:00:00Z' }] })
    expect(conditions).toHaveLength(4)
    const reminders = conditions.map((condition) => buildReminder(condition, 'user-1'))
    expect(reminders.map((item) => item.destination_path)).toEqual(expect.arrayContaining(['/?view=invoices&filter=overdue', '/?view=expenses&filter=missing_support', '/?view=jobs&filter=completed_without_invoice', '/?view=quotes&filter=accepted_pending_action']))
    expect(JSON.stringify(reminders)).not.toMatch(/client|supplier|email|phone|address/i)
  })

  it('deduplicates repeated runs, fans out to two staff users, and handles conflict no-op', async () => {
    const condition = buildProducerConditions({ now, thresholds, invoices: [{ id: 'inv-1', issue_date: '2026-08-01', status: 'issued', total: 10 }], payments: [] })[0]
    const inserted = []
    const first = await produceReminders({ conditions: [condition], users: ['u1', 'u2'], insertReminder: async (row) => inserted.push(row) })
    const second = await produceReminders({ conditions: [condition], users: ['u1', 'u2'], existingDedupeKeys: new Set(inserted.map((row) => `${row.user_id}:${row.dedupe_key}`)), insertReminder: async () => { throw { code: '23505' } } })
    expect(first.inserted).toBe(2)
    expect(second.deduplicated).toBe(2)
    expect(new Set(inserted.map((row) => row.dedupe_key)).size).toBe(1)
  })

  it('suppresses only explicit matching dismissed/resolved decisions', async () => {
    const condition = buildProducerConditions({ now, thresholds, invoices: [{ id: 'inv-1', issue_date: '2026-08-01', status: 'issued', total: 10 }], payments: [] })[0]
    const inserted = []
    const result = await produceReminders({ conditions: [condition], users: ['u1'], decisions: [{ alert_key: condition.rule.alertKey, fingerprint: 'unpaid_invoices_older_threshold:inv-1', scope: 'global', user_id: null, status: 'dismissed' }], insertReminder: async (row) => inserted.push(row) })
    expect(result.suppressed).toBe(1)
    expect(inserted).toHaveLength(0)
  })

  it('keeps dedupe deterministic and rejects unauthorized invocation tokens', () => {
    const condition = { rule: { alertKey: 'x', ruleId: 'rule', category: 'operations', sourceTable: 'jobs', destinationPath: '/?view=jobs&filter=completed_without_invoice', title: 't', body: 'b' }, sourceId: 'source' }
    expect(buildReminder(condition, 'user').dedupe_key).toBe(buildReminder(condition, 'user').dedupe_key)
    expect(isAuthorizedProducerToken({ token: 'wrong', secret: 'secret', serviceRoleKey: 'role' })).toBe(false)
    expect(isAuthorizedProducerToken({ token: 'secret', secret: 'secret', serviceRoleKey: 'role' })).toBe(true)
  })
})
