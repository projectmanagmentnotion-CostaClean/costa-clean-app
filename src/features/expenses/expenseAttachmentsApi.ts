import { getSupabaseClient } from '../../lib/supabase'

export const EXPENSE_RECEIPTS_BUCKET = 'expense-receipts'

function sanitizeFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  const base = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName
  const ext = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : ''

  const safeBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return `${safeBase || 'archivo'}${ext}`
}

export function buildExpenseReceiptPath(expenseId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `expenses/${expenseId}/${stamp}-${safeName}`
}

export async function uploadExpenseReceipt(expenseId: string, file: File) {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const filePath = buildExpenseReceiptPath(expenseId, file.name)

  const { error: uploadError } = await client.storage
    .from(EXPENSE_RECEIPTS_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  return {
    filePath,
  }
}

export async function createExpenseReceiptSignedUrl(
  filePath: string,
  expiresInSeconds = 3600,
) {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const { data, error: signedUrlError } = await client.storage
    .from(EXPENSE_RECEIPTS_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds)

  if (signedUrlError) {
    throw new Error(signedUrlError.message)
  }

  return data.signedUrl
}

export async function deleteExpenseReceipt(filePath: string) {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const { error: removeError } = await client.storage
    .from(EXPENSE_RECEIPTS_BUCKET)
    .remove([filePath])

  if (removeError) {
    throw new Error(removeError.message)
  }
}
