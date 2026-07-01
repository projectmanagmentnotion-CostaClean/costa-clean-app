import { createContext } from 'react'
import type { ToastApi } from './toastTypes'

export const ToastContext = createContext<ToastApi | null>(null)
