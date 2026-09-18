import { clearVitePreloadRecovery, installVitePreloadRecovery } from './runtime/vitePreloadRecovery'
import { resolveApplicationSurface } from './portal/applicationSurface'

installVitePreloadRecovery()

const surface = resolveApplicationSurface(window.location.pathname)
// Keep the document surface in lockstep with the feature flag used by App.
// V3 is the default CRM surface; only the explicit v2 switch selects legacy.
const isV3Surface = surface === 'crm' && new URLSearchParams(window.location.search).get('v2') !== '1'
document.documentElement.dataset.appSurface = isV3Surface ? 'v3' : 'legacy'

async function bootstrapApplication() {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('No se encontró el punto de montaje de la aplicación.')
  }

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
