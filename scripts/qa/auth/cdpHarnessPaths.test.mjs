import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getQaPaths,
  matchesExpectedAppHtml,
  matchesExpectedAppTitle,
} from './cdpHarness.mjs'

describe('getQaPaths auth namespace', () => {
  it('keeps the existing default auth paths', () => {
    const previous = process.env.QA_AUTH_NAMESPACE
    delete process.env.QA_AUTH_NAMESPACE

    try {
      const paths = getQaPaths('C:/qa-root')
      expect(paths.authDir).toBe(path.resolve('C:/qa-root', '.auth'))
      expect(paths.profileDir).toBe(path.resolve('C:/qa-root', '.auth', 'qa-browser-profile'))
    } finally {
      if (previous === undefined) delete process.env.QA_AUTH_NAMESPACE
      else process.env.QA_AUTH_NAMESPACE = previous
    }
  })

  it('isolates sandbox auth metadata and profile', () => {
    const previous = process.env.QA_AUTH_NAMESPACE
    process.env.QA_AUTH_NAMESPACE = 'sandbox'

    try {
      const paths = getQaPaths('C:/qa-root')
      expect(paths.authDir).toBe(path.resolve('C:/qa-root', '.auth', 'sandbox'))
      expect(paths.stateFile).toBe(path.resolve('C:/qa-root', '.auth', 'sandbox', 'costa-clean-storage-state.json'))
      expect(paths.profileDir).toBe(path.resolve('C:/qa-root', '.auth', 'sandbox', 'qa-browser-profile'))
    } finally {
      if (previous === undefined) delete process.env.QA_AUTH_NAMESPACE
      else process.env.QA_AUTH_NAMESPACE = previous
    }
  })
})

describe('Costa Clean QA target identity', () => {
  it('accepts the Costa Clean title and rejects another local Vite app', () => {
    expect(matchesExpectedAppTitle('CostaClean CRM | Gestion')).toBe(true)
    expect(matchesExpectedAppHtml('<title>CostaClean CRM | Gestion</title>')).toBe(true)
    expect(matchesExpectedAppHtml('<title>Malcriado</title>')).toBe(false)
  })
})
