import { useEffect, useState } from 'react'

export function useShellViewportState() {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [compactMobileNav, setCompactMobileNav] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia('(max-width: 640px)')

    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches)
    }

    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)

    return () => {
      mediaQuery.removeEventListener('change', syncViewport)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0
      setShowScrollTop(scrollY > 360)
      setCompactMobileNav(scrollY > 96)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return {
    showScrollTop,
    compactMobileNav,
    isMobileViewport,
  }
}
