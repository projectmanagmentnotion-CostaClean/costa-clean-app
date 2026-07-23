import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const migrationName = '20260722171428_public_quiz_providerless_abuse_protection.sql'
const migrationPath = path.resolve('supabase', 'migrations', migrationName)
const migrationSql = readFileSync(migrationPath, 'utf8')
const transactionBoundaries = (migrationSql.match(/^\s*(?:begin|commit);\s*$/gimu) ?? []).length
const privateTempRoot = path.join('.project-agent', 'private', 'tmp')
mkdirSync(privateTempRoot, { recursive: true })
const workDir = mkdtempSync(path.join(privateTempRoot, 'gate4b-'))
const clusterDir = path.join(workDir, 'cluster')
const portableClusterDir = clusterDir.replaceAll('\\', '/')
const port = String(55441 + Math.floor(Math.random() * 500))
const postgres = findPostgres()
let started = false
let serverProcess = null

try {
  run(postgres.initdb, [`--pgdata=${portableClusterDir}`, '--username=postgres', '--auth=trust', '--encoding=UTF8', '--no-locale'])
  serverProcess = spawn(postgres.server, ['-D', portableClusterDir, '-F', '-p', port, '-h', '127.0.0.1'], {
    windowsHide: true,
    stdio: 'ignore',
    env: { ...process.env, PG_RESTRICT_EXEC: '1' },
  })
  await waitForServer()
  started = true

  psql(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create table public.public_gym_manual_quiz_attempts (
      id uuid default gen_random_uuid() primary key,
      nombre_trabajador text not null,
      puntuacion integer not null,
      porcentaje integer not null check (porcentaje between 0 and 100),
      aprobado boolean not null,
      fecha timestamptz default timezone('utc', now()) not null,
      respuestas_json jsonb default '{}'::jsonb not null,
      errores_json jsonb default '[]'::jsonb not null,
      total_preguntas integer not null check (total_preguntas > 0),
      created_at timestamptz default timezone('utc', now()) not null,
      constraint public_gym_manual_quiz_attempts_worker_name_length
        check (char_length(btrim(nombre_trabajador)) between 2 and 120)
    );
    alter table public.public_gym_manual_quiz_attempts enable row level security;
    create function public.submit_public_gym_manual_quiz_attempt(p_attempt jsonb)
      returns jsonb language sql security definer set search_path=public,pg_temp
      as 'select p_attempt';
    grant execute on function public.submit_public_gym_manual_quiz_attempt(jsonb) to anon, authenticated;
  `)

  run(postgres.psql, connectionArgs().concat(['--set=ON_ERROR_STOP=1', '--file', migrationPath]))

  const result = psql(`
    do $proof$
    declare
      v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
      v_request jsonb;
      v_result jsonb;
      v_second jsonb;
    begin
      if not exists (
        select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='public_quiz_submission_guards' and c.relrowsecurity
      ) then raise exception 'guard RLS proof failed'; end if;
      if has_function_privilege('anon', 'public.submit_public_gym_manual_quiz_attempt(jsonb)', 'EXECUTE')
        or has_function_privilege('authenticated', 'public.submit_public_gym_manual_quiz_attempt(jsonb)', 'EXECUTE')
      then raise exception 'legacy RPC remains executable'; end if;
      if has_function_privilege('anon', 'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)', 'EXECUTE')
        or has_function_privilege('authenticated', 'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)', 'EXECUTE')
        or not has_function_privilege('service_role', 'public.submit_public_gym_manual_quiz_attempt_private(jsonb,text,text)', 'EXECUTE')
      then raise exception 'private RPC grants proof failed'; end if;
      if has_table_privilege('anon', 'public.public_quiz_submission_guards', 'SELECT')
        or has_table_privilege('authenticated', 'public.public_quiz_submission_guards', 'SELECT')
      then raise exception 'guard table exposure proof failed'; end if;

      v_request := jsonb_build_object(
        'workerName', 'QA-GATE4B-LOCAL-PROOF',
        'quizVersion', 'gym-manual-2026-07-22-v1',
        'answers', '{"q01":"a","q02":"c","q03":"d","q04":"a","q05":"c","q06":"b","q07":"d","q08":"a","q09":"b","q10":"c","q11":"a","q12":"d","q13":"b","q14":"c","q15":"a","q16":"d","q17":"b","q18":"c","q19":"b","q20":"c"}'::jsonb,
        'honeypot', '',
        'interactionStartedAt', v_now_ms - 31000,
        'interactionDurationMs', 31000,
        'requestNonce', '123e4567-e89b-42d3-a456-426614174000'
      );
      v_result := public.submit_public_gym_manual_quiz_attempt_private(v_request, repeat('a',64), repeat('b',64));
      if v_result #>> '{ok}' <> 'true' or (v_result #>> '{result,score}')::integer <> 19
        or v_result #>> '{result,percentage}' <> '95'
      then raise exception 'authoritative scoring proof failed'; end if;
      if (select count(*) from public.public_gym_manual_quiz_attempts where nombre_trabajador='QA-GATE4B-LOCAL-PROOF') <> 1
      then raise exception 'attempt insertion proof failed'; end if;

      v_second := public.submit_public_gym_manual_quiz_attempt_private(v_request, repeat('a',64), repeat('b',64));
      if v_second #>> '{ok}' <> 'false' then raise exception 'replay proof failed'; end if;
      v_request := jsonb_set(v_request, '{requestNonce}', '"123e4567-e89b-42d3-a456-426614174001"');
      v_second := public.submit_public_gym_manual_quiz_attempt_private(v_request, repeat('a',64), repeat('c',64));
      if v_second #>> '{ok}' <> 'false' then raise exception 'cooldown proof failed'; end if;
      if (select count(*) from public.public_gym_manual_quiz_attempts where nombre_trabajador='QA-GATE4B-LOCAL-PROOF') <> 1
      then raise exception 'rate denial inserted an attempt'; end if;

      begin
        perform public.submit_public_gym_manual_quiz_attempt_private(v_request || '{"forgedScore":20}'::jsonb, repeat('d',64), repeat('e',64));
        raise exception 'unknown field proof failed';
      exception when sqlstate '22023' then null;
      end;

      delete from public.public_gym_manual_quiz_attempts where nombre_trabajador='QA-GATE4B-LOCAL-PROOF';
      delete from public.public_quiz_submission_guards where fingerprint_hash=repeat('a',64);
      if (select count(*) from public.public_gym_manual_quiz_attempts) <> 0
        or (select count(*) from public.public_quiz_submission_guards) <> 0
      then raise exception 'cleanup proof failed'; end if;
    end;
    $proof$;
    select json_build_object(
      'migration', '${migrationName}',
      'transactionBoundaries', ${transactionBoundaries},
      'attemptRows', (select count(*) from public.public_gym_manual_quiz_attempts),
      'guardRows', (select count(*) from public.public_quiz_submission_guards),
      'proof', 'PASS'
    );
  `)
  process.stdout.write(`Disposable PostgreSQL proof: ${result.trim()}\n`)
} finally {
  if (started) {
    const stopped = spawnSync(postgres.pgCtl, ['-D', portableClusterDir, '-m', 'fast', '-w', 'stop'], {
      encoding: 'utf8', windowsHide: true, env: { ...process.env, PG_RESTRICT_EXEC: '1' },
    })
    if (stopped.status !== 0) serverProcess?.kill()
  } else {
    serverProcess?.kill()
  }
  rmSync(workDir, { recursive: true, force: true })
}

function connectionArgs() {
  return ['--host', '127.0.0.1', '--port', port, '--username', 'postgres', '--dbname', 'postgres', '--no-password']
}

function psql(sql) {
  return run(postgres.psql, connectionArgs().concat(['--set=ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--command', sql]))
}

function run(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, PG_RESTRICT_EXEC: '1' },
  })
  if (result.status !== 0) throw new Error(`Command failed (${path.basename(executable)}): ${result.stderr.trim()}`)
  return result.stdout
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = spawnSync(postgres.pgIsReady, ['--host', '127.0.0.1', '--port', port], {
      encoding: 'utf8', windowsHide: true,
    })
    if (ready.status === 0) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Disposable PostgreSQL did not become ready.')
}

function findPostgres() {
  const candidates = [
    'C:/Program Files/PostgreSQL/17/bin',
    'C:/Program Files/PostgreSQL/16/bin',
    'C:/Program Files/PostgreSQL/15/bin',
  ]
  for (const bin of candidates) {
    const tools = {
      initdb: path.join(bin, 'initdb.exe'),
      pgCtl: path.join(bin, 'pg_ctl.exe'),
      psql: path.join(bin, 'psql.exe'),
      pgIsReady: path.join(bin, 'pg_isready.exe'),
      server: path.join(bin, 'postgres.exe'),
    }
    if (Object.values(tools).every(existsSync)) return tools
  }
  throw new Error('PostgreSQL initdb/pg_ctl/psql are unavailable; disposable proof not executed.')
}
