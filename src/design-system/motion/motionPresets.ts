export type MotionEase = string

export const motionDurationFast = 0.18
export const motionDurationBase = 0.28
export const motionDurationSlow = 0.42

export const motionEaseStandard: MotionEase = 'power2.out'
export const motionEaseExit: MotionEase = 'power2.in'
export const motionEaseEmphasized: MotionEase = 'power3.out'

export interface MotionPresetOverrides {
  autoAlpha?: number
  clearProps?: string
  delay?: number
  duration?: number
  ease?: MotionEase
  scale?: number
  stagger?: number | GSAPStaggerVars
  x?: number
  y?: number
}

export interface MotionPresetDefinition {
  from: GSAPTweenVars
  reducedMotionTo: GSAPTweenVars
  to: GSAPTweenVars
}

export type MotionPresetName =
  | 'fadeIn'
  | 'fadeUp'
  | 'scaleIn'
  | 'softReveal'
  | 'listStagger'
  | 'stepTransition'
  | 'sheetEnter'
  | 'modalEnter'

function buildReducedMotionTo(clearProps: string | undefined): GSAPTweenVars {
  return {
    autoAlpha: 1,
    clearProps,
    duration: 0.01,
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
  }
}

export function createMotionPreset(
  presetName: MotionPresetName,
  overrides: MotionPresetOverrides = {},
): MotionPresetDefinition {
  const clearProps = overrides.clearProps ?? 'opacity,transform'

  switch (presetName) {
    case 'fadeIn':
      return {
        from: { autoAlpha: 0 },
        reducedMotionTo: buildReducedMotionTo(clearProps),
        to: {
          autoAlpha: 1,
          clearProps,
          delay: overrides.delay ?? 0,
          duration: overrides.duration ?? motionDurationFast,
          ease: overrides.ease ?? motionEaseStandard,
        },
      }

    case 'fadeUp':
      return {
        from: { autoAlpha: 0, y: overrides.y ?? 14 },
        reducedMotionTo: buildReducedMotionTo(clearProps),
        to: {
          autoAlpha: 1,
          clearProps,
          delay: overrides.delay ?? 0,
          duration: overrides.duration ?? motionDurationBase,
          ease: overrides.ease ?? motionEaseStandard,
          y: 0,
        },
      }

    case 'scaleIn':
      return {
        from: { autoAlpha: 0, scale: overrides.scale ?? 0.98 },
        reducedMotionTo: buildReducedMotionTo(clearProps),
        to: {
          autoAlpha: 1,
          clearProps,
          delay: overrides.delay ?? 0,
          duration: overrides.duration ?? motionDurationBase,
          ease: overrides.ease ?? motionEaseEmphasized,
          scale: 1,
        },
      }

    case 'softReveal':
      return {
        from: { autoAlpha: 0, y: overrides.y ?? 8 },
        reducedMotionTo: buildReducedMotionTo(clearProps),
        to: {
          autoAlpha: 1,
          clearProps,
          delay: overrides.delay ?? 0,
          duration: overrides.duration ?? motionDurationBase,
          ease: overrides.ease ?? motionEaseStandard,
          y: 0,
        },
      }

    case 'listStagger':
      return {
        from: { autoAlpha: 0, y: overrides.y ?? 10 },
        reducedMotionTo: buildReducedMotionTo(clearProps),
        to: {
          autoAlpha: 1,
          clearProps,
          delay: overrides.delay ?? 0,
          duration: overrides.duration ?? motionDurationFast,
          ease: overrides.ease ?? motionEaseStandard,
          stagger: overrides.stagger ?? 0.04,
          y: 0,
        },
      }

    case 'stepTransition':
      return {
        from: { autoAlpha: 0, x: overrides.x ?? 16 },
        reducedMotionTo: buildReducedMotionTo(clearProps),
        to: {
          autoAlpha: 1,
          clearProps,
          delay: overrides.delay ?? 0,
          duration: overrides.duration ?? motionDurationBase,
          ease: overrides.ease ?? motionEaseEmphasized,
          x: 0,
        },
      }

    case 'sheetEnter':
      return {
        from: { autoAlpha: 0, y: overrides.y ?? 22 },
        reducedMotionTo: buildReducedMotionTo(clearProps),
        to: {
          autoAlpha: 1,
          clearProps,
          delay: overrides.delay ?? 0,
          duration: overrides.duration ?? motionDurationBase,
          ease: overrides.ease ?? motionEaseEmphasized,
          y: 0,
        },
      }

    case 'modalEnter':
      return {
        from: { autoAlpha: 0, scale: overrides.scale ?? 0.96, y: overrides.y ?? 10 },
        reducedMotionTo: buildReducedMotionTo(clearProps),
        to: {
          autoAlpha: 1,
          clearProps,
          delay: overrides.delay ?? 0,
          duration: overrides.duration ?? motionDurationBase,
          ease: overrides.ease ?? motionEaseEmphasized,
          scale: 1,
          y: 0,
        },
      }
  }
}

export const motionPresets: Record<MotionPresetName, MotionPresetDefinition> = {
  fadeIn: createMotionPreset('fadeIn'),
  fadeUp: createMotionPreset('fadeUp'),
  listStagger: createMotionPreset('listStagger'),
  modalEnter: createMotionPreset('modalEnter'),
  scaleIn: createMotionPreset('scaleIn'),
  sheetEnter: createMotionPreset('sheetEnter'),
  softReveal: createMotionPreset('softReveal'),
  stepTransition: createMotionPreset('stepTransition'),
}

export function getReducedMotionSetVars(overrides: MotionPresetOverrides = {}) {
  return buildReducedMotionTo(overrides.clearProps ?? 'opacity,transform')
}

export type MotionTarget = GSAPTweenTarget
