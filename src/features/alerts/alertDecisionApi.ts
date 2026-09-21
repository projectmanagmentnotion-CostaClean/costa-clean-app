import { getSupabaseClient } from '../../lib/supabase'
import { fetchSupabaseRestList, getAuthenticatedReadContext } from '../../lib/supabaseRest'
import { recordAuditEvent } from '../auditTrail/auditTrailApi'

export type AlertDecisionStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed'
export type AlertDecisionScope = 'global' | 'user'

export interface AlertDecision {
  id?: string
  alert_key: string
  fingerprint: string
  scope: AlertDecisionScope
  user_id: string | null
  status: AlertDecisionStatus
  read_at: string | null
  resolved_at: string | null
  dismissed_at: string | null
  metadata?: Record<string, unknown>
  updated_at: string
}

const decisionSelect = 'id,alert_key,fingerprint,scope,user_id,status,read_at,resolved_at,dismissed_at,metadata,updated_at'

export async function listAlertDecisions(): Promise<AlertDecision[]> {
  return fetchSupabaseRestList<AlertDecision>(
    `operational_alert_decisions?select=${decisionSelect}&order=updated_at.desc`,
  )
}

async function getCurrentUserId(): Promise<string> {
  const { client, error } = getSupabaseClient()
  if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.')
  const { data, error: userError } = await client.auth.getUser()
  if (userError || !data.user) throw new Error(userError?.message ?? 'No hay una sesión activa.')
  return data.user.id
}

export async function saveAlertDecision(input: {
  alertKey: string
  fingerprint: string
  scope: AlertDecisionScope
  status: AlertDecisionStatus
  readAt?: string | null
  metadata?: Record<string, unknown>
}): Promise<AlertDecision> {
  const context = await getAuthenticatedReadContext()
  const userId = input.scope === 'user' ? await getCurrentUserId() : null
  const now = new Date().toISOString()
  const row = {
    alert_key: input.alertKey,
    fingerprint: input.fingerprint,
    scope: input.scope,
    user_id: userId,
    status: input.status,
    read_at: input.readAt === undefined ? null : input.readAt,
    resolved_at: input.status === 'resolved' ? now : null,
    dismissed_at: input.status === 'dismissed' ? now : null,
    metadata: input.metadata ?? {},
  }
  const response = await fetch(
    `${context.supabaseUrl}/rest/v1/operational_alert_decisions?on_conflict=alert_key,fingerprint,owner_key`,
    {
      method: 'POST',
      headers: {
        apikey: context.supabaseAnonKey,
        Authorization: `Bearer ${context.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(row),
    },
  )
  if (!response.ok) throw new Error(`REST ${response.status}: ${await response.text()}`)
  const [saved] = (await response.json()) as AlertDecision[]
  if (!saved) throw new Error('No se recibió la decisión de alerta guardada.')
  if (input.scope === 'global') {
    await recordAuditEvent({
      entityType: 'alert',
      entityId: input.alertKey,
      action: 'status_update',
      changedFields: ['status'],
      newValues: { status: input.status },
      metadata: { fingerprint: input.fingerprint, ...input.metadata },
    })
  }
  return saved
}
