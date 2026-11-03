import { describe, expect, it, vi } from 'vitest'
import { addCanvasToA4Pdf } from './documentPdfPagination'

describe('addCanvasToA4Pdf', () => {
  it('creates one A4 page per canonical canvas slice and keeps the final page proportional', () => {
    const createdCanvases: Array<{ width: number; height: number; toDataURL: ReturnType<typeof vi.fn> }> = []
    const previousDocument = globalThis.document

    globalThis.document = {
      createElement: vi.fn(() => {
        const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }
        const canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toDataURL: vi.fn(() => 'data:image/jpeg;base64,page') }
        createdCanvases.push(canvas)
        return canvas
      }),
    } as unknown as Document

    try {
      const pdf = { addPage: vi.fn(), addImage: vi.fn() }
      const source = { width: 2100, height: 4000 } as HTMLCanvasElement

      expect(addCanvasToA4Pdf(source, pdf)).toBe(2)
      expect(createdCanvases.map((canvas) => canvas.height)).toEqual([2970, 1030])
      expect(pdf.addPage).toHaveBeenCalledTimes(1)
      expect(pdf.addImage).toHaveBeenCalledTimes(2)
      expect(pdf.addImage.mock.calls[0][5]).toBe(297)
      expect(pdf.addImage.mock.calls[1][5]).toBe(103)
    } finally {
      globalThis.document = previousDocument
    }
  })
})
