import { deleteExpenseReceipt, uploadExpenseReceipt } from './expenseAttachmentsApi'
import { updateExpenseAttachment } from './expenseApi'

export interface ReceiptWorkflowDeps {
  upload: typeof uploadExpenseReceipt
  update: typeof updateExpenseAttachment
  remove: typeof deleteExpenseReceipt
}

export type PreviousReceiptCleanup = 'not-needed' | 'removed' | 'failed'

export interface ReceiptReplacementResult {
  filePath: string
  previousReceiptCleanup: PreviousReceiptCleanup
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
): Promise<ReceiptReplacementResult> {
  const { filePath: newPath } = await deps.upload(expenseId, file)

  try {
    await deps.update(expenseId, newPath)
  } catch (cause) {
    try { await deps.remove(newPath) } catch { /* best effort cleanup; preserve original write error */ }
    throw cause
  }

  let previousReceiptCleanup: PreviousReceiptCleanup = 'not-needed'
  if (oldPath && oldPath !== newPath) {
    try {
      await deps.remove(oldPath)
      previousReceiptCleanup = 'removed'
    } catch {
      // The replacement is already persisted. Keep its success separate from
      // cleanup, which may be denied for a legacy path under the Storage P0.
      previousReceiptCleanup = 'failed'
    }
  }

  return { filePath: newPath, previousReceiptCleanup }
}
