import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, getInitialTheme } from './app/theme'
import './index.css'

export function bootstrapCrm(rootElement: HTMLElement) {
  document.title = 'CostaClean CRM | Gestión y presupuestos de limpieza'
  applyTheme(getInitialTheme())

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
