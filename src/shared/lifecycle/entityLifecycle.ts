export type LifecycleFields = {
  status?: string | null
  archived_at?: string | null
  deleted_at?: string | null
  cancelled_at?: string | null
}

export type LifecycleEntityKind =
  | 'job'
  | 'invoice'
  | 'quote'
  | 'expense'
  | 'client'
  | 'property'
  | 'lead'
  | 'payment'

export function isArchivedEntity(entity: LifecycleFields | null | undefined): boolean {
  return Boolean(entity?.archived_at)
}

export function isDeletedEntity(entity: LifecycleFields | null | undefined): boolean {
  return Boolean(entity?.deleted_at)
}

export function isCancelledEntity(entity: LifecycleFields | null | undefined): boolean {
  return entity?.status === 'cancelled' || Boolean(entity?.cancelled_at)
}

export function isHiddenFromDefaultViews(kind: LifecycleEntityKind, entity: LifecycleFields | null | undefined): boolean {
  if (!entity) return false
  if (isDeletedEntity(entity) || isArchivedEntity(entity)) return true

  if (kind === 'job' || kind === 'invoice') {
    return isCancelledEntity(entity)
  }

  if (kind === 'quote') {
    return entity.status === 'rejected' || isCancelledEntity(entity)
  }

  if (kind === 'client') {
    return entity.status === 'inactive'
  }

  if (kind === 'lead') {
    return isArchivedEntity(entity)
  }

  return false
}

export function isActiveForDefaultView(kind: LifecycleEntityKind, entity: LifecycleFields | null | undefined): boolean {
  return !isHiddenFromDefaultViews(kind, entity)
}

export function getLifecycleLabel(entity: LifecycleFields | null | undefined): string | null {
  if (!entity) return null
  if (isDeletedEntity(entity)) return 'En papelera'
  if (isArchivedEntity(entity)) return 'Archivado'
  if (isCancelledEntity(entity)) return 'Cancelado'
  return null
}
