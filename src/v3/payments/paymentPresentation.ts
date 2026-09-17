export interface PaymentProvenancePresentation {
  label: string
  description: string
  editable: boolean
}

export type PaymentOriginFilter = 'all' | 'manual' | 'transfer_auto' | 'transfer_regularization'

export function filterPaymentsByOrigin<T extends { origin_type?: string | null }>(payments: T[], originFilter: PaymentOriginFilter): T[] {
  if (originFilter === 'all') return payments
  return payments.filter((payment) => (payment.origin_type ?? 'manual') === originFilter)
}

export function getPaymentProvenancePresentation(originType: string | null | undefined): PaymentProvenancePresentation {
  switch (originType) {
    case 'transfer_auto':
      return {
        label: 'Información automática de transferencia',
        description: 'Este registro se creó a partir de información de transferencia. No confirma conciliación ni liquidación de la factura.',
        editable: false,
      }
    case 'transfer_regularization':
      return {
        label: 'Regularización histórica de transferencia',
        description: 'Este registro conserva información histórica de transferencia. No confirma conciliación ni liquidación de la factura.',
        editable: false,
      }
    case 'manual':
    default:
      return {
        label: 'Cobro registrado manualmente',
        description: 'Cobro registrado manualmente y vinculado a la factura indicada.',
        editable: true,
      }
  }
}
