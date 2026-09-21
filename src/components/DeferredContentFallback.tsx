import { DSPageLoading } from '../design-system/components/DSPageLoading'
import { V3LoadingState } from '../v3/components/V3Primitives'
import { isV3FeatureFlagEnabled } from '../v3/navigation/useV3FeatureFlag'

interface DeferredContentFallbackProps {
  title: string
  description: string
}

export function DeferredContentFallback({
  title,
  description,
}: DeferredContentFallbackProps) {
  const isV3Surface = typeof window !== 'undefined' && isV3FeatureFlagEnabled(window.location.search)

  if (isV3Surface) {
    return <V3LoadingState label={title} />
  }

  return <DSPageLoading title={title} description={description} mode="inline" rows={1} />
}
