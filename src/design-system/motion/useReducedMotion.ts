import { useEffect, useState } from 'react'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function getInitialReducedMotionPreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialReducedMotionPreference)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)

    const syncPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    syncPreference()
    mediaQuery.addEventListener('change', syncPreference)

    return () => {
      mediaQuery.removeEventListener('change', syncPreference)
    }
  }, [])

  return prefersReducedMotion
}
