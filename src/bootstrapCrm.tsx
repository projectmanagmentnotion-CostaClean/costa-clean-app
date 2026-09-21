import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, getInitialTheme } from './app/theme'
import './index.css'
import './v3/design/v3.css'

export function bootstrapCrm(rootElement: HTMLElement) {
  document.title = 'CostaClean CRM | Gestión y presupuestos de limpieza'
  applyTheme(getInitialTheme())

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
