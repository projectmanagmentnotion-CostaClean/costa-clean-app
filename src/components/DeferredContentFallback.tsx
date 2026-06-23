interface DeferredContentFallbackProps {
  title: string
  description: string
}

export function DeferredContentFallback({
  title,
  description,
}: DeferredContentFallbackProps) {
  return (
    <div className="empty-state cc-state-card cc-state-card--loading">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}
