export const invoicePrintStyles = `
  @page {
    size: A4 portrait;
    margin: 0;
  }

  :root {
    color-scheme: light;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #eef2f7;
    color: #0f172a;
    font-family: Inter, Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    min-height: 100vh;
  }

  .cc-print-root {
    padding: 24px;
  }

  .cc-invoice-a4 {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 14mm 14mm 12mm;
    background: #ffffff;
    color: #0f172a;
    display: flex;
    flex-direction: column;
    gap: 8mm;
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
  }

  .cc-invoice-a4__header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 72mm;
    gap: 8mm;
    align-items: start;
  }

  .cc-invoice-a4__brand {
    display: flex;
    gap: 5mm;
    align-items: center;
    min-width: 0;
  }

  .cc-invoice-a4__logo {
    width: 54mm;
    height: auto;
    object-fit: contain;
    display: block;
  }

  .cc-invoice-a4__brand-copy {
    min-width: 0;
  }

  .cc-invoice-a4__eyebrow {
    display: inline-block;
    margin-bottom: 2mm;
    font-size: 10pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 700;
  }

  .cc-invoice-a4__brand-copy h1 {
    margin: 0;
    font-size: 24pt;
    line-height: 1;
    letter-spacing: 0.02em;
  }

  .cc-invoice-a4__brand-copy p {
    margin: 2.5mm 0 0;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #475569;
  }

  .cc-invoice-a4__doc-box,
  .cc-invoice-a4__panel,
  .cc-invoice-a4__reference-card,
  .cc-invoice-a4__totals {
    border: 1px solid #dbe3ee;
    border-radius: 4mm;
    background: #ffffff;
  }

  .cc-invoice-a4__doc-box {
    padding: 5mm;
    display: grid;
    gap: 3mm;
  }

  .cc-invoice-a4__doc-row {
    display: flex;
    justify-content: space-between;
    gap: 4mm;
    align-items: baseline;
    font-size: 10.5pt;
  }

  .cc-invoice-a4__doc-row span {
    color: #64748b;
  }

  .cc-invoice-a4__doc-row strong {
    text-align: right;
  }

  .cc-invoice-a4__parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6mm;
  }

  .cc-invoice-a4__panel,
  .cc-invoice-a4__reference-card {
    padding: 5mm;
  }

  .cc-invoice-a4__panel--soft {
    background: #f8fafc;
  }

  .cc-invoice-a4__label {
    display: inline-block;
    margin-bottom: 2.5mm;
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .cc-invoice-a4__panel strong,
  .cc-invoice-a4__reference-card strong {
    display: block;
    margin: 0;
    font-size: 11.5pt;
    line-height: 1.35;
  }

  .cc-invoice-a4__panel p,
  .cc-invoice-a4__reference-card p {
    margin: 1.5mm 0 0;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #334155;
  }

  .cc-invoice-a4__references {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6mm;
  }

  .cc-invoice-a4__table-wrap {
    border: 1px solid #dbe3ee;
    border-radius: 4mm;
    overflow: hidden;
  }

  .cc-invoice-a4__table {
    width: 100%;
    border-collapse: collapse;
  }

  .cc-invoice-a4__table thead {
    display: table-header-group;
  }

  .cc-invoice-a4__table th {
    background: #0f172a;
    color: #ffffff;
    font-size: 10pt;
    text-align: left;
    padding: 4mm 4.5mm;
    font-weight: 700;
  }

  .cc-invoice-a4__table td {
    padding: 4.5mm;
    font-size: 10.5pt;
    border-top: 1px solid #e5e7eb;
    vertical-align: top;
  }

  .cc-invoice-a4__table th:nth-child(2),
  .cc-invoice-a4__table th:nth-child(3),
  .cc-invoice-a4__table th:nth-child(4),
  .cc-invoice-a4__table td:nth-child(2),
  .cc-invoice-a4__table td:nth-child(3),
  .cc-invoice-a4__table td:nth-child(4) {
    text-align: right;
    white-space: nowrap;
  }

  .cc-invoice-a4__footer-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 68mm;
    gap: 6mm;
    align-items: start;
  }

  .cc-invoice-a4__notes {
    display: grid;
    gap: 6mm;
  }

  .cc-invoice-a4__totals {
    padding: 5mm;
    display: grid;
    gap: 2.5mm;
    align-self: start;
  }

  .cc-invoice-a4__total-row {
    display: flex;
    justify-content: space-between;
    gap: 4mm;
    font-size: 10.5pt;
    line-height: 1.4;
  }

  .cc-invoice-a4__total-row span {
    color: #475569;
  }

  .cc-invoice-a4__total-row--grand {
    margin-top: 2mm;
    padding-top: 3mm;
    border-top: 1px solid #cbd5e1;
    font-size: 12.5pt;
    font-weight: 800;
  }

  .cc-invoice-a4__total-row--grand span,
  .cc-invoice-a4__total-row--grand strong {
    color: #0f172a;
  }

  .cc-invoice-a4,
  .cc-invoice-a4 * {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  @media print {
    html,
    body {
      background: #ffffff;
    }

    .cc-print-root {
      padding: 0;
    }

    .cc-invoice-a4 {
      margin: 0;
      width: 210mm;
      min-height: 297mm;
      box-shadow: none;
    }
  }
`
