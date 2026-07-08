import { DSPageLoading } from './DSPageLoading'

interface DSLoadingStateProps {
  title: string
  description: string
}

export function DSLoadingState({ title, description }: DSLoadingStateProps) {
  return <DSPageLoading title={title} description={description} mode="inline" rows={1} />
}
