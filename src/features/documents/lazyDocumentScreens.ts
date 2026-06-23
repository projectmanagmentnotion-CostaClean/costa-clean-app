import { lazy } from 'react'

export const LazyInvoiceDocumentScreen = lazy(async () => ({
  default: (await import('../invoices/InvoiceDocumentScreen')).InvoiceDocumentScreen,
}))

export const LazyQuoteDocumentScreen = lazy(async () => ({
  default: (await import('../quotes/QuoteDocumentScreen')).QuoteDocumentScreen,
}))
