import {
  useRef,
  type PropsWithChildren,
} from 'react'
import { gsap, useGSAP } from '../design-system/motion/gsap'
import { useReducedMotion } from '../design-system/motion/useReducedMotion'

interface PortalMotionSurfaceProps extends PropsWithChildren {
  stateKey: string
}

export function PortalMotionSurface({
  children,
  stateKey,
}: PortalMotionSurfaceProps) {
  const scopeRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const previewReducedMotion =
    import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('portalReducedMotion') === '1'

  useGSAP(() => {
    const target = scopeRef.current
    if (!target) return

    if (prefersReducedMotion || previewReducedMotion) {
      gsap.set(target, { clearProps: 'transform', y: 0 })
      return
    }

    try {
      gsap.fromTo(
        target,
        { y: 6 },
        {
          clearProps: 'transform',
          duration: 0.24,
          ease: 'power2.out',
          y: 0,
        },
      )
    } catch {
      target.style.removeProperty('transform')
    }
  }, {
    dependencies: [prefersReducedMotion, previewReducedMotion, stateKey],
    revertOnUpdate: true,
    scope: scopeRef,
  })

  return (
    <div
      ref={scopeRef}
      className="portal-motion-surface"
    >
      {children}
    </div>
  )
}
