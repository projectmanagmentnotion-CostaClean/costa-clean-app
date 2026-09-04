export const vitePreloadRecoveryStorageKey = 'costaclean-vite-preload-recovery'

interface RecoveryWindow {
  addEventListener: Window['addEventListener']
  sessionStorage: Storage
  location: Location
}

export function clearVitePreloadRecovery(windowRef: RecoveryWindow = window) {
  try {
    windowRef.sessionStorage.removeItem(vitePreloadRecoveryStorageKey)
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function installVitePreloadRecovery(windowRef: RecoveryWindow = window) {
  windowRef.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()

    let recoveryAttempted = false
    try {
      recoveryAttempted = windowRef.sessionStorage.getItem(vitePreloadRecoveryStorageKey) === 'attempted'
    } catch {
      recoveryAttempted = true
    }

    if (recoveryAttempted) return

    try {
      windowRef.sessionStorage.setItem(vitePreloadRecoveryStorageKey, 'attempted')
    } catch {
      // Without storage, do not risk a reload loop.
      return
    }

    windowRef.location.reload()
  })
}
