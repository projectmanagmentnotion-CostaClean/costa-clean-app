import { useEffect, useRef, type ReactNode } from 'react'
import { createScrollTriggerOnce, killScopedScrollTriggers, useReducedMotion } from '../../../design-system/motion'

interface HomeMotionSectionProps {
  children: ReactNode
  className?: string
}

export function HomeMotionSection({ children, className }: HomeMotionSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion) return undefined
    const scopeElement = sectionRef.current

    void createScrollTriggerOnce(scopeElement, {
      start: 'top 88%',
      y: 14,
    })

    return () => {
      void killScopedScrollTriggers(scopeElement)
    }
  }, [prefersReducedMotion])

  return (
    <section ref={sectionRef} className={className}>
      {children}
    </section>
  )
}
