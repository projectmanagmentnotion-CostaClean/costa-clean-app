import { gsap } from './gsap'
import { motionDurationBase, motionEaseStandard, type MotionEase } from './motionPresets'
import { registerSvgPlugins } from './gsapPlugins'
import { getInitialReducedMotionPreference } from './useReducedMotion'

export interface DrawSvgOptions {
  delay?: number
  drawFrom?: string
  drawTo?: string
  duration?: number
  ease?: MotionEase
}

function canMeasureSvgPath(path: SVGGeometryElement) {
  return typeof path.getTotalLength === 'function'
}

export function prepareSvgPathDraw(path: SVGGeometryElement) {
  if (!canMeasureSvgPath(path)) return

  const totalLength = path.getTotalLength()
  path.style.strokeDasharray = `${totalLength}`
  path.style.strokeDashoffset = `${totalLength}`
  path.style.visibility = 'visible'
}

export function resetSvgPath(path: SVGGeometryElement) {
  path.style.strokeDasharray = ''
  path.style.strokeDashoffset = ''
  path.style.visibility = ''
}

export async function drawSvgPath(path: SVGGeometryElement, options: DrawSvgOptions = {}) {
  if (getInitialReducedMotionPreference()) {
    resetSvgPath(path)
    return null
  }

  const drawResolution = await registerSvgPlugins()
  if (drawResolution.drawSvg.state === 'available') {
    return gsap.fromTo(
      path,
      { drawSVG: options.drawFrom ?? '0%' } as GSAPTweenVars,
      {
        delay: options.delay ?? 0,
        drawSVG: options.drawTo ?? '100%',
        duration: options.duration ?? motionDurationBase,
        ease: options.ease ?? motionEaseStandard,
      } as GSAPTweenVars,
    )
  }

  if (!canMeasureSvgPath(path)) return null

  prepareSvgPathDraw(path)

  return gsap.to(path, {
    delay: options.delay ?? 0,
    duration: options.duration ?? motionDurationBase,
    ease: options.ease ?? motionEaseStandard,
    strokeDashoffset: 0,
  })
}
