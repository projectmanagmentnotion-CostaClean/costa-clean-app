import { clearVitePreloadRecovery, installVitePreloadRecovery } from './runtime/vitePreloadRecovery'
import { resolveApplicationSurface } from './portal/applicationSurface'

installVitePreloadRecovery()

const isV3Surface = new URLSearchParams(window.location.search).get('v3') === '1'
document.documentElement.dataset.appSurface = isV3Surface ? 'v3' : 'legacy'

async function bootstrapApplication() {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('No se encontró el punto de montaje de la aplicación.')
  }

  const surface = resolveApplicationSurface(window.location.pathname)

  if (surface === 'portal') {
    const { bootstrapPortal } = await import('./portal/bootstrapPortal')
    await bootstrapPortal(rootElement)
    return
  }

  const { bootstrapCrm } = await import('./bootstrapCrm')
  bootstrapCrm(rootElement)
}

void bootstrapApplication().then(() => {
  clearVitePreloadRecovery()
})
