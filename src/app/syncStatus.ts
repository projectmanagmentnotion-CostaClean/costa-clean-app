export type SyncStatus = 'fresh' | 'syncing' | 'offline' | 'changed'

export function getSyncStatusLabel(status: SyncStatus): string {
  if (status === 'syncing') return 'Sincronizando…'
  if (status === 'offline') return 'Sin conexión'
  if (status === 'changed') return 'Cambios nuevos'
  return 'Actualizado ahora'
}
