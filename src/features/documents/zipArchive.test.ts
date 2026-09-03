import { describe, expect, it } from 'vitest'
import { buildStoredZip, makeZipTextEntry } from './zipArchive'

describe('buildStoredZip', () => {
  it('creates a ZIP with local and central directory records', async () => {
    const bytes = new Uint8Array(await buildStoredZip([makeZipTextEntry('factura.pdf', 'PDF')]).arrayBuffer())
    const signature = String.fromCharCode(...bytes.slice(0, 4))
    const archiveText = new TextDecoder().decode(bytes)

    expect(signature).toBe('PK\x03\x04')
    expect(archiveText).toContain('factura.pdf')
    expect(archiveText).toContain('PK\x01\x02')
    expect(archiveText).toContain('PK\x05\x06')
  })
})
