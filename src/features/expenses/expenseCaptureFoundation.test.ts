import { describe, expect, it } from 'vitest'
import { buildExpenseCaptureStoragePath, EXPENSE_CAPTURE_MAX_BYTES, EXPENSE_CAPTURE_MIME_TYPES, sha256File, transitionExpenseCaptureState, validateExpenseCaptureFile } from './expenseCaptureFoundation'

describe('N5.1 capture foundation', () => {
  it('accepts the supported private-document contract only', () => {
    expect(EXPENSE_CAPTURE_MIME_TYPES).toEqual(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    expect(validateExpenseCaptureFile({ name: 'ticket.png', type: 'image/png', size: 1 })).toBeNull()
    expect(validateExpenseCaptureFile({ name: 'ticket.exe', type: 'application/octet-stream', size: 1 })).toContain('PDF')
    expect(validateExpenseCaptureFile({ name: 'ticket.png', type: 'image/png', size: 0 })).toContain('vacío')
    expect(validateExpenseCaptureFile({ name: 'ticket.png', type: 'image/png', size: EXPENSE_CAPTURE_MAX_BYTES + 1 })).toContain('10 MB')
    expect(validateExpenseCaptureFile({ name: '../ticket.png', type: 'image/png', size: 1 })).toContain('nombre')
    expect(validateExpenseCaptureFile({ name: 'folder/ticket.png', type: 'image/png', size: 1 })).toContain('nombre')
  })

  it('uses a deterministic safe path that contains no user filename', () => {
    const path = buildExpenseCaptureStoragePath('11111111-1111-4111-8111-111111111111', 'a'.repeat(64))
    expect(path).toBe(`captures/11111111-1111-4111-8111-111111111111/${'a'.repeat(64)}`)
    expect(() => buildExpenseCaptureStoragePath('bad', 'a'.repeat(64))).toThrow()
  })

  it('hashes bytes and guards illegal state transitions', async () => {
    const file = { arrayBuffer: async () => new TextEncoder().encode('Costa Clean').buffer } as File
    expect(await sha256File(file)).toBe('54344858c49c2f82bb90ef3c57bfe25ce8f4adb87fd7bc0c7109277a172ac0ee')
    expect(transitionExpenseCaptureState('IDLE', 'SELECTING')).toBe('SELECTING')
    expect(() => transitionExpenseCaptureState('READY_FOR_REVIEW', 'UPLOADING')).toThrow()
  })
})
