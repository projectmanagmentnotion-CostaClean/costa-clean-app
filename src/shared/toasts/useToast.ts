import { useContext } from 'react'
import type { ToastApi, ToastInput } from './toastTypes'
import { ToastContext } from './toastContext'

function noopShow(input: ToastInput) {
  void input
  return 'toast-noop'
}

function noop() {}

const fallbackToastApi: ToastApi = {
  show: noopShow,
  update: noop,
  dismiss: noop,
  success: (title, description, options) => noopShow({ type: 'success', title, description, ...options }),
  warning: (title, description, options) => noopShow({ type: 'warning', title, description, ...options }),
  error: (title, description, options) => noopShow({ type: 'error', title, description, ...options }),
  info: (title, description, options) => noopShow({ type: 'info', title, description, ...options }),
  loading: (title, description, options) => noopShow({ type: 'loading', title, description, ...options }),
}

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? fallbackToastApi
}
