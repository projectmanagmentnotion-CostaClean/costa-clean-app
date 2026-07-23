begin;

create table public.public_quiz_submission_guards (
  nonce_hash text primary key,
  fingerprint_hash text not null,
  seen_at timestamptz not null default clock_timestamp(),
  accepted_at timestamptz,
  expires_at timestamptz not null,
  constraint public_quiz_submission_guards_nonce_hash_check
    check (nonce_hash ~ '^[0-9a-f]{64}$'),
  constraint public_quiz_submission_guards_fingerprint_hash_check
    check (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  constraint public_quiz_submission_guards_accepted_at_check
    check (accepted_at is null or accepted_at >= seen_at),
  constraint public_quiz_submission_guards_expiry_check
    check (expires_at > seen_at and expires_at <= seen_at + interval '24 hours 1 minute')
);

alter table public.public_quiz_submission_guards enable row level security;
revoke all on table public.public_quiz_submission_guards from public, anon, authenticated;

create index public_quiz_submission_guards_fingerprint_accepted_idx
  on public.public_quiz_submission_guards (fingerprint_hash, accepted_at desc)
  where accepted_at is not null;
create index public_quiz_submission_guards_expires_idx
  on public.public_quiz_submission_guards (expires_at);

create or replace function public.submit_public_gym_manual_quiz_attempt_private(
  p_request jsonb,
  p_fingerprint_hash text,
  p_nonce_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_now_ms bigint := floor(extract(epoch from v_now) * 1000)::bigint;
  v_name text;
  v_started_at bigint;
  v_duration bigint;
  v_score integer;
  v_percentage integer;
  v_answers jsonb;
  v_correct_answers constant jsonb := '{
    "q01":"b","q02":"c","q03":"d","q04":"a","q05":"c",
    "q06":"b","q07":"d","q08":"a","q09":"b","q10":"c",
    "q11":"a","q12":"d","q13":"b","q14":"c","q15":"a",
    "q16":"d","q17":"b","q18":"c","q19":"b","q20":"c"
  }'::jsonb;
  v_incorrect jsonb;
  v_recent_count integer;
  v_last_accepted timestamptz;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object'
    or (select count(*) from jsonb_object_keys(p_request)) <> 7
    or exists (
      select 1 from jsonb_object_keys(p_request) as key
      where key not in (
        'workerName', 'quizVersion', 'answers', 'honeypot',
        'interactionStartedAt', 'interactionDurationMs', 'requestNonce'
      )
    )
    or not (p_request ?& array[
      'workerName', 'quizVersion', 'answers', 'honeypot',
      'interactionStartedAt', 'interactionDurationMs', 'requestNonce'
    ])
  then
    raise exception 'invalid quiz request' using errcode = '22023';
  end if;

  if jsonb_typeof(p_request -> 'workerName') <> 'string'
    or jsonb_typeof(p_request -> 'quizVersion') <> 'string'
    or jsonb_typeof(p_request -> 'answers') <> 'object'
    or jsonb_typeof(p_request -> 'honeypot') <> 'string'
    or jsonb_typeof(p_request -> 'interactionStartedAt') <> 'number'
    or jsonb_typeof(p_request -> 'interactionDurationMs') <> 'number'
    or jsonb_typeof(p_request -> 'requestNonce') <> 'string'
  then
    raise exception 'invalid quiz request' using errcode = '22023';
  end if;

  v_name := p_request ->> 'workerName';
  if v_name <> btrim(regexp_replace(v_name, '[[:space:]]+', ' ', 'g'))
    or char_length(v_name) not between 2 and 120
    or p_request ->> 'quizVersion' <> 'gym-manual-2026-07-22-v1'
    or p_request ->> 'honeypot' <> ''
    or p_request ->> 'requestNonce' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_fingerprint_hash !~ '^[0-9a-f]{64}$'
    or p_nonce_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'invalid quiz request' using errcode = '22023';
  end if;

  begin
    v_started_at := (p_request ->> 'interactionStartedAt')::bigint;
    v_duration := (p_request ->> 'interactionDurationMs')::bigint;
  exception when others then
    raise exception 'invalid quiz request' using errcode = '22023';
  end;
  if v_duration not between 30000 and 7200000
    or v_started_at > v_now_ms + 10000
    or v_now_ms - v_started_at > 7210000
    or abs((v_now_ms - v_started_at) - v_duration) > 10000
  then
    raise exception 'invalid quiz request' using errcode = '22023';
  end if;

  v_answers := p_request -> 'answers';
  if (select count(*) from jsonb_object_keys(v_answers)) <> 20
    or exists (
      select 1
      from jsonb_each(v_correct_answers) expected(key, value)
      where not (v_answers ? expected.key)
        or jsonb_typeof(v_answers -> expected.key) <> 'string'
        or v_answers ->> expected.key not in ('a', 'b', 'c', 'd')
    )
    or exists (
      select 1 from jsonb_object_keys(v_answers) as key
      where not (v_correct_answers ? key)
    )
  then
    raise exception 'invalid quiz request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint_hash, 0));

  delete from public.public_quiz_submission_guards
  where ctid in (
    select ctid from public.public_quiz_submission_guards
    where expires_at <= v_now
    order by expires_at
    limit 100
  );

  insert into public.public_quiz_submission_guards (
    nonce_hash, fingerprint_hash, seen_at, expires_at
  ) values (
    p_nonce_hash, p_fingerprint_hash, v_now, v_now + interval '24 hours'
  ) on conflict (nonce_hash) do nothing;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'rate_limited', 'message', 'Espera antes de volver a intentarlo.'),
      'retryAfterSeconds', 60
    );
  end if;

  select count(*), max(accepted_at)
    into v_recent_count, v_last_accepted
  from public.public_quiz_submission_guards
  where fingerprint_hash = p_fingerprint_hash
    and accepted_at >= v_now - interval '15 minutes';

  if v_last_accepted is not null and v_last_accepted > v_now - interval '60 seconds'
    or v_recent_count >= 3
  then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'rate_limited', 'message', 'Espera antes de volver a intentarlo.'),
      'retryAfterSeconds', 60
    );
  end if;

  select count(*) filter (where v_answers ->> expected.key = expected.value #>> '{}')
    into v_score
  from jsonb_each(v_correct_answers) expected(key, value);
  v_percentage := round((v_score::numeric * 100) / 20)::integer;

  select coalesce(jsonb_agg(expected.key order by expected.key), '[]'::jsonb)
    into v_incorrect
  from jsonb_each(v_correct_answers) expected(key, value)
  where v_answers ->> expected.key <> expected.value #>> '{}';

  insert into public.public_gym_manual_quiz_attempts (
    nombre_trabajador, puntuacion, porcentaje, aprobado,
    respuestas_json, errores_json, total_preguntas
  ) values (
    v_name, v_score, v_percentage, v_percentage >= 80,
    v_answers, v_incorrect, 20
  );

  update public.public_quiz_submission_guards
  set accepted_at = v_now
  where nonce_hash = p_nonce_hash;

  return jsonb_build_object(
    'ok', true,
    'result', jsonb_build_object(
      'score', v_score,
      'percentage', v_percentage,
      'passed', v_percentage >= 80,
      'totalQuestions', 20,
      'incorrectQuestionIds', v_incorrect
    )
  );
end;
$$;

revoke execute on function public.submit_public_gym_manual_quiz_attempt(jsonb)
  from public, anon, authenticated;
revoke execute on function public.submit_public_gym_manual_quiz_attempt_private(jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_gym_manual_quiz_attempt_private(jsonb, text, text)
  to service_role;

commit;
