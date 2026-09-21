import { useState } from 'react'
import { businessRules } from '../../app/businessRules'
import { buildInvoicePricingMetadataWithClientFiscalSnapshot } from '../clients/clientFiscalData'
import { saveInvoiceWithLines } from '../financial/financialWriteApi'
import { findInvoiceDuplicateGroups } from '../duplicates/duplicateEngine'
import { normalizeLineConcept } from '../quotes/lineConcepts'
import type { BillingLineFormState } from '../shared/billingLineDrafts'
import { buildBillingLinePayloads, createBlankBillingLine, createLocalId } from '../shared/billingLineDrafts'
import { roundMoney } from '../shared/billingLineDrafts'
import { QuickCreateDocumentFlow } from '../shared/QuickCreateDocumentFlow'
import { InvoiceCreateFlow, type InvoiceCreateFlowProps } from './InvoiceCreateFlow'
import type { InvoiceCreatePrefill } from './invoiceCreatePrefill'

function todayLocalDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function linesFromPrefill(prefill?: InvoiceCreatePrefill | null): BillingLineFormState[] {
  return prefill?.lines?.length
    ? prefill.lines.map((line) => ({ local_id: createLocalId('LINE-DRAFT'), concept: line.concept, quantity: line.quantity || '1.00', unit: line.unit || 'servicio', unit_price: line.unit_price || '0.00' }))
    : [createBlankBillingLine()]
}

