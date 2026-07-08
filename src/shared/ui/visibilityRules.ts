export function hasMeaningfulCount(value: number) {
  return value > 0
}

export function hasMeaningfulAmount(value: number, threshold = 0.009) {
  return value > threshold
}

export function compactVisibleItems<T>(items: Array<T | false | null | undefined>) {
  return items.filter(Boolean) as T[]
}
