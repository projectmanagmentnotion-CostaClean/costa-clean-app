import type { ReactNode } from 'react'

export type ToastType = 'success' | 'warning' | 'error' | 'info' | 'loading'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastInput {
  type: ToastType
  title: string
  description?: ReactNode
  durationMs?: number
  persistent?: boolean
  action?: ToastAction
}

export interface ToastRecord extends ToastInput {
  id: string
  createdAt: number
}

export interface ToastUpdateInput {
  type?: ToastType
  title?: string
  description?: ReactNode
  durationMs?: number
  persistent?: boolean
  action?: ToastAction
}

export interface ToastApi {
  show: (input: ToastInput) => string
  update: (id: string, input: ToastUpdateInput) => void
  dismiss: (id: string) => void
  success: (title: string, description?: ReactNode, options?: Partial<Omit<ToastInput, 'type' | 'title' | 'description'>>) => string
  warning: (title: string, description?: ReactNode, options?: Partial<Omit<ToastInput, 'type' | 'title' | 'description'>>) => string
  error: (title: string, description?: ReactNode, options?: Partial<Omit<ToastInput, 'type' | 'title' | 'description'>>) => string
  info: (title: string, description?: ReactNode, options?: Partial<Omit<ToastInput, 'type' | 'title' | 'description'>>) => string
  loading: (title: string, description?: ReactNode, options?: Partial<Omit<ToastInput, 'type' | 'title' | 'description'>>) => string
}
