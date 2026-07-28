import { describe, expect, it } from 'vitest'
import crmBootstrapSource from '../bootstrapCrm.tsx?raw'
import mainSource from '../main.tsx?raw'
import accessMachineSource from './accessMachine.ts?raw'
import bootstrapSource from './bootstrapPortal.tsx?raw'
import contractsSource from './contracts.ts?raw'
import portalAppSource from './PortalApp.tsx?raw'
import portalAuthScreenSource from './PortalAuthScreen.tsx?raw'
import portalPagesSource from './PortalPages.tsx?raw'
import portalPreviewShellSource from './PortalPreviewShell.tsx?raw'
import portalShellSource from './PortalShell.tsx?raw'
import foundationAdapterSource from './adapters/portalFoundationAdapter.ts?raw'
import previewAdapterSource from './adapters/portalPreviewAdapter.ts?raw'
import portalClientSource from './adapters/portalSupabaseClient.ts?raw'
import lifecycleSource from './auth/portalAuthLifecycle.ts?raw'
import parserSource from './auth/selfAccessContext.ts?raw'

const portalSources = [
  accessMachineSource,
  bootstrapSource,
  contractsSource,
  portalAppSource,
  portalAuthScreenSource,
  portalPagesSource,
  portalPreviewShellSource,
  portalShellSource,
  foundationAdapterSource,
  previewAdapterSource,
  portalClientSource,
  lifecycleSource,
  parserSource,
]

describe('portal source boundary', () => {
  it('does not import CRM features or the shared CRM Supabase client', () => {
    const forbiddenPatterns = [
      /from\s+['"][^'"]*\/app\//,
      /from\s+['"][^'"]*\/features\//,
      /from\s+['"][^'"]*lib\/supabase['"]/i,
      /getSupabaseClient/,
      /\b(?:client|supabase)\.from\s*\(/,
      /\/rest\/v1\//,
      /\/functions\/v1\//,
      /service_role/i,
      /user_metadata|raw_user_meta_data/i,
    ]

    expect(portalSources.some((source) =>
      forbiddenPatterns.some((pattern) => pattern.test(source)),
    )).toBe(false)
  })

  it('limits Supabase usage to the portal client and one narrow RPC', () => {
    expect(portalClientSource.includes('@supabase/supabase-js')).toBe(true)
    expect(/client\.rpc\(\s*['"]portal_resolve_self_access_context['"]\s*,?\s*\)/u.test(
      foundationAdapterSource,
    )).toBe(true)
    expect(foundationAdapterSource.includes('.rpc(')).toBe(true)
    expect(foundationAdapterSource.includes('.from(')).toBe(false)
  })

  it('keeps preview code behind a development-only dynamic import', () => {
    expect(bootstrapSource.includes('import.meta.env.DEV')).toBe(true)
    expect(bootstrapSource.includes("import('./adapters/portalPreviewAdapter')")).toBe(true)
    expect(bootstrapSource.includes("import('./PortalPreviewBar')")).toBe(true)
    expect(bootstrapSource.includes("import('./PortalPreviewShell')")).toBe(true)
    expect(portalShellSource.includes('PortalPages')).toBe(false)
    expect(portalShellSource.includes('portalPreview')).toBe(false)
  })

  it('keeps the entry point split behind dynamic imports', () => {
    expect(mainSource.includes("import('./portal/bootstrapPortal')")).toBe(true)
    expect(mainSource.includes("import('./bootstrapCrm')")).toBe(true)
    expect(/import\s+App\s+from/.test(mainSource)).toBe(false)
  })

  it('gives the portal and CRM distinct document identities', () => {
    expect(bootstrapSource.includes("document.title = 'Área de clientes | Costa Clean'")).toBe(true)
    expect(crmBootstrapSource.includes("document.title = 'CostaClean CRM")).toBe(true)
  })

  it('does not log credentials, sessions, RPC payloads or provider errors', () => {
    expect(portalSources.some((source) =>
      /console\.(log|debug|info|warn|error)\s*\(/u.test(source),
    )).toBe(false)
  })
})
