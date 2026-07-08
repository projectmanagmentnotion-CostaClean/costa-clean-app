import { DSPageLoading } from '../design-system/components/DSPageLoading'

interface DeferredContentFallbackProps {
  title: string
  description: string
}

export function DeferredContentFallback({
  title,
  description,
}: DeferredContentFallbackProps) {
  return <DSPageLoading title={title} description={description} mode="inline" rows={1} />
}
