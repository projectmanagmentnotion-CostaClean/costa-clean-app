import { useEffect, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { PaymentCreateForm } from '../features/payments/PaymentCreateForm'
import { PaymentDetailCard } from '../features/payments/PaymentDetailCard'
import { PaymentsList } from '../features/payments/PaymentsList'
import type { PaymentListItem } from '../features/payments/types'
import type { ClientListItem } from '../features/clients/types'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { NavigationGuard } from '../app/navigationGuard'

interface PaymentsPageProps {
  payments: PaymentListItem[]
  invoices: InvoiceListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  error: string | null
  onPaymentCreated: () => Promise<void>
  onOpenInvoiceDetail: (invoiceId: string) => void
  onOpenClientWorkspace: (clientId: string, tab?: ClientWorkspaceTab) => void
  activeFilterLabel: string | null
  onClearFilter: () => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
}

export function PaymentsPage({
  payments,
  invoices,
  clients,
  properties,
  jobs,
  quotes,
  error,
  onPaymentCreated,
  onOpenInvoiceDetail,
  onOpenClientWorkspace,
  activeFilterLabel,
  onClearFilter,
  onUnsavedChange,
  confirmNavigation,
}: PaymentsPageProps) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)

  const selectedPayment =
    payments.find((payment) => payment.id === selectedPaymentId) ?? payments[0] ?? null
  const selectedPaymentKey = selectedPayment?.id ?? null
  const hasPendingWork = showCreateForm || hasUnsavedDetailChanges

  useEffect(() => {
    onUnsavedChange?.(hasPendingWork, 'cambios sin guardar en pagos')
    return () => onUnsavedChange?.(false)
  }, [hasPendingWork, onUnsavedChange])

  function runGuarded(action: () => void) {
    if (!hasPendingWork) {
      action()
      return
    }

    if (!confirmNavigation) {
      action()
      return
    }

    confirmNavigation(action, {
      description: 'Hay cambios sin guardar en pagos. Si continúas, perderás esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  async function handlePaymentCreated() {
    await onPaymentCreated()
    setShowCreateForm(false)
  }

  return (
    <section className="page-section cc-master-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Pagos</h1>
          <p>
            Registra y consulta cobros con un patrón de lista y detalle más limpio.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            if (showCreateForm) {
              runGuarded(() => setShowCreateForm(false))
              return
            }

            setShowCreateForm(true)
          }}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo pago'}
        </button>
      </div>

      {showCreateForm ? (
        <PaymentCreateForm
          invoices={invoices}
          clients={clients}
          properties={properties}
          jobs={jobs}
          quotes={quotes}
          onCreated={handlePaymentCreated}
        />
      ) : null}

      {activeFilterLabel ? (
        <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
      ) : null}

      <div className="cc-master-layout cc-master-layout--list-first">
        <div className="cc-master-layout__list">
          <PaymentsList
            payments={payments}
            error={error}
            selectedPaymentId={selectedPaymentKey}
            onSelectPayment={(payment) => {
              if (payment.id === selectedPaymentKey) return
              runGuarded(() => setSelectedPaymentId(payment.id))
            }}
          />
        </div>

        <div className="cc-master-layout__detail">
          <PaymentDetailCard
            payment={selectedPayment}
            invoices={invoices}
            onPaymentUpdated={onPaymentCreated}
            onOpenInvoiceDetail={onOpenInvoiceDetail}
            onOpenClientWorkspace={onOpenClientWorkspace}
            onUnsavedChange={setHasUnsavedDetailChanges}
          />
        </div>
      </div>
    </section>
  )
}
