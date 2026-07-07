import type { ReactNode } from 'react'
import { ActionFlowOverlay } from './ActionFlowOverlay'
import { useActionFlowOverlayMode } from './useActionFlowOverlayMode'

interface ResponsiveActionFlowProps {
  isOpen: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}

export function ResponsiveActionFlow({
  isOpen,
  title,
  description,
  onClose,
  children,
}: ResponsiveActionFlowProps) {
  const useOverlay = useActionFlowOverlayMode()

  if (!isOpen) {
    return null
  }

  if (!useOverlay) {
    return <>{children}</>
  }

  return (
    <ActionFlowOverlay
      isOpen={isOpen}
      title={title}
      description={description ?? ''}
      onClose={onClose}
    >
      {children}
    </ActionFlowOverlay>
  )
}
