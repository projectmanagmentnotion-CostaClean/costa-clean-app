import { useEffect, useId, useState } from 'react'
import type { ClientListItem } from '../../features/clients/types'
import {
  getClientInitials,
  removeClientProfileImage,
  resolveClientProfileImageSignedUrl,
  saveClientProfileImage,
} from '../../features/clients/clientProfileMedia'
import { V3BottomSheet, V3ConfirmSheet, V3Icon, V3SecondaryAction } from '../components/V3Primitives'

export function V3ClientAvatar({ client, size = 'compact' }: { client: Pick<ClientListItem, 'full_name' | 'profile_image_path'>; size?: 'compact' | 'large' }) {
  const imagePath = client.profile_image_path?.trim() || null
  const [imageState, setImageState] = useState<{ path: string | null; url: string | null }>({ path: null, url: null })
  const imageUrl = imageState.path === imagePath ? imageState.url : null

  useEffect(() => {
    let cancelled = false
    void resolveClientProfileImageSignedUrl(client.profile_image_path).then((url) => {
      if (!cancelled) setImageState({ path: imagePath, url })
    })
    return () => { cancelled = true }
  }, [client.profile_image_path, imagePath])

  return <span className={`v3-client-avatar v3-client-avatar--${size}`} aria-hidden="true">
    {imageUrl ? <img src={imageUrl} alt="" onError={() => setImageState({ path: imagePath, url: null })} /> : <span>{getClientInitials(client.full_name)}</span>}
  </span>
}

export function V3ClientProfileMedia({ client, onEdit, onSaved }: { client: ClientListItem; onEdit: () => void; onSaved?: () => Promise<void> }) {
  const inputId = useId()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isRemoveOpen, setIsRemoveOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const hasImage = Boolean(client.profile_image_path)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await saveClientProfileImage({ clientId: client.id, file, existingPath: client.profile_image_path })
      await onSaved?.()
      setMessage(result.cleanupError ? 'Foto actualizada. No se pudo retirar la foto anterior; revisa la limpieza de almacenamiento.' : 'Foto guardada.')
      setIsSheetOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la foto del cliente.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmRemove() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await removeClientProfileImage({ clientId: client.id, existingPath: client.profile_image_path })
      await onSaved?.()
      setMessage(result.cleanupError ? 'Foto eliminada. No se pudo retirar el archivo anterior; revisa la limpieza de almacenamiento.' : 'Foto eliminada.')
      setIsRemoveOpen(false)
      setIsSheetOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la foto del cliente.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <section className="v3-client-profile-media" aria-label={`Identidad de ${client.full_name}`}>
      <button type="button" className="v3-client-avatar-button" onClick={() => setIsSheetOpen(true)} aria-label={`${hasImage ? 'Gestionar' : 'Añadir'} foto de ${client.full_name}`}>
        <V3ClientAvatar client={client} size="large" />
      </button>
      <div className="v3-client-profile-media__identity"><span className="v3-page-title__eyebrow">Ficha de cliente</span><h1>{client.full_name}</h1><p>{client.display_code ?? 'Sin código'} · {client.status === 'inactive' ? 'Inactivo' : 'Activo'}</p></div>
      <div className="v3-client-profile-media__actions"><V3SecondaryAction onClick={onEdit}>Editar</V3SecondaryAction><V3SecondaryAction onClick={() => setIsSheetOpen(true)} ariaLabel={`${hasImage ? 'Cambiar' : 'Añadir'} foto de ${client.full_name}`}><V3Icon name={hasImage ? 'replace' : 'camera'} size={16} /> {hasImage ? 'Cambiar foto' : 'Añadir foto'}</V3SecondaryAction></div>
    </section>
    {message ? <p className="v3-inline-message" role="status">{message}</p> : null}
    {error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}
    {isSheetOpen ? <V3BottomSheet title={`${hasImage ? 'Gestionar' : 'Añadir'} foto de cliente`} closeOnEscape={!busy} onClose={() => { if (!busy) setIsSheetOpen(false) }}>
      <p className="v3-section-copy">La foto se guarda de forma privada y solo se muestra en el CRM interno.</p>
      <div className="v3-workspace-actions">
        <label htmlFor={inputId} className="v3-action v3-action--primary"><V3Icon name={hasImage ? 'replace' : 'camera'} size={16} /> {hasImage ? 'Cambiar foto' : 'Seleccionar foto'}</label>
        <input id={inputId} className="v3-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleFile(event.target.files?.[0])} disabled={busy} aria-label="Seleccionar foto de cliente" />
        {hasImage ? <V3SecondaryAction onClick={() => { setIsRemoveOpen(true); setIsSheetOpen(false) }} disabled={busy} ariaLabel={`Eliminar foto de ${client.full_name}`}><V3Icon name="trash" size={16} /> Eliminar foto</V3SecondaryAction> : null}
      </div>
      {busy ? <p className="v3-inline-message" role="status">Guardando foto…</p> : null}
    </V3BottomSheet> : null}
    {isRemoveOpen ? <V3ConfirmSheet title="Eliminar foto" description="Se quitará la foto del perfil y se eliminará el archivo privado después de actualizar el cliente." confirmLabel="Eliminar foto" busy={busy} onCancel={() => setIsRemoveOpen(false)} onConfirm={() => void confirmRemove()} /> : null}
  </>
}
