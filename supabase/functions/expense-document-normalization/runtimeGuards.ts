export const QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const SERVER_RUNTIME_ENV = 'N53_SERVER_RUNTIME_MODE'

export function isQaRuntimeConfigured(url: string, mode: string): boolean {
  try { return new URL(url).hostname.split('.')[0] === QA_PROJECT_REF && mode === 'qa-runtime' } catch { return false }
}
