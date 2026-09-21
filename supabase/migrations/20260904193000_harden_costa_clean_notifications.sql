begin;

alter table public.notification_reminders
  drop constraint if exists notification_reminders_dedupe_key_key;

create unique index if not exists notification_reminders_user_dedupe_key_idx
  on public.notification_reminders(user_id, dedupe_key);

alter table public.notification_reminders
  add column if not exists processing_started_at timestamptz null;

create or replace function public.claim_notification_reminders(p_limit integer default 25)
returns setof public.notification_reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.notification_reminders
    where (status = 'ready' and scheduled_for <= timezone('utc', now()))
       or (status = 'processing' and processing_started_at < timezone('utc', now()) - interval '10 minutes')
    order by scheduled_for, created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  )
  update public.notification_reminders reminder
  set status = 'processing', processing_started_at = timezone('utc', now())
  from candidates
  where reminder.id = candidates.id
  returning reminder.*;
end;
$$;

revoke all on function public.claim_notification_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_reminders(integer) to service_role;

commit;
