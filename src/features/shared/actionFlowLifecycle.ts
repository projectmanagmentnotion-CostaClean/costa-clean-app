export interface ActionFlowLifecycleProps {
  onCancel?: () => void
  onDirtyChange?: (isDirty: boolean) => void
}

export interface FullViewActionFlowProps extends ActionFlowLifecycleProps {
  onRefreshData: () => Promise<void>
  onCompleted: () => Promise<void>
}

interface ContextualActionFlowCompletionOptions<TCreated> {
  created: TCreated
  applyCreated: (created: TCreated) => void | Promise<void>
  closeSubflow: () => void
  markDirty: () => void
}

export async function completeFullViewActionFlow({
  onRefreshData,
  onCompleted,
}: Pick<FullViewActionFlowProps, 'onRefreshData' | 'onCompleted'>) {
  await onRefreshData()
  await onCompleted()
}

export async function completeContextualActionFlow<TCreated>({
  created,
  applyCreated,
  closeSubflow,
  markDirty,
}: ContextualActionFlowCompletionOptions<TCreated>) {
  await applyCreated(created)
  closeSubflow()
  markDirty()
}
