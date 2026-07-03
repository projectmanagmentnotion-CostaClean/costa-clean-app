import type { ReactNode } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'

interface DSConfirmDialogProps {
  isOpen: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'default' | 'warning'
  isBusy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DSConfirmDialog(props: DSConfirmDialogProps) {
  return <ConfirmDialog {...props} />
}
