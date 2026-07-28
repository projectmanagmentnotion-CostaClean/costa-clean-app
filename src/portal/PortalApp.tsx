import { useEffect, useReducer, type ReactNode } from 'react'
import {
  initialPortalAccessState,
  reducePortalAccessState,
} from './accessMachine'
import type { PortalRuntimeAdapter } from './contracts'
import { PortalAccessScreen } from './PortalAccessScreen'
import { PortalShell } from './PortalShell'

interface PortalAppProps {
  adapter: PortalRuntimeAdapter
  previewControl?: ReactNode
}

export function PortalApp({ adapter, previewControl = null }: PortalAppProps) {
  const [accessState, dispatch] = useReducer(
    reducePortalAccessState,
    initialPortalAccessState,
  )

  useEffect(() => {
    let isCurrent = true

    dispatch({ type: 'BOOTSTRAP_STARTED' })

    adapter.access.resolveAccess()
      .then((resolution) => {
        if (isCurrent) {
          dispatch({ type: 'ACCESS_RESOLVED', resolution })
        }
      })
      .catch(() => {
        if (isCurrent) {
          dispatch({ type: 'BOOTSTRAP_FAILED' })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [adapter])

  return (
    <div
      className={
        adapter.previewScenario
          ? 'portal-root portal-root--preview'
          : 'portal-root'
      }
    >
      {previewControl}
      {accessState.status === 'authenticated' ? (
        <PortalShell
          access={accessState}
          reads={adapter.reads}
          previewScenario={adapter.previewScenario}
        />
      ) : (
        <PortalAccessScreen state={accessState} />
      )}
    </div>
  )
}
