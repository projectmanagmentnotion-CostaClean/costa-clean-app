import { describe, expect, it } from 'vitest'
import {
  buildExportedExpenseSupportStem,
  buildExternalAccountingPackageStem,
  buildExternalHtmlName,
  buildExternalJsonName,
  externalAccountingSectionPaths,
  getExportAudienceLabel,
} from './externalExportPolicy'

describe('externalExportPolicy', () => {
  it('normaliza el nombre del paquete fiscal externo', () => {
    expect(buildExternalAccountingPackageStem('T2 2026 / BCN')).toBe('costa-clean-paquete-fiscal-t2-2026-bcn')
  })

  it('normaliza nombres visibles de html y json', () => {
    expect(buildExternalHtmlName('Resumen del periodo')).toBe('resumen-del-periodo.html')
    expect(buildExternalJsonName('Resumen para gestoría')).toBe('resumen-para-gestoria.json')
  })

  it('genera nombres limpios para soportes de gasto exportados', () => {
    expect(buildExportedExpenseSupportStem('EXP 2026/004')).toBe('soporte-gasto-exp-2026004')
  })

  it('mantiene el mapa de carpetas externas esperado', () => {
    expect(externalAccountingSectionPaths).toMatchObject({
      summary: 'resumen',
      invoices: 'facturas-emitidas',
      payments: 'cobros',
      expenses: 'gastos-y-soportes',
      quotes: 'presupuestos-comerciales',
      pendingItems: 'pendientes-de-revision',
      accountantReview: 'resumen-para-gestoria',
    })
  })

  it('expone etiquetas de audiencia sin semantica interna', () => {
    expect(getExportAudienceLabel('customer')).toBe('Cliente')
    expect(getExportAudienceLabel('accounting_external')).toBe('Gestoria / tercero')
    expect(getExportAudienceLabel('internal_review')).toBe('Revision interna')
  })
})
