import { useCallback, useEffect, useState } from 'react'

export const jobWorkspaceTabs = [
  'summary',
  'operations',
  'billing',
  'activity',
] as const

export type JobWorkspaceTab = (typeof jobWorkspaceTabs)[number]

const supportedTabs = new Set<JobWorkspaceTab>(jobWorkspaceTabs)

function readJobWorkspaceLocation() {
  if (typeof window === 'undefined') {
    return {
      jobId: null,
      tab: 'summary' as JobWorkspaceTab,
    }
  }

  const url = new URL(window.location.href)
  const rawTab = url.searchParams.get('jobTab')

  return {
    jobId: url.searchParams.get('job'),
    tab: rawTab && supportedTabs.has(rawTab as JobWorkspaceTab)
      ? rawTab as JobWorkspaceTab
      : 'summary',
  }
}

export function setJobWorkspaceLocation(
  nextState: {
    jobId?: string | null
    tab?: JobWorkspaceTab
  },
  replace = false,
) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)

  if (nextState.jobId) {
    url.searchParams.set('job', nextState.jobId)
  } else {
    url.searchParams.delete('job')
  }

  if (nextState.jobId && nextState.tab) {
    url.searchParams.set('jobTab', nextState.tab)
  } else if (!nextState.jobId) {
    url.searchParams.delete('jobTab')
  }

  if (replace) {
    window.history.replaceState({ job: nextState.jobId, jobTab: nextState.tab }, '', url)
    return
  }

  window.history.pushState({ job: nextState.jobId, jobTab: nextState.tab }, '', url)
}

export function useJobWorkspaceNavigation(validJobIds: string[]) {
  const [state, setState] = useState(() => readJobWorkspaceLocation())
  const activeJobId = state.jobId && validJobIds.includes(state.jobId)
    ? state.jobId
    : null

  useEffect(() => {
    if (state.jobId && !validJobIds.includes(state.jobId)) {
      setJobWorkspaceLocation({ jobId: null }, true)
    }
  }, [state.jobId, validJobIds])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePopState = () => {
      setState(readJobWorkspaceLocation())
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const openJobWorkspace = useCallback((jobId: string, tab: JobWorkspaceTab = 'summary') => {
    const nextState = { jobId, tab }
    setJobWorkspaceLocation(nextState)
    setState(nextState)
  }, [])

  const closeJobWorkspace = useCallback(() => {
    setJobWorkspaceLocation({ jobId: null })
    setState({
      jobId: null,
      tab: 'summary',
    })
  }, [])

  const setActiveTab = useCallback((tab: JobWorkspaceTab) => {
    setState((current) => {
      const nextState = {
        jobId: current.jobId,
        tab,
      }

      setJobWorkspaceLocation(nextState, true)
      return nextState
    })
  }, [])

  return {
    activeJobId,
    activeTab: activeJobId ? state.tab : 'summary',
    openJobWorkspace,
    closeJobWorkspace,
    setActiveTab,
  }
}
