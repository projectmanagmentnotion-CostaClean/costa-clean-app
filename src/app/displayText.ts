import type { AppView } from './navigation'

const appViewLabels: Record<AppView, string> = {
  dashboard: 'Inicio',
  leads: 'Leads',
  clients: 'Clientes',
  properties: 'Propiedades',
  quotes: 'Presupuestos',
  jobs: 'Servicios',
  invoices: 'Facturas',
  payments: 'Pagos',
}

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Vencido',
  issued: 'Emitida',
  paid: 'Pagada',
  cancelled: 'Cancelada',
}

export function getAppViewLabel(view: AppView): string {
  return appViewLabels[view] ?? view
}

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Sin estado'
  return statusLabels[status] ?? status
}
