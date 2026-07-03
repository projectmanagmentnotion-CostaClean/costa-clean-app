import './design-system.css'

type DSSkeletonVariant = 'text' | 'title' | 'block'

interface DSSkeletonProps {
  width?: string
  height?: string
  variant?: DSSkeletonVariant
  className?: string
}

export function DSSkeleton({
  width,
  height,
  variant = 'text',
  className,
}: DSSkeletonProps) {
  return (
    <span
      className={['ds-skeleton', `ds-skeleton--${variant}`, className ?? ''].filter(Boolean).join(' ')}
      aria-hidden="true"
      style={{ width, height }}
    />
  )
}
