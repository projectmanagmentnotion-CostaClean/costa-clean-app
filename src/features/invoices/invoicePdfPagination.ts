export type InvoicePdfSemanticBlockKind =
  | 'header'
  | 'parties'
  | 'references'
  | 'table-header'
  | 'table-row'
  | 'footer'

export interface InvoicePdfSemanticBlock {
  id: string
  kind: InvoicePdfSemanticBlockKind
  start: number
  end: number
}

export interface InvoicePdfPageRange {
  start: number
  end: number
  reason: 'semantic-boundary' | 'oversized-block-fallback'
}

export function getInvoicePdfPageHeightMm(
  range: Pick<InvoicePdfPageRange, 'start' | 'end'>,
  pageHeightCss: number,
): number {
  if (!Number.isFinite(pageHeightCss) || pageHeightCss <= 0) {
    throw new Error('Invoice PDF page height must be a positive finite number.')
  }

  return Math.min(297, ((range.end - range.start) / pageHeightCss) * 297)
}

const EPSILON = 0.01

function normalizeBlock(block: InvoicePdfSemanticBlock, totalHeight: number): InvoicePdfSemanticBlock | null {
  const start = Math.max(0, Math.min(totalHeight, block.start))
  const end = Math.max(start, Math.min(totalHeight, block.end))

  if (end - start <= EPSILON) return null

  return { ...block, start, end }
}

export function createInvoicePdfPageRanges(
  blocks: InvoicePdfSemanticBlock[],
  pageHeight: number,
  totalHeight: number,
): InvoicePdfPageRange[] {
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
    throw new Error('Invoice PDF page height must be a positive finite number.')
  }

  if (!Number.isFinite(totalHeight) || totalHeight < 0) {
    throw new Error('Invoice PDF total height must be a non-negative finite number.')
  }

  if (totalHeight <= EPSILON) return [{ start: 0, end: 0, reason: 'semantic-boundary' }]

  const normalizedBlocks = blocks
    .map((block) => normalizeBlock(block, totalHeight))
    .filter((block): block is InvoicePdfSemanticBlock => block !== null)
    .sort((left, right) => left.start - right.start || left.end - right.end)

  const ranges: InvoicePdfPageRange[] = []
  let pageStart = 0

  while (pageStart < totalHeight - EPSILON) {
    const pageLimit = pageStart + pageHeight
    const candidates = normalizedBlocks.filter((block) => (
      block.end > pageStart + EPSILON &&
      block.end <= pageLimit + EPSILON
    ))

    const semanticEnd = candidates.reduce((latest, block) => Math.max(latest, block.end), 0)

    if (semanticEnd > pageStart + EPSILON) {
      ranges.push({ start: pageStart, end: semanticEnd, reason: 'semantic-boundary' })
      pageStart = semanticEnd
      continue
    }

    const fallbackEnd = Math.min(pageLimit, totalHeight)
    if (fallbackEnd <= pageStart + EPSILON) {
      throw new Error('Invoice PDF pagination could not make progress.')
    }

    ranges.push({
      start: pageStart,
      end: fallbackEnd,
      reason: 'oversized-block-fallback',
    })
    pageStart = fallbackEnd
  }

  return ranges
}

function rectFor(element: Element, root: HTMLElement): { start: number; end: number } {
  const rootRect = root.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  return {
    start: Math.max(0, rect.top - rootRect.top),
    end: Math.max(0, rect.bottom - rootRect.top),
  }
}

export function collectInvoicePdfSemanticBlocks(root: HTMLElement): InvoicePdfSemanticBlock[] {
  const blocks: InvoicePdfSemanticBlock[] = []
  const add = (element: Element | null, kind: InvoicePdfSemanticBlockKind, id: string) => {
    if (!element) return
    const rect = rectFor(element, root)
    blocks.push({ id, kind, ...rect })
  }

  add(root.querySelector('[data-pdf-block="header"]'), 'header', 'header')
  add(root.querySelector('[data-pdf-block="parties"]'), 'parties', 'parties')
  add(root.querySelector('[data-pdf-block="references"]'), 'references', 'references')
  add(root.querySelector('[data-pdf-table-header]'), 'table-header', 'table-header')

  root.querySelectorAll('[data-pdf-table-row]').forEach((row, index) => {
    add(row, 'table-row', `table-row-${index + 1}`)
  })

  add(root.querySelector('[data-pdf-block="footer"]'), 'footer', 'footer')

  return blocks
}
