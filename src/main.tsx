import { clearVitePreloadRecovery, installVitePreloadRecovery } from './runtime/vitePreloadRecovery'

installVitePreloadRecovery()

// The clean release candidate is intentionally scoped to the authenticated
// internal CRM surface; no portal bootstrap belongs in this entrypoint.
document.documentElement.dataset.appSurface = 'v3'

async function bootstrapApplication() {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('No se encontró el punto de montaje de la aplicación.')
  }

  const { bootstrapCrm } = await import('./bootstrapCrm')
  bootstrapCrm(rootElement)
}

void bootstrapApplication().then(() => {
  clearVitePreloadRecovery()
})
