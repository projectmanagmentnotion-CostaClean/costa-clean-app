import type { TransactionalEmailResult } from './transactionalEmail.ts'

export const PORTAL_INVITATION_DELIVERY_MAX_ATTEMPTS = 5
export type PortalInvitationDeliveryStatus = 'queued' | 'provider_accepted' | 'retry_scheduled' | 'blocked' | 'terminal_failed'
export interface PortalInvitationDeliveryOutboxEntry { invitationId: string; provider: 'brevo'; idempotencyKey: string; correlationId: string; status: 'queued' }
export interface PortalInvitationDeliveryTransition { status: Exclude<PortalInvitationDeliveryStatus, 'queued'>; attemptCount: number; retryable: boolean; providerCode?: string; providerMessageId?: string }
const FINAL_DELIVERY_STATUSES = ['provider_accepted', 'retry_scheduled', 'blocked', 'terminal_failed'] as const

export function requirePortalInvitationDeliveryFinalization(input: { status: unknown; attemptCount: unknown; previousAttemptCount: unknown; nextAttemptAt: unknown; now?: Date }): { destroyPayload: boolean } {
  const status = input.status, attemptCount = input.attemptCount, previousAttemptCount = input.previousAttemptCount
  if (typeof status !== 'string' || !FINAL_DELIVERY_STATUSES.includes(status as typeof FINAL_DELIVERY_STATUSES[number])
    || typeof attemptCount !== 'number' || !Number.isInteger(attemptCount)
    || typeof previousAttemptCount !== 'number' || !Number.isInteger(previousAttemptCount)
    || attemptCount !== previousAttemptCount + 1 || attemptCount < 1 || attemptCount > PORTAL_INVITATION_DELIVERY_MAX_ATTEMPTS
    || (status === 'retry_scheduled' && attemptCount >= PORTAL_INVITATION_DELIVERY_MAX_ATTEMPTS)) throw new Error('portal_invitation_delivery_finalization_invalid')
  const isRetry = status === 'retry_scheduled'
  const retryAt = input.nextAttemptAt instanceof Date ? input.nextAttemptAt : null
  if ((isRetry && (!retryAt || Number.isNaN(retryAt.getTime()) || retryAt <= (input.now ?? new Date()))) || (!isRetry && input.nextAttemptAt !== null)) throw new Error('portal_invitation_delivery_finalization_invalid')
  return { destroyPayload: !isRetry }
}
function requireOpaqueReference(value: string, field: string): string { const normalized=value.trim(); if(!normalized||normalized.length>160) throw new Error(`portal_invitation_delivery_${field}_invalid`); return normalized }
function requireAttemptCount(value: number): number { if(!Number.isInteger(value)||value<0||value>=PORTAL_INVITATION_DELIVERY_MAX_ATTEMPTS) throw new Error('portal_invitation_delivery_attempt_count_invalid'); return value }
export function buildPortalInvitationDeliveryOutboxEntry(input:{invitationId:string;idempotencyKey:string;correlationId:string}):PortalInvitationDeliveryOutboxEntry{return{invitationId:requireOpaqueReference(input.invitationId,'invitation_id'),provider:'brevo',idempotencyKey:requireOpaqueReference(input.idempotencyKey,'idempotency_key'),correlationId:requireOpaqueReference(input.correlationId,'correlation_id'),status:'queued'}}
export function transitionPortalInvitationDelivery(result:TransactionalEmailResult,previousAttemptCount:number):PortalInvitationDeliveryTransition{const attemptCount=requireAttemptCount(previousAttemptCount)+1;if(result.status==='accepted'){const providerMessageId=result.providerMessageId?.trim();if(!providerMessageId)return{status:'terminal_failed',attemptCount,retryable:false,providerCode:'provider_message_id_missing'};return{status:'provider_accepted',attemptCount,retryable:false,providerMessageId}}if(result.retryable&&attemptCount<PORTAL_INVITATION_DELIVERY_MAX_ATTEMPTS)return{status:'retry_scheduled',attemptCount,retryable:true,providerCode:result.providerCode};if(result.retryable)return{status:'terminal_failed',attemptCount,retryable:false,providerCode:result.providerCode};return{status:'blocked',attemptCount,retryable:false,providerCode:result.providerCode}}
export function toPortalInvitationDeliveryAuditEvent(entry:PortalInvitationDeliveryOutboxEntry,transition:PortalInvitationDeliveryTransition){return{invitationId:entry.invitationId,correlationId:entry.correlationId,provider:entry.provider,status:transition.status,attemptCount:transition.attemptCount,retryable:transition.retryable,providerCode:transition.providerCode,hasProviderMessageId:Boolean(transition.providerMessageId)}}
