begin;

create or replace function public.archive_job(p_job_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if nullif(pg_catalog.btrim(p_job_id), '') is null then
    raise exception 'Job id is required.' using errcode = '22023';
  end if;

  -- Reuse the existing active internal write-role guard. It allows owner,
  -- admin, operator and finance, while rejecting readonly and non-members.
  perform app_private.require_internal_staff_write();

  update public.jobs as job
     set archived_at = coalesce(job.archived_at, pg_catalog.clock_timestamp()),
         updated_at = pg_catalog.clock_timestamp()
   where job.id = p_job_id;

  if not found then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  return true;
end;
$function$;

alter function public.archive_job(text) owner to postgres;
revoke all on function public.archive_job(text) from public, anon, authenticated, service_role;
grant execute on function public.archive_job(text) to authenticated;

commit;
