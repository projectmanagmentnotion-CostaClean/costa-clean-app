import { gsap, registerGsapPlugins } from './gsap'

export type GsapPluginName =
  | 'ScrollTrigger'
  | 'DrawSVGPlugin'
  | 'MorphSVGPlugin'
  | 'SplitText'
  | 'Flip'
  | 'ScrollToPlugin'
  | 'MotionPathPlugin'
  | 'Observer'
  | 'Draggable'
  | 'ScrollSmoother'
  | 'InertiaPlugin'
  | 'Physics2DPlugin'
  | 'PhysicsPropsPlugin'
  | 'PixiPlugin'
  | 'EaselPlugin'
  | 'GSDevTools'
  | 'ScrambleTextPlugin'
  | 'TextPlugin'

export type GsapPluginState = 'available' | 'notAvailable' | 'disabledByPolicy'

export interface GsapPluginResolution<T = unknown> {
  name: GsapPluginName
  plugin: T | null
  reason?: string
  state: GsapPluginState
}

type PluginLoader = () => Promise<unknown>

const disabledByPolicyPlugins: Record<Exclude<GsapPluginName,
  'ScrollTrigger' | 'DrawSVGPlugin' | 'MorphSVGPlugin' | 'SplitText' | 'Flip' | 'ScrollToPlugin' | 'MotionPathPlugin' | 'Observer' | 'Draggable'
>, string> = {
  EaselPlugin: 'Pospuesto por politica: fuera del scope actual.',
  GSDevTools: 'Pospuesto por politica: herramienta de debug, no runtime productivo.',
  InertiaPlugin: 'Pospuesto por politica: no necesario en esta fase.',
  Physics2DPlugin: 'Pospuesto por politica: no necesario en esta fase.',
  PhysicsPropsPlugin: 'Pospuesto por politica: no necesario en esta fase.',
  PixiPlugin: 'Pospuesto por politica: no necesario en esta fase.',
  ScrambleTextPlugin: 'Pospuesto por politica: decorativo para la app actual.',
  ScrollSmoother: 'Pospuesto por politica: no permitido sin sprint especifico.',
  TextPlugin: 'Pospuesto por politica: evitar motion textual decorativo en esta fase.',
}

const pluginLoaders: Partial<Record<GsapPluginName, PluginLoader>> = {
  Draggable: async () => (await import('gsap/Draggable')).Draggable,
  DrawSVGPlugin: async () => (await import('gsap/DrawSVGPlugin')).DrawSVGPlugin,
  Flip: async () => (await import('gsap/Flip')).Flip,
  MorphSVGPlugin: async () => (await import('gsap/MorphSVGPlugin')).MorphSVGPlugin,
  MotionPathPlugin: async () => (await import('gsap/MotionPathPlugin')).MotionPathPlugin,
  Observer: async () => (await import('gsap/Observer')).Observer,
  ScrollToPlugin: async () => (await import('gsap/ScrollToPlugin')).ScrollToPlugin,
  ScrollTrigger: async () => (await import('gsap/ScrollTrigger')).ScrollTrigger,
  SplitText: async () => (await import('gsap/SplitText')).SplitText,
}

const pluginCache = new Map<GsapPluginName, Promise<GsapPluginResolution>>()
const registeredPlugins = new Set<GsapPluginName>()

async function resolvePlugin(name: GsapPluginName): Promise<GsapPluginResolution> {
  const disabledReason = disabledByPolicyPlugins[name as keyof typeof disabledByPolicyPlugins]
  if (disabledReason) {
    return {
      name,
      plugin: null,
      reason: disabledReason,
      state: 'disabledByPolicy',
    }
  }

  const loader = pluginLoaders[name]
  if (!loader) {
    return {
      name,
      plugin: null,
      reason: 'No existe loader registrado para este plugin.',
      state: 'notAvailable',
    }
  }

  try {
    const plugin = await loader()
    if (!plugin) {
      return {
        name,
        plugin: null,
        reason: 'El modulo se resolvio, pero no expuso el plugin esperado.',
        state: 'notAvailable',
      }
    }

    return {
      name,
      plugin,
      state: 'available',
    }
  } catch (error) {
    return {
      name,
      plugin: null,
      reason: error instanceof Error ? error.message : 'Error desconocido cargando plugin.',
      state: 'notAvailable',
    }
  }
}

export function loadGsapPlugin(name: GsapPluginName): Promise<GsapPluginResolution> {
  const cached = pluginCache.get(name)
  if (cached) return cached

  const resolution = resolvePlugin(name)
  pluginCache.set(name, resolution)
  return resolution
}

async function registerPluginByName(name: GsapPluginName) {
  const resolution = await loadGsapPlugin(name)
  if (resolution.state !== 'available' || !resolution.plugin) {
    return resolution
  }

  if (!registeredPlugins.has(name)) {
    registerGsapPlugins(resolution.plugin as Parameters<typeof gsap.registerPlugin>[number])
    registeredPlugins.add(name)
  }

  return resolution
}

export async function registerScrollTrigger() {
  return registerPluginByName('ScrollTrigger')
}

export async function registerSvgPlugins() {
  const results = await Promise.all([
    registerPluginByName('DrawSVGPlugin'),
    registerPluginByName('MorphSVGPlugin'),
  ])

  return {
    drawSvg: results[0],
    morphSvg: results[1],
  }
}

export async function registerTextPlugins() {
  return {
    splitText: await registerPluginByName('SplitText'),
  }
}

export async function registerFlipPlugin() {
  return registerPluginByName('Flip')
}

export async function registerMotionPathPlugin() {
  return registerPluginByName('MotionPathPlugin')
}

export async function registerScrollToPlugin() {
  return registerPluginByName('ScrollToPlugin')
}

export async function registerInteractionPlugins() {
  const results = await Promise.all([
    registerPluginByName('Observer'),
    registerPluginByName('Draggable'),
  ])

  return {
    draggable: results[1],
    observer: results[0],
  }
}

export async function registerMorphSvgPlugin() {
  return registerPluginByName('MorphSVGPlugin')
}

export function getDisabledGsapPlugins() {
  return Object.keys(disabledByPolicyPlugins) as Array<keyof typeof disabledByPolicyPlugins>
}

export const approvedGsapPlugins: GsapPluginName[] = [
  'ScrollTrigger',
  'DrawSVGPlugin',
  'MorphSVGPlugin',
  'SplitText',
  'Flip',
  'ScrollToPlugin',
  'MotionPathPlugin',
  'Observer',
  'Draggable',
]
