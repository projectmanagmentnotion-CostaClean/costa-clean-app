import { gsap } from './gsap'
import { motionDurationFast, motionEaseStandard, type MotionEase } from './motionPresets'
import { registerTextPlugins } from './gsapPlugins'
import { getInitialReducedMotionPreference } from './useReducedMotion'

interface SplitTextLike {
  chars?: Element[]
  lines?: Element[]
  revert: () => void
  words?: Element[]
}

interface SplitTextFallback {
  revert: () => void
  words: Element[]
}

export interface SplitHeadlineOptions {
  delay?: number
  duration?: number
  ease?: MotionEase
  maxCharacters?: number
  type?: string
}

function isUnsafeTextTarget(element: HTMLElement) {
  return Boolean(element.closest('form, [data-critical-motion="true"]'))
}

function createWordFallback(element: HTMLElement) {
  const originalText = element.textContent ?? ''
  const words = originalText
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const span = document.createElement('span')
      span.textContent = `${word} `
      span.style.display = 'inline-block'
      return span
    })

  element.dataset.motionOriginalText = originalText
  element.textContent = ''
  words.forEach((word) => element.appendChild(word))

  return {
    revert() {
      element.textContent = originalText
      delete element.dataset.motionOriginalText
    },
    words,
  }
}

export async function splitHeadlineText(element: HTMLElement, options: SplitHeadlineOptions = {}) {
  if (isUnsafeTextTarget(element)) return null
  if ((element.textContent ?? '').length > (options.maxCharacters ?? 120)) return null

  const textPlugins = await registerTextPlugins()
  if (textPlugins.splitText.state !== 'available' || !textPlugins.splitText.plugin) {
    return createWordFallback(element)
  }

  const SplitText = textPlugins.splitText.plugin as new (target: Element, vars?: Record<string, unknown>) => SplitTextLike
  return new SplitText(element, { type: options.type ?? 'lines,words' })
}

export async function animateSplitHeadline(element: HTMLElement, options: SplitHeadlineOptions = {}) {
  if (getInitialReducedMotionPreference()) return null

  const splitResult = await splitHeadlineText(element, options)
  if (!splitResult) return null

  const targets =
    ('lines' in splitResult && splitResult.lines?.length
      ? splitResult.lines
      : 'words' in splitResult && splitResult.words?.length
        ? splitResult.words
        : 'chars' in splitResult
          ? splitResult.chars ?? []
          : []) satisfies Element[]
  if (targets.length === 0) return null

  return gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 10 },
    {
      autoAlpha: 1,
      clearProps: 'opacity,transform',
      delay: options.delay ?? 0,
      duration: options.duration ?? motionDurationFast,
      ease: options.ease ?? motionEaseStandard,
      stagger: 0.03,
      y: 0,
    },
  )
}

export function revertSplitHeadline(splitResult: SplitTextLike | SplitTextFallback | null | undefined) {
  splitResult?.revert()
}
