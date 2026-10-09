import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchSupabaseRestList } from '../../lib/supabaseRest'
import type { QuoteLineItem, QuoteListItem } from './types'

interface QuoteDocumentLinesState {
  quote: QuoteListItem
  isLoadingLines: boolean
  linesError: string | null
}

function hasQuoteLines(quote: QuoteListItem): boolean {
  return Boolean(quote.quote_lines?.length || quote.lines?.length)
}

function sortQuoteLines(lines: QuoteLineItem[]): QuoteLineItem[] {
  return [...lines].sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
}

export function useQuoteDocumentLines(quote: QuoteListItem): QuoteDocumentLinesState {
  const [loadedLines, setLoadedLines] = useState<{ quoteId: string; lines: QuoteLineItem[] } | null>(null)
  const [linesErrorState, setLinesErrorState] = useState<{ quoteId: string; message: string } | null>(null)
  const setLinesError = useCallback((message: string) => setLinesErrorState({ quoteId: quote.id, message }), [quote.id])
  const quoteHasLines = hasQuoteLines(quote)

  useEffect(() => {
    let isActive = true

    if (quoteHasLines) {
      return () => {
        isActive = false
      }
    }

    async function loadLines() {

      try {
        const lines = await fetchSupabaseRestList<QuoteLineItem>(
          `quote_lines?quote_id=eq.${encodeURIComponent(quote.id)}&select=id,quote_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc`,
        )

        if (isActive) {
          setLoadedLines({ quoteId: quote.id, lines: sortQuoteLines(lines) })
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
  }, [quote.id, quoteHasLines, setLinesError])

  const currentLoadedLines = loadedLines?.quoteId === quote.id ? loadedLines.lines : null
  const currentLinesError = currentLoadedLines || linesErrorState?.quoteId !== quote.id ? null : linesErrorState.message

  const quoteWithLines = useMemo(() => {
    if (quote.lines?.length) {
      return {
        ...quote,
        lines: sortQuoteLines(quote.lines),
      }
    }

    if (quote.quote_lines?.length) {
      return {
        ...quote,
        lines: sortQuoteLines(quote.quote_lines),
      }
    }

    if (currentLoadedLines) {
      return {
        ...quote,
        lines: currentLoadedLines,
      }
    }

    return quote
  }, [currentLoadedLines, quote])

  return {
    quote: quoteWithLines,
    isLoadingLines: !quoteHasLines && !currentLoadedLines && !currentLinesError,
    linesError: currentLinesError,
  }
}
