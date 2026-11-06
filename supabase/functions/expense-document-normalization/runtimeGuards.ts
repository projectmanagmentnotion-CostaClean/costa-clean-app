export const QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCT_PROJECT_REF = 'wfxnwfcdjainpojhbdri'
export const SERVER_RUNTIME_ENV = 'N53_SERVER_RUNTIME_MODE'

export function isQaRuntimeConfigured(url: string, mode: string): boolean {
  try { return new URL(url).hostname.split('.')[0] === QA_PROJECT_REF && mode === 'qa-runtime' } catch { return false }
}

export function isProductRuntimeConfigured(url: string, mode: string): boolean {
  try { return new URL(url).hostname.split('.')[0] === PRODUCT_PROJECT_REF && mode === 'production' } catch { return false }
}

export function isServerRuntimeConfigured(url: string, mode: string): boolean {
  return isQaRuntimeConfigured(url, mode) || isProductRuntimeConfigured(url, mode)
}

export function isNormalizationRuntimeReady(url: string, mode: string, publishableKey: string, serviceRoleKey: string): boolean {
  return isServerRuntimeConfigured(url, mode) && publishableKey.length > 0 && serviceRoleKey.length > 0
}
