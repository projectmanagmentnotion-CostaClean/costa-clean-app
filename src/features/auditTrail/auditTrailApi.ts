import { getSupabaseClient } from '../../lib/supabase'

type AuditEntityType = 'lead' | 'quote' | 'invoice' | 'payment' | 'expense' | 'property' | 'alert'
type AuditAction =
  | 'upsert'
  | 'status_update'
  | 'convert_to_client'
  | 'accept'
  | 'accept_and_invoice'
  | 'attachment_update'
  | 'fiscal_analysis'

interface AuditEventInput {
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  changedFields?: string[]
  newValues?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase para la auditoria.')
  }

  const { error: auditError } = await client.rpc('record_audit_event', {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_action: input.action,
    p_changed_fields: input.changedFields ?? [],
    p_new_values: input.newValues ?? {},
    p_metadata: input.metadata ?? {},
  })

  if (auditError) {
    throw new Error(auditError.message || 'No se pudo registrar el evento de auditoria.')
  }
}
