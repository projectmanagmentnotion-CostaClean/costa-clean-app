/** An invoice editor may be saved only after its persisted values match the selected invoice. */
export function canSaveInvoiceEditor(
  invoiceId: string | null | undefined,
  hydratedInvoiceId: string | null,
): boolean {
  return Boolean(invoiceId && hydratedInvoiceId && invoiceId === hydratedInvoiceId)
}

/** Issued invoices need an explicit internal-correction attestation before a rewrite. */
export function canSaveIssuedInvoiceCorrection(status: string, internalCorrectionConfirmed: boolean): boolean {
  return status !== 'issued' || internalCorrectionConfirmed
}
