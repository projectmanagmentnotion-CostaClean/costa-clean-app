create or replace function public.prevent_fiscal_invoice_hard_delete()
returns trigger
language plpgsql
as $function$
begin
  if old.status in ('issued', 'paid') or old.invoice_number is not null or old.display_code is not null then
    if current_setting('app.qa_n3_fixture_teardown', true) = 'true'
      and coalesce(auth.jwt() ->> 'iss', '') = 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'
      and old.id like 'QA_N3_INVOICE_%'
      and coalesce(old.notes, '') ~ '^QA_N3_[0-9a-f]{32}\|source=n3_numbering_certification$' then
      return old;
    end if;
    if coalesce(auth.jwt() ->> 'iss', '') = 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'
      and old.id like 'QA_N2_INVOICE_%'
      and coalesce(old.notes, '') ~ '^QA_N2_CONC_[0-9a-f]{32}\|source=n2_concurrency_certification$' then
      return old;
    end if;
    raise exception 'Las facturas con numeracion fiscal no se pueden eliminar; deben conservar su trazabilidad.' using errcode = '55000';
  end if;
  return old;
end;
$function$;

alter function public.prevent_fiscal_invoice_hard_delete() owner to postgres;
