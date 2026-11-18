interface ExpenseReceiptPreviewDocumentProps {
  kind: 'pdf' | 'image'
  url: string
  onError: () => void
}

export function ExpenseReceiptPreviewDocument({ kind, url, onError }: ExpenseReceiptPreviewDocumentProps) {
  if (kind === 'pdf') {
    return <>
      <iframe
        className="cc-expense-receipt-preview__document"
        src={url}
        title="Vista previa del justificante PDF"
        referrerPolicy="no-referrer"
        onError={onError}
      />
      <a href={url} target="_blank" rel="noreferrer">
        Abrir PDF en una pestaña nueva
      </a>
    </>
  }

  return (
    <img
      className="cc-expense-receipt-preview__image"
      src={url}
      alt="Vista previa del justificante"
      referrerPolicy="no-referrer"
      onError={onError}
    />
  )
}
