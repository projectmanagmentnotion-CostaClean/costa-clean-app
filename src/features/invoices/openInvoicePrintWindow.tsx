import { renderToStaticMarkup } from 'react-dom/server'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import { invoicePrintStyles } from './invoicePrintStyles'
import type { InvoiceListItem } from './types'
import {
  buildBrandedDocumentTitle,
  sanitizeFilenamePart,
} from '../documents/utils'

export type InvoiceOutputIntent = 'print' | 'pdf'

function getClientName(invoice: InvoiceListItem): string {
  return (
    invoice.client_name?.trim() ||
    invoice.client_display_code ||
    invoice.client_id ||
    'Cliente'
  )
}

function getInvoiceRef(invoice: InvoiceListItem): string {
  return sanitizeFilenamePart(invoice.invoice_number ?? invoice.display_code ?? invoice.id)
}

export function getInvoiceDocumentTitle(invoice: InvoiceListItem): string {
  return buildBrandedDocumentTitle('Factura', getInvoiceRef(invoice), getClientName(invoice))
}

export function openInvoicePrintWindow(
  invoice: InvoiceListItem,
  intent: InvoiceOutputIntent = 'print',
) {
  const printWindow = window.open('', '_blank', 'width=1100,height=1400')

  if (!printWindow) {
    window.alert('El navegador bloqueó la ventana emergente. Permite pop-ups para imprimir o guardar PDF.')
    return
  }

  const documentTitle = getInvoiceDocumentTitle(invoice)
  const markup = renderToStaticMarkup(<InvoiceDocumentA4 invoice={invoice} variant="print" />)

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${documentTitle}</title>
    <style>${invoicePrintStyles}</style>
  </head>
  <body>
    <div class="cc-print-root">${markup}</div>

    <script>
      window.addEventListener('load', function () {
        setTimeout(function () {
          document.title = ${JSON.stringify(documentTitle)};
          window.focus();
          window.print();
        }, ${intent === 'pdf' ? 300 : 250});
      });
    </script>
  </body>
</html>`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
