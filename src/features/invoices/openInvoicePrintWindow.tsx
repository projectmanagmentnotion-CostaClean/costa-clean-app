import { renderToStaticMarkup } from 'react-dom/server'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import { invoicePrintStyles } from './invoicePrintStyles'
import type { InvoiceListItem } from './types'

type InvoiceOutputIntent = 'print' | 'pdf'

function getDocumentTitle(invoice: InvoiceListItem, intent: InvoiceOutputIntent): string {
  const invoiceRef = invoice.invoice_number ?? invoice.display_code ?? invoice.id
  return intent === 'pdf'
    ? `Factura ${invoiceRef} - Guardar PDF`
    : `Factura ${invoiceRef} - Imprimir`
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

  const documentTitle = getDocumentTitle(invoice, intent)
  const markup = renderToStaticMarkup(<InvoiceDocumentA4 invoice={invoice} />)

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
          window.focus();
          window.print();
        }, 250);
      });
    </script>
  </body>
</html>`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
