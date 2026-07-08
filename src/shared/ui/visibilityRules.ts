export function hasMeaningfulCount(value: number) {
  return value > 0
}

export function hasMeaningfulAmount(value: number, threshold = 0.009) {
  return value > threshold
}

interface OperationalVisibilityOptions {
  positiveValue?: number | null | undefined
  hasSpecificAction?: boolean
  resolvesImmediateDecision?: boolean
}

export function shouldRenderOperationalBlock({
  positiveValue,
  hasSpecificAction = false,
  resolvesImmediateDecision = false,
}: OperationalVisibilityOptions) {
  return hasMeaningfulCount(Number(positiveValue ?? 0)) || hasSpecificAction || resolvesImmediateDecision
}

export function compactVisibleItems<T>(items: Array<T | false | null | undefined>) {
  return items.filter(Boolean) as T[]
}
