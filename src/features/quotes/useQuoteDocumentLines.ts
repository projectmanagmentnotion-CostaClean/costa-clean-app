import { useEffect, useMemo, useState } from 'react'
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
  const [loadedLines, setLoadedLines] = useState<QuoteLineItem[] | null>(null)
  const [isLoadingLines, setIsLoadingLines] = useState(false)
  const [linesError, setLinesError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    setLoadedLines(null)
    setLinesError(null)

    if (hasQuoteLines(quote)) {
      setIsLoadingLines(false)
      return () => {
        isActive = false
      }
    }

    async function loadLines() {
      setIsLoadingLines(true)

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Faltan las variables de entorno de Supabase.')
        }

        const response = await fetch(
          `${supabaseUrl}/rest/v1/quote_lines?quote_id=eq.${encodeURIComponent(quote.id)}&select=id,quote_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc`,
          {
            method: 'GET',
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
          },
        )

        if (!response.ok) {
          throw new Error(`REST ${response.status}: ${response.statusText}`)
        }

        const lines = ((await response.json()) as QuoteLineItem[]) ?? []

        if (isActive) {
          setLoadedLines(sortQuoteLines(lines))
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
  }, [quote])

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

    if (loadedLines) {
      return {
        ...quote,
        lines: loadedLines,
      }
    }

    return quote
  }, [quote, loadedLines])

  return {
    quote: quoteWithLines,
    isLoadingLines,
    linesError,
  }
}
