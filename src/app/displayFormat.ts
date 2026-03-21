import { businessRules } from './businessRules'
import { getStatusLabel } from './displayText'

export function formatCurrency(value: number | null | undefined): string {
  const numericValue = typeof value === 'number' ? value : 0

  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: businessRules.currency,
  }).format(numericValue)
}

export function formatDateEs(value: string | null | undefined): string {
  if (!value) {
    return 'Sin fecha'
  }

  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const propertyTypeLabels: Record<string, string> = {
  apartment: 'Apartamento',
  house: 'Casa',
  office: 'Oficina',
  local: 'Local',
  tourist_apartment: 'Apartamento turístico',
  community: 'Comunidad',
  construction_site: 'Obra',
}

const serviceTypeLabels: Record<string, string> = {
  standard_cleaning: 'Limpieza estándar',
  deep_cleaning: 'Limpieza profunda',
  post_construction: 'Limpieza post-obra',
  check_out_cleaning: 'Limpieza check-out',
  airbnb_turnover: 'Cambio Airbnb',
  glass_cleaning: 'Limpieza de cristales',
}

const paymentMethodLabels: Record<string, string> = {
  transfer: 'Transferencia',
  cash: 'Efectivo',
  bizum: 'Bizum',
  card: 'Tarjeta',
}

export function getPropertyTypeLabel(value: string | null | undefined): string {
  if (!value) return 'Sin tipo'
  return propertyTypeLabels[value] ?? value
}

export function getServiceTypeLabel(value: string | null | undefined): string {
  if (!value) return 'Sin tipo'
  return serviceTypeLabels[value] ?? value
}

export function getPaymentMethodLabel(value: string | null | undefined): string {
  if (!value) return 'Sin método'
  return paymentMethodLabels[value] ?? value
}

export function getDisplayStatusLabel(value: string | null | undefined): string {
  return getStatusLabel(value)
}
