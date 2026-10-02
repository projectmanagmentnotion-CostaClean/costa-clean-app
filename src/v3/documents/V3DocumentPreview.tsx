import type { ReactNode } from 'react'
import { DocumentThumbnail } from '../../features/documents/DocumentThumbnail'
import { V3ErrorState, V3LoadingState, V3SecondaryAction, V3Status } from '../components/V3Primitives'

interface V3DocumentPreviewProps {
  documentKind: 'invoice' | 'quote'
  title: string
  description: string
  statusLabel: string
  statusTone: 'neutral' | 'success' | 'warning' | 'danger'
  error: string | null
  onOpenDocument: () => void
  children: ReactNode
}

export function V3DocumentPreview({ documentKind, title, description, statusLabel, statusTone, error, onOpenDocument, children }: V3DocumentPreviewProps) {
  return (
    <section className={`v3-document-preview v3-document-preview--${documentKind} cc-doc-preview-panel cc-doc-preview-panel--${documentKind}`} aria-labelledby={`v3-document-preview-title-${documentKind}`}>
      <div className="v3-document-preview__header">
        <div>
          <h2 id={`v3-document-preview-title-${documentKind}`}>{title}</h2>
          <p>{description}</p>
        </div>
        <V3Status label={statusLabel} tone={statusTone} />
      </div>
      <div className="v3-document-preview__actions">
        <V3SecondaryAction onClick={onOpenDocument}>Abrir documento</V3SecondaryAction>
      </div>
      <div className="v3-document-preview__viewport">
        <DocumentThumbnail className="v3-document-preview__canvas">
          {error ? <V3ErrorState title="No se pudo cargar la vista previa" description={error} /> : children}
        </DocumentThumbnail>
      </div>
      <p className="v3-document-preview__assistive">La miniatura usa el mismo documento A4 canónico que la salida PDF final.</p>
    </section>
  )
}

export function V3DocumentPreviewLoading({ label, description }: { label: string; description: string }) {
  return <V3LoadingState label={`${label}: ${description}`} />
}
