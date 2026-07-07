import { useEffect, useState } from 'react'

const DEFAULT_QUERY = '(max-width: 1024px)'

function readMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia(query).matches
}

export function useActionFlowOverlayMode(query = DEFAULT_QUERY): boolean {
  const [matches, setMatches] = useState(() => readMatches(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia(query)
    const syncMatches = () => setMatches(mediaQuery.matches)

    syncMatches()
    mediaQuery.addEventListener('change', syncMatches)

    return () => mediaQuery.removeEventListener('change', syncMatches)
  }, [query])

  return matches
}
