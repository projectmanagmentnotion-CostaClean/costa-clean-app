import { deleteExpenseReceipt, uploadExpenseReceipt } from './expenseAttachmentsApi'
import { updateExpenseAttachment } from './expenseApi'

export interface ReceiptWorkflowDeps {
  upload: typeof uploadExpenseReceipt
  update: typeof updateExpenseAttachment
  remove: typeof deleteExpenseReceipt
}

const defaultDeps: ReceiptWorkflowDeps = {
  upload: uploadExpenseReceipt,
  update: updateExpenseAttachment,
  remove: deleteExpenseReceipt,
}

export async function replaceExpenseReceipt(
  expenseId: string,
  file: File,
  oldPath: string | null | undefined,
  deps: ReceiptWorkflowDeps = defaultDeps,
): Promise<string> {
  const { filePath: newPath } = await deps.upload(expenseId, file)

  try {
    await deps.update(expenseId, newPath)
  } catch (cause) {
    try { await deps.remove(newPath) } catch { /* best effort cleanup; preserve original write error */ }
    throw cause
  }

  if (oldPath && oldPath !== newPath) {
    await deps.remove(oldPath)
  }

  return newPath
}
