import { lazy } from 'react'

export const LazyFiscalPeriodExportSection = lazy(async () => ({
  default: (await import('./FiscalPeriodExportSection')).FiscalPeriodExportSection,
}))
