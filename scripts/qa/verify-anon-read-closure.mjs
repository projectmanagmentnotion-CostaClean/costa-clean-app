import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertNoPrivilegedFrontendConfig, assertSandboxPublicConfig } from './qaEnvironmentGuardrails.mjs'
import { readSupabaseProjectFingerprint } from './sandboxReadiness.mjs'
import {
  buildAuthenticatedWriteHeaders,
  parsePrivateDbUrl,
  runPrivateQaQuery,
  withAuthenticatedQaSession,
} from './verify-authenticated-rls-writes.mjs'

const EXPECTED_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_PROJECT_REF = 'wfxnwfcdjainpojhbdri'
const TABLES = Object.freeze([
  'clients', 'properties', 'leads', 'invoices', 'invoice_lines',
  'payments', 'quotes', 'quote_lines', 'public_gym_manual_quiz_attempts', 'jobs',
])
const rootDir = process.cwd()
const reportDir = path.join(rootDir, 'qa-reports', 'private', 'anon-closure')
const dbUrlPath = path.join(rootDir, '.project-agent', 'private', 'schema-export', 'qa-db-url.txt')

function resolveMode(args) {
  const modes = args.filter((arg) => arg === '--before' || arg === '--after')
  if (modes.length !== 1) throw new Error('Choose exactly one mode: --before or --after.')
  return modes[0].slice(2)
}

function assertTarget() {
  assertNoPrivilegedFrontendConfig(process.env)
  assertSandboxPublicConfig(process.env)
  const ref = readSupabaseProjectFingerprint(process.env.VITE_SUPABASE_URL)
  if (process.env.QA_ENV !== 'sandbox' || process.env.QA_SANDBOX_PROJECT_REF !== EXPECTED_PROJECT_REF) {
    throw new Error('Anonymous closure verification requires the authorized QA environment.')
  }
  if (ref !== EXPECTED_PROJECT_REF || ref === PRODUCTION_PROJECT_REF) {
    throw new Error('Destination is not the authorized QA project.')
  }
}

const catalogSql = `
select jsonb_build_object(
  'projectRef', '${EXPECTED_PROJECT_REF}',
  'rls', (select coalesce(jsonb_object_agg(c.relname, c.relrowsecurity), '{}'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any(array[${TABLES.map((t) => `'${t}'`).join(',')}])) ,
  'anonSelectPolicies', (select coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'policy', policyname, 'roles', roles)), '[]'::jsonb)
    from pg_policies where schemaname = 'public' and cmd = 'SELECT'
      and tablename = any(array[${TABLES.map((t) => `'${t}'`).join(',')}])
      and roles && array['public'::name, 'anon'::name]),
  'anonTableSelectGrants', (select coalesce(jsonb_agg(jsonb_build_object('table', table_name, 'grantee', grantee)), '[]'::jsonb)
    from information_schema.role_table_grants where table_schema = 'public'
      and table_name = any(array[${TABLES.map((t) => `'${t}'`).join(',')}])
      and privilege_type = 'SELECT' and grantee in ('anon', 'PUBLIC')),
  'sensitiveAnonRpcGrants', (select coalesce(jsonb_agg(jsonb_build_object('function', p.proname, 'args', pg_get_function_identity_arguments(p.oid))), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname = any(array[
        'accept_quote_workflow','assert_invoice_numbering_regular','backfill_invoice_fiscal_snapshots',
        'build_client_fiscal_snapshot','convert_lead_to_client','ensure_invoice_pricing_metadata',
        'find_first_missing_invoice_sequence','record_audit_event','refresh_invoice_payment_status',
        'save_invoice_with_lines','save_invoice_with_lines_v2','save_lead_quote_with_lines',
        'save_payment_and_refresh_invoice','save_quote_with_lines','settle_invoice_by_transfer',
        'update_invoice_status','update_quote_status','require_authenticated_financial_write',
        'require_authenticated_write','create_lead','update_lead'
      ])),
  'sensitiveAuthenticatedRpcGrants', (select coalesce(jsonb_agg(distinct p.proname), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and p.proname = any(array[
        'accept_quote_workflow','assert_invoice_numbering_regular','backfill_invoice_fiscal_snapshots',
        'build_client_fiscal_snapshot','convert_lead_to_client','ensure_invoice_pricing_metadata',
        'find_first_missing_invoice_sequence','record_audit_event','refresh_invoice_payment_status',
        'save_invoice_with_lines','save_invoice_with_lines_v2','save_lead_quote_with_lines',
        'save_payment_and_refresh_invoice','save_quote_with_lines','settle_invoice_by_transfer',
        'update_invoice_status','update_quote_status','create_lead','update_lead'
      ])),
  'anonWritePolicies', (select coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'policy', policyname, 'command', cmd)), '[]'::jsonb)
    from pg_policies where schemaname = 'public'
      and tablename = any(array['leads','invoices','invoice_lines','payments','quotes','quote_lines','public_gym_manual_quiz_attempts'])
      and cmd in ('INSERT','UPDATE','DELETE') and roles && array['public'::name, 'anon'::name]),
  'publicQuizSubmitAnon', coalesce((select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_public_gym_manual_quiz_attempt'), false)
)::text;
`

