grant usage on schema public to authenticated;
grant select on public.job_lines to authenticated;
revoke select on public.job_lines from anon;

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'job_lines'
      and rowsecurity
  ) then
    execute 'drop policy if exists "authenticated can read job lines for readable jobs" on public.job_lines';
    execute $policy$
      create policy "authenticated can read job lines for readable jobs"
      on public.job_lines
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.jobs j
          where j.id = job_lines.job_id
        )
      )
    $policy$;
  end if;
end;
$$;
