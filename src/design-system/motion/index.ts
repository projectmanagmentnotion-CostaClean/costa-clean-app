export { ensureGsapRegistration, gsap, registerGsapPlugins, useGSAP } from './gsap'
export {
  approvedGsapPlugins,
  getDisabledGsapPlugins,
  loadGsapPlugin,
  registerFlipPlugin,
  registerInteractionPlugins,
  registerMorphSvgPlugin,
  registerMotionPathPlugin,
  registerScrollToPlugin,
  registerScrollTrigger,
  registerSvgPlugins,
  registerTextPlugins,
  type GsapPluginName,
  type GsapPluginResolution,
  type GsapPluginState,
} from './gsapPlugins'
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
export {
  captureFlipState,
  runFlipTransition,
  type FlipTransitionOptions,
} from './flipMotion'
export {
  createMotionPathTween,
  type MotionPathTweenOptions,
} from './motionPath'
export {
  getGsapPluginAvailability,
  type GsapPluginAvailabilitySummary,
} from './pluginAvailability'
export {
  createScrollReveal,
  createScrollRevealFallback,
  createScrollTriggerOnce,
  killScopedScrollTriggers,
  refreshScrollTriggers,
  registerScrollTriggerHelpers,
  type ScrollRevealOptions,
} from './scrollTrigger'
export {
  animateSplitHeadline,
  revertSplitHeadline,
  splitHeadlineText,
  type SplitHeadlineOptions,
} from './textMotion'
export { useGsapEntrance, type UseGsapEntranceOptions } from './useGsapEntrance'
export { getInitialReducedMotionPreference, REDUCED_MOTION_QUERY, useReducedMotion } from './useReducedMotion'
export {
  drawSvgPath,
  prepareSvgPathDraw,
  resetSvgPath,
  type DrawSvgOptions,
} from './svgDraw'
