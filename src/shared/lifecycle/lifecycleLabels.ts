export function getArchiveActionLabel(isArchived: boolean): string {
  return isArchived ? 'Restaurar' : 'Archivar'
}

export function getDeleteActionLabel(): string {
  return 'Mover a papelera'
}

export function getCancelActionLabel(kind: 'job' | 'invoice'): string {
  return kind === 'job' ? 'Cancelar servicio' : 'Anular factura'
}
