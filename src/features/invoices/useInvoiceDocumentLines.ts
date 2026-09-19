import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [loadedLines, setLoadedLines] = useState<{ invoiceId: string; lines: InvoiceLineItem[] } | null>(null)
  const [linesErrorState, setLinesErrorState] = useState<{ invoiceId: string; message: string } | null>(null)
  const setLinesError = useCallback((message: string) => setLinesErrorState({ invoiceId: invoice.id, message }), [invoice.id])

  useEffect(() => {
    let isActive = true

    if (hasInvoiceLines(invoice)) {
      return () => {
        isActive = false
      }
    }

    async function loadLines() {

      try {
        const lines = await fetchSupabaseRestList<InvoiceLineItem>(
          `invoice_lines?invoice_id=eq.${encodeURIComponent(invoice.id)}&select=id,invoice_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc`,
        )

        if (isActive) {
          setLoadedLines({ invoiceId: invoice.id, lines: sortInvoiceLines(lines) })
        }
      } catch (err) {
        if (isActive) {
          setLinesError(err instanceof Error ? err.message : 'Error desconocido cargando líneas.')
        }
      }
    }

    void loadLines()

    return () => {
      isActive = false
    }
  }, [invoice, setLinesError])

  const currentLoadedLines = loadedLines?.invoiceId === invoice.id ? loadedLines.lines : null
  const currentLinesError = currentLoadedLines || linesErrorState?.invoiceId !== invoice.id ? null : linesErrorState.message

  const invoiceWithLines = useMemo(() => {
    if (hasInvoiceLines(invoice)) {
      return {
        ...invoice,
        lines: sortInvoiceLines(invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []),
      }
    }

    if (currentLoadedLines) {
      return {
        ...invoice,
        lines: currentLoadedLines,
      }
    }

    return invoice
  }, [currentLoadedLines, invoice])

  return {
    invoice: invoiceWithLines,
    isLoadingLines: !hasInvoiceLines(invoice) && !currentLoadedLines && !currentLinesError,
    linesError: currentLinesError,
  }
}
