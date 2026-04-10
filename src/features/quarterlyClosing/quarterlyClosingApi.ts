import { getSupabaseClient } from '../../lib/supabase'
import type {
  QuarterlyClosingRecord,
  QuarterlyClosingSnapshot,
  QuarterlyClosingStatus,
} from './types'

const QUARTERLY_CLOSINGS_SELECT = [
  'id',
  'fiscal_year',
  'fiscal_quarter',
  'status',
  'closed_at',
  'notes',
  'snapshot_json',
  'created_at',
  'updated_at',
].join(',')

export async function listQuarterlyClosings(): Promise<QuarterlyClosingRecord[]> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const { data, error: queryError } = await client
    .from('quarterly_closings')
    .select(QUARTERLY_CLOSINGS_SELECT)
    .order('fiscal_year', { ascending: false })
    .order('fiscal_quarter', { ascending: false })

  if (queryError) {
    throw new Error(queryError.message)
  }

  return (data ?? []) as unknown as QuarterlyClosingRecord[]
}

interface SaveQuarterlyClosingInput {
  fiscalYear: number
  fiscalQuarter: number
  status: QuarterlyClosingStatus
  notes: string | null
  snapshot: QuarterlyClosingSnapshot
}

export async function saveQuarterlyClosing({
  fiscalYear,
  fiscalQuarter,
  status,
  notes,
  snapshot,
}: SaveQuarterlyClosingInput): Promise<QuarterlyClosingRecord> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const { data, error: upsertError } = await client
    .from('quarterly_closings')
    .upsert(
      {
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        status,
        closed_at: new Date().toISOString(),
        notes,
        snapshot_json: snapshot,
      },
      { onConflict: 'fiscal_year,fiscal_quarter' },
    )
    .select(QUARTERLY_CLOSINGS_SELECT)
    .single()

  if (upsertError) {
    throw new Error(upsertError.message)
  }

  return data as unknown as QuarterlyClosingRecord
}
