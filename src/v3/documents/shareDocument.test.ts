import { describe, expect, it } from 'vitest'
import { buildShareDocumentPayload, canShareDocumentFile } from './shareDocument'

describe('shareDocument payload', () => {
  it('creates an application/pdf File without external upload', () => {
    const payload = buildShareDocumentPayload({ blob: new Blob(['%PDF-'], { type: 'application/pdf' }), filename: 'presupuesto.pdf', title: 'Presupuesto' })
    expect(payload?.file.name).toBe('presupuesto.pdf')
    expect(payload?.file.type).toBe('application/pdf')
    expect(payload?.title).toBe('Presupuesto')
  })

  it('rejects invalid documents before share', () => {
    expect(buildShareDocumentPayload({ blob: new Blob(['x'], { type: 'text/plain' }), filename: 'bad.txt', title: 'Bad' })).toBeNull()
  })

  it('detects native file sharing support and safe fallback capability', () => {
    const file = buildShareDocumentPayload({ blob: new Blob(['%PDF-'], { type: 'application/pdf' }), filename: 'presupuesto.pdf', title: 'Presupuesto' })!.file
    const originalNavigator = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share: () => undefined, canShare: () => true } })
    expect(canShareDocumentFile(file)).toBe(true)
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share: undefined } })
    expect(canShareDocumentFile(file)).toBe(false)
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
  })
})
