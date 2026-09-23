begin;

-- QA-only corrective migration. It narrows the existing planner's plan-root
-- match to the canonical exact identity ending in -ROOT.
do $correction$
declare
  v_definition text;
  v_old text := 'p.id like ''PLAN-'' || v_token || ''\_%'' escape ''\''';
  v_new text := 'p.id = ''PLAN-'' || v_token || ''-ROOT''';
begin
  select pg_get_functiondef('public.qa_n4_func_teardown_plan(text)'::regprocedure)
    into v_definition;
  if position(v_old in v_definition) = 0 then
    raise exception 'N4 teardown planner root pattern not found; refusing correction.' using errcode = '55000';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;
end;
$correction$;

commit;
