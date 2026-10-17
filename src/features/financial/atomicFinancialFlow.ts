export interface AtomicFlowDraft {
  idempotencyKey: string
  jobId: string
  invoiceId: string
  clientId: string
  propertyId: string
  quoteId: string
  scheduledDate: string
  serviceType: string
  concept: string
  quantity: number
  unitPrice: number
  taxAmount: number
  status: string
  paymentEnabled: boolean
  paymentAmount: number
  paymentMethod: string
  paymentDate: string
}

export function createAtomicFlowDraft(randomUuid: () => string = () => crypto.randomUUID()): AtomicFlowDraft {
  return {
    idempotencyKey: randomUuid(),
    jobId: `JOB-${randomUuid()}`,
    invoiceId: `INVOICE-${randomUuid()}`,
    clientId: '',
    propertyId: '',
    quoteId: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
    serviceType: 'standard_cleaning',
    concept: '',
    quantity: 1,
    unitPrice: 0,
    taxAmount: 0,
    status: 'draft',
    paymentEnabled: false,
    paymentAmount: 0,
    paymentMethod: 'transfer',
    paymentDate: new Date().toISOString().slice(0, 10),
  }
}

export function buildAtomicOperationPayload(draft: AtomicFlowDraft) {
  const subtotal = Math.round(draft.quantity * draft.unitPrice * 100) / 100
  const total = Math.round((subtotal + draft.taxAmount) * 100) / 100
  const jobLine = {
    id: `JOB-LINE-${draft.jobId}`,
    job_id: draft.jobId,
    sort_order: 1,
    concept: draft.concept.trim(),
    quantity: draft.quantity,
    unit: 'servicio',
    unit_price: draft.unitPrice,
    line_subtotal: subtotal,
  }
  const invoiceLine = {
    id: `INVOICE-LINE-${draft.invoiceId}`,
    invoice_id: draft.invoiceId,
    sort_order: 1,
    concept: draft.concept.trim(),
    quantity: draft.quantity,
    unit: 'servicio',
    unit_price: draft.unitPrice,
    line_subtotal: subtotal,
  }

  return {
    job: {
      id: draft.jobId,
      client_id: draft.clientId,
      property_id: draft.propertyId,
      quote_id: draft.quoteId || null,
      scheduled_date: draft.scheduledDate,
      status: 'scheduled',
      service_type: draft.serviceType,
      billing_concept: draft.concept.trim(),
      billing_quantity: draft.quantity,
      billing_unit: 'servicio',
      billing_unit_price: draft.unitPrice,
    },
    jobLines: [jobLine],
    invoice: {
      id: draft.invoiceId,
      job_id: draft.jobId,
      quote_id: draft.quoteId || null,
      client_id: draft.clientId,
      property_id: draft.propertyId,
      issue_date: draft.scheduledDate,
      status: draft.status,
      subtotal,
      tax_amount: draft.taxAmount,
      total,
    },
    invoiceLines: [invoiceLine],
    payment: draft.paymentEnabled ? {
      id: `PAYMENT-${draft.invoiceId}`,
      invoice_id: draft.invoiceId,
      payment_date: draft.paymentDate,
      amount: draft.paymentAmount,
      payment_method: draft.paymentMethod,
      origin_type: 'manual',
    } : null,
    idempotencyKey: draft.idempotencyKey,
  }
}

export function mapAtomicFinancialError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const known: Record<string, string> = {
    client_not_found: 'El cliente seleccionado ya no existe. Actualiza la lista y vuelve a intentarlo.',
    property_client_mismatch: 'La propiedad no pertenece al cliente seleccionado.',
    quote_client_mismatch: 'El presupuesto no pertenece al cliente seleccionado.',
    job_relationship_mismatch: 'Las relaciones del servicio no son coherentes.',
    invoice_line_totals_invalid: 'Revisa cantidades, precios y subtotales de la línea.',
    invoice_totals_invalid: 'Los totales han cambiado. Revisa la facturación antes de confirmar.',
    payment_invoice_mismatch: 'El cobro no está vinculado a la factura de esta operación.',
    payment_amount_invalid: 'El importe del cobro debe ser positivo y no superar el total.',
    idempotency_conflict: 'Esta operación ya fue enviada con otra información. Conserva el borrador y revisa el resultado.',
  }
  const key = Object.keys(known).find((candidate) => message.includes(candidate))
  return key ? known[key] : 'No se pudo completar la operación. El borrador se ha conservado para reintentarlo.'
}
