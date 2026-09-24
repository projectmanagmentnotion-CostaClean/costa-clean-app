import { useCallback, useEffect, useState } from 'react'
import type { TeamMember } from './teamOperational'
import { listTeamMembers, saveTeamMember } from './teamOperationalApi'

function newMember(): TeamMember {
  return { id: `TEAM-${crypto.randomUUID()}`, full_name: '', status: 'active', default_hourly_cost: null }
}

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [draft, setDraft] = useState<TeamMember | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try { setMembers(await listTeamMembers()); setError(null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el equipo.') }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function save() {
    if (!draft?.full_name.trim()) { setError('El nombre es obligatorio.'); return }
    if (draft.default_hourly_cost != null && draft.default_hourly_cost < 0) { setError('El coste hora no puede ser negativo.'); return }
    setSaving(true)
    try { await saveTeamMember({ ...draft, full_name: draft.full_name.trim() }); setDraft(null); await refresh() } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el miembro.') } finally { setSaving(false) }
  }

  return <section className="data-section" data-qa="team-management"><div className="section-header"><div><h2>Equipo</h2><p>Roster operativo interno y coste hora. No es nómina ni control horario.</p></div><button type="button" className="primary-button" onClick={() => setDraft(newMember())}>Nuevo miembro</button></div>
    {draft ? <div className="lead-form cc-form-shell__grid"><label>Nombre<input autoFocus value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} /></label><label>Coste hora interno<input type="number" min="0" step="0.01" value={draft.default_hourly_cost ?? ''} onChange={(event) => setDraft({ ...draft, default_hourly_cost: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Teléfono<input value={draft.phone ?? ''} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label><label>Estado<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as TeamMember['status'] })}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label><label>Notas<textarea value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label><div className="page-header-actions"><button type="button" className="secondary-button" onClick={() => setDraft(null)} disabled={saving}>Cancelar</button><button type="button" className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar miembro'}</button></div></div> : null}
    {members.length === 0 ? <p>{error ?? 'No hay miembros operativos todavía.'}</p> : <div className="cc-list-section__header">{members.map((member) => <article key={member.id} className="cc-list-section__header"><div><strong>{member.full_name}</strong><p>{member.status === 'active' ? 'Activo' : 'Inactivo'} · Coste hora interno: {member.default_hourly_cost == null ? 'sin definir' : `${Number(member.default_hourly_cost).toFixed(2)} €`}</p></div><button type="button" className="secondary-button" onClick={() => setDraft(member)}>{member.status === 'active' ? 'Editar / desactivar' : 'Editar / reactivar'}</button></article>)}</div>}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
  </section>
}
