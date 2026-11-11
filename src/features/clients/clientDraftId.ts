import { createClientId } from './clientIdentity'

/**
 * Returns the existing record identity for edits, or allocates a unique,
 * stable-per-form identity for a new client draft.
 */
export function createClientDraftId(clientId?: string | null): string {
  const existingId = clientId?.trim()
  return existingId || createClientId()
}
