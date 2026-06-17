import { sanitizeFilenamePart } from '../documents/utils'

export type ExportDeliveryAudience = 'customer' | 'accounting_external' | 'internal_review'

export const externalAccountingSectionPaths = {
  summary: 'resumen',
  invoices: 'facturas-emitidas',
  payments: 'cobros',
  expenses: 'gastos-y-soportes',
  quotes: 'presupuestos-comerciales',
  pendingItems: 'pendientes-de-revision',
  accountantReview: 'resumen-para-gestoria',
} as const

export function toExternalStem(value: string): string {
  return sanitizeFilenamePart(value)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

export function buildExternalAccountingPackageStem(periodLabel: string): string {
  const periodStem = toExternalStem(periodLabel)
  return periodStem ? `costa-clean-paquete-fiscal-${periodStem}` : 'costa-clean-paquete-fiscal'
}

export function buildExternalJsonName(baseName: string): string {
  return `${toExternalStem(baseName) || 'resumen'}.json`
}

export function buildExternalHtmlName(baseName: string): string {
  return `${toExternalStem(baseName) || 'documento'}.html`
}

export function buildExportedExpenseSupportStem(expenseReference: string): string {
  const safeReference = toExternalStem(expenseReference)
  return safeReference ? `soporte-gasto-${safeReference}` : 'soporte-gasto'
}

export function getExportAudienceLabel(audience: ExportDeliveryAudience): string {
  if (audience === 'customer') return 'Cliente'
  if (audience === 'accounting_external') return 'Gestoria / tercero'
  return 'Revision interna'
}
