import { useState } from 'react'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { InvoiceCreateFlow } from '../features/invoices/InvoiceCreateFlow'
import type { JobListItem } from '../features/jobs/types'
import { QuoteCreateFlow } from '../features/quotes/QuoteCreateFlow'
import type { QuoteListItem } from '../features/quotes/types'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'

const previewClients: ClientListItem[] = [
  {
    id: 'client-preview-1',
    display_code: 'CLI-0001',
    full_name: 'Miguel Angel Flores Novoa',
    phone: '600123123',
    email: 'miguel@example.com',
    tax_id: '12345678A',
    billing_address: 'Calle Mayor 10, Barcelona',
    status: 'active',
    source_lead_id: null,
  },
]

const previewProperties: PropertyListItem[] = [
  {
    id: 'property-preview-1',
    display_code: 'PRO-0001',
    client_id: 'client-preview-1',
    client_display_code: 'CLI-0001',
    client_name: 'Miguel Angel Flores Novoa',
    name: 'Gimnasio Centro',
    property_type: 'gym',
    address: 'Calle Mayor 10',
    city: 'Barcelona',
    postal_code: '08001',
    notes: 'Propiedad de prueba para validar flows.',
  },
]

const previewQuotes: QuoteListItem[] = [
  {
    id: 'quote-preview-1',
    display_code: '2026-001',
    client_id: 'client-preview-1',
    client_display_code: 'CLI-0001',
    client_name: 'Miguel Angel Flores Novoa',
    property_id: 'property-preview-1',
    property_display_code: 'PRO-0001',
    status: 'accepted',
    subtotal: 120,
    tax_amount: 25.2,
    total: 145.2,
    notes: 'Limpieza de mantenimiento mensual.',
    quote_lines: [
      {
        id: 'quote-line-preview-1',
        quote_id: 'quote-preview-1',
        sort_order: 1,
        concept: 'Limpieza de mantenimiento',
        quantity: 1,
        unit: 'servicio',
        unit_price: 120,
        line_subtotal: 120,
      },
    ],
  },
]

const previewJobs: JobListItem[] = [
  {
    id: 'job-preview-1',
    display_code: 'JOB-0037',
    client_id: 'client-preview-1',
    client_display_code: 'CLI-0001',
    client_name: 'Miguel Angel Flores Novoa',
    property_id: 'property-preview-1',
    property_display_code: 'PRO-0001',
    property_name: 'Gimnasio Centro',
    quote_id: 'quote-preview-1',
    quote_display_code: '2026-001',
    scheduled_date: '2026-06-09',
    status: 'completed',
    service_type: 'maintenance',
    billing_concept: 'Limpieza de mantenimiento general',
    billing_quantity: 1,
    billing_unit: 'servicio',
    billing_unit_price: 120,
    notes: 'Servicio mock para preview móvil.',
  },
]

type PreviewFlow = 'invoice' | 'quote'

export function DevStepFlowPreviewPage() {
  const [activeFlow, setActiveFlow] = useState<PreviewFlow>('invoice')
  const [isOpen, setIsOpen] = useState(true)

  return (
    <main className="cc-boot-screen" aria-label="Preview local del step flow">
      <div className="cc-boot-screen__wave" aria-hidden="true" />
      <div className="cc-boot-screen__glow cc-boot-screen__glow--one" />
      <div className="cc-boot-screen__glow cc-boot-screen__glow--two" />

      <section className="cc-boot-card">
        <div className="cc-boot-card__copy">
          <p className="cc-boot-card__kicker">Preview local</p>
          <h1>Step flow móvil</h1>
          <p>Ruta de validación visual para iPhone. Solo existe en `vite dev`.</p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="secondary-button" onClick={() => { setActiveFlow('invoice'); setIsOpen(true) }}>
            Probar factura
          </button>
          <button type="button" className="secondary-button" onClick={() => { setActiveFlow('quote'); setIsOpen(true) }}>
            Probar presupuesto
          </button>
        </div>
      </section>

      <ActionFlowOverlay
        isOpen={isOpen}
        title={activeFlow === 'invoice' ? 'Nueva factura' : 'Nuevo presupuesto'}
        description="Preview local para validar jerarquía móvil del flow."
        onClose={() => setIsOpen(false)}
      >
        {activeFlow === 'invoice' ? (
          <InvoiceCreateFlow
            clients={previewClients}
            properties={previewProperties}
            jobs={previewJobs}
            quotes={previewQuotes}
            onRefreshData={async () => undefined}
            onCompleted={async () => undefined}
            onCancel={() => setIsOpen(false)}
          />
        ) : (
          <QuoteCreateFlow
            clients={previewClients}
            properties={previewProperties}
            onRefreshData={async () => undefined}
            onCompleted={async () => undefined}
            onCancel={() => setIsOpen(false)}
          />
        )}
      </ActionFlowOverlay>
    </main>
  )
}
