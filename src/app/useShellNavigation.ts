import { useCallback, useEffect, useRef, useState } from 'react'
import { appViews, type AppView } from './navigation'
import type { NavigationGuardOptions } from './navigationGuard'

interface PendingGuardedAction {
  action: () => void
  title: string
  description: string
  confirmLabel: string
}

const supportedViews = new Set<AppView>(appViews)

function readViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'dashboard'

  const url = new URL(window.location.href)
  const view = url.searchParams.get('view')

  if (view && supportedViews.has(view as AppView)) {
    return view as AppView
  }

  return 'dashboard'
}

function writeViewToLocation(view: AppView, replace = false) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.set('view', view)

  if (replace) {
    window.history.replaceState({ view }, '', url)
    return
  }

  window.history.pushState({ view }, '', url)
}

export function useShellNavigation() {
  const [currentView, setCurrentView] = useState<AppView>(() => readViewFromLocation())
  const [unsavedChangesContext, setUnsavedChangesContext] = useState<string | null>(null)
  const [pendingGuardedAction, setPendingGuardedAction] = useState<PendingGuardedAction | null>(null)
  const [navigationBackTarget, setNavigationBackTarget] = useState<AppView | null>(null)
  const viewBackStackRef = useRef<AppView[]>([])

  useEffect(() => {
    writeViewToLocation(readViewFromLocation(), true)
  }, [])

  const updateUnsavedChanges = useCallback((hasUnsavedChanges: boolean, contextLabel = 'cambios sin guardar') => {
    setUnsavedChangesContext(hasUnsavedChanges ? contextLabel : null)
  }, [])

  const commitViewChange = useCallback((view: AppView, options?: { replace?: boolean }) => {
    setCurrentView((currentView) => {
      if (view === currentView) return currentView

      if (!options?.replace) {
        viewBackStackRef.current = [...viewBackStackRef.current, currentView].slice(-8)
      }

      writeViewToLocation(view, Boolean(options?.replace))
      setNavigationBackTarget(viewBackStackRef.current.at(-1) ?? null)
      return view
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePopState = () => {
      setCurrentView(readViewFromLocation())
      setNavigationBackTarget(viewBackStackRef.current.at(-1) ?? null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const runWithNavigationGuard = useCallback((action: () => void, options?: NavigationGuardOptions) => {
    if (!unsavedChangesContext) {
      action()
      return
    }

    setPendingGuardedAction({
      action,
      title: options?.title ?? 'Salir sin guardar',
      description: options?.description ?? `Hay ${unsavedChangesContext}. Si continuas, perderas esos cambios.`,
      confirmLabel: options?.confirmLabel ?? 'Salir sin guardar',
    })
  }, [unsavedChangesContext])

  const handleConfirmGuardedAction = useCallback(() => {
    if (!pendingGuardedAction) return

    const action = pendingGuardedAction.action
    setPendingGuardedAction(null)
    setUnsavedChangesContext(null)
    action()
  }, [pendingGuardedAction])

  const navigateToView = useCallback((view: AppView) => {
    if (view === currentView) return

    runWithNavigationGuard(() => {
      commitViewChange(view)
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si cambias de modulo ahora, perderas esos cambios.`,
      confirmLabel: 'Cambiar de modulo',
    })
  }, [commitViewChange, currentView, runWithNavigationGuard, unsavedChangesContext])

  const navigateBack = useCallback(() => {
    const previousView = viewBackStackRef.current.at(-1) ?? 'dashboard'
    if (previousView === currentView) {
      setNavigationBackTarget(viewBackStackRef.current.at(-1) ?? null)
      return
    }

    runWithNavigationGuard(() => {
      viewBackStackRef.current.pop()
      setCurrentView(previousView)
      setNavigationBackTarget(viewBackStackRef.current.at(-1) ?? null)
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si vuelves ahora, perderas esos cambios.`,
      confirmLabel: 'Volver',
    })
  }, [currentView, runWithNavigationGuard, unsavedChangesContext])

  return {
    currentView,
    unsavedChangesContext,
    pendingGuardedAction,
    navigationBackTarget,
    updateUnsavedChanges,
    commitViewChange,
    runWithNavigationGuard,
    handleConfirmGuardedAction,
    navigateToView,
    navigateBack,
    setPendingGuardedAction,
  }
}
