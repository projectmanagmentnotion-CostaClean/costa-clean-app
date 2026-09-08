import { useSyncExternalStore } from 'react'

function readV3Flag(): boolean {
  if (typeof window === 'undefined') return false
  return new URL(window.location.href).searchParams.get('v3') === '1'
}

function subscribeToLocation(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

export function useV3FeatureFlag(): boolean {
  return useSyncExternalStore(subscribeToLocation, readV3Flag, () => false)
}

export function isV3FeatureFlagEnabled(search: string): boolean {
  return new URLSearchParams(search).get('v3') === '1'
}
