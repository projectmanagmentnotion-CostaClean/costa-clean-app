import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { PortalApp } from './PortalApp'
import { createPortalFoundationAdapter } from './adapters/portalFoundationAdapter'
import type { PortalRuntimeAdapter } from './contracts'
import './portal.css'

interface PortalBootstrapRuntime {
  adapter: PortalRuntimeAdapter
  previewControl: ReactNode
}

async function createRuntime(): Promise<PortalBootstrapRuntime> {
  if (!import.meta.env.DEV) {
    return {
      adapter: createPortalFoundationAdapter(),
      previewControl: null,
    }
  }

  const [
    {
      createPortalPreviewAdapter,
      readPortalPreviewScenario,
    },
    { PortalPreviewBar },
  ] = await Promise.all([
    import('./adapters/portalPreviewAdapter'),
    import('./PortalPreviewBar'),
  ])
  const scenario = readPortalPreviewScenario(window.location.search)

  return {
    adapter: createPortalPreviewAdapter(scenario),
    previewControl: <PortalPreviewBar scenario={scenario} />,
  }
}

export async function bootstrapPortal(rootElement: HTMLElement) {
  const { adapter, previewControl } = await createRuntime()

  document.title = 'Área de clientes | Costa Clean'

  createRoot(rootElement).render(
    <StrictMode>
      <PortalApp adapter={adapter} previewControl={previewControl} />
    </StrictMode>,
  )
}