async function probeTables(accessToken = null) {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anonKey } = process.env
  const headers = accessToken
    ? buildAuthenticatedWriteHeaders(anonKey, accessToken)
    : { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  const results = []
  for (const table of TABLES) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      method: 'HEAD',
      headers,
    })
    results.push({ table, status: response.status, ok: response.ok })
  }
  return results
}

function assertAfter(catalog, anonymous, authenticated) {
  const rlsFailures = TABLES.filter((table) => catalog.rls?.[table] !== true)
  if (rlsFailures.length) throw new Error(`RLS is disabled on: ${rlsFailures.join(', ')}.`)
  if (catalog.anonSelectPolicies.length || catalog.anonTableSelectGrants.length) {
    throw new Error('Anonymous SELECT catalog exposure remains.')
  }
  if (catalog.sensitiveAnonRpcGrants.length) throw new Error('Sensitive anonymous RPC grants remain.')
  if (catalog.anonWritePolicies.length) throw new Error('Legacy anonymous write policies remain.')
  const requiredAuthenticatedRpcs = [
    'accept_quote_workflow','assert_invoice_numbering_regular','backfill_invoice_fiscal_snapshots',
    'build_client_fiscal_snapshot','convert_lead_to_client','ensure_invoice_pricing_metadata',
    'find_first_missing_invoice_sequence','record_audit_event','refresh_invoice_payment_status',
    'save_invoice_with_lines','save_invoice_with_lines_v2','save_lead_quote_with_lines',
    'save_payment_and_refresh_invoice','save_quote_with_lines','settle_invoice_by_transfer',
    'update_invoice_status','update_quote_status','create_lead','update_lead',
  ]
  const missingAuthenticatedRpcs = requiredAuthenticatedRpcs.filter(
    (name) => !catalog.sensitiveAuthenticatedRpcGrants.includes(name),
  )
  if (missingAuthenticatedRpcs.length) {
    throw new Error(`Required authenticated RPC grants are missing: ${missingAuthenticatedRpcs.join(', ')}.`)
  }
  const anonFailures = anonymous.filter((probe) => ![401, 403].includes(probe.status))
  if (anonFailures.length) throw new Error(`Anonymous REST reads remain available on ${anonFailures.length} table(s).`)
  const authFailures = authenticated.filter((probe) => probe.status !== 200)
  if (authFailures.length) throw new Error(`Authenticated REST reads failed on ${authFailures.length} table(s).`)
  if (!catalog.publicQuizSubmitAnon) throw new Error('The allowlisted public quiz submission RPC is unavailable.')
}

async function main() {
  const mode = resolveMode(process.argv.slice(2))
  assertTarget()
  const connection = parsePrivateDbUrl(await fs.readFile(dbUrlPath, 'utf8'))
  const catalog = await runPrivateQaQuery(connection, catalogSql, `anon-closure-${mode}-catalog`)
  const anonymous = await probeTables()
  let authenticated = []
  if (mode === 'after') {
    const result = await withAuthenticatedQaSession(async (accessToken) => {
      const probes = await probeTables(accessToken)
      return { auth: { ok: probes.every((probe) => probe.status === 200), status: probes[0]?.status ?? 0 }, probes }
    })
    authenticated = result.probes
    assertAfter(catalog, anonymous, authenticated)
  }

  const report = {
    generatedAt: new Date().toISOString(), mode, projectRef: EXPECTED_PROJECT_REF,
    productionTouched: false, catalog, anonymous, authenticated,
  }
  await fs.mkdir(reportDir, { recursive: true })
  await fs.writeFile(path.join(reportDir, `qa-anon-${mode}-latest.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  if (mode === 'after') {
    await fs.writeFile(path.join(reportDir, 'qa-rpc-grants-after-latest.json'), `${JSON.stringify({
      generatedAt: report.generatedAt,
      projectRef: EXPECTED_PROJECT_REF,
      sensitiveAnonRpcGrants: catalog.sensitiveAnonRpcGrants,
      sensitiveAuthenticatedRpcGrants: catalog.sensitiveAuthenticatedRpcGrants,
      anonWritePolicies: catalog.anonWritePolicies,
      publicQuizSubmitAnon: catalog.publicQuizSubmitAnon,
    }, null, 2)}\n`, 'utf8')
  }

  process.stdout.write([
    `Destination: QA ${EXPECTED_PROJECT_REF}`,
    `Mode: ${mode}`,
    `Anonymous SELECT policies: ${catalog.anonSelectPolicies.length}`,
    `Anonymous SELECT grants: ${catalog.anonTableSelectGrants.length}`,
    `Sensitive anonymous RPC grants: ${catalog.sensitiveAnonRpcGrants.length}`,
    `Legacy anonymous write policies: ${catalog.anonWritePolicies?.length ?? 'not-captured'}`,
    `Sensitive authenticated RPC grants: ${catalog.sensitiveAuthenticatedRpcGrants?.length ?? 'not-captured'}`,
    `Anonymous REST statuses: ${anonymous.map((item) => `${item.table}=${item.status}`).join(', ')}`,
    mode === 'after' ? `Authenticated REST statuses: ${authenticated.map((item) => `${item.table}=${item.status}`).join(', ')}` : '',
    'Production touched: no',
    '',
  ].filter(Boolean).join('\n'))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`Anonymous read closure verification failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
