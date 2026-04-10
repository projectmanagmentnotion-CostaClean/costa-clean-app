import { getSupabaseClient } from '../../lib/supabase'
import type {
  AnnualClosingRecord,
  AnnualClosingSnapshot,
  AnnualClosingStatus,
} from './types'

const ANNUAL_CLOSINGS_SELECT = [
  'id',
  'fiscal_year',
  'status',
  'closed_at',
  'notes',
  'snapshot_json',
  'created_at',
  'updated_at',
].join(',')

export async function listAnnualClosings(): Promise<AnnualClosingRecord[]> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const { data, error: queryError } = await client
    .from('annual_closings')
    .select(ANNUAL_CLOSINGS_SELECT)
    .order('fiscal_year', { ascending: false })

  if (queryError) {
    throw new Error(queryError.message)
  }

  return (data ?? []) as unknown as AnnualClosingRecord[]
}

interface SaveAnnualClosingInput {
  fiscalYear: number
  status: AnnualClosingStatus
  notes: string | null
  snapshot: AnnualClosingSnapshot
}

export async function saveAnnualClosing({
  fiscalYear,
  status,
  notes,
  snapshot,
}: SaveAnnualClosingInput): Promise<AnnualClosingRecord> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const { data, error: upsertError } = await client
    .from('annual_closings')
    .upsert(
      {
        fiscal_year: fiscalYear,
        status,
        closed_at: new Date().toISOString(),
        notes,
        snapshot_json: snapshot,
      },
      { onConflict: 'fiscal_year' },
    )
    .select(ANNUAL_CLOSINGS_SELECT)
    .single()

  if (upsertError) {
    throw new Error(upsertError.message)
  }

  return data as unknown as AnnualClosingRecord
}
