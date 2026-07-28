import { describe, expect, it } from 'vitest'
import crmBootstrapSource from '../bootstrapCrm.tsx?raw'
import mainSource from '../main.tsx?raw'
import accessMachineSource from './accessMachine.ts?raw'
import bootstrapSource from './bootstrapPortal.tsx?raw'
import contractsSource from './contracts.ts?raw'
import portalAppSource from './PortalApp.tsx?raw'
import portalPagesSource from './PortalPages.tsx?raw'
import portalShellSource from './PortalShell.tsx?raw'
import foundationAdapterSource from './adapters/portalFoundationAdapter.ts?raw'
import previewAdapterSource from './adapters/portalPreviewAdapter.ts?raw'

const portalSources = [
  accessMachineSource,
  bootstrapSource,
  contractsSource,
  portalAppSource,
  portalPagesSource,
  portalShellSource,
  foundationAdapterSource,
  previewAdapterSource,
]

describe('portal source boundary', () => {
  it('does not import CRM features or the Supabase client', () => {
    const forbiddenPatterns = [
      /from\s+['"][^'"]*\/app\//,
      /from\s+['"][^'"]*\/features\//,
      /from\s+['"][^'"]*supabase/i,
      /getSupabaseClient/,
      /\.from\s*\(/,
      /\/rest\/v1\//,
      /\/functions\/v1\//,
      /service_role/i,
    ]
    const hasForbiddenSource = portalSources.some((source) =>
      forbiddenPatterns.some((pattern) => pattern.test(source)),
    )

    expect(hasForbiddenSource).toBe(false)
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
})
