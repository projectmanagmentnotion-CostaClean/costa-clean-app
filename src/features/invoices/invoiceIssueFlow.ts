const QA_SUPABASE_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_SUPABASE_PROJECT_REF = 'wfxnwfcdjainpojhbdri'

export function getInvoiceIssueEnvironmentLabel(supabaseUrl: string): string {
  try {
    const hostname = new URL(supabaseUrl).hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'Local'

    const [projectRef, ...domainParts] = hostname.split('.')
    if (domainParts.join('.') !== 'supabase.co') return 'entorno no identificado'
    if (projectRef === QA_SUPABASE_PROJECT_REF) return 'QA'
    if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF) return 'Production'
    return 'Supabase desconocido'
  } catch {
    return 'entorno no identificado'
  }
}

export function getInvoiceIssueConfirmationDescription(supabaseUrl: string): string {
  const environmentLabel = getInvoiceIssueEnvironmentLabel(supabaseUrl)
  return `Se emitirá este borrador en ${environmentLabel} usando la sesión interna autenticada y la numeración oficial de ese entorno.`
}

export interface InvoiceIssueSnapshot {
  id: string
  client_id: string
  status: string
  subtotal: number | string
  tax_amount: number | string
  total: number | string
  invoice_number: string | null
}

export interface InvoiceIssueSelection {
  id: string
  client_id: string
  status: string
  subtotal: number
  tax_amount: number
  total: number
  invoice_number: string | null
}

export interface InvoiceIssueDependencies {
  getAuthenticatedUserId: () => Promise<string | null>
  readInvoice: (invoiceId: string) => Promise<InvoiceIssueSnapshot | null>
  issueInvoice: (invoiceId: string) => Promise<void>
  findInvoicesWithNumber: (invoiceNumber: string) => Promise<string[]>
}

export interface InvoiceIssueResult {
  invoice: InvoiceIssueSnapshot
  warning: string | null
}

function toCents(value: number | string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return Number.NaN
  return Math.round((parsed + Number.EPSILON) * 100)
}

function matchesSelectedInvoice(
  selected: InvoiceIssueSelection,
  production: InvoiceIssueSnapshot,
): boolean {
  return production.id === selected.id
    && production.client_id === selected.client_id
    && production.status === 'draft'
    && selected.status === 'draft'
    && production.invoice_number === null
    && selected.invoice_number === null
    && toCents(production.subtotal) === toCents(selected.subtotal)
    && toCents(production.tax_amount) === toCents(selected.tax_amount)
    && toCents(production.total) === toCents(selected.total)
}

export async function issueSelectedInvoice(
  selected: InvoiceIssueSelection,
  dependencies: InvoiceIssueDependencies,
): Promise<InvoiceIssueResult> {
  if (!selected.id || !selected.client_id || selected.status !== 'draft') {
    throw new Error('Solo se pueden emitir borradores con identificador y cliente válidos.')
  }

  if (!await dependencies.getAuthenticatedUserId()) {
    throw new Error('Inicia sesión con una cuenta interna antes de emitir la factura.')
  }

  const current = await dependencies.readInvoice(selected.id)
  if (!current || !matchesSelectedInvoice(selected, current)) {
    throw new Error('La factura seleccionada ya no coincide con el entorno configurado (ID, cliente, estado o importes). No se ha emitido.')
  }

  let rpcError: unknown = null
  try {
    await dependencies.issueInvoice(current.id)
  } catch (error) {
    rpcError = error
  }

  let persisted: InvoiceIssueSnapshot | null
  try {
    persisted = await dependencies.readInvoice(current.id)
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : ''
    throw new Error(`El entorno configurado no confirma la emisión ni su número fiscal. No vuelvas a intentarlo sin releer la factura.${detail}`)
  }
  if (!persisted || persisted.id !== selected.id || persisted.status !== 'issued' || !persisted.invoice_number) {
    if (rpcError instanceof Error) throw rpcError
    throw new Error('El entorno configurado no confirma la emisión y el número fiscal. No vuelvas a intentarlo sin releer la factura.')
  }

  let matchingNumbers: string[]
  try {
    matchingNumbers = await dependencies.findInvoicesWithNumber(persisted.invoice_number)
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : ''
    throw new Error(`La factura está emitida, pero el entorno configurado no confirmó la unicidad del número fiscal. No repitas la emisión.${detail}`)
  }
  if (matchingNumbers.length !== 1 || matchingNumbers[0] !== persisted.id) {
    throw new Error(`El entorno configurado asignó ${persisted.invoice_number}, pero la unicidad no pudo verificarse. Detén nuevas emisiones y revisa el estado.`)
  }

  return {
    invoice: persisted,
    warning: rpcError instanceof Error
      ? `La emisión quedó persistida como ${persisted.invoice_number}, pero la llamada devolvió un error: ${rpcError.message}`
      : null,
  }
}
