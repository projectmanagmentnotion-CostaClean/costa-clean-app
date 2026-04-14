-- Foundation for public quote requests and future Google Forms CSV imports.
-- This migration adds staging tables only; it does not write into leads, clients, properties, or quotes.

create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null default 'received',
  submitted_at timestamptz,
  normalized_input jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  source_field_map jsonb not null default '{}'::jsonb,
  pricing_breakdown jsonb not null default '{}'::jsonb,
  lead_draft_id uuid,
  lead_id text,
  quote_id text,
  external_source_key text,
  import_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intake_submissions_source_check check (
    source in ('public_quote_form', 'public_quote_request', 'google_forms_csv', 'google_form_import')
  ),
  constraint intake_submissions_status_check check (
    status in ('received', 'reviewing', 'converted', 'rejected')
  ),
  constraint intake_submissions_required_contact_check check (
    length(trim(coalesce(normalized_input->>'fullName', ''))) > 0
    and length(trim(coalesce(normalized_input->>'phone', ''))) > 0
    and coalesce((normalized_input->>'consentQuoteProcessing')::boolean, false) = true
  )
);

create table if not exists public.lead_drafts (
  id uuid primary key default gen_random_uuid(),
  intake_submission_id uuid not null references public.intake_submissions(id) on delete cascade,
  suggested_full_name text not null,
  phone text not null,
  email text,
  city text,
  postal_code text,
  status text not null default 'ready_for_review',
  matched_lead_id text,
  normalized_input jsonb not null default '{}'::jsonb,
  quote_draft_seed jsonb not null default '{}'::jsonb,
  pricing_breakdown jsonb not null default '{}'::jsonb,
  ai_email_draft text,
  ai_whatsapp_draft text,
  ai_draft_status text not null default 'not_generated',
  ai_generation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_drafts_status_check check (
    status in ('new', 'matched_existing_lead', 'ready_for_review', 'converted', 'dismissed')
  ),
  constraint lead_drafts_ai_draft_status_check check (
    ai_draft_status in ('not_generated', 'drafted', 'reviewed')
  )
);

alter table public.intake_submissions
  add column if not exists pricing_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists external_source_key text,
  add column if not exists import_metadata jsonb not null default '{}'::jsonb;

alter table public.lead_drafts
  add column if not exists pricing_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists ai_generation_metadata jsonb not null default '{}'::jsonb;

alter table public.intake_submissions
  drop constraint if exists intake_submissions_source_check;

alter table public.intake_submissions
  add constraint intake_submissions_source_check check (
    source in ('public_quote_form', 'public_quote_request', 'google_forms_csv', 'google_form_import')
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intake_submissions_lead_draft_fk'
  ) then
    alter table public.intake_submissions
      add constraint intake_submissions_lead_draft_fk
      foreign key (lead_draft_id)
      references public.lead_drafts(id)
      on delete set null
      deferrable initially deferred;
  end if;
end;
$$;

create index if not exists intake_submissions_source_created_idx
  on public.intake_submissions (source, created_at desc);

create index if not exists intake_submissions_status_created_idx
  on public.intake_submissions (status, created_at desc);

create index if not exists intake_submissions_contact_idx
  on public.intake_submissions (
    lower(normalized_input->>'phone'),
    lower(coalesce(normalized_input->>'email', ''))
  );

create unique index if not exists intake_submissions_external_source_key_idx
  on public.intake_submissions (external_source_key)
  where external_source_key is not null;

create index if not exists lead_drafts_intake_submission_idx
  on public.lead_drafts (intake_submission_id);

create index if not exists lead_drafts_status_created_idx
  on public.lead_drafts (status, created_at desc);

create index if not exists lead_drafts_contact_idx
  on public.lead_drafts (lower(phone), lower(coalesce(email, '')));

do $$
begin
  if to_regclass('public.leads') is not null then
    alter table public.leads
      add column if not exists normalized_phone text,
      add column if not exists public_intake_last_submission_id uuid,
      add column if not exists public_intake_metadata jsonb not null default '{}'::jsonb;

    create index if not exists leads_normalized_phone_idx
      on public.leads (normalized_phone);

    update public.leads
    set normalized_phone = case
      when phone is null or regexp_replace(phone, '[^0-9]', '', 'g') = '' then null
      when trim(phone) like '+%' then '+' || regexp_replace(phone, '[^0-9]', '', 'g')
      when regexp_replace(phone, '[^0-9]', '', 'g') like '00%' then '+' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 3)
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 9 then '+34' || regexp_replace(phone, '[^0-9]', '', 'g')
      else '+' || regexp_replace(phone, '[^0-9]', '', 'g')
    end
    where normalized_phone is null
      and phone is not null;
  end if;
end;
$$;

create or replace function public.set_public_intake_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_intake_submissions_updated_at on public.intake_submissions;
create trigger set_intake_submissions_updated_at
  before update on public.intake_submissions
  for each row
  execute function public.set_public_intake_updated_at();

drop trigger if exists set_lead_drafts_updated_at on public.lead_drafts;
create trigger set_lead_drafts_updated_at
  before update on public.lead_drafts
  for each row
  execute function public.set_public_intake_updated_at();

alter table public.intake_submissions enable row level security;
alter table public.lead_drafts enable row level security;

drop policy if exists "Public users can create intake submissions" on public.intake_submissions;
create policy "Public users can create intake submissions"
  on public.intake_submissions
  for insert
  to anon
  with check (true);

drop policy if exists "Authenticated users can manage intake submissions" on public.intake_submissions;
create policy "Authenticated users can manage intake submissions"
  on public.intake_submissions
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Authenticated users can manage lead drafts" on public.lead_drafts;
create policy "Authenticated users can manage lead drafts"
  on public.lead_drafts
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

grant insert on public.intake_submissions to anon;
grant select, insert, update, delete on public.intake_submissions to authenticated;
grant select, insert, update, delete on public.lead_drafts to authenticated;
