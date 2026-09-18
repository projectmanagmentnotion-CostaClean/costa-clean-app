begin;

-- CP-4.3C invitation delivery state. The outbox deliberately holds no
-- recipient, invite URL or raw token material.
create table public.portal_invitation_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.client_portal_invitations(id) on delete restrict,
  provider text not null check (provider in ('brevo')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 160),
  correlation_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'leased', 'provider_accepted', 'retry_scheduled', 'blocked', 'terminal_failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_expires_at timestamptz,
  provider_message_id text,
  last_provider_code text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status in ('queued', 'retry_scheduled') and next_attempt_at is not null)
    or status not in ('queued', 'retry_scheduled')
  ),
  check (
    (status = 'provider_accepted' and provider_message_id is not null)
    or status <> 'provider_accepted'
  )
);

create index portal_invitation_delivery_outbox_ready_idx
  on public.portal_invitation_delivery_outbox (status, next_attempt_at)
  where status in ('queued', 'retry_scheduled');

alter table public.portal_invitation_delivery_outbox enable row level security;
alter table public.portal_invitation_delivery_outbox force row level security;

revoke all on table public.portal_invitation_delivery_outbox from public, anon, authenticated;
grant select, insert, update on table public.portal_invitation_delivery_outbox to service_role;

commit;
