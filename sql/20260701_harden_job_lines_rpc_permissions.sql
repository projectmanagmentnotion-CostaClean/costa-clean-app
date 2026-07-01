grant usage on schema public to anon, authenticated;

grant select on public.job_lines to anon, authenticated;

revoke execute on function public.save_job_with_lines(jsonb, jsonb) from public, anon;
grant execute on function public.save_job_with_lines(jsonb, jsonb) to authenticated;
