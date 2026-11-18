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
    expect(source).toContain('Datos detectados · pendientes de confirmar')
    expect(source).toContain('createExpenseNormalizationClient')
    expect(source).toContain('createExpenseExtractionClient()')
    expect(source).not.toContain('createOpenAiExpenseExtractionClient')
    expect(source).toContain('normalizeExpenseProposalReview')
    expect(source).toContain('Confirmo que he revisado la propuesta y quiero guardarla')
    expect(source).toContain('reviewedProposal.reconciliation.status !== \'MATCH\'')
    expect(source).toContain('iframe src={previewUrl}')
    expect(source).toContain('onClick={() => void replaceDocument()}')
    expect(source).toContain("void handleFile('upload', selected, true)")
    expect(source).toContain('function clearCaptureState()')
    expect(source).toContain("setCategory('otros'); setDescription(''); setPaymentMethod('other'); setNotes('')")
    expect(source).toContain('setCategory(\'otros\'); setDescription(\'\'); setPaymentMethod(\'other\'); setNotes(\'\')')
    expect(source).toContain('buildConfirmedExpensePayload')
    expect(source).toContain('confirmExpenseCapture')
    expect(source).toContain('Confirmo que he revisado la propuesta y quiero guardarla')
    expect(source).toContain('data-entity-id')
    expect(source).toContain("setStatus('READY_FOR_REVIEW')")
    expect(source).not.toContain("move('UPLOADED'); move('READY_FOR_REVIEW')")
    expect(source).not.toContain('Detectado por proveedor local')
  })

  it('uses real file inputs with the supported contract', () => {
    expect(source).toContain('capture="environment"')
    expect(source).toContain('application/pdf,image/jpeg,image/png,image/webp')
    expect(source).toContain('role="alert"')
  })

  it('validates replacement files before cancelling the previous capture and resets review state', () => {
    expect(source.indexOf('const validationError = validateExpenseCaptureFile(nextFile)')).toBeLessThan(source.indexOf('if (replaceCurrent && session)'))
    expect(source).toContain("void handleFile('upload', selected, true)")
    expect(source).toContain('function replaceDocument() {\n    uploadInputRef.current?.click()')
    expect(source).toContain("setCategory('otros'); setDescription(''); setPaymentMethod('other'); setNotes(''); setConfirmed(false); setDuplicateDecision('CREATE_NEW')")
  })

  it('reports a successful save separately from a failed list refresh', () => {
    expect(source).toContain("setConfirmationResult(result)")
    expect(source).toContain('El gasto se guardó, pero no se pudo actualizar la lista. Recarga la vista.')
  })
})
