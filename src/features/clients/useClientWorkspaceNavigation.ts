import { useCallback, useEffect, useState } from 'react'

export const clientWorkspaceTabs = [
  'summary',
  'properties',
  'jobs',
  'quotes',
  'invoices',
  'payments',
  'activity',
] as const

export type ClientWorkspaceTab = (typeof clientWorkspaceTabs)[number]

const supportedTabs = new Set<ClientWorkspaceTab>(clientWorkspaceTabs)

function readClientWorkspaceLocation() {
  if (typeof window === 'undefined') {
    return {
      clientId: null,
      tab: 'summary' as ClientWorkspaceTab,
    }
  }

  const url = new URL(window.location.href)
  const rawTab = url.searchParams.get('clientTab')

  return {
    clientId: url.searchParams.get('client'),
    tab: rawTab && supportedTabs.has(rawTab as ClientWorkspaceTab)
      ? rawTab as ClientWorkspaceTab
      : 'summary',
  }
}

export function setClientWorkspaceLocation(
  nextState: {
    clientId?: string | null
    tab?: ClientWorkspaceTab
  },
  replace = false,
) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)

  if (nextState.clientId) {
    url.searchParams.set('client', nextState.clientId)
  } else {
    url.searchParams.delete('client')
  }

  if (nextState.clientId && nextState.tab) {
    url.searchParams.set('clientTab', nextState.tab)
  } else if (!nextState.clientId) {
    url.searchParams.delete('clientTab')
  }

  if (replace) {
    window.history.replaceState({ client: nextState.clientId, clientTab: nextState.tab }, '', url)
    return
  }

  window.history.pushState({ client: nextState.clientId, clientTab: nextState.tab }, '', url)
}

export function useClientWorkspaceNavigation(validClientIds: string[]) {
  const [state, setState] = useState(() => readClientWorkspaceLocation())
  const activeClientId = state.clientId && validClientIds.includes(state.clientId)
    ? state.clientId
    : null

  useEffect(() => {
    if (state.clientId && !validClientIds.includes(state.clientId)) {
      setClientWorkspaceLocation({ clientId: null }, true)
    }
  }, [state.clientId, validClientIds])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePopState = () => {
      setState(readClientWorkspaceLocation())
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const openClientWorkspace = useCallback((clientId: string, tab: ClientWorkspaceTab = 'summary') => {
    const nextState = { clientId, tab }
    setClientWorkspaceLocation(nextState)
    setState(nextState)
  }, [])

  const closeClientWorkspace = useCallback(() => {
    setClientWorkspaceLocation({ clientId: null })
    setState({
      clientId: null,
      tab: 'summary',
    })
  }, [])

  const setActiveTab = useCallback((tab: ClientWorkspaceTab) => {
    setState((current) => {
      const nextState = {
        clientId: current.clientId,
        tab,
      }

      setClientWorkspaceLocation(nextState, true)
      return nextState
    })
  }, [])

  return {
    activeClientId,
    activeTab: activeClientId ? state.tab : 'summary',
    openClientWorkspace,
    closeClientWorkspace,
    setActiveTab,
  }
}
