import { describe, expect, it } from 'vitest'
import {
  isPublicGymManualQuizPath,
  isPublicQuoteRequestPath,
  normalizePublicPathname,
} from './publicStandaloneRoutes'
import appSource from '../App.tsx?raw'

describe('publicStandaloneRoutes', () => {
  it('normalizes trailing slashes on standalone public paths', () => {
    expect(normalizePublicPathname('/quote-request/')).toBe('/quote-request')
    expect(normalizePublicPathname('/presupuesto/')).toBe('/presupuesto')
    expect(normalizePublicPathname('/')).toBe('/')
  })

  it('keeps quote request routes public with or without trailing slash', () => {
    for (const pathname of ['/quote-request', '/presupuesto']) {
      expect(isPublicQuoteRequestPath(pathname)).toBe(true)
      expect(isPublicQuoteRequestPath(`${pathname}/`)).toBe(true)
      expect(isPublicGymManualQuizPath(pathname)).toBe(false)
    }
  })

  it('keeps quiz routes public with or without trailing slash', () => {
    for (const pathname of ['/manual-quiz', '/prueba-operativa-gimnasio', '/prueba-manual-gimnasio']) {
      expect(isPublicGymManualQuizPath(pathname)).toBe(true)
      expect(isPublicGymManualQuizPath(`${pathname}/`)).toBe(true)
      expect(isPublicQuoteRequestPath(pathname)).toBe(false)
    }
  })

  it('renders all standalone public routes before auth loading or private auth gates', () => {
    expect(appSource).toContain('if (isPublicStandalonePath || isDevStepFlowPreview)')
    expect(appSource).toContain('if (isPublicQuoteRequestStandalone)')
    expect(appSource).toContain('<PublicQuoteRequestPage />')
    expect(appSource).toContain('if (isPublicGymManualQuizStandalone)')
    expect(appSource).toContain('<PublicGymManualQuizPage />')
  })

  it('keeps private routes behind the existing session and auth gates', () => {
    expect(isPublicQuoteRequestPath('/dashboard')).toBe(false)
    expect(isPublicGymManualQuizPath('/dashboard')).toBe(false)
    expect(appSource).toContain('await client.auth.getSession()')
    expect(appSource).toContain('if (!session)')
    expect(appSource).toContain('<AuthPage onSignedIn={() => undefined}')
    expect(appSource).toContain('<AppShell')
  })
})
