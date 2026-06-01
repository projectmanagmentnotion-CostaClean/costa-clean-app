create extension if not exists pgcrypto;

create table if not exists public.public_gym_manual_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  nombre_trabajador text not null,
  puntuacion integer not null check (puntuacion >= 0),
  porcentaje integer not null check (porcentaje >= 0 and porcentaje <= 100),
  aprobado boolean not null,
  fecha timestamptz not null default timezone('utc', now()),
  respuestas_json jsonb not null default '{}'::jsonb,
  errores_json jsonb not null default '[]'::jsonb,
  total_preguntas integer not null check (total_preguntas > 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint public_gym_manual_quiz_attempts_worker_name_length
    check (char_length(btrim(nombre_trabajador)) between 2 and 120)
);

create index if not exists public_gym_manual_quiz_attempts_fecha_idx
  on public.public_gym_manual_quiz_attempts (fecha desc);

grant usage on schema public to anon, authenticated;
grant select, insert on public.public_gym_manual_quiz_attempts to anon, authenticated;

alter table public.public_gym_manual_quiz_attempts enable row level security;

drop policy if exists "Public can read gym manual quiz attempts" on public.public_gym_manual_quiz_attempts;
create policy "Public can read gym manual quiz attempts"
  on public.public_gym_manual_quiz_attempts
  for select
  using (true);

drop policy if exists "Public can insert gym manual quiz attempts" on public.public_gym_manual_quiz_attempts;
create policy "Public can insert gym manual quiz attempts"
  on public.public_gym_manual_quiz_attempts
  for insert
  with check (true);
