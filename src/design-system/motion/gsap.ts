import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

let gsapCoreRegistered = false

export function ensureGsapRegistration() {
  if (gsapCoreRegistered) return

  gsap.registerPlugin(useGSAP)
  gsapCoreRegistered = true
}

export function registerGsapPlugins(...plugins: Parameters<typeof gsap.registerPlugin>) {
  ensureGsapRegistration()
  gsap.registerPlugin(...plugins)
}

ensureGsapRegistration()

export { gsap, useGSAP }
