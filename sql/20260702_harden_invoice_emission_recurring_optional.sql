do $$
begin
  if to_regclass('public.recurring_invoice_plans') is null then
    raise notice 'Skipping recurring invoice hardening: public.recurring_invoice_plans does not exist.';
    return;
  end if;

  execute $sql$
    create or replace function public.generate_invoice_from_recurring_plan(
      p_plan_id text,
      p_invoice_id text default null,
      p_issue_date date default current_date
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = public, pg_temp
    as $fn$
    declare
      v_plan public.recurring_invoice_plans%rowtype;
      v_invoice_id text := coalesce(nullif(p_invoice_id, ''), 'INVOICE-' || gen_random_uuid()::text);
      v_subtotal numeric := 0;
      v_tax_amount numeric := 0;
      v_total numeric := 0;
      v_next_issue_date date := p_issue_date;
    begin
      perform public.require_authenticated_financial_write();

      if nullif(p_plan_id, '') is null then
        raise exception 'La automatizacion recurrente necesita identificador.';
      end if;

      select *
      into v_plan
      from public.recurring_invoice_plans
      where id = p_plan_id
      for update;

      if not found then
        raise exception 'No se encontro la automatizacion recurrente indicada.';
      end if;

      if v_plan.status <> 'active' then
        raise exception 'Solo se pueden emitir facturas desde automatizaciones activas.';
      end if;

      select coalesce(sum((line ->> 'line_subtotal')::numeric), 0)
      into v_subtotal
      from jsonb_array_elements(v_plan.template_lines) as line;

      v_tax_amount := round(v_subtotal * coalesce(v_plan.tax_rate, 0.21), 2);
      v_total := round(v_subtotal + v_tax_amount, 2);

      if public.invoice_status_consumes_fiscal_number(v_plan.default_invoice_status) then
        perform public.assert_invoice_numbering_regular(extract(year from p_issue_date)::integer, v_invoice_id);
      end if;

      insert into public.invoices (
        id,
        job_id,
        quote_id,
        client_id,
        property_id,
        issue_date,
        status,
        subtotal,
        tax_amount,
        total,
        notes,
        internal_notes,
        pricing_metadata
      )
      values (
        v_invoice_id,
        null,
        v_plan.quote_id,
        v_plan.client_id,
        v_plan.property_id,
        p_issue_date,
        v_plan.default_invoice_status,
        v_subtotal,
        v_tax_amount,
        v_total,
        nullif(v_plan.notes, ''),
        concat_ws(E'\n\n',
          'Factura generada desde automatizacion recurrente.',
          nullif(v_plan.internal_notes, '')
        ),
        public.ensure_invoice_pricing_metadata(
          coalesce(v_plan.pricing_metadata, '{}'::jsonb) || jsonb_build_object(
            'recurring_plan_id', v_plan.id,
            'recurring_plan_title', v_plan.title,
            'generated_from_recurring_plan', true
          ),
          v_plan.client_id,
          'client_backfill'
        )
      );

      insert into public.invoice_lines (
        id,
        invoice_id,
        sort_order,
        concept,
        quantity,
        unit,
        unit_price,
        line_subtotal
      )
      select
        'INVOICE-LINE-' || gen_random_uuid()::text,
        v_invoice_id,
        row_number() over (),
        trim(coalesce(line ->> 'concept', '')),
        (line ->> 'quantity')::numeric,
        coalesce(nullif(trim(coalesce(line ->> 'unit', '')), ''), 'servicio'),
        (line ->> 'unit_price')::numeric,
        (line ->> 'line_subtotal')::numeric
      from jsonb_array_elements(v_plan.template_lines) as line;

      if v_plan.frequency = 'weekly' then
        v_next_issue_date := p_issue_date + 7;
      elsif v_plan.frequency = 'biweekly' then
        v_next_issue_date := p_issue_date + 14;
      elsif v_plan.frequency = 'monthly' then
        v_next_issue_date := (p_issue_date + interval '1 month')::date;
      else
        v_next_issue_date := (p_issue_date + interval '3 month')::date;
      end if;

      update public.recurring_invoice_plans
      set
        last_issued_at = now(),
        next_issue_date = v_next_issue_date,
        updated_at = now()
      where id = v_plan.id;

      perform public.refresh_invoice_payment_status(v_invoice_id);

      return jsonb_build_object(
        'invoice_id', v_invoice_id,
        'plan_id', v_plan.id,
        'next_issue_date', v_next_issue_date
      );
    end;
    $fn$;
  $sql$;

  execute 'grant execute on function public.generate_invoice_from_recurring_plan(text, text, date) to authenticated';
end $$;
