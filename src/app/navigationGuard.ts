export interface NavigationGuardOptions {
  title?: string
  description?: string
  confirmLabel?: string
}

export type NavigationGuard = (
  action: () => void,
  options?: NavigationGuardOptions,
) => void
