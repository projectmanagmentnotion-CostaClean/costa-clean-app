import type { PortalReadAdapter, PortalRuntimeAdapter } from '../contracts'

function unavailableRead(): Promise<never> {
  return Promise.reject(new Error('Portal read boundary is not connected in CP-3A.'))
}

const unavailableReads: PortalReadAdapter = {
  getAccountContext: unavailableRead,
  getDashboard: unavailableRead,
  listProperties: unavailableRead,
  listServices: unavailableRead,
  listServiceRequests: unavailableRead,
  listInvoices: unavailableRead,
}

export function createPortalFoundationAdapter(): PortalRuntimeAdapter {
  return {
    access: {
      resolveAccess: async () => ({ status: 'unauthenticated' }),
    },
    reads: unavailableReads,
    previewScenario: null,
  }
}
