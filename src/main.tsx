import { resolveApplicationSurface } from './portal/applicationSurface'

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

void bootstrapApplication()
