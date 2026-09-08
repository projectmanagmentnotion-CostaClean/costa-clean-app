import { describe, expect, it } from 'vitest'
import { buildV3HomePriorities } from './homePriorities'

const routing = { kind: 'module' as const, view: 'invoices' as const, filterKey: 'invoices' as const, filterValue: 'pending' as const }

function alert(overrides: Partial<Parameters<typeof buildV3HomePriorities>[0]['alerts'][number]> = {}) {
  return { id: 'alert-1', ruleId: 'unpaid_invoices_older_threshold' as const, severity: 'critical' as const, title: 'Factura vencida', summary: '2 facturas', detail: 'Cobro pendiente', count: 2, amount: 2140, routing, ...overrides }
}

function incident(overrides: Partial<Parameters<typeof buildV3HomePriorities>[0]['incidents'][number]> = {}) {
  return { id: 'job-without-invoice-1', severity: 'warning' as const, title: 'Servicio sin factura', summary: 'Cliente · hoy', detail: 'Facturar', entityLabel: 'SRV-1', primaryAction: { kind: 'open_job_workspace' as const, label: 'Crear factura', jobId: 'job-1' }, ...overrides }
}

describe('V3 home priorities', () => {
  it('orders critical before warning and caps the queue', () => {
    const priorities = buildV3HomePriorities({ alerts: [alert()], incidents: [incident({ id: 'quote-1', severity: 'warning', title: 'Presupuesto pendiente' }), incident({ id: 'property-relation-anomaly-1', severity: 'critical', title: 'Relación anómala' }), incident({ id: 'client-missing-fiscal-1', severity: 'warning', title: 'Datos fiscales' })] })
    expect(priorities).toHaveLength(3)
    expect(priorities[0].severity).toBe('critical')
    expect(priorities.map((item) => item.label)).toEqual(['Factura vencida', 'Relación anómala', 'Datos fiscales'])
  })

  it('deduplicates an operational incident represented by an alert', () => {
    const priorities = buildV3HomePriorities({ alerts: [alert({ ruleId: 'completed_jobs_without_invoice_older_threshold', id: 'alert-job', title: 'Servicios sin factura' })], incidents: [incident()] })
    expect(priorities).toHaveLength(1)
    expect(priorities[0].alert?.id).toBe('alert-job')
  })

  it('returns no priorities for clean state', () => {
    expect(buildV3HomePriorities({ alerts: [], incidents: [] })).toEqual([])
  })
})
