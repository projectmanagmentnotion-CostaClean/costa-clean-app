import { useSyncExternalStore } from 'react'

function readV3Flag(): boolean {
  if (typeof window === 'undefined') return true
  return isV3FeatureFlagEnabled(window.location.search)
}

function subscribeToLocation(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

export function useV3FeatureFlag(): boolean {
  return useSyncExternalStore(subscribeToLocation, readV3Flag, () => true)
}

export function isV3FeatureFlagEnabled(search: string): boolean {
  return new URLSearchParams(search).get('v2') !== '1'
}
