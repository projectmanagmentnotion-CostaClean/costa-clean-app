import { gsap } from './gsap'
import { motionDurationBase, motionDurationFast, motionEaseStandard, type MotionEase } from './motionPresets'
import { registerScrollTrigger } from './gsapPlugins'
import { getInitialReducedMotionPreference } from './useReducedMotion'

interface ScrollTriggerLike {
  create: (vars: Record<string, unknown>) => unknown
  getAll: () => Array<{ kill: () => void; trigger?: Element | null }>
  refresh: () => void
}

export interface ScrollRevealOptions {
  delay?: number
  duration?: number
  ease?: MotionEase
  once?: boolean
  pin?: boolean
  scrub?: boolean | number
  start?: string
  trigger?: Element | string
  x?: number
  y?: number
}

async function getScrollTriggerPlugin(): Promise<ScrollTriggerLike | null> {
  const resolution = await registerScrollTrigger()
  if (resolution.state !== 'available' || !resolution.plugin) {
    return null
  }

  return resolution.plugin as ScrollTriggerLike
}

function shouldSkipScrollMotion() {
  return typeof window === 'undefined' || getInitialReducedMotionPreference()
}

export async function createScrollReveal(target: gsap.TweenTarget, options: ScrollRevealOptions = {}) {
  if (shouldSkipScrollMotion()) return null

  const ScrollTrigger = await getScrollTriggerPlugin()
  if (!ScrollTrigger) return null

  const trigger = options.trigger ?? target
  const animation = gsap.fromTo(
    target,
    { autoAlpha: 0, x: options.x ?? 0, y: options.y ?? 18 },
    {
      autoAlpha: 1,
      clearProps: 'opacity,transform',
      delay: options.delay ?? 0,
      duration: options.duration ?? motionDurationBase,
      ease: options.ease ?? motionEaseStandard,
      paused: true,
      x: 0,
      y: 0,
    },
  )

  return ScrollTrigger.create({
    animation,
    once: options.once ?? true,
    pin: options.pin ?? false,
    scrub: options.scrub ?? false,
    start: options.start ?? 'top 86%',
    trigger,
  })
}

export async function createScrollTriggerOnce(target: gsap.TweenTarget, options: Omit<ScrollRevealOptions, 'once'> = {}) {
  return createScrollReveal(target, { ...options, once: true })
}

export async function refreshScrollTriggers() {
  const ScrollTrigger = await getScrollTriggerPlugin()
  ScrollTrigger?.refresh()
}

export async function killScopedScrollTriggers(scope: Element | null | undefined) {
  if (!scope) return

  const ScrollTrigger = await getScrollTriggerPlugin()
  if (!ScrollTrigger) return

  ScrollTrigger.getAll().forEach((trigger) => {
    if (trigger.trigger instanceof Element && scope.contains(trigger.trigger)) {
      trigger.kill()
    }
  })
}

export async function registerScrollTriggerHelpers() {
  return getScrollTriggerPlugin()
}

export function createScrollRevealFallback(target: gsap.TweenTarget) {
  return gsap.fromTo(target, { autoAlpha: 0 }, { autoAlpha: 1, duration: motionDurationFast, ease: motionEaseStandard })
}
