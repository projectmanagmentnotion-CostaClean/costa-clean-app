import type { ReactNode } from 'react'
import { ActionFlowOverlay } from './ActionFlowOverlay'

interface MajorEditFlowOverlayProps {
  isOpen: boolean
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}

export function MajorEditFlowOverlay({
  isOpen,
  title,
  description,
  onClose,
  children,
}: MajorEditFlowOverlayProps) {
  return (
    <ActionFlowOverlay
      isOpen={isOpen}
      title={title}
      description={description}
      onClose={onClose}
    >
      {children}
    </ActionFlowOverlay>
  )
}
