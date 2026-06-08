import { describe, expect, it } from 'vitest'
import {
  isPublicGymManualQuizPath,
  isPublicQuoteRequestPath,
  normalizePublicPathname,
} from './publicStandaloneRoutes'

describe('publicStandaloneRoutes', () => {
  it('normalizes trailing slashes on standalone public paths', () => {
    expect(normalizePublicPathname('/quote-request/')).toBe('/quote-request')
    expect(normalizePublicPathname('/presupuesto/')).toBe('/presupuesto')
    expect(normalizePublicPathname('/')).toBe('/')
  })

  it('keeps quote request routes public with or without trailing slash', () => {
    expect(isPublicQuoteRequestPath('/quote-request')).toBe(true)
    expect(isPublicQuoteRequestPath('/quote-request/')).toBe(true)
    expect(isPublicQuoteRequestPath('/presupuesto')).toBe(true)
    expect(isPublicQuoteRequestPath('/presupuesto/')).toBe(true)
  })

  it('keeps quiz routes public with or without trailing slash', () => {
    expect(isPublicGymManualQuizPath('/manual-quiz')).toBe(true)
    expect(isPublicGymManualQuizPath('/manual-quiz/')).toBe(true)
    expect(isPublicGymManualQuizPath('/prueba-manual-gimnasio/')).toBe(true)
  })
})
