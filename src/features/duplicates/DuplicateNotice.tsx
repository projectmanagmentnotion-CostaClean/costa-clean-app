interface DuplicateNoticeProps {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export function DuplicateNotice({
  title,
  description,
  actionLabel,
  onAction,
}: DuplicateNoticeProps) {
  return (
    <div className="cc-duplicate-review__notice">
      <strong>{title}</strong>
      <p>{description}</p>
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
