import { useState } from 'react'
import { formatCurrency } from '../../app/displayFormat'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { getSupabaseClient } from '../../lib/supabase'
import { getSupabasePublicEnv } from '../../lib/supabaseEnv'
import { updateInvoiceStatus } from '../financial/financialWriteApi'
import { V3ConfirmSheet, V3PrimaryAction } from '../../v3/components/V3Primitives'
import type { InvoiceListItem } from './types'
import {
  getInvoiceIssueConfirmationDescription,
  issueSelectedInvoice,
  type InvoiceIssueDependencies,
} from './invoiceIssueFlow'

interface InvoiceIssueActionProps {
  invoice: InvoiceListItem | null
  onInvoiceUpdated: () => Promise<void>
  presentation?: 'legacy' | 'v3'
}

function createInvoiceIssueDependencies(): InvoiceIssueDependencies {
  const { client, error } = getSupabaseClient()
  if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.')

  return {
    async getAuthenticatedUserId() {
      const { data, error: authError } = await client.auth.getUser()
      if (authError) throw new Error(authError.message || 'No se pudo verificar la sesión interna.')
      return data.user?.id ?? null
    },
    async readInvoice(invoiceId) {
      const { data, error: readError } = await client
        .from('invoices')
        .select('id,client_id,status,subtotal,tax_amount,total,invoice_number')
        .eq('id', invoiceId)
        .maybeSingle()
      if (readError) throw new Error(readError.message || 'No se pudo contrastar la factura con el entorno configurado.')
      return data
    },
    issueInvoice: (invoiceId) => updateInvoiceStatus(invoiceId, 'issued'),
    async findInvoicesWithNumber(invoiceNumber) {
      const { data, error: readError } = await client
        .from('invoices')
        .select('id')
        .eq('invoice_number', invoiceNumber)
      if (readError) throw new Error(readError.message || 'No se pudo comprobar la unicidad del número fiscal.')
      return (data ?? []).map((invoice) => invoice.id)
    },
  }
}

export function InvoiceIssueAction({ invoice, onInvoiceUpdated, presentation = 'legacy' }: InvoiceIssueActionProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isIssuing, setIsIssuing] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isOutcomeUncertain, setIsOutcomeUncertain] = useState(false)

  if (!invoice || invoice.status !== 'draft') return null

  const clientLabel = invoice.client_name ?? invoice.client_label ?? invoice.client_id
  const { supabaseUrl } = getSupabasePublicEnv()
  const isV3Presentation = presentation === 'v3'

  async function confirmIssue() {
    if (!invoice || isIssuing || isOutcomeUncertain) return

    setIsIssuing(true)
    setErrorMessage(null)
    setResultMessage(null)
    try {
      const result = await issueSelectedInvoice(invoice, createInvoiceIssueDependencies())
      setResultMessage(result.warning
        ? `Emitida ${result.invoice.invoice_number} · estado ${result.invoice.status}. ${result.warning}`
        : `Factura emitida · ${result.invoice.invoice_number} · estado ${result.invoice.status}.`)
      setIsConfirmOpen(false)
      try {
        await onInvoiceUpdated()
      } catch {
        setErrorMessage(`El entorno configurado confirma la emisión ${result.invoice.invoice_number}, pero no se pudo actualizar la lista. Recarga la ficha y no repitas la emisión.`)
        setIsOutcomeUncertain(true)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo verificar la emisión.'
      setErrorMessage(message)
      setIsOutcomeUncertain(
        message.includes('El entorno configurado no confirma')
        || message.includes('no confirmó la unicidad')
        || message.includes('unicidad no pudo verificarse'),
      )
      setIsConfirmOpen(false)
      try {
        await onInvoiceUpdated()
      } catch {
        // Keep the original issuance/readback error visible.
      }
    } finally {
      setIsIssuing(false)
    }
  }

  const openConfirmation = () => {
    setErrorMessage(null)
    setIsConfirmOpen(true)
  }
  const confirmationDescription = `${getInvoiceIssueConfirmationDescription(supabaseUrl)} Cliente: ${clientLabel}. Total: ${formatCurrency(invoice.total)}.`

  return (
    <>
      {isV3Presentation ? (
        <V3PrimaryAction onClick={openConfirmation} disabled={isIssuing || isOutcomeUncertain || invoice.invoice_number !== null}>
          Emitir factura
        </V3PrimaryAction>
      ) : (
        <div className="cc-invoice-issue-action">
          <div className="form-actions cc-invoice-detail-card__action-row">
            <button type="button" className="primary-button" onClick={openConfirmation} disabled={isIssuing || isOutcomeUncertain || invoice.invoice_number !== null}>
              Emitir factura
            </button>
          </div>
        </div>
      )}
      {resultMessage ? <p role="status">{resultMessage}</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {isOutcomeUncertain ? <p>No repitas la emisión. Recarga la ficha y confirma el estado y número fiscal en el entorno configurado.</p> : null}
      {isV3Presentation ? (
        isConfirmOpen ? <V3ConfirmSheet title="Confirmar emisión fiscal" description={confirmationDescription} confirmLabel="Emitir factura" busy={isIssuing} onCancel={() => setIsConfirmOpen(false)} onConfirm={() => void confirmIssue()} /> : null
      ) : (
        <ConfirmDialog
          isOpen={isConfirmOpen}
          title="Confirmar emisión fiscal"
          description={(
            <div>
              <p>{getInvoiceIssueConfirmationDescription(supabaseUrl)}</p>
              <dl>
                <dt>Cliente</dt><dd>{clientLabel}</dd>
                <dt>ID</dt><dd>{invoice.id}</dd>
                <dt>Base</dt><dd>{formatCurrency(invoice.subtotal)}</dd>
                <dt>IVA</dt><dd>{formatCurrency(invoice.tax_amount)}</dd>
                <dt>Total</dt><dd>{formatCurrency(invoice.total)}</dd>
              </dl>
            </div>
          )}
          confirmLabel="Emitir factura"
          tone="warning"
          isBusy={isIssuing}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={() => void confirmIssue()}
        />
      )}
    </>
  )
}
