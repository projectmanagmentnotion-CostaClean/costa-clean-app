import { DeferredContentFallback } from '../../components/DeferredContentFallback'

interface DSLoadingStateProps {
  title: string
  description: string
}

export function DSLoadingState({ title, description }: DSLoadingStateProps) {
  return <DeferredContentFallback title={title} description={description} />
}
