alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check;

alter table public.audit_events
  add constraint audit_events_entity_type_check
  check (entity_type = any (array['lead','quote','invoice','payment','expense','property','alert']::text[]));
