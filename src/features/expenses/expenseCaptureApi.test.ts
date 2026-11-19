import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { getSupabaseClient } from '../../lib/supabase'
import { createFixtureExtractionProvider } from './expenseExtractionProvider'
import { normalizeExpenseProposal } from './expenseNormalization'
import { buildConfirmedExpensePayload, normalizeExpenseProposalReview } from './expenseConfirmation'
import { attachExpenseCaptureDocument, confirmExpenseCapture, createExpenseCaptureSession } from './expenseCaptureApi'
import type { ExpenseCaptureDocumentContract, ExpenseCaptureSessionContract } from './expenseCaptureFoundation'

vi.mock('../../lib/supabase', () => ({ getSupabaseClient: vi.fn() }))

const mockedGetSupabaseClient = vi.mocked(getSupabaseClient)
const session: ExpenseCaptureSessionContract = {
  id: '123e4567-e89b-42d3-a456-426614174003', status: 'UPLOADED', source: 'upload',
  idempotency_key: 'synthetic-capture-key', created_at: '2026-11-19T10:00:00Z', expires_at: '2026-11-20T10:00:00Z',
}

function setupClient() {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'create_expense_capture_session') return { data: session, error: null }
    if (name === 'attach_expense_capture_document') return {
      data: {
        id: '123e4567-e89b-42d3-a456-426614174004', capture_session_id: session.id,
        storage_path: `captures/${session.id}/${'a'.repeat(64)}`, page_index: 0,
      }, error: null,
    }
    if (name === 'confirm_expense_capture') return {
      data: { confirmation_id: '123e4567-e89b-42d3-a456-426614174005', expense_id: '123e4567-e89b-42d3-a456-426614174006', reused: false }, error: null,
    }
    return { data: null, error: { message: 'unexpected RPC' } }
  })
  const upload = vi.fn(async (...args: unknown[]) => { void args; return { error: null } })
  const remove = vi.fn(async () => ({ error: null }))
  const client = {
    rpc,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: '123e4567-e89b-42d3-a456-426614174007' } }, error: null })) },
    storage: { from: vi.fn(() => ({ upload, remove })) },
  }
  mockedGetSupabaseClient.mockReturnValue({ client: client as never, error: null })
  return { client, rpc, upload, remove }
}

describe('N5.5 capture API synthetic PDF/image flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    { filename: 'fixture-smart-expense-synthetic.pdf', mimeType: 'application/pdf', fixture: 'smart-expense-synthetic-invoice.pdf' },
    { filename: 'fixture-smart-expense-synthetic.png', mimeType: 'image/png', fixture: 'smart-expense-synthetic-invoice.png' },
  ])('uploads, reviews and confirms a local fixture proposal for $mimeType through mocked persistence', async ({ filename, mimeType, fixture }) => {
    const { rpc, upload } = setupClient()
    const bytes = readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url))
    const file = new File([bytes], filename, { type: mimeType })

    const captureSession = await createExpenseCaptureSession('upload', 'synthetic-capture-key')
    const document = await attachExpenseCaptureDocument(captureSession, file) as ExpenseCaptureDocumentContract
    expect(upload).toHaveBeenCalledOnce()
    expect(upload.mock.calls[0]?.[0]).toMatch(/^captures\/[0-9a-f-]{36}\/[0-9a-f]{64}$/u)
    expect(document).toMatchObject({ originalFilename: filename, mimeType, sizeBytes: file.size })

    const extracted = await createFixtureExtractionProvider().extractDocument({
      captureDocumentId: document.id, captureSessionId: captureSession.id, originalFilename: filename,
      mimeType, sizeBytes: file.size, sha256: document.sha256,
    })
    expect(extracted).toMatchObject({ ok: true, metadata: { provider: 'fixture' } })
    if (!extracted.ok) return

    const normalized = normalizeExpenseProposal(extracted.proposal)
    const reviewed = normalizeExpenseProposalReview(normalized, {
      documentType: 'INVOICE', supplierName: 'Proveedor revisado de prueba', supplierTaxId: 'B12345674',
      invoiceNumber: 'TEST-2026-001', issueDate: '2026-09-28', net: '150.00', tax: '26.00', gross: '176.00',
      vatLines: [{ rate: '10', base: '50.00', tax: '5.00' }, { rate: '21', base: '100.00', tax: '21.00' }],
    })
    const confirmation = buildConfirmedExpensePayload(reviewed, {
      confirmed: true, supplierCandidate: null, duplicateDecision: 'CREATE_NEW', duplicateCandidate: null,
      category: 'materiales', description: 'Compra sintética revisada', paymentMethod: 'card',
      supplierName: 'Proveedor revisado de prueba', supplierTaxId: 'B12345674',
    })
    expect(confirmation).toMatchObject({ ok: true })
    if (!confirmation.ok) return

    const saved = await confirmExpenseCapture(captureSession, document, '123e4567-e89b-42d3-a456-426614174008', 'synthetic-confirmation-key', {
      confirmed: true, supplierCandidate: null, duplicateDecision: 'CREATE_NEW', duplicateCandidate: null,
      category: 'materiales', description: 'Compra sintética revisada', paymentMethod: 'card',
      supplierName: 'Proveedor revisado de prueba', supplierTaxId: 'B12345674', payload: confirmation.payload,
    })
    expect(saved).toEqual({ confirmation_id: '123e4567-e89b-42d3-a456-426614174005', expense_id: '123e4567-e89b-42d3-a456-426614174006', reused: false })
    expect(rpc).toHaveBeenCalledWith('confirm_expense_capture', expect.objectContaining({
      p_capture_session_id: captureSession.id,
      p_capture_document_id: document.id,
      p_authenticated_user_id: '123e4567-e89b-42d3-a456-426614174007',
      p_payload: expect.objectContaining({ confirmed: true, supplier_name: 'Proveedor revisado de prueba', subtotal: 150, tax_amount: 26, total: 176 }),
    }))
    expect(rpc).toHaveBeenCalledTimes(3)
  })

  it('refuses persistence when human confirmation is missing', async () => {
    const { rpc } = setupClient()
    await expect(confirmExpenseCapture(session, {
      id: '123e4567-e89b-42d3-a456-426614174004', capture_session_id: session.id,
      storage_path: `captures/${session.id}/${'a'.repeat(64)}`, originalFilename: 'fixture.png',
      mimeType: 'image/png', sizeBytes: 1, sha256: 'a'.repeat(64), page_index: 0,
    }, 'normalization-id', 'confirmation-key', {
      confirmed: false, supplierCandidate: null, duplicateDecision: 'CREATE_NEW', duplicateCandidate: null,
      category: 'materiales', description: 'No guardar', paymentMethod: 'card', payload: {} as never,
    })).rejects.toThrow('La confirmación humana es obligatoria.')
    expect(rpc).not.toHaveBeenCalled()
  })
})
