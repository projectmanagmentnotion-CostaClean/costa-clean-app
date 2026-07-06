import { motionDurationBase, motionEaseEmphasized, type MotionEase } from './motionPresets'
import { registerFlipPlugin } from './gsapPlugins'
import { getInitialReducedMotionPreference } from './useReducedMotion'

interface FlipLike {
  from: (state: unknown, vars?: Record<string, unknown>) => unknown
  getState: (targets: GSAPTweenTarget) => unknown
}

export interface FlipTransitionOptions {
  absolute?: boolean
  duration?: number
  ease?: MotionEase
  maxItems?: number
}

function normalizeTargets(targets: GSAPTweenTarget) {
  if (targets instanceof Element) return [targets]
  if (Array.isArray(targets)) return targets.flatMap((item) => (item instanceof Element ? [item] : []))
  return []
}

async function getFlipPlugin(): Promise<FlipLike | null> {
  const resolution = await registerFlipPlugin()
  if (resolution.state !== 'available' || !resolution.plugin) {
    return null
  }

  return resolution.plugin as FlipLike
}

export async function captureFlipState(targets: GSAPTweenTarget) {
  const Flip = await getFlipPlugin()
  if (!Flip) return null

  const elements = normalizeTargets(targets)
  if (elements.length === 0) return null

  return Flip.getState(elements)
}

export async function runFlipTransition(targets: GSAPTweenTarget, options: FlipTransitionOptions = {}) {
  if (getInitialReducedMotionPreference()) return null

  const Flip = await getFlipPlugin()
  if (!Flip) return null

  const elements = normalizeTargets(targets)
  if (elements.length === 0 || elements.length > (options.maxItems ?? 24)) {
    return null
  }

  const state = Flip.getState(elements)

  return Flip.from(state, {
    absolute: options.absolute ?? false,
    duration: options.duration ?? motionDurationBase,
    ease: options.ease ?? motionEaseEmphasized,
  })
}
