import { describe, expect, it } from 'vitest'
import accountExperienceSource from './PortalAccountExperience.tsx?raw'
import contractsSource from './contracts.ts?raw'
import onboardingSource from './PortalOnboardingFlow.tsx?raw'

describe('portal account experience boundaries', () => {
  it('keeps membership roles and unavailable actions inside the approved contract', () => {
    expect(contractsSource).toContain("'client_member'")
    expect(contractsSource).toContain("'client_admin'")
    expect(accountExperienceSource).not.toContain('Colaborador operativo')
    expect(accountExperienceSource).toContain('No disponible en este entorno')
    expect(accountExperienceSource).not.toMatch(/supabase\.from\(/)
    expect(accountExperienceSource).not.toContain('/functions/v1/')
  })

  it('keeps marketing separate and conservative until the trusted contract exists', () => {
    expect(accountExperienceSource).toContain('novedades comerciales')
    expect(accountExperienceSource).toContain('disabled')
    expect(onboardingSource).toContain('marketingOptIn: false')
    expect(onboardingSource).toContain("'pending_review'")
    expect(onboardingSource).not.toContain('clients')
  })
})
