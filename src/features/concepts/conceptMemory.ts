import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'
import type { QuoteListItem } from '../quotes/types'
import { normalizeLineConcept } from '../quotes/lineConcepts'

export type ConceptDomain = 'quote' | 'invoice' | 'expense'

export interface ConceptStructuredSuggestion {
  concept: string
  quantity?: string
  unit?: string
  unit_price?: string
}

interface ConceptMemoryAccumulator {
  key: string
  label: string
  totalUses: number
  lastUsedAt: string | null
  lastUsedAtMs: number
  domainCounts: Record<ConceptDomain, number>
  clientCounts: Map<string, number>
  templates: Partial<Record<ConceptDomain, ConceptStructuredSuggestion>>
}

export interface ConceptMemoryEntry {
  key: string
  label: string
  totalUses: number
  lastUsedAt: string | null
  domainCounts: Record<ConceptDomain, number>
  clientCounts: Record<string, number>
  templates: Partial<Record<ConceptDomain, ConceptStructuredSuggestion>>
}

export interface ConceptMemoryIndex {
  entries: ConceptMemoryEntry[]
}

export interface ConceptSuggestion {
  key: string
  label: string
  reasons: string[]
  domain: ConceptDomain
  structuredSuggestion?: ConceptStructuredSuggestion
}

interface ConceptSuggestionOptions {
  query: string
  domain: ConceptDomain
  clientId?: string | null
  limit?: number
}

interface BuildConceptMemoryIndexInput {
  quotes?: QuoteListItem[]
  invoices?: InvoiceListItem[]
  expenses?: ExpenseListItem[]
}

const emptyDomainCounts: Record<ConceptDomain, number> = {
  quote: 0,
  invoice: 0,
  expense: 0,
}

function normalizeSearchText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanConceptLabel(value: string | null | undefined): string {
  return normalizeLineConcept(String(value ?? '').replace(/\s+/g, ' ').trim(), '').trim()
}

function hasUsefulConcept(value: string): boolean {
  const normalized = normalizeSearchText(value)
  return normalized.length >= 4 && /[a-z]/.test(normalized)
}

function parseDateMs(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumericString(value: number | null | undefined): string | undefined {
  if (!Number.isFinite(Number(value))) return undefined
  return Number(value).toFixed(2)
}

function createAccumulator(key: string, label: string): ConceptMemoryAccumulator {
  return {
    key,
    label,
    totalUses: 0,
    lastUsedAt: null,
    lastUsedAtMs: 0,
    domainCounts: { ...emptyDomainCounts },
    clientCounts: new Map<string, number>(),
    templates: {},
  }
}

function maybeSetTemplate(
  accumulator: ConceptMemoryAccumulator,
  domain: ConceptDomain,
  template: ConceptStructuredSuggestion | undefined,
) {
  if (!template) return
  if (accumulator.templates[domain]) return
  accumulator.templates[domain] = template
}

function registerConcept(
  buckets: Map<string, ConceptMemoryAccumulator>,
  {
    rawLabel,
    domain,
    clientId,
    usedAt,
    template,
  }: {
    rawLabel: string | null | undefined
    domain: ConceptDomain
    clientId?: string | null
    usedAt?: string | null
    template?: ConceptStructuredSuggestion
  },
) {
  const label = cleanConceptLabel(rawLabel)
  if (!hasUsefulConcept(label)) return

  const key = normalizeSearchText(label)
  const accumulator = buckets.get(key) ?? createAccumulator(key, label)

  accumulator.totalUses += 1
  accumulator.domainCounts[domain] += 1

  if (clientId) {
    accumulator.clientCounts.set(clientId, (accumulator.clientCounts.get(clientId) ?? 0) + 1)
  }

  const usedAtMs = parseDateMs(usedAt)
  if (usedAtMs >= accumulator.lastUsedAtMs) {
    accumulator.lastUsedAtMs = usedAtMs
    accumulator.lastUsedAt = usedAt ?? null
    accumulator.label = label.length >= accumulator.label.length ? label : accumulator.label
  }

  maybeSetTemplate(accumulator, domain, template)
  buckets.set(key, accumulator)
}

export function buildConceptMemoryIndex({
  quotes = [],
  invoices = [],
  expenses = [],
}: BuildConceptMemoryIndexInput): ConceptMemoryIndex {
  const buckets = new Map<string, ConceptMemoryAccumulator>()

  for (const quote of quotes) {
    const lines = quote.lines?.length ? quote.lines : quote.quote_lines ?? []
    for (const line of lines) {
      registerConcept(buckets, {
        rawLabel: line.concept,
        domain: 'quote',
        clientId: quote.client_id,
        usedAt: line.created_at ?? quote.created_at ?? null,
        template: {
          concept: cleanConceptLabel(line.concept),
          quantity: formatNumericString(line.quantity) ?? '1.00',
          unit: line.unit?.trim() || 'servicio',
          unit_price: formatNumericString(line.unit_price) ?? '0.00',
        },
      })
    }
  }

  for (const invoice of invoices) {
    const lines = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []
    for (const line of lines) {
      registerConcept(buckets, {
        rawLabel: line.concept,
        domain: 'invoice',
        clientId: invoice.client_id,
        usedAt: line.created_at ?? invoice.issue_date ?? null,
        template: {
          concept: cleanConceptLabel(line.concept),
          quantity: formatNumericString(line.quantity) ?? '1.00',
          unit: line.unit?.trim() || 'servicio',
          unit_price: formatNumericString(line.unit_price) ?? '0.00',
        },
      })
    }
  }

  for (const expense of expenses) {
    registerConcept(buckets, {
      rawLabel: expense.description,
      domain: 'expense',
      usedAt: expense.updated_at ?? expense.created_at ?? expense.expense_date ?? null,
    })
  }

  return {
    entries: [...buckets.values()]
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        totalUses: entry.totalUses,
        lastUsedAt: entry.lastUsedAt,
        domainCounts: entry.domainCounts,
        clientCounts: Object.fromEntries(entry.clientCounts.entries()),
        templates: entry.templates,
      }))
      .sort((left, right) => {
        if (right.totalUses !== left.totalUses) {
          return right.totalUses - left.totalUses
        }

        return parseDateMs(right.lastUsedAt) - parseDateMs(left.lastUsedAt)
      }),
  }
}

