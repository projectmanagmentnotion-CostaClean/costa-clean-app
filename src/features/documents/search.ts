export function normalizeSearchText(value: string | number | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function matchesSearchQuery(
  query: string,
  fields: Array<string | number | null | undefined>,
): boolean {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return true
  }

  const haystack = fields
    .map((field) => normalizeSearchText(field))
    .filter(Boolean)
    .join(' ')

  return haystack.includes(normalizedQuery)
}
