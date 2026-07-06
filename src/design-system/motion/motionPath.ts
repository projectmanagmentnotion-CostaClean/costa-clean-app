import { gsap } from './gsap'
import { motionDurationSlow, motionEaseStandard, type MotionEase } from './motionPresets'
import { registerMotionPathPlugin } from './gsapPlugins'
import { getInitialReducedMotionPreference } from './useReducedMotion'

export interface MotionPathTweenOptions {
  align?: string | Element
  autoRotate?: boolean
  duration?: number
  ease?: MotionEase
  path: string | Element
}

export async function createMotionPathTween(target: gsap.TweenTarget, options: MotionPathTweenOptions) {
  if (getInitialReducedMotionPreference()) return null

  const resolution = await registerMotionPathPlugin()
  if (resolution.state !== 'available') return null

  return gsap.to(target, {
    duration: options.duration ?? motionDurationSlow,
    ease: options.ease ?? motionEaseStandard,
    motionPath: {
      align: options.align,
      autoRotate: options.autoRotate ?? false,
      path: options.path,
    },
  } as GSAPTweenVars)
}
