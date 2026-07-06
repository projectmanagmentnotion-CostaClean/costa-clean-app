export { ensureGsapRegistration, gsap, registerGsapPlugins, useGSAP } from './gsap'
export {
  createMotionPreset,
  getReducedMotionSetVars,
  motionDurationBase,
  motionDurationFast,
  motionDurationSlow,
  motionEaseEmphasized,
  motionEaseExit,
  motionEaseStandard,
  motionPresets,
  type MotionPresetDefinition,
  type MotionPresetName,
  type MotionPresetOverrides,
  type MotionTarget,
} from './motionPresets'
export { useGsapEntrance, type UseGsapEntranceOptions } from './useGsapEntrance'
export { getInitialReducedMotionPreference, REDUCED_MOTION_QUERY, useReducedMotion } from './useReducedMotion'
