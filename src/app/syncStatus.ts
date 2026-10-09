export type SyncStatus = 'fresh' | 'syncing' | 'offline' | 'changed' | 'error'

export function getSyncStatusLabel(status: SyncStatus): string {
  if (status === 'syncing') return 'Sincronizando…'
  if (status === 'offline') return 'Sin conexión'
  if (status === 'changed') return 'Cambios nuevos'
  if (status === 'error') return 'Error al actualizar'
  return 'Actualizado ahora'
}