function getRecencyBonus(lastUsedAt: string | null): number {
  const lastUsedAtMs = parseDateMs(lastUsedAt)
  if (!lastUsedAtMs) return 0
  const daysOld = (Date.now() - lastUsedAtMs) / 86_400_000
  if (daysOld <= 7) return 18
  if (daysOld <= 30) return 12
  if (daysOld <= 90) return 6
  return 0
}

function buildReasons(entry: ConceptMemoryEntry, domain: ConceptDomain, clientId?: string | null): string[] {
  const reasons: string[] = []
  if (clientId && (entry.clientCounts[clientId] ?? 0) > 0) {
    reasons.push('Cliente')
  }
  if (entry.domainCounts[domain] > 0) {
    reasons.push(domain === 'quote' ? 'Presupuesto' : domain === 'invoice' ? 'Factura' : 'Gasto')
  }
  if (entry.totalUses >= 3) {
    reasons.push('Frecuente')
  }
  if (getRecencyBonus(entry.lastUsedAt) > 0) {
    reasons.push('Reciente')
  }
  return reasons
}

export function getConceptSuggestions(
  index: ConceptMemoryIndex,
  {
    query,
    domain,
    clientId = null,
    limit = 6,
  }: ConceptSuggestionOptions,
): ConceptSuggestion[] {
  const normalizedQuery = normalizeSearchText(query)
  const queryTokens = normalizedQuery ? normalizedQuery.split(' ') : []

  return index.entries
    .map((entry) => {
      const normalizedLabel = normalizeSearchText(entry.label)
      const clientUses = clientId ? (entry.clientCounts[clientId] ?? 0) : 0
      const domainUses = entry.domainCounts[domain]
      let score = 0

      if (clientUses > 0) score += 120 + clientUses * 8
      if (domainUses > 0) score += 70 + domainUses * 4
      score += Math.min(entry.totalUses, 8) * 4
      score += getRecencyBonus(entry.lastUsedAt)

      if (normalizedQuery) {
        if (normalizedLabel === normalizedQuery) {
          score += 80
        } else if (normalizedLabel.startsWith(normalizedQuery)) {
          score += 52
        } else if (normalizedLabel.includes(normalizedQuery)) {
          score += 30
        }

        const matchedTokens = queryTokens.filter((token) => normalizedLabel.includes(token)).length
        score += matchedTokens * 8

        if (matchedTokens === 0 && !normalizedLabel.includes(normalizedQuery)) {
          score -= 160
        }
      }

      return {
        entry,
        score,
      }
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.entry.totalUses !== left.entry.totalUses) return right.entry.totalUses - left.entry.totalUses
      return parseDateMs(right.entry.lastUsedAt) - parseDateMs(left.entry.lastUsedAt)
    })
    .slice(0, limit)
    .map(({ entry }) => ({
      key: entry.key,
      label: entry.label,
      reasons: buildReasons(entry, domain, clientId),
      domain,
      structuredSuggestion: entry.templates[domain],
    }))
}
