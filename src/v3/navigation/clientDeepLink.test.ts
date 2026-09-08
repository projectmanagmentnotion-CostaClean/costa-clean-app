import { describe, expect, it } from 'vitest'
import { readClientDeepLink } from './clientDeepLink'

describe('client deep link', () => {
  it('reads a valid client id and ignores blank values', () => {
    expect(readClientDeepLink('?v3=1&view=clients&client=abc')).toBe('abc')
    expect(readClientDeepLink('?v3=1&view=clients&client=')).toBeNull()
  })
})
