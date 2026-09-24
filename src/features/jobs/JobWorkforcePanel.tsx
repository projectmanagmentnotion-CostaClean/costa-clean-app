import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeHoursToMinutes, summarizeJobLabor, type JobTeamAssignment, type JobTimeEntry, type TeamMember } from './teamOperational'
import { listJobTeamData, listTeamMembers, saveJobTeamAssignments, saveJobTimeEntry } from './teamOperationalApi'

export function JobWorkforcePanel({ jobId, onRefresh }: { jobId: string; onRefresh: () => Promise<void> }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [assignments, setAssignments] = useState<JobTeamAssignment[]>([])
  const [entries, setEntries] = useState<JobTimeEntry[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [plannedHours, setPlannedHours] = useState<Record<string, string>>({})
  const [hours, setHours] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const summary = useMemo(() => summarizeJobLabor(assignments, entries), [assignments, entries])

  const refresh = useCallback(async () => {
    try { const [team, data] = await Promise.all([listTeamMembers(), listJobTeamData(jobId)]); setMembers(team); setAssignments(data.assignments); setEntries(data.entries); setSelected(data.assignments.filter((item) => item.status !== 'cancelled').map((item) => item.team_member_id)); setError(null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el equipo del servicio.') }
  }, [jobId])
  useEffect(() => { void refresh() }, [refresh])

  async function saveAssignments() {
    setSaving(true)
    try { await saveJobTeamAssignments(jobId, selected.map((memberId) => ({ team_member_id: memberId, planned_minutes: plannedHours[memberId] ? normalizeHoursToMinutes(Number(plannedHours[memberId])) : null }))); await refresh(); await onRefresh() } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el equipo asignado.') } finally { setSaving(false) }
  }

  async function recordHours(memberId: string) {
    setSaving(true)
    try { await saveJobTimeEntry({ job_id: jobId, team_member_id: memberId, work_date: new Date().toISOString().slice(0, 10), minutes: normalizeHoursToMinutes(Number(hours[memberId] ?? '0')) }); setHours({ ...hours, [memberId]: '' }); await refresh(); await onRefresh() } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'No se pudieron registrar las horas.') } finally { setSaving(false) }
  }

  return <section className="data-section" data-qa="job-workforce"><div className="section-header"><div><h2>Equipo asignado</h2><p>Planificado: {summary.plannedMinutes} min · Registrado: {summary.actualMinutes} min · Coste de personal: {summary.actualLaborCost.toFixed(2)} €</p></div><button type="button" className="primary-button" onClick={() => void saveAssignments()} disabled={saving}>Guardar equipo</button></div>
    {members.filter((member) => member.status === 'active' || selected.includes(member.id)).map((member) => <article key={member.id} className="cc-list-section__header"><div><label><input type="checkbox" checked={selected.includes(member.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, member.id] : selected.filter((id) => id !== member.id))} /> {member.full_name}</label><p>Planificado: {assignments.find((item) => item.team_member_id === member.id)?.planned_minutes ?? 0} min · Coste hora: {member.default_hourly_cost == null ? 'sin definir' : `${Number(member.default_hourly_cost).toFixed(2)} €`}</p></div>{selected.includes(member.id) ? <div className="page-header-actions"><label>Horas planificadas<input type="number" min="0.01" step="0.25" value={plannedHours[member.id] ?? ''} onChange={(event) => setPlannedHours({ ...plannedHours, [member.id]: event.target.value })} /></label><label>Registrar horas<input type="number" min="0.01" step="0.25" value={hours[member.id] ?? ''} onChange={(event) => setHours({ ...hours, [member.id]: event.target.value })} /></label><button type="button" className="secondary-button" onClick={() => void recordHours(member.id)} disabled={saving}>Guardar horas</button></div> : null}</article>)}
    {assignments.length === 0 ? <p>Servicio sin equipo asignado.</p> : null}
    {entries.length === 0 ? <p>Servicio sin horas registradas.</p> : null}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
  </section>
}
