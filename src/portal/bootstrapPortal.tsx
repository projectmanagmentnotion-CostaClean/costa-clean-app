import {
  StrictMode,
  type ComponentType,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import { PortalApp } from './PortalApp'
import type { PortalPreviewShellProps } from './PortalPreviewShell'
import { createPortalFoundationAdapter } from './adapters/portalFoundationAdapter'
import type { PortalRuntimeAdapter } from './contracts'
import { portalTokens } from './portalTokens'
import './portal.css'

interface PortalBootstrapRuntime {
  adapter: PortalRuntimeAdapter
  authenticatedSurface?: ComponentType<PortalPreviewShellProps>
  previewControl: ReactNode
}

async function createRuntime(): Promise<PortalBootstrapRuntime> {
  const hasRequestedPreview =
    import.meta.env.DEV
    && new URLSearchParams(window.location.search).has('portalPreview')

  if (!hasRequestedPreview) {
    return {
      adapter: createPortalFoundationAdapter(),
      previewControl: null,
    }
  }

  const [
    { createPortalPreviewAdapter, readPortalPreviewScenario },
    { PortalPreviewBar },
    { PortalPreviewShell },
  ] = await Promise.all([
    import('./adapters/portalPreviewAdapter'),
    import('./PortalPreviewBar'),
    import('./PortalPreviewShell'),
  ])
  const scenario = readPortalPreviewScenario(window.location.search)
  if (!scenario) throw new Error('Portal preview scenario was not resolved.')

  return {
    adapter: createPortalPreviewAdapter(scenario),
    authenticatedSurface: PortalPreviewShell,
    previewControl: <PortalPreviewBar scenario={scenario} />,
  }
}

export async function bootstrapPortal(rootElement: HTMLElement) {
  const { adapter, authenticatedSurface, previewControl } = await createRuntime()

  document.title = 'Área de clientes | Costa Clean'
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', portalTokens.color.surface)

  createRoot(rootElement).render(
    <StrictMode>
      <PortalApp
        adapter={adapter}
        authenticatedSurface={authenticatedSurface}
        previewControl={previewControl}
      />
    </StrictMode>,
  )
}
