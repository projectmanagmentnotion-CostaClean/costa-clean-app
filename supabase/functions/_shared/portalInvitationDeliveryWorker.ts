import { decryptPortalInvitationDeliveryToken, type EncryptedPortalInvitationDeliveryPayload } from './portalInvitationDeliveryPayload.ts'
import { buildPortalInvitationEmail, toTransactionalEmailAuditEvent, type TransactionalEmailProvider } from './transactionalEmail.ts'
import { toPortalInvitationDeliveryAuditEvent, transitionPortalInvitationDelivery, type PortalInvitationDeliveryTransition } from './portalInvitationDeliveryOutbox.ts'
import { isAuthorizedQaInvitationRecipient } from './portalInvitationDeliverySandbox.ts'
export interface PortalInvitationDeliveryLease{invitationId:string;recipient:string;expiresAt:string;idempotencyKey:string;correlationId:string;attemptCount:number;payload:EncryptedPortalInvitationDeliveryPayload}
export interface PortalInvitationDeliveryStore{claimNext(invitationId?:string):Promise<PortalInvitationDeliveryLease|null>;finalize(input:{invitationId:string;transition:PortalInvitationDeliveryTransition}):Promise<void>}
export interface PortalInvitationDeliveryWorkerResult{status:'idle'|'processed';audit?:ReturnType<typeof toPortalInvitationDeliveryAuditEvent>;emailAudit?:ReturnType<typeof toTransactionalEmailAuditEvent>}
function buildInvitationUrl(baseUrl:string,token:string):string{let url:URL;try{url=new URL(baseUrl)}catch{throw new Error('portal_invitation_delivery_accept_url_invalid')}if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/portal/invitacion'||url.search||url.hash)throw new Error('portal_invitation_delivery_accept_url_invalid');url.hash=`token=${encodeURIComponent(token)}`;return url.toString()}
export async function processPortalInvitationDelivery(input:{store:PortalInvitationDeliveryStore;provider:TransactionalEmailProvider;encryptionKey:string;invitationAcceptUrl:string;qaRecipient:string;invitationId?:string;now?:()=>Date}):Promise<PortalInvitationDeliveryWorkerResult>{
  const lease=await input.store.claimNext(input.invitationId)
  if(!lease)return{status:'idle'}
  let transition:PortalInvitationDeliveryTransition|undefined
  let emailAudit:ReturnType<typeof toTransactionalEmailAuditEvent>|undefined

  if(!isAuthorizedQaInvitationRecipient(lease.recipient,input.qaRecipient)){
    transition=transitionPortalInvitationDelivery({status:'not_configured',retryable:false,providerCode:'qa_recipient_not_allowed'},lease.attemptCount)
  }else{
    let token:string|undefined
    try{
      token=await decryptPortalInvitationDeliveryToken({
        payload:lease.payload,
        invitationId:lease.invitationId,
        encryptionKey:input.encryptionKey,
        now:input.now,
      })
    }catch{
      transition=transitionPortalInvitationDelivery({status:'failed',retryable:false,providerCode:'payload_decrypt_failed'},lease.attemptCount)
    }

    let invitationUrl:string|undefined
    if(!transition&&token){
      try{
        invitationUrl=buildInvitationUrl(input.invitationAcceptUrl,token)
      }catch{
        transition=transitionPortalInvitationDelivery({status:'failed',retryable:false,providerCode:'invitation_url_build_failed'},lease.attemptCount)
      }
    }

    let request:ReturnType<typeof buildPortalInvitationEmail>|undefined
    if(!transition&&invitationUrl){
      try{
        request=buildPortalInvitationEmail({
          recipient:lease.recipient,
          locale:'es-ES',
          invitationUrl,
          expiresAt:lease.expiresAt,
          idempotencyKey:lease.idempotencyKey,
          correlationId:lease.correlationId,
        })
      }catch{
        transition=transitionPortalInvitationDelivery({status:'failed',retryable:false,providerCode:'email_request_build_failed'},lease.attemptCount)
      }
    }

    if(!transition&&request){
      try{
        const providerResult=await input.provider.sendTransactionalEmail(request)
        transition=transitionPortalInvitationDelivery(providerResult,lease.attemptCount)
        emailAudit=toTransactionalEmailAuditEvent(request,providerResult)
      }catch{
        transition=transitionPortalInvitationDelivery({status:'failed',retryable:false,providerCode:'worker_processing_exception'},lease.attemptCount)
      }
    }
  }

  if(!transition){
    transition=transitionPortalInvitationDelivery({status:'failed',retryable:false,providerCode:'worker_processing_exception'},lease.attemptCount)
  }

  await input.store.finalize({invitationId:lease.invitationId,transition})
  const audit=toPortalInvitationDeliveryAuditEvent({
    invitationId:lease.invitationId,
    provider:'brevo',
    idempotencyKey:lease.idempotencyKey,
    correlationId:lease.correlationId,
    status:'queued',
  },transition)
  return{status:'processed',audit,emailAudit}
}