export function InvoiceCreateEntry(props: InvoiceCreateFlowProps) {
  const [advanced, setAdvanced] = useState(false)
  const [advancedPrefill, setAdvancedPrefill] = useState<InvoiceCreatePrefill | null>(null)

  if (advanced) {
    return <InvoiceCreateFlow {...props} prefill={advancedPrefill ?? props.prefill} />
  }

  const prefill = props.prefill
  const initialLines = linesFromPrefill(prefill)

  return (
    <QuickCreateDocumentFlow
      documentLabel="factura"
      clients={props.clients}
      properties={props.properties}
      clientId={prefill?.client_id ?? ''}
      propertyId={prefill?.property_id ?? ''}
      initialLines={initialLines}
      initialNotes={prefill?.notes ?? ''}
      lockedContextLabel={prefill?.job_id || prefill?.quote_id ? `${prefill.title ?? 'Contexto heredado'} · los datos disponibles se han precargado` : null}
      onSave={async ({ clientId, propertyId, notes, lines }) => {
        const invoiceId = createLocalId('INVOICE')
        const linePayloads = buildBillingLinePayloads(lines, normalizeLineConcept)
        if (!linePayloads) throw new Error('Cada línea debe tener concepto, cantidad y precio válidos.')
        const selectedQuote = prefill?.quote_id ? props.quotes.find((quote) => quote.id === prefill.quote_id) : null
        const selectedClientForSave = props.clients.find((client) => client.id === clientId)
        const selectedPropertyForSave = props.properties.find((property) => property.id === propertyId)
        const subtotal = roundMoney(linePayloads.reduce((sum, line) => sum + line.line_subtotal, 0))
        const taxAmount = roundMoney(subtotal * businessRules.defaultTaxRate)
        const total = roundMoney(subtotal + taxAmount)
        const duplicateGroups = findInvoiceDuplicateGroups({
          id: invoiceId,
          display_code: null,
          invoice_number: null,
          job_id: prefill?.job_id || null,
          job_display_code: null,
          quote_id: prefill?.quote_id || null,
          quote_display_code: selectedQuote?.display_code ?? null,
          client_id: clientId,
          client_display_code: selectedClientForSave?.display_code ?? null,
          client_label: selectedClientForSave?.full_name ?? null,
          issue_date: todayLocalDate(),
          status: 'draft',
          subtotal,
          tax_amount: taxAmount,
          total,
          notes: notes.trim() || null,
          internal_notes: selectedQuote?.internal_notes ?? null,
          pricing_metadata: buildInvoicePricingMetadataWithClientFiscalSnapshot(selectedQuote?.pricing_metadata ?? null, selectedClientForSave),
          payment_status: 'pending',
          paid_amount: 0,
          outstanding_amount: total,
          payment_count: 0,
          last_payment_date: null,
          last_payment_method: null,
          last_payment_origin_type: null,
          client_name: selectedClientForSave?.full_name ?? null,
          client_phone: selectedClientForSave?.phone ?? null,
          client_email: selectedClientForSave?.email ?? null,
          property_id: propertyId || null,
          property_display_code: selectedPropertyForSave?.display_code ?? null,
          property_name: selectedPropertyForSave?.name ?? null,
          property_address_line: selectedPropertyForSave?.address ?? null,
          service_reference: prefill?.title ?? null,
          service_description: null,
          billing_concept: linePayloads[0]?.concept ?? null,
          billing_quantity: linePayloads[0]?.quantity ?? null,
          billing_unit: linePayloads[0]?.unit ?? null,
          billing_unit_price: linePayloads[0]?.unit_price ?? null,
          invoice_lines: linePayloads.map((line) => ({ ...line, invoice_id: invoiceId })),
          lines: linePayloads.map((line) => ({ ...line, invoice_id: invoiceId })),
        }, props.invoices ?? [])
        if (duplicateGroups.length > 0) {
          throw new Error('Se detectaron posibles facturas duplicadas. Abre el editor avanzado para revisarlas antes de guardar.')
        }
        await saveInvoiceWithLines({
          id: invoiceId,
          job_id: prefill?.job_id || null,
          quote_id: prefill?.quote_id || null,
          client_id: clientId,
          property_id: propertyId || null,
          issue_date: todayLocalDate(),
          status: 'draft',
          subtotal,
          tax_amount: taxAmount,
          total,
          notes: notes.trim() || null,
          internal_notes: selectedQuote?.internal_notes ?? null,
          pricing_metadata: buildInvoicePricingMetadataWithClientFiscalSnapshot(selectedQuote?.pricing_metadata ?? null, selectedClientForSave),
        }, linePayloads.map((line) => ({ ...line, invoice_id: invoiceId })))
        await props.onCreatedInvoice?.({
          id: invoiceId,
          display_code: null,
          invoice_number: null,
          job_id: prefill?.job_id || null,
          quote_id: prefill?.quote_id || null,
          client_id: clientId,
          client_display_code: selectedClientForSave?.display_code ?? null,
          issue_date: todayLocalDate(),
          status: 'draft',
          subtotal,
          tax_amount: taxAmount,
          total,
          notes: notes.trim() || null,
          internal_notes: selectedQuote?.internal_notes ?? null,
          pricing_metadata: buildInvoicePricingMetadataWithClientFiscalSnapshot(selectedQuote?.pricing_metadata ?? null, selectedClientForSave),
          client_name: selectedClientForSave?.full_name ?? null,
          property_id: propertyId || null,
          property_display_code: selectedPropertyForSave?.display_code ?? null,
          property_name: selectedPropertyForSave?.name ?? null,
          lines: linePayloads.map((line) => ({ ...line, invoice_id: invoiceId })),
        })
        await props.onRefreshData?.()
        await props.onCompleted?.()
      }}
      onOpenAdvanced={({ clientId, propertyId, notes, lines }) => {
        setAdvancedPrefill({
          request_id: createLocalId('INVOICE-PREFILL'),
          origin_kind: prefill?.origin_kind ?? 'manual',
          job_id: prefill?.job_id ?? '',
          quote_id: prefill?.quote_id ?? '',
          client_id: clientId,
          property_id: propertyId,
          notes,
          lines: lines.map((line) => ({ concept: line.concept, quantity: line.quantity, unit: line.unit, unit_price: line.unit_price })),
          title: prefill?.title,
        })
        setAdvanced(true)
      }}
      onCancel={props.onCancel}
      onDirtyChange={props.onDirtyChange}
    />
  )
}
