import { useEffect, useMemo, useState } from 'react'
import { fetchSupabaseRestList } from '../../lib/supabaseRest'
import type { InvoiceLineItem, InvoiceListItem } from './types'

interface InvoiceDocumentLinesState {
  invoice: InvoiceListItem
  isLoadingLines: boolean
  linesError: string | null
}

function hasInvoiceLines(invoice: InvoiceListItem): boolean {
  return Boolean(invoice.lines?.length || invoice.invoice_lines?.length)
}

function sortInvoiceLines(lines: InvoiceLineItem[]): InvoiceLineItem[] {
  return [...lines].sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
}

export function useInvoiceDocumentLines(invoice: InvoiceListItem): InvoiceDocumentLinesState {
  const [loadedLines, setLoadedLines] = useState<InvoiceLineItem[] | null>(null)
  const [isLoadingLines, setIsLoadingLines] = useState(false)
  const [linesError, setLinesError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    setLoadedLines(null)
    setLinesError(null)

    if (hasInvoiceLines(invoice)) {
      setIsLoadingLines(false)
      return () => {
        isActive = false
      }
    }

    async function loadLines() {
      setIsLoadingLines(true)

      try {
        const lines = await fetchSupabaseRestList<InvoiceLineItem>(
          `invoice_lines?invoice_id=eq.${encodeURIComponent(invoice.id)}&select=id,invoice_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc`,
        )

        if (isActive) {
          setLoadedLines(sortInvoiceLines(lines))
        }
      } catch (err) {
        if (isActive) {
          setLinesError(err instanceof Error ? err.message : 'Error desconocido cargando líneas.')
        }
      } finally {
        if (isActive) {
          setIsLoadingLines(false)
        }
      }
    }

    void loadLines()

    return () => {
      isActive = false
    }
  }, [invoice])

  const invoiceWithLines = useMemo(() => {
    if (hasInvoiceLines(invoice)) {
      return {
        ...invoice,
        lines: sortInvoiceLines(invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []),
      }
    }

    if (loadedLines) {
      return {
        ...invoice,
        lines: loadedLines,
      }
    }

    return invoice
  }, [invoice, loadedLines])

  return {
    invoice: invoiceWithLines,
    isLoadingLines,
    linesError,
  }
}
