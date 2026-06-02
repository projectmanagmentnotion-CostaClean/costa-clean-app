import { getStatusLabel } from './displayText'

export const quoteStatusOptions = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const
export const jobStatusOptions = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const
export const invoiceStatusOptions = ['draft', 'issued', 'paid', 'cancelled'] as const
export const invoiceManualStatusOptions = ['draft', 'issued', 'cancelled'] as const

export function getStatusOptionLabel(status: string): string {
  return getStatusLabel(status)
}
