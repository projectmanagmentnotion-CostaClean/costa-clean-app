import { describe, expect, it } from 'vitest'
import { getSyncStatusLabel } from './syncStatus'

describe('live sync status labels', () => {
  it('does not label failed refreshes as up to date', () => {
    expect(getSyncStatusLabel('error')).toBe('Error al actualizar')
    expect(getSyncStatusLabel('fresh')).toBe('Actualizado ahora')
  })
})
