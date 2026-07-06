import { useRef, type RefObject } from 'react'
import { gsap, useGSAP } from './gsap'
import {
  createMotionPreset,
  getReducedMotionSetVars,
  type MotionPresetName,
  type MotionPresetOverrides,
  type MotionTarget,
} from './motionPresets'
import { useReducedMotion } from './useReducedMotion'

type MotionScope = RefObject<HTMLElement | null> | Element | string | null | undefined

function isRefObject(scope: MotionScope): scope is RefObject<HTMLElement | null> {
  return typeof scope === 'object' && scope !== null && 'current' in scope
}

function resolveTarget(scope: MotionScope, target: MotionTarget | undefined, fallbackScope: RefObject<HTMLElement | null>) {
  if (target) return target
  if (isRefObject(scope)) return scope.current
  if (scope) return scope
  return fallbackScope.current
}

export interface UseGsapEntranceOptions {
  dependencies?: readonly unknown[]
  disabled?: boolean
  onReducedMotion?: 'set' | 'skip'
  overrides?: MotionPresetOverrides
  preset?: MotionPresetName
  revertOnUpdate?: boolean
  scope?: MotionScope
  target?: MotionTarget
}

export function useGsapEntrance({
  dependencies = [],
  disabled = false,
  onReducedMotion = 'set',
  overrides,
  preset = 'fadeUp',
  revertOnUpdate = true,
  scope,
  target,
}: UseGsapEntranceOptions = {}) {
  const localScopeRef = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const animationScope = scope ?? localScopeRef
  const presetDefinition = createMotionPreset(preset, overrides)

  const gsapResult = useGSAP(
    () => {
      if (disabled) return

      const resolvedTarget = resolveTarget(scope, target, localScopeRef)
      if (!resolvedTarget) return

      if (prefersReducedMotion) {
        if (onReducedMotion === 'set') {
          gsap.set(resolvedTarget, getReducedMotionSetVars(overrides))
        }
        return
      }

      gsap.fromTo(resolvedTarget, presetDefinition.from, presetDefinition.to)
    },
    {
      dependencies: [disabled, onReducedMotion, prefersReducedMotion, preset, ...dependencies],
      revertOnUpdate,
      scope: animationScope,
    },
  )

  return {
    context: gsapResult.context,
    contextSafe: gsapResult.contextSafe,
    prefersReducedMotion,
    scopeRef: localScopeRef,
  }
}
