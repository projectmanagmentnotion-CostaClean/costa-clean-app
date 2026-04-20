-- Resolve lead-owned draft quote updates server-side so duplicate prevention is not a dead end.

create or replace function public.save_lead_quote_with_lines(
  p_lead_id text,
  p_intake_submission_id text,
  p_quote jsonb,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead_id text := nullif(p_lead_id, '');
  v_intake_id text := nullif(p_intake_submission_id, '');
  v_requested_quote_id text := nullif(p_quote ->> 'id', '');
  v_quote_id text;
  v_existing record;
  v_quote_payload jsonb;
begin
  perform public.require_authenticated_financial_write();

  if v_lead_id is null then
    raise exception 'El lead es obligatorio para guardar el presupuesto.';
  end if;

  if v_intake_id is not null then
    select q.id, q.status
    into v_existing
    from public.intake_submissions i
    join public.quotes q on q.id = i.quote_id
    where i.id = v_intake_id
    limit 1
    for update of q;

    if found then
      if v_existing.status in ('draft', 'sent', 'pending', 'pending_review') then
        v_quote_id := v_existing.id;
      else
        raise exception 'Este intake ya tiene un presupuesto finalizado. No se sobrescribira automaticamente.';
      end if;
    end if;
  end if;

  if v_quote_id is null then
    select id, status
    into v_existing
    from public.quotes
    where lead_id = v_lead_id
      and status in ('draft', 'sent', 'pending', 'pending_review')
    order by created_at desc
    limit 1
    for update;

    if found then
      v_quote_id := v_existing.id;
    end if;
  end if;

  if v_quote_id is null and exists (
    select 1
    from public.quotes
    where lead_id = v_lead_id
      and status in ('accepted', 'rejected', 'expired', 'cancelled')
  ) then
    raise exception 'Este lead ya tiene un presupuesto finalizado. No se creara otro borrador automaticamente.';
  end if;

  v_quote_id := coalesce(v_quote_id, v_requested_quote_id, 'QUOTE-' || gen_random_uuid()::text);
  v_quote_payload := p_quote || jsonb_build_object(
    'id', v_quote_id,
    'lead_id', v_lead_id,
    'client_id', null,
    'status', coalesce(nullif(p_quote ->> 'status', ''), 'draft')
  );

  perform public.save_quote_with_lines(v_quote_payload, p_lines);

  if v_intake_id is not null then
    update public.intake_submissions
    set
      status = 'converted',
      lead_id = v_lead_id,
      quote_id = v_quote_id
    where id = v_intake_id;
  end if;

  update public.lead_drafts
  set
    status = 'converted',
    matched_lead_id = v_lead_id
  where intake_submission_id = v_intake_id;

  update public.leads
  set status = 'quoted'
  where id = v_lead_id
    and status <> 'won';

  return jsonb_build_object(
    'quote_id', v_quote_id,
    'lead_id', v_lead_id,
    'action', case when v_requested_quote_id = v_quote_id then 'created_or_updated' else 'resolved_existing' end
  );
end;
$$;

revoke execute on function public.save_lead_quote_with_lines(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_lead_quote_with_lines(text, text, jsonb, jsonb) to authenticated;
