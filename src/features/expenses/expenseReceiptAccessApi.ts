import { getSupabaseClient } from '../../lib/supabase'

export interface OperatorExpenseReceiptAssignment {
  operatorUserId: string
  grantedBy: string | null
  grantedAt: string
}

function getClient() {
  const { client, error } = getSupabaseClient()
  if (error || !client) throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  return client
}

function requireUuid(value: string, label: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new Error(`${label} no es válido.`)
  }
  return value
}

/** Owner/Admin-only RPC, enforced again by the database. */
export async function assignOperatorExpenseReceiptAccess(expenseId: string, operatorUserId: string): Promise<void> {
  const { error } = await getClient().rpc('assign_operator_expense_receipt_access', {
    p_expense_id: requireUuid(expenseId, 'El gasto'),
    p_operator_user_id: requireUuid(operatorUserId, 'El usuario operador'),
  })
  if (error) throw new Error(error.message)
}

/** Owner/Admin-only RPC, enforced again by the database. */
export async function revokeOperatorExpenseReceiptAccess(expenseId: string, operatorUserId: string): Promise<void> {
  const { error } = await getClient().rpc('revoke_operator_expense_receipt_access', {
    p_expense_id: requireUuid(expenseId, 'El gasto'),
    p_operator_user_id: requireUuid(operatorUserId, 'El usuario operador'),
  })
  if (error) throw new Error(error.message)
}

/** Returns only active operator assignments for an expense; the RPC checks Owner/Admin. */
export async function listOperatorExpenseReceiptAccess(expenseId: string): Promise<OperatorExpenseReceiptAssignment[]> {
  const { data, error } = await getClient().rpc('list_operator_expense_receipt_access', {
    p_expense_id: requireUuid(expenseId, 'El gasto'),
  })
  if (error) throw new Error(error.message)
  if (!Array.isArray(data)) throw new Error('La respuesta de asignaciones no es válida.')

  return data.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('La respuesta de asignaciones no es válida.')
    const item = row as Record<string, unknown>
    if (typeof item.operator_user_id !== 'string' || typeof item.granted_at !== 'string'
      || (item.granted_by !== null && typeof item.granted_by !== 'string')) {
      throw new Error('La respuesta de asignaciones no es válida.')
    }
    return { operatorUserId: item.operator_user_id, grantedBy: item.granted_by, grantedAt: item.granted_at }
  })
}
