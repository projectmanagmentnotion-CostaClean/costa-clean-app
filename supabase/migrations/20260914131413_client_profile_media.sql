begin;

-- V3-7A proposal only. This migration has not been applied to QA or
-- production. It keeps only the private object path in public.clients.
alter table public.clients
  add column if not exists profile_image_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'client-profile-media',
  'client-profile-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Internal staff read client profile media" on storage.objects;
create policy "Internal staff read client profile media"
on storage.objects for select to authenticated
using (
  bucket_id = 'client-profile-media'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name like 'clients/%'
);

drop policy if exists "Internal staff upload client profile media" on storage.objects;
create policy "Internal staff upload client profile media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-profile-media'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name ~ '^clients/[^/]+/[0-9A-Fa-f-]+\.(jpg|png|webp)$'
  and name !~ '(^|/)\.\.($|/)'
);

drop policy if exists "Internal staff update client profile media" on storage.objects;
create policy "Internal staff update client profile media"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-profile-media'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name like 'clients/%'
)
with check (
  bucket_id = 'client-profile-media'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name ~ '^clients/[^/]+/[0-9A-Fa-f-]+\.(jpg|png|webp)$'
  and name !~ '(^|/)\.\.($|/)'
);

drop policy if exists "Internal staff delete client profile media" on storage.objects;
create policy "Internal staff delete client profile media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-profile-media'
  and portal_private.is_active_internal_staff((select auth.uid()))
  and name like 'clients/%'
);

-- The existing authenticated update_client RPC remains the only DB write
-- boundary. This replacement adds exactly one supported optional field.
create or replace function public.update_client(p_client jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, pg_temp
as $$
declare
  v_id text := nullif(trim(p_client ->> 'id'), '');
  v_profile_image_path text := nullif(trim(p_client ->> 'profile_image_path'), '');
  v_client public.clients%rowtype;
begin
  perform public.require_authenticated_write();

  if p_client is null or jsonb_typeof(p_client) <> 'object' then
    raise exception 'Client payload must be a JSON object.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_client) as key
    where key not in ('id', 'full_name', 'phone', 'email', 'tax_id', 'billing_address', 'status', 'archived_at', 'source_lead_id', 'profile_image_path')
  ) then
    raise exception 'Client payload contains unsupported fields.';
  end if;
  if v_id is null then
    raise exception 'Client id is required.';
  end if;
  if p_client ? 'full_name' and nullif(trim(p_client ->> 'full_name'), '') is null then
    raise exception 'Client full_name cannot be empty.';
  end if;
  if p_client ? 'status' and coalesce(p_client ->> 'status', '') not in ('active', 'inactive') then
    raise exception 'Unsupported client status.';
  end if;
  if p_client ? 'profile_image_path'
    and v_profile_image_path is not null
    and (
      v_profile_image_path !~ '^clients/[^/]+/[0-9A-Fa-f-]+\.(jpg|png|webp)$'
      or split_part(v_profile_image_path, '/', 2) <> v_id
    ) then
    raise exception 'Unsupported client profile image path.';
  end if;

  update public.clients
  set
    full_name = case when p_client ? 'full_name' then trim(p_client ->> 'full_name') else full_name end,
    phone = case when p_client ? 'phone' then nullif(trim(p_client ->> 'phone'), '') else phone end,
    email = case when p_client ? 'email' then nullif(trim(p_client ->> 'email'), '') else email end,
    tax_id = case when p_client ? 'tax_id' then nullif(trim(p_client ->> 'tax_id'), '') else tax_id end,
    billing_address = case when p_client ? 'billing_address' then nullif(trim(p_client ->> 'billing_address'), '') else billing_address end,
    status = case when p_client ? 'status' then p_client ->> 'status' else status end,
    archived_at = case when p_client ? 'archived_at' then nullif(p_client ->> 'archived_at', '')::timestamptz else archived_at end,
    source_lead_id = case when p_client ? 'source_lead_id' then nullif(trim(p_client ->> 'source_lead_id'), '') else source_lead_id end,
    profile_image_path = case when p_client ? 'profile_image_path' then v_profile_image_path else profile_image_path end,
    updated_at = now()
  where id = v_id
  returning * into v_client;

  if not found then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_client);
end;
$$;

revoke execute on function public.update_client(jsonb) from public, anon;
grant execute on function public.update_client(jsonb) to authenticated;

commit;
