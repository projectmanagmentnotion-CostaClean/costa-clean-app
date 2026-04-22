import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

const MOBILE_BREAKPOINT_QUERY = '(max-width: 640px)'
const MOBILE_THUMBNAIL_WIDTH_PERCENT = 280

interface DocumentThumbnailProps {
  className?: string
  children: ReactNode
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function DocumentThumbnail({ className, children }: DocumentThumbnailProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const documentRef = useRef<HTMLDivElement | null>(null)
  const [thumbnailHeight, setThumbnailHeight] = useState<number | null>(null)
  const [thumbnailScale, setThumbnailScale] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY)
    let frameId = 0

    const updateMeasurements = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        if (!mediaQuery.matches) {
          setThumbnailHeight((current) => (current === null ? current : null))
          setThumbnailScale((current) => (current === null ? current : null))
          return
        }

        const canvasElement = canvasRef.current
        const documentElement = documentRef.current

        if (!canvasElement || !documentElement) return

        const canvasWidth = canvasElement.clientWidth
        const documentWidth = documentElement.offsetWidth
        const documentHeight = documentElement.offsetHeight

        if (!canvasWidth || !documentWidth || !documentHeight) return

        const nextScale = canvasWidth / documentWidth
        const nextHeight = Math.ceil(documentHeight * nextScale)

        setThumbnailScale((current) => (
          current !== null && Math.abs(current - nextScale) < 0.0005 ? current : nextScale
        ))
        setThumbnailHeight((current) => (current === nextHeight ? current : nextHeight))
      })
    }

    updateMeasurements()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateMeasurements())
      : null

    if (canvasRef.current) resizeObserver?.observe(canvasRef.current)
    if (documentRef.current) resizeObserver?.observe(documentRef.current)

    const handleViewportChange = () => updateMeasurements()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange)
    } else {
      mediaQuery.addListener(handleViewportChange)
    }

    window.addEventListener('resize', handleViewportChange)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', handleViewportChange)

      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleViewportChange)
      } else {
        mediaQuery.removeListener(handleViewportChange)
      }
    }
  }, [])

  const thumbnailStyle: CSSProperties & Record<string, string> = {
    '--cc-doc-thumb-width': `${MOBILE_THUMBNAIL_WIDTH_PERCENT}%`,
  }

  if (thumbnailHeight !== null) {
    thumbnailStyle.height = `${thumbnailHeight}px`
    thumbnailStyle['--cc-doc-thumb-height'] = `${thumbnailHeight}px`
  }

  if (thumbnailScale !== null) {
    thumbnailStyle['--cc-doc-thumb-scale'] = String(thumbnailScale)
  }

  return (
    <div className={joinClassNames('cc-doc-preview-panel__canvas', className)} ref={canvasRef}>
      <div className="cc-doc-preview-panel__thumbnail" style={thumbnailStyle}>
        <div className="cc-doc-preview-panel__thumbnail-doc" ref={documentRef}>
          {children}
        </div>
      </div>
    </div>
  )
}
