export const BUILD_INFO = {
  version: __APP_BUILD_VERSION__,
  commit: __APP_BUILD_COMMIT__,
  builtAt: __APP_BUILD_DATE__,
} as const

export function shouldShowBuildInfo() {
  return typeof window !== 'undefined' && window.location.search.includes('debugBuild=1')
}
