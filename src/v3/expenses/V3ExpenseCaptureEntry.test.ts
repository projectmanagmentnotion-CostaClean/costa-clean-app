import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./V3ExpenseCaptureEntry.tsx', import.meta.url), 'utf8')

describe('N5.1 capture entry contract', () => {
  it('keeps manual creation visible and does not create expenses', () => {
    expect(source).toContain('Hacer foto')
    expect(source).toContain('Subir ticket o factura')
    expect(source).toContain('Continuar manualmente')
    expect(source).not.toContain('createExpense(')
    expect(source).toContain('createExpenseCaptureSession')
    expect(source).toContain('pendiente de revisión')
    expect(source).toContain('Extraer datos')
    expect(source).toContain('nunca crea el gasto automáticamente')
    expect(source).toContain('Continuar manualmente')
    expect(source).not.toContain('createFixtureExtractionProvider')
    expect(source).not.toContain('€')
    expect(source).toContain('Confianza no disponible')
    expect(source).toContain('Campos no detectados:')
    expect(source).toContain('Confianza baja:')
  })

  it('uses real file inputs with the supported contract', () => {
    expect(source).toContain('capture="environment"')
    expect(source).toContain('application/pdf,image/jpeg,image/png,image/webp')
    expect(source).toContain('role="alert"')
  })
})
