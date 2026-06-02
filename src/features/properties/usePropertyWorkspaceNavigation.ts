import { useCallback, useEffect, useState } from 'react'

export const propertyWorkspaceTabs = [
  'summary',
  'jobs',
  'quotes',
  'invoices',
  'payments',
  'activity',
] as const

export type PropertyWorkspaceTab = (typeof propertyWorkspaceTabs)[number]

const supportedTabs = new Set<PropertyWorkspaceTab>(propertyWorkspaceTabs)

function readPropertyWorkspaceLocation() {
  if (typeof window === 'undefined') {
    return {
      propertyId: null,
      tab: 'summary' as PropertyWorkspaceTab,
    }
  }

  const url = new URL(window.location.href)
  const rawTab = url.searchParams.get('propertyTab')

  return {
    propertyId: url.searchParams.get('property'),
    tab: rawTab && supportedTabs.has(rawTab as PropertyWorkspaceTab)
      ? rawTab as PropertyWorkspaceTab
      : 'summary',
  }
}

function writePropertyWorkspaceLocation(
  nextState: {
    propertyId?: string | null
    tab?: PropertyWorkspaceTab
  },
  replace = false,
) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)

  if (nextState.propertyId) {
    url.searchParams.set('property', nextState.propertyId)
  } else {
    url.searchParams.delete('property')
  }

  if (nextState.propertyId && nextState.tab) {
    url.searchParams.set('propertyTab', nextState.tab)
  } else if (!nextState.propertyId) {
    url.searchParams.delete('propertyTab')
  }

  if (replace) {
    window.history.replaceState({ property: nextState.propertyId, propertyTab: nextState.tab }, '', url)
    return
  }

  window.history.pushState({ property: nextState.propertyId, propertyTab: nextState.tab }, '', url)
}

export function usePropertyWorkspaceNavigation(validPropertyIds: string[]) {
  const [state, setState] = useState(() => readPropertyWorkspaceLocation())
  const activePropertyId = state.propertyId && validPropertyIds.includes(state.propertyId)
    ? state.propertyId
    : null

  useEffect(() => {
    if (state.propertyId && !validPropertyIds.includes(state.propertyId)) {
      writePropertyWorkspaceLocation({ propertyId: null }, true)
    }
  }, [state.propertyId, validPropertyIds])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePopState = () => {
      setState(readPropertyWorkspaceLocation())
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const openPropertyWorkspace = useCallback((propertyId: string, tab: PropertyWorkspaceTab = 'summary') => {
    const nextState = { propertyId, tab }
    writePropertyWorkspaceLocation(nextState)
    setState(nextState)
  }, [])

  const closePropertyWorkspace = useCallback(() => {
    writePropertyWorkspaceLocation({ propertyId: null })
    setState({
      propertyId: null,
      tab: 'summary',
    })
  }, [])

  const setActiveTab = useCallback((tab: PropertyWorkspaceTab) => {
    setState((current) => {
      const nextState = {
        propertyId: current.propertyId,
        tab,
      }

      writePropertyWorkspaceLocation(nextState, true)
      return nextState
    })
  }, [])

  return {
    activePropertyId,
    activeTab: activePropertyId ? state.tab : 'summary',
    openPropertyWorkspace,
    closePropertyWorkspace,
    setActiveTab,
  }
}
