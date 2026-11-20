import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseClient } from '../../lib/supabase'
import { assignOperatorExpenseReceiptAccess, listOperatorExpenseReceiptAccess, revokeOperatorExpenseReceiptAccess } from './expenseReceiptAccessApi'

vi.mock('../../lib/supabase', () => ({ getSupabaseClient: vi.fn() }))

const mockedGetSupabaseClient = vi.mocked(getSupabaseClient)
const expenseId = '123e4567-e89b-42d3-a456-426614174010'
const operatorUserId = '123e4567-e89b-42d3-a456-426614174011'
type RpcResponse = { data: unknown; error: { message: string } | null }
const createRpc = (implementation: (...args: unknown[]) => Promise<RpcResponse> = async () => ({ data: null, error: null })) => vi.fn(implementation)
type RpcMock = ReturnType<typeof createRpc>

function setup(rpc: RpcMock = createRpc()) {
  const client = { rpc }
  mockedGetSupabaseClient.mockReturnValue({ client: client as never, error: null })
  return rpc
}

describe('operator expense receipt access API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the Owner/Admin assignment RPC with UUID-validated identifiers', async () => {
    const rpc = setup()
    await assignOperatorExpenseReceiptAccess(expenseId, operatorUserId)
    expect(rpc).toHaveBeenCalledWith('assign_operator_expense_receipt_access', {
      p_expense_id: expenseId,
      p_operator_user_id: operatorUserId,
    })
  })

  it('calls the revocation RPC and does not write assignment rows from the client', async () => {
    const rpc = setup()
    await revokeOperatorExpenseReceiptAccess(expenseId, operatorUserId)
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('revoke_operator_expense_receipt_access', {
      p_expense_id: expenseId,
      p_operator_user_id: operatorUserId,
    })
  })

  it('lists only the typed assignment projection returned by the database RPC', async () => {
    const grantedAt = '2026-11-20T10:00:00.000Z'
    const rpc = setup(createRpc(async () => ({
      data: [{ operator_user_id: operatorUserId, granted_by: expenseId, granted_at: grantedAt }], error: null,
    })))
    await expect(listOperatorExpenseReceiptAccess(expenseId)).resolves.toEqual([
      { operatorUserId, grantedBy: expenseId, grantedAt },
    ])
    expect(rpc).toHaveBeenCalledWith('list_operator_expense_receipt_access', { p_expense_id: expenseId })
  })

  it('rejects malformed identifiers, RPC errors, and malformed RPC results', async () => {
    const rpc = setup()
    await expect(assignOperatorExpenseReceiptAccess('expenses/arbitrary-path', operatorUserId)).rejects.toThrow('El gasto no es válido.')
    expect(rpc).not.toHaveBeenCalled()

    setup(createRpc(async () => ({ data: null, error: { message: 'permission denied' } })))
    await expect(revokeOperatorExpenseReceiptAccess(expenseId, operatorUserId)).rejects.toThrow('permission denied')

    setup(createRpc(async () => ({ data: [{ operator_user_id: 42 }], error: null })))
    await expect(listOperatorExpenseReceiptAccess(expenseId)).rejects.toThrow('La respuesta de asignaciones no es válida.')
  })
})
