begin;

-- N5.1 temporary document capture only. Selecting a document never creates an
-- expense row; final expense creation remains the existing canonical flow.
create table if not exists public.expense_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'UPLOADED' check (status in (
    'UPLOADED', 'PROCESSING', 'EXTRACTED', 'NEEDS_REVIEW',
    'DUPLICATE_REVIEW', 'READY_TO_CONFIRM', 'FINALIZING', 'COMPLETED',
    'FAILED', 'CANCELLED'
  )),
  source text not null check (source in ('camera', 'upload', 'manual')),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  completed_expense_id text,
  last_error text,
  unique (created_by, idempotency_key)
);

create table if not exists public.expense_capture_documents (
  id uuid primary key default gen_random_uuid(),
  capture_session_id uuid not null references public.expense_capture_sessions(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (char_length(trim(original_filename)) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  page_index integer not null default 0 check (page_index >= 0),
  created_at timestamptz not null default now(),
  unique (capture_session_id, sha256)
);

create index if not exists expense_capture_sessions_owner_idx
  on public.expense_capture_sessions (created_by, updated_at desc);
create index if not exists expense_capture_documents_session_idx
  on public.expense_capture_documents (capture_session_id, page_index);

alter table public.expense_capture_sessions enable row level security;
alter table public.expense_capture_sessions force row level security;
alter table public.expense_capture_documents enable row level security;
alter table public.expense_capture_documents force row level security;
revoke all on public.expense_capture_sessions from public, anon, authenticated, service_role;
revoke all on public.expense_capture_documents from public, anon, authenticated, service_role;

drop policy if exists expense_capture_sessions_internal_read on public.expense_capture_sessions;
create policy expense_capture_sessions_internal_read on public.expense_capture_sessions
  for select to authenticated
  using (created_by = (select auth.uid()) and app_private.is_active_internal_staff((select auth.uid())));

drop policy if exists expense_capture_documents_internal_read on public.expense_capture_documents;
create policy expense_capture_documents_internal_read on public.expense_capture_documents
  for select to authenticated
  using (exists (
    select 1 from public.expense_capture_sessions s
    where s.id = expense_capture_documents.capture_session_id
      and s.created_by = (select auth.uid())
      and app_private.is_active_internal_staff((select auth.uid()))
  ));

create or replace function public.create_expense_capture_session(
  p_source text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.expense_capture_sessions;
begin
  if v_user_id is null or not app_private.is_active_internal_staff(v_user_id) then
    raise exception 'capture_internal_staff_required' using errcode = '42501';
  end if;
  if p_source not in ('camera', 'upload', 'manual') then
    raise exception 'capture_source_invalid' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'capture_idempotency_key_required' using errcode = '22023';
  end if;

  insert into public.expense_capture_sessions(created_by, source, idempotency_key)
  values (v_user_id, p_source, trim(p_idempotency_key))
  on conflict (created_by, idempotency_key) do nothing;

  select * into v_session
  from public.expense_capture_sessions
  where created_by = v_user_id and idempotency_key = trim(p_idempotency_key);

  if v_session.source <> p_source then
    raise exception 'capture_idempotency_payload_mismatch' using errcode = '23505';
  end if;

  return jsonb_build_object(
    'id', v_session.id,
    'status', v_session.status,
    'source', v_session.source,
    'idempotency_key', v_session.idempotency_key,
    'created_at', v_session.created_at,
    'expires_at', v_session.expires_at
  );
end;
$$;

create or replace function public.attach_expense_capture_document(
  p_capture_session_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sha256 text,
  p_page_index integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_document public.expense_capture_documents;
begin
  if v_user_id is null or not app_private.is_active_internal_staff(v_user_id) then
    raise exception 'capture_internal_staff_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.expense_capture_sessions s
    where s.id = p_capture_session_id and s.created_by = v_user_id and s.status <> 'CANCELLED'
  ) then
    raise exception 'capture_session_not_found' using errcode = 'P0002';
  end if;
  if p_storage_path is null or p_storage_path not like 'captures/' || p_capture_session_id::text || '/%' then
    raise exception 'capture_storage_path_invalid' using errcode = '22023';
  end if;
  if position('..' in p_storage_path) > 0 or position(chr(92) in p_storage_path) > 0 then
    raise exception 'capture_storage_path_invalid' using errcode = '22023';
  end if;
  if p_original_filename is null or trim(p_original_filename) = ''
     or position('..' in p_original_filename) > 0
     or position('/' in p_original_filename) > 0
     or position(chr(92) in p_original_filename) > 0 then
    raise exception 'capture_filename_invalid' using errcode = '22023';
  end if;
  if p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
     or p_file_size_bytes <= 0 or p_file_size_bytes > 10485760
     or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'capture_document_invalid' using errcode = '22023';
  end if;

  insert into public.expense_capture_documents(
    capture_session_id, storage_path, original_filename, mime_type,
    file_size_bytes, sha256, page_index
  ) values (
    p_capture_session_id, p_storage_path, left(trim(p_original_filename), 255),
    p_mime_type, p_file_size_bytes, lower(p_sha256), coalesce(p_page_index, 0)
  ) on conflict (capture_session_id, sha256) do nothing;

  select * into v_document
  from public.expense_capture_documents
  where capture_session_id = p_capture_session_id and sha256 = lower(p_sha256);

  update public.expense_capture_sessions
  set status = 'UPLOADED', updated_at = now()
  where id = p_capture_session_id and created_by = v_user_id;

  return jsonb_build_object(
    'id', v_document.id,
    'capture_session_id', v_document.capture_session_id,
    'storage_path', v_document.storage_path,
    'sha256', v_document.sha256,
    'page_index', v_document.page_index
  );
end;
$$;

create or replace function public.cancel_expense_capture_session(
  p_capture_session_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_paths text[];
begin
  if v_user_id is null or not app_private.is_active_internal_staff(v_user_id) then
    raise exception 'capture_internal_staff_required' using errcode = '42501';
  end if;
  select coalesce(array_agg(storage_path), '{}'::text[]) into v_paths
  from public.expense_capture_documents
  where capture_session_id = p_capture_session_id;
  update public.expense_capture_sessions
  set status = 'CANCELLED', updated_at = now()
  where id = p_capture_session_id and created_by = v_user_id;
  if not found then raise exception 'capture_session_not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', p_capture_session_id, 'status', 'CANCELLED', 'storage_paths', v_paths);
end;
$$;

alter function public.create_expense_capture_session(text, text) owner to postgres;
alter function public.attach_expense_capture_document(uuid, text, text, text, bigint, text, integer) owner to postgres;
alter function public.cancel_expense_capture_session(uuid) owner to postgres;

revoke all on function public.create_expense_capture_session(text, text) from public, anon;
revoke all on function public.attach_expense_capture_document(uuid, text, text, text, bigint, text, integer) from public, anon;
revoke all on function public.cancel_expense_capture_session(uuid) from public, anon;
grant execute on function public.create_expense_capture_session(text, text) to authenticated;
grant execute on function public.attach_expense_capture_document(uuid, text, text, text, bigint, text, integer) to authenticated;
grant execute on function public.cancel_expense_capture_session(uuid) to authenticated;

-- Capture objects are private and scoped to the owning internal staff member.
drop policy if exists n51_capture_insert on storage.objects;
create policy n51_capture_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = 'captures'
    and app_private.is_active_internal_staff((select auth.uid()))
    and exists (
      select 1 from public.expense_capture_sessions s
      where s.id::text = (storage.foldername(name))[2]
        and s.created_by = (select auth.uid())
        and s.status <> 'CANCELLED'
    )
  );

drop policy if exists n51_capture_select on storage.objects;
create policy n51_capture_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = 'captures'
    and exists (
      select 1 from public.expense_capture_sessions s
      where s.id::text = (storage.foldername(name))[2]
        and s.created_by = (select auth.uid())
        and app_private.is_active_internal_staff((select auth.uid()))
    )
  );

drop policy if exists n51_capture_delete on storage.objects;
create policy n51_capture_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = 'captures'
    and exists (
      select 1 from public.expense_capture_sessions s
      where s.id::text = (storage.foldername(name))[2]
        and s.created_by = (select auth.uid())
        and app_private.is_active_internal_staff((select auth.uid()))
    )
  );

commit;
