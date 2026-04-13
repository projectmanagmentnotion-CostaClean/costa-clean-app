import { useCallback, useRef, useState } from 'react'
import type { AppView } from './navigation'
import type { NavigationGuardOptions } from './navigationGuard'

interface PendingGuardedAction {
  action: () => void
  title: string
  description: string
  confirmLabel: string
}

export function useShellNavigation() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [unsavedChangesContext, setUnsavedChangesContext] = useState<string | null>(null)
  const [pendingGuardedAction, setPendingGuardedAction] = useState<PendingGuardedAction | null>(null)
  const [navigationBackTarget, setNavigationBackTarget] = useState<AppView | null>(null)
  const viewBackStackRef = useRef<AppView[]>([])

  const updateUnsavedChanges = useCallback((hasUnsavedChanges: boolean, contextLabel = 'cambios sin guardar') => {
    setUnsavedChangesContext(hasUnsavedChanges ? contextLabel : null)
  }, [])

  const commitViewChange = useCallback((view: AppView, options?: { replace?: boolean }) => {
    setCurrentView((currentView) => {
      if (view === currentView) return currentView

      if (!options?.replace) {
        viewBackStackRef.current = [...viewBackStackRef.current, currentView].slice(-8)
      }

      setNavigationBackTarget(viewBackStackRef.current.at(-1) ?? null)
      return view
    })
  }, [])

  const runWithNavigationGuard = useCallback((action: () => void, options?: NavigationGuardOptions) => {
    if (!unsavedChangesContext) {
      action()
      return
    }

    setPendingGuardedAction({
      action,
      title: options?.title ?? 'Salir sin guardar',
      description: options?.description ?? `Hay ${unsavedChangesContext}. Si continúas, perderás esos cambios.`,
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
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si cambias de módulo ahora, perderás esos cambios.`,
      confirmLabel: 'Cambiar de módulo',
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
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si vuelves ahora, perderás esos cambios.`,
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
