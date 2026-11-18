import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeTaxId } from './expenseNormalizationTaxId'

const pdf = readFileSync(new URL('./fixtures/smart-expense-synthetic-invoice.pdf', import.meta.url))
const png = readFileSync(new URL('./fixtures/smart-expense-synthetic-invoice.png', import.meta.url))

function pngTextChunks(input: Buffer): string[] {
  const output: string[] = []
  let offset = 8

  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset)
    const type = input.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > input.length) break

    if (type === 'tEXt') {
      const chunk = input.subarray(dataStart, dataEnd).toString('latin1')
      output.push(chunk.slice(chunk.indexOf('\0') + 1))
    }

    offset = dataEnd + 4
    if (type === 'IEND') break
  }

  return output
}

describe('synthetic Smart Expense invoice documents', () => {
  it('contains a legible PDF invoice with a clearly fictitious tax ID and coherent 21% VAT', () => {
    expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4')
    const content = pdf.toString('latin1').replaceAll('\\(', '(').replaceAll('\\)', ')')
    for (const field of [
      'FACTURA SINTETICA - SOLO PRUEBAS',
      'DOCUMENTO FICTICIO - NO VALIDO PARA CONTABILIDAD',
      'Proveedor Ficticio Norte S.L.',
      'NIF FICTICIO (NO VALIDO): B00000002',
      'SYN-PDF-2026-001',
      '12/11/2026',
      'Consumibles de limpieza sinteticos',
      'Base imponible: 100.00 EUR',
      'IVA 21%: 21.00 EUR',
      'TOTAL: 121.00 EUR',
    ]) expect(content).toContain(field)

    expect(Math.round(100 * 0.21 * 100) / 100).toBe(21)
    expect(Math.round((100 + 21) * 100) / 100).toBe(121)
    expect(normalizeTaxId('B00000002').status).toBe('INVALID')
  })

  it('contains a readable PNG invoice with visible and embedded synthetic fields', () => {
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const text = pngTextChunks(png).join('\n')
    for (const field of [
      'FACTURA SINTETICA - SOLO PRUEBAS',
      'DOCUMENTO FICTICIO - NO VALIDO PARA CONTABILIDAD',
      'Suministros Demo Mediterraneo S.L.',
      'NIF FICTICIO (NO VALIDO): B00000001',
      'SYN-IMG-2026-002',
      '13/11/2026',
      'Material de prueba sintetico',
      'Base imponible: 80.00 EUR',
      'IVA 21%: 16.80 EUR',
      'TOTAL: 96.80 EUR',
    ]) expect(text).toContain(field)

    expect(Math.round(80 * 0.21 * 100) / 100).toBe(16.8)
    expect(Math.round((80 + 16.8) * 100) / 100).toBe(96.8)
    expect(normalizeTaxId('B00000001').status).toBe('INVALID')
  })
})
