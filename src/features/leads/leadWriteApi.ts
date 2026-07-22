import {
  fetchAuthenticatedSupabaseWrite,
  readSingleAuthenticatedWriteRow,
} from '../../lib/authenticatedSupabaseWrite'
import { operationalWriteRpcPaths } from '../../lib/operationalWriteRpc'
import type { LeadListItem } from './types'

type LeadWritePayload = Record<string, unknown>

async function writeLead(path: string, payload: LeadWritePayload): Promise<LeadListItem> {
  const response = await fetchAuthenticatedSupabaseWrite(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_lead: payload }),
  })

  return readSingleAuthenticatedWriteRow<LeadListItem>(
    response,
    'No se pudo confirmar el lead guardado.',
  )
}

export function createLeadAuthenticated(payload: LeadWritePayload): Promise<LeadListItem> {
  return writeLead(operationalWriteRpcPaths.createLead, payload)
}

export function updateLeadAuthenticated(
  leadId: string,
  payload: LeadWritePayload,
): Promise<LeadListItem> {
  return writeLead(operationalWriteRpcPaths.updateLead, { ...payload, id: leadId })
}
