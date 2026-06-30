import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSupabasePublicEnv } from '../src/lib/supabaseEnv.ts'
import {
  applyManualClientFiscalBackfill,
  buildManualClientFiscalBackfillPlan,
  manualClientFiscalEntries,
} from '../src/features/clients/manualClientFiscalBackfill.ts'
import type { ClientListItem } from '../src/features/clients/types.ts'

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return

  const envText = fs.readFileSync(filePath, 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

async function listClients(): Promise<ClientListItem[]> {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan variables de entorno de Supabase para ejecutar el backfill manual.')
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/clients?select=id,display_code,created_at,full_name,phone,email,tax_id,billing_address,status,source_lead_id&order=created_at.desc&limit=1000`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error(`No se pudieron cargar clientes: ${response.status} ${response.statusText}`)
  }

  return ((await response.json()) as ClientListItem[]) ?? []
}

async function main() {
  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  loadEnvFile(path.join(workspaceRoot, '.env.local'))

  const clients = await listClients()
  const plan = buildManualClientFiscalBackfillPlan(clients, manualClientFiscalEntries)
  const shouldApply = process.argv.includes('--apply')
  const result = shouldApply
    ? await applyManualClientFiscalBackfill(plan)
    : {
        updatedClients: plan.updates.map((update) => ({
          clientId: update.clientId,
          clientDisplayCode: update.clientDisplayCode,
          clientName: update.clientName,
          referenceName: update.referenceName,
          appliedFields: update.appliedFields,
        })),
        unchangedClients: plan.unchanged,
        notFound: plan.notFound,
        conflicts: plan.conflicts,
      }

  console.log(JSON.stringify({
    mode: shouldApply ? 'apply' : 'dry-run',
    sourceEntries: manualClientFiscalEntries.length,
    foundClients: plan.updates.length + plan.unchanged.length,
    updatedClients: result.updatedClients,
    unchangedClients: result.unchangedClients,
    notFound: result.notFound,
    conflicts: result.conflicts,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
