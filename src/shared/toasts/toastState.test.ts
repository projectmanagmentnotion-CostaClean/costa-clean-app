import { describe, expect, it } from 'vitest'
import { addToastRecord, createToastRecord, dismissToastRecord, updateToastRecord } from './toastState'

describe('toastState', () => {
  it('creates a renderable toast record with defaults', () => {
    const record = createToastRecord(
      { type: 'success', title: 'Servicio guardado' },
      { id: 'toast-1', now: 10 },
    )

    expect(record).toMatchObject({
      id: 'toast-1',
      type: 'success',
      title: 'Servicio guardado',
      durationMs: 3800,
      persistent: false,
      createdAt: 10,
    })
  })

  it('adds success and error toasts into the viewport state', () => {
    const first = addToastRecord([], { type: 'success', title: 'Guardado' }, { id: 'toast-1', now: 1 })
    const second = addToastRecord(first.toasts, { type: 'error', title: 'Fallo real' }, { id: 'toast-2', now: 2 })

    expect(second.toasts).toHaveLength(2)
    expect(JSON.stringify(second.toasts.map((toast) => toast.type))).toBe(JSON.stringify(['success', 'error']))
  })

  it('updates a loading toast into success', () => {
    const current = [
      createToastRecord({ type: 'loading', title: 'Guardando servicio...', persistent: true }, { id: 'toast-1', now: 1 }),
    ]

    const next = updateToastRecord(current, 'toast-1', {
      type: 'success',
      title: 'Servicio guardado',
      description: 'Las lineas se actualizaron correctamente.',
      persistent: false,
    }, 2)

    expect(next[0]).toMatchObject({
      id: 'toast-1',
      type: 'success',
      title: 'Servicio guardado',
      persistent: false,
      durationMs: 3800,
      createdAt: 2,
    })
  })

  it('dismisses toasts cleanly', () => {
    const current = [
      createToastRecord({ type: 'success', title: 'Guardado' }, { id: 'toast-1', now: 1 }),
      createToastRecord({ type: 'warning', title: 'Refresh pendiente' }, { id: 'toast-2', now: 2 }),
    ]

    const next = dismissToastRecord(current, 'toast-1')

    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('toast-2')
  })
})
