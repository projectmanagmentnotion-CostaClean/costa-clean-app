create or replace function public.simplify_billing_concept(p_concept text)
returns text
language plpgsql
immutable
as $$
declare
  v_compacted text := regexp_replace(coalesce(p_concept, ''), '\s+', ' ', 'g');
begin
  v_compacted := btrim(v_compacted);

  if v_compacted = '' then
    return 'Servicio de limpieza';
  end if;

  return left(v_compacted, 120);
end;
$$;
