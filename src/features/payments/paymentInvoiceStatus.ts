import type { InvoiceListItem } from '../invoices/types'

function parseAmount(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function syncInvoicePaidStatus(invoiceId: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  }

  const invoiceResponse = await fetch(
    `${supabaseUrl}/rest/v1/invoices?id=eq.${encodeURIComponent(invoiceId)}&select=id,total,status`,
    { method: 'GET', headers },
  )

  if (!invoiceResponse.ok) {
    throw new Error(`REST ${invoiceResponse.status}: ${invoiceResponse.statusText}`)
  }

  const [invoice] = ((await invoiceResponse.json()) as Pick<InvoiceListItem, 'id' | 'total' | 'status'>[]) ?? []
  if (!invoice || invoice.status === 'paid') {
    return
  }

  const paymentsResponse = await fetch(
    `${supabaseUrl}/rest/v1/payments?invoice_id=eq.${encodeURIComponent(invoiceId)}&select=amount`,
    { method: 'GET', headers },
  )

  if (!paymentsResponse.ok) {
    throw new Error(`REST ${paymentsResponse.status}: ${paymentsResponse.statusText}`)
  }

  const payments = ((await paymentsResponse.json()) as Array<{ amount: number | string | null }>) ?? []
  const totalPaid = payments.reduce((sum, payment) => sum + parseAmount(payment.amount), 0)

  if (totalPaid < parseAmount(invoice.total)) {
    return
  }

  const patchResponse = await fetch(
    `${supabaseUrl}/rest/v1/invoices?id=eq.${encodeURIComponent(invoiceId)}`,
    {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'paid' }),
    },
  )

  if (!patchResponse.ok) {
    const errorText = await patchResponse.text()
    throw new Error(`REST ${patchResponse.status}: ${errorText || patchResponse.statusText}`)
  }
}
