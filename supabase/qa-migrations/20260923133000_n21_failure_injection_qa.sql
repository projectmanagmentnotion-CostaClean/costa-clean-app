begin;

create or replace function public.qa_n21_failpoint_is_armed(p_stage text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
begin
  if p_stage not in ('after_job', 'after_job_lines', 'after_invoice', 'after_invoice_lines') then
    return false;
  end if;
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    return false;
  end if;
  begin
    v_user_id := app_private.require_active_internal_staff();
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.internal_staff_memberships m
    where m.user_id = v_user_id and m.role in ('owner', 'admin')
      and m.status = 'active' and m.revoked_at is null
  ) and current_setting('app.qa_n21_failpoint', true) = p_stage;
end;
$function$;

create or replace function public.qa_n21_failpoint_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_stage text := current_setting('app.qa_n21_failpoint', true);
  v_invoice_id text;
  v_job_id text;
  v_run_id text;
begin
  if v_stage not in ('after_job', 'after_job_lines', 'after_invoice', 'after_invoice_lines') then
    return coalesce(new, old);
  end if;
  if not public.qa_n21_failpoint_is_armed(v_stage) then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'jobs' then
    v_invoice_id := new.source_metadata ->> 'source_invoice_id';
    v_run_id := substring(v_invoice_id from '^INVOICE-QA_N2_FUNC_([0-9a-f]{32})_');
    if v_stage = 'after_job' and v_run_id is not null
       and new.id ~ ('^JOB-[0-9a-f-]+$')
       and new.source_metadata ->> 'source' = 'invoice_auto_service'
       and new.source_metadata ->> 'operation_key' like '%QA_N2_FUNC_' || v_run_id || '%' then
      raise exception 'QA_N21_FAILPOINT:%', v_stage using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'job_lines' then
    select j.id, j.source_metadata ->> 'source_invoice_id'
      into v_job_id, v_invoice_id
    from public.jobs j where j.id = new.job_id;
    v_run_id := substring(v_invoice_id from '^INVOICE-QA_N2_FUNC_([0-9a-f]{32})_');
    if v_stage = 'after_job_lines' and v_run_id is not null and v_job_id is not null then
      raise exception 'QA_N21_FAILPOINT:%', v_stage using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'invoices' then
    v_run_id := substring(new.id from '^INVOICE-QA_N2_FUNC_([0-9a-f]{32})_');
    if v_stage = 'after_invoice' and v_run_id is not null
       and new.notes like 'QA_N2_FUNC_' || v_run_id || '\_%' escape '\'
       and coalesce(new.pricing_metadata #>> '{n21_business_graph,operation_key}', '') like '%QA_N2_FUNC_' || v_run_id || '%' then
      raise exception 'QA_N21_FAILPOINT:%', v_stage using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'invoice_lines' then
    select i.id into v_invoice_id from public.invoices i where i.id = new.invoice_id;
    v_run_id := substring(v_invoice_id from '^INVOICE-QA_N2_FUNC_([0-9a-f]{32})_');
    if v_stage = 'after_invoice_lines' and v_run_id is not null then
      raise exception 'QA_N21_FAILPOINT:%', v_stage using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;

create or replace function public.qa_n21_failpoint_save(p_request jsonb, p_failpoint text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invoice_id text := p_request -> 'invoice' ->> 'id';
  v_operation_key text := p_request ->> 'operation_key';
  v_run_id text;
  v_user_id uuid;
begin
  v_user_id := app_private.require_active_internal_staff();
  if not exists (select 1 from public.internal_staff_memberships m where m.user_id = v_user_id and m.role in ('owner','admin') and m.status='active' and m.revoked_at is null) then
    raise exception 'N2.1 failpoint requires an active internal administrator.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1' then
    raise exception 'N2.1 failpoint requires the canonical QA issuer.' using errcode = '42501';
  end if;
  if p_failpoint not in ('after_job','after_job_lines','after_invoice','after_invoice_lines') then raise exception 'Invalid N2.1 failpoint.' using errcode = '22023'; end if;
  v_run_id := substring(v_invoice_id from '^INVOICE-QA_N2_FUNC_([0-9a-f]{32})_');
  if v_run_id is null or v_operation_key not like '%QA_N2_FUNC_' || v_run_id || '%' then raise exception 'Failpoint requires exact QA_N2_FUNC provenance.' using errcode = '42501'; end if;
  perform set_config('app.qa_n21_failpoint', p_failpoint, true);
  return public.save_invoice_business_graph(p_request);
end;
$function$;

drop trigger if exists trg_qa_n21_failpoint_jobs on public.jobs;
create constraint trigger trg_qa_n21_failpoint_jobs after insert on public.jobs
deferrable initially immediate for each row execute function public.qa_n21_failpoint_trigger();
drop trigger if exists trg_qa_n21_failpoint_job_lines on public.job_lines;
create constraint trigger trg_qa_n21_failpoint_job_lines after insert on public.job_lines
deferrable initially immediate for each row execute function public.qa_n21_failpoint_trigger();
drop trigger if exists trg_qa_n21_failpoint_invoices on public.invoices;
create constraint trigger trg_qa_n21_failpoint_invoices after insert on public.invoices
deferrable initially immediate for each row execute function public.qa_n21_failpoint_trigger();
drop trigger if exists trg_qa_n21_failpoint_invoice_lines on public.invoice_lines;
create constraint trigger trg_qa_n21_failpoint_invoice_lines after insert on public.invoice_lines
deferrable initially immediate for each row execute function public.qa_n21_failpoint_trigger();

alter function public.qa_n21_failpoint_is_armed(text) owner to postgres;
alter function public.qa_n21_failpoint_trigger() owner to postgres;
alter function public.qa_n21_failpoint_save(jsonb,text) owner to postgres;
revoke all on function public.qa_n21_failpoint_is_armed(text) from public, anon, authenticated;
revoke all on function public.qa_n21_failpoint_trigger() from public, anon, authenticated;
revoke all on function public.qa_n21_failpoint_save(jsonb,text) from public, anon, authenticated;
grant execute on function public.qa_n21_failpoint_save(jsonb,text) to authenticated;

commit;
