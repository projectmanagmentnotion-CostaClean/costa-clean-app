import { parseInvoiceFiscalSequence } from './invoiceNumbering'

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

/** The normal correction path keeps the issued fiscal number, so its date must stay in that fiscal year. */
export function canKeepInvoiceFiscalNumber(invoiceNumber: string | null | undefined, issueDate: string): boolean {
  const issueYear = Number(issueDate.slice(0, 4))
  return Number.isInteger(issueYear) && parseInvoiceFiscalSequence(invoiceNumber, issueYear) !== null
}
