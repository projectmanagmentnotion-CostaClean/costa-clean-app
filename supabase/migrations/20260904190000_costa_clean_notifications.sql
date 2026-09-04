begin;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  master_enabled boolean not null default true,
  collections_enabled boolean not null default true,
  operations_enabled boolean not null default true,
  administration_enabled boolean not null default true,
  quiet_hours_start time null,
  quiet_hours_end time null,
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz null,
  active boolean not null default true,
  last_error_code text null,
  last_error_at timestamptz null,
  last_success_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('collections', 'operations', 'administration')),
  title text not null,
  body text not null,
  destination_path text not null,
  dedupe_key text not null unique,
  source_table text null,
  source_id text null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('ready', 'processing', 'sent', 'failed', 'expired', 'cancelled')),
  scheduled_for timestamptz not null default timezone('utc', now()),
  sent_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_reminder_id uuid not null references public.notification_reminders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  push_subscription_id uuid null references public.push_subscriptions(id) on delete set null,
  result text not null check (result in ('sent', 'failed', 'terminal_failure', 'ignored')),
  status_code integer null,
  error_code text null,
  attempted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_notification_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at before update on public.notification_preferences for each row execute function public.set_notification_updated_at();
drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at before update on public.push_subscriptions for each row execute function public.set_notification_updated_at();
drop trigger if exists set_notification_reminders_updated_at on public.notification_reminders;
create trigger set_notification_reminders_updated_at before update on public.notification_reminders for each row execute function public.set_notification_updated_at();

create index if not exists push_subscriptions_user_active_idx on public.push_subscriptions(user_id, active);
create index if not exists notification_reminders_ready_idx on public.notification_reminders(status, scheduled_for);
create index if not exists notification_delivery_attempts_reminder_idx on public.notification_delivery_attempts(notification_reminder_id);

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_reminders enable row level security;
alter table public.notification_delivery_attempts enable row level security;

drop policy if exists notification_preferences_owner_select on public.notification_preferences;
create policy notification_preferences_owner_select on public.notification_preferences for select to authenticated using (auth.uid() = user_id);
drop policy if exists notification_preferences_owner_insert on public.notification_preferences;
create policy notification_preferences_owner_insert on public.notification_preferences for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists notification_preferences_owner_update on public.notification_preferences;
create policy notification_preferences_owner_update on public.notification_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_owner_select on public.push_subscriptions;
create policy push_subscriptions_owner_select on public.push_subscriptions for select to authenticated using (auth.uid() = user_id);
drop policy if exists push_subscriptions_owner_insert on public.push_subscriptions;
create policy push_subscriptions_owner_insert on public.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_owner_update on public.push_subscriptions;
create policy push_subscriptions_owner_update on public.push_subscriptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_owner_delete on public.push_subscriptions;
create policy push_subscriptions_owner_delete on public.push_subscriptions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists notification_reminders_owner_select on public.notification_reminders;
create policy notification_reminders_owner_select on public.notification_reminders for select to authenticated using (auth.uid() = user_id);
drop policy if exists notification_delivery_attempts_owner_select on public.notification_delivery_attempts;
create policy notification_delivery_attempts_owner_select on public.notification_delivery_attempts for select to authenticated using (auth.uid() = user_id);

revoke all on public.notification_preferences from anon;
revoke all on public.push_subscriptions from anon;
revoke all on public.notification_reminders from anon;
revoke all on public.notification_delivery_attempts from anon;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.notification_reminders to authenticated;
grant select on public.notification_delivery_attempts to authenticated;

commit;
