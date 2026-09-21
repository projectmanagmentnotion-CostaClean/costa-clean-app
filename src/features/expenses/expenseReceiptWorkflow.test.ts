import { describe, expect, it, vi } from 'vitest'
import { replaceExpenseReceipt, type ReceiptWorkflowDeps } from './expenseReceiptWorkflow'

const file = { name: 'receipt.png' } as File

function deps(overrides: Partial<ReceiptWorkflowDeps> = {}): ReceiptWorkflowDeps {
  return {
    upload: overrides.upload ?? vi.fn(async () => ({ filePath: 'new/path.png' })),
    update: overrides.update ?? vi.fn(async () => undefined),
    remove: overrides.remove ?? vi.fn(async () => undefined),
  }
}

describe('replaceExpenseReceipt', () => {
  it('adds without deleting when there is no old object', async () => {
    const d = deps()
    await replaceExpenseReceipt('expense-1', file, null, d)
    expect(d.update).toHaveBeenCalledWith('expense-1', 'new/path.png')
    expect(d.remove).not.toHaveBeenCalled()
  })

  it('persists the new pointer before deleting the old object', async () => {
    const order: string[] = []
    const d = deps({
      update: vi.fn(async () => { order.push('update') }),
      remove: vi.fn(async () => { order.push('remove') }),
    })
    await replaceExpenseReceipt('expense-1', file, 'old/path.png', d)
    expect(order).toEqual(['update', 'remove'])
  })

  it('cleans up the new object when pointer persistence fails', async () => {
    const d = deps({ update: vi.fn(async () => { throw new Error('pointer failed') }) })
    await expect(replaceExpenseReceipt('expense-1', file, 'old/path.png', d)).rejects.toThrow('pointer failed')
    expect(d.remove).toHaveBeenCalledWith('new/path.png')
  })

  it('keeps the new pointer and surfaces old-object cleanup failure', async () => {
    const d = deps({ remove: vi.fn(async (path: string) => { if (path === 'old/path.png') throw new Error('old cleanup failed') }) })
    await expect(replaceExpenseReceipt('expense-1', file, 'old/path.png', d)).rejects.toThrow('old cleanup failed')
    expect(d.update).toHaveBeenCalledWith('expense-1', 'new/path.png')
  })
})
