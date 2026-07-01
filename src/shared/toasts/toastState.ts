import type { ToastInput, ToastRecord, ToastUpdateInput } from './toastTypes'

const defaultDurations: Record<ToastRecord['type'], number> = {
  success: 3800,
  warning: 5200,
  error: 6200,
  info: 3600,
  loading: 0,
}

function buildToastId(seed: number) {
  return `toast-${seed}`
}

export function createToastRecord(
  input: ToastInput,
  options?: {
    id?: string
    now?: number
  },
): ToastRecord {
  const createdAt = options?.now ?? Date.now()
  return {
    ...input,
    id: options?.id ?? buildToastId(createdAt),
    createdAt,
    durationMs: input.persistent ? 0 : input.durationMs ?? defaultDurations[input.type],
    persistent: input.persistent ?? input.type === 'loading',
  }
}

export function addToastRecord(
  current: ToastRecord[],
  input: ToastInput,
  options?: {
    id?: string
    now?: number
  },
) {
  const nextRecord = createToastRecord(input, options)
  return {
    id: nextRecord.id,
    toasts: [...current, nextRecord],
  }
}

export function updateToastRecord(
  current: ToastRecord[],
  id: string,
  input: ToastUpdateInput,
  now = Date.now(),
) {
  return current.map((toast) => {
    if (toast.id !== id) return toast

    const nextType = input.type ?? toast.type
    const nextPersistent = input.persistent ?? (nextType === 'loading')
    return {
      ...toast,
      ...input,
      type: nextType,
      persistent: nextPersistent,
      durationMs: nextPersistent ? 0 : input.durationMs ?? defaultDurations[nextType],
      createdAt: now,
    }
  })
}

export function dismissToastRecord(current: ToastRecord[], id: string) {
  return current.filter((toast) => toast.id !== id)
}
