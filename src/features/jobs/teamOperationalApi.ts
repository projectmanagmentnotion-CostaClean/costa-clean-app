import { getSupabaseClient } from '../../lib/supabase'
import type { JobTimeEntry, JobTeamAssignment, TeamMember } from './teamOperational'

function clientOrThrow() {
  const { client, error } = getSupabaseClient()
  if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.')
  return client
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await clientOrThrow().from('team_members').select('*').order('full_name')
  if (error) throw error
  return (data ?? []) as TeamMember[]
}

export async function saveTeamMember(member: Partial<TeamMember> & Pick<TeamMember, 'id' | 'full_name'>) {
  const { data, error } = await clientOrThrow().rpc('save_team_member', { p_member: member })
  if (error) throw error
  return data as TeamMember
}

export async function listJobTeamData(jobId: string) {
  const client = clientOrThrow()
  const [assignments, entries] = await Promise.all([
    client.from('job_team_assignments').select('*').eq('job_id', jobId).order('created_at'),
    client.from('job_time_entries').select('*').eq('job_id', jobId).order('work_date'),
  ])
  if (assignments.error) throw assignments.error
  if (entries.error) throw entries.error
  return { assignments: (assignments.data ?? []) as JobTeamAssignment[], entries: (entries.data ?? []) as JobTimeEntry[] }
}

export async function saveJobTeamAssignments(jobId: string, assignments: Array<Partial<JobTeamAssignment> & Pick<JobTeamAssignment, 'team_member_id'>>) {
  const { data, error } = await clientOrThrow().rpc('save_job_team_assignments', { p_job_id: jobId, p_assignments: assignments })
  if (error) throw error
  return data as { job_id: string; assignment_count: number; assignments: JobTeamAssignment[] }
}

export async function saveJobTimeEntry(entry: Partial<JobTimeEntry> & Pick<JobTimeEntry, 'job_id' | 'team_member_id' | 'work_date' | 'minutes'>) {
  const { data, error } = await clientOrThrow().rpc('save_job_time_entry', { p_entry: entry })
  if (error) throw error
  return data as JobTimeEntry
}
