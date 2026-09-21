import { useState } from 'react'
import { businessRules } from '../../app/businessRules'
import { saveQuoteWithLines } from '../financial/financialWriteApi'
import { findQuoteDuplicateGroups } from '../duplicates/duplicateEngine'
import type { BillingLineFormState } from '../shared/billingLineDrafts'
import { createBlankBillingLine, createLocalId, roundMoney } from '../shared/billingLineDrafts'
import { QuickCreateDocumentFlow } from '../shared/QuickCreateDocumentFlow'
import { QuoteCreateFlow, type QuoteCreateFlowProps } from './QuoteCreateFlow'
import { buildQuoteLinePayloads } from './quoteLineUtils'
import type { QuoteCreatePrefill } from './quoteCreatePrefill'

function linesFromPrefill(prefill?: QuoteCreatePrefill | null): BillingLineFormState[] {
  return prefill?.lines?.length
    ? prefill.lines.map((line) => ({ local_id: createLocalId('LINE-DRAFT'), concept: line.concept, quantity: line.quantity || '1.00', unit: line.unit || 'servicio', unit_price: line.unit_price || '0.00' }))
    : [createBlankBillingLine()]
}

export function QuoteCreateEntry(props: QuoteCreateFlowProps) {
  const [advanced, setAdvanced] = useState(false)
  const [advancedPrefill, setAdvancedPrefill] = useState<QuoteCreatePrefill | null>(null)

  if (advanced) return <QuoteCreateFlow {...props} prefill={advancedPrefill ?? props.prefill} />

  const prefill = props.prefill
  return (
    <QuickCreateDocumentFlow
      documentLabel="presupuesto"
      clients={props.clients}
      properties={props.properties}
      clientId={prefill?.client_id ?? props.contextClientId ?? ''}
      propertyId={prefill?.property_id ?? props.contextPropertyId ?? ''}
      initialLines={linesFromPrefill(prefill)}
      initialNotes={prefill?.notes ?? ''}
      lockedContextLabel={prefill?.client_id || props.contextClientId ? 'Cliente y contexto disponibles' : null}
      onSave={async ({ clientId, propertyId, notes, lines }) => {
        const quoteId = createLocalId('QUOTE')
        const linePayloads = buildQuoteLinePayloads(lines, quoteId)
        if (!linePayloads) throw new Error('Cada línea debe tener concepto, cantidad y precio válidos.')
        const subtotal = roundMoney(linePayloads.reduce((sum, line) => sum + line.line_subtotal, 0))
        const taxAmount = roundMoney(subtotal * businessRules.defaultTaxRate)
        const total = roundMoney(subtotal + taxAmount)
        const selectedClient = props.clients.find((client) => client.id === clientId)
        const selectedProperty = props.properties.find((property) => property.id === propertyId)
        const duplicateGroups = findQuoteDuplicateGroups({
          id: quoteId,
          display_code: null,
          lead_id: null,
          lead_display_code: null,
          lead_name: null,
          client_id: clientId,
          client_display_code: selectedClient?.display_code ?? null,
          client_name: selectedClient?.full_name ?? null,
          property_id: propertyId || null,
          property_display_code: selectedProperty?.display_code ?? null,
          status: 'draft',
          job_id: null,
          invoice_id: null,
          subtotal,
          tax_amount: taxAmount,
          total,
          notes: notes.trim() || null,
          internal_notes: null,
          pricing_metadata: null,
          created_at: new Date().toISOString(),
          quote_lines: linePayloads,
          lines: linePayloads,
        }, props.quotes ?? [])
        if (duplicateGroups.length > 0) {
          throw new Error('Se detectaron posibles presupuestos duplicados. Abre el editor avanzado para revisarlos antes de guardar.')
        }
        await saveQuoteWithLines({
          id: quoteId,
          client_id: clientId,
          lead_id: null,
          property_id: propertyId || null,
          status: 'draft',
          subtotal,
          tax_amount: taxAmount,
          total,
          notes: notes.trim() || null,
        }, linePayloads)
        await props.onCreatedQuote?.({ id: quoteId, client_id: clientId, property_id: propertyId || null })
        await props.onRefreshData?.()
        await props.onCompleted?.()
      }}
      onOpenAdvanced={({ clientId, propertyId, notes, lines }) => {
        setAdvancedPrefill({
          request_id: createLocalId('QUOTE-PREFILL'),
          client_id: clientId,
          property_id: propertyId,
          notes,
          lines: lines.map((line) => ({ concept: line.concept, quantity: line.quantity, unit: line.unit, unit_price: line.unit_price })),
        })
        setAdvanced(true)
      }}
      onCancel={props.onCancel}
      onDirtyChange={props.onDirtyChange}
    />
  )
}
