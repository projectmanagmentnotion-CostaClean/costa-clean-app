-- Expand audit_events constraints so current lead and acceptance workflows are auditable.
-- This migration does not modify or delete existing business data.

alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check;

alter table public.audit_events
  add constraint audit_events_entity_type_check check (
    entity_type in ('lead', 'quote', 'invoice', 'payment', 'expense')
  );

alter table public.audit_events
  drop constraint if exists audit_events_action_check;

alter table public.audit_events
  add constraint audit_events_action_check check (
    action in (
      'upsert',
      'status_update',
      'convert_to_client',
      'accept',
      'accept_and_invoice',
      'attachment_update',
      'fiscal_analysis'
    )
  );
