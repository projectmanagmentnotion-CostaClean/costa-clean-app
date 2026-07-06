export interface PostalCodeSuggestion {
  postalCode: string
  city: string
  province: string
}

const postalCodeSuggestions: PostalCodeSuggestion[] = [
  { postalCode: '08001', city: 'Barcelona', province: 'Barcelona' },
  { postalCode: '08018', city: 'Barcelona', province: 'Barcelona' },
  { postalCode: '08024', city: 'Barcelona', province: 'Barcelona' },
  { postalCode: '08917', city: 'Badalona', province: 'Barcelona' },
  { postalCode: '08911', city: 'Badalona', province: 'Barcelona' },
  { postalCode: '08901', city: "L'Hospitalet de Llobregat", province: 'Barcelona' },
  { postalCode: '08930', city: 'Sant Adria de Besos', province: 'Barcelona' },
  { postalCode: '08370', city: 'Calella', province: 'Barcelona' },
  { postalCode: '08380', city: 'Malgrat de Mar', province: 'Barcelona' },
  { postalCode: '08397', city: 'Pineda de Mar', province: 'Barcelona' },
  { postalCode: '08360', city: 'Canet de Mar', province: 'Barcelona' },
  { postalCode: '08301', city: 'Mataro', province: 'Barcelona' },
  { postalCode: '08389', city: 'Palafolls', province: 'Barcelona' },
  { postalCode: '17300', city: 'Blanes', province: 'Girona' },
  { postalCode: '17310', city: 'Lloret de Mar', province: 'Girona' },
  { postalCode: '17320', city: 'Tossa de Mar', province: 'Girona' },
  { postalCode: '17250', city: 'Platja dAro', province: 'Girona' },
  { postalCode: '17220', city: 'Sant Feliu de Guixols', province: 'Girona' },
  { postalCode: '17230', city: 'Palamos', province: 'Girona' },
  { postalCode: '17001', city: 'Girona', province: 'Girona' },
]

function normalizeLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function findPostalCodeSuggestions(query: string, limit = 5): PostalCodeSuggestion[] {
  const normalized = normalizeLookup(query)
  if (!normalized) return []

  const exactPostalMatches = postalCodeSuggestions.filter((item) => item.postalCode.startsWith(query.trim()))
  const cityMatches = postalCodeSuggestions.filter((item) => normalizeLookup(item.city).includes(normalized))

  const merged = [...exactPostalMatches, ...cityMatches]
    .filter((item, index, list) => list.findIndex((candidate) => candidate.postalCode === item.postalCode && candidate.city === item.city) === index)

  return merged.slice(0, limit)
}

export function formatPostalCodeSuggestionLabel(suggestion: PostalCodeSuggestion) {
  return `${suggestion.postalCode} · ${suggestion.city}`
}
